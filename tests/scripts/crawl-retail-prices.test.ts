// @vitest-environment node
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Pool, type PoolClient } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { backoffMs, collectProducts, crawlBatch, ensureRound, get, progress, retryAfterMs } from "../../scripts/crawl-retail-prices.mjs";
import { retailHtml as html, retailLicense } from "../fixtures/retail-product";
import { searchMedicines } from "../../src/lib/db/medicines";
import { refreshRetailLicenses } from "../../scripts/refresh-retail-licenses.mjs";
import { strToU8, zipSync } from "fflate";
import { cyberbizFixture, cyberbizSource, cyberbizUrl } from "../fixtures/cyberbiz-product";

const query = vi.fn();
vi.mock("../../src/lib/db/pool", () => ({ getPool: () => ({ query }) }));

const sources = [
  { id: "00000000-0000-4000-8000-000000000001", name: "Test A", base: "https://a.test", shopId: 41218, categoryId: 410434, catalog: "https://a.test/medicines", productIds: [1,2,3,4] },
  { id: "00000000-0000-4000-8000-000000000002", name: "Test B", base: "https://b.test", shopId: 41218, categoryId: 410434, catalog: "https://b.test/medicines", productIds: [1,2,3] },
];
const product = (source: (typeof sources)[number], id: number) => `${source.base}/SalePage/Index/${id}`;
const manifest = (countA = 4, countB = 3) => vi.fn(async (source: (typeof sources)[number]) => {
  const index = sources.findIndex(candidate => candidate.id === source.id);
  if (index === -1) throw new Error("Unexpected source");
  return Array.from({ length: index === 0 ? countA : countB }, (_, i) => product(source, i + 1));
});

afterEach(() => vi.restoreAllMocks());

describe("商品清單與價格解析", () => {
  it("解析 Retry-After 秒數與 HTTP 日期，限流及逾時採用較長冷卻", () => {
    const now = Date.parse("2026-10-16T00:00:00Z");
    expect(retryAfterMs("120", now)).toBe(120000);
    expect(retryAfterMs("Fri, 16 Oct 2026 02:00:00 GMT", now)).toBe(7200000);
    for (const value of [null, "invalid", "0", "9".repeat(400)]) expect(retryAfterMs(value, now)).toBe(0);
    expect(backoffMs({ status: 429, retryAfterMs: 7200000 })).toBe(7200000);
    expect(backoffMs({ status: 503 })).toBe(1800000);
    expect(backoffMs({ name: "TimeoutError" })).toBe(1800000);
    expect(backoffMs({ status: 403 })).toBe(86400000);
    expect(backoffMs({ status: 404 })).toBe(0);
  });

  it("加快排程仍保留 2.5 秒請求間隔，並帶回 Retry-After", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-16T00:00:00Z"));
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response("ok"))
      .mockResolvedValueOnce(new Response("busy", { status: 429, headers: { "Retry-After": "7200" } }));
    vi.stubGlobal("fetch", fetcher);
    try {
      const first = get("https://a.test/one");
      await vi.runAllTimersAsync();
      expect(await first).toBe("ok");
      const second = get("https://a.test/two").catch(error => error);
      await vi.advanceTimersByTimeAsync(2499);
      expect(fetcher).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);
      expect(await second).toMatchObject({ status: 429, retryAfterMs: 7200000 });
      expect(fetcher).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
      vi.unstubAllGlobals();
    }
  });

  it("只使用藥品限定 ID 清單，不再掃描商城 sitemap", async () => {
    expect(await collectProducts({ ...sources[0], productIds: [1,2,2] })).toEqual([1,2].map(id => product(sources[0], id)));
    for (const ids of [[], [0], [NaN]]) await expect(collectProducts({ ...sources[0], productIds: ids })).rejects.toThrow();
  });
});

// Each run owns a temporary schema; never clear the real crawl queue.
describe.skipIf(!process.env.DATABASE_URL_UNPOOLED)("Postgres 爬取進度整合測試", () => {
  const schema = `crawler_test_${randomUUID().replaceAll("-", "")}`;
  let pool: Pool;
  let client: PoolClient;
  const connect = async () => {
    const connection = await pool.connect();
    await connection.query(`SET search_path TO "${schema}"`);
    return connection;
  };

  beforeAll(async () => {
    pool = new Pool({ connectionString: process.env.DATABASE_URL_UNPOOLED, max: 4, connectionTimeoutMillis: 10000 });
    const connection = await pool.connect();
    try {
      await connection.query(`CREATE SCHEMA "${schema}"`);
      await connection.query(`SET search_path TO "${schema}"`);
      for (const name of ["001_catalog.sql", "002_medicine_usage.sql", "005_medicine_information.sql", "007_medicine_prices.sql", "008_retail_price_observations.sql", "009_retail_crawl_state.sql", "010_retail_crawl_queue.sql", "011_retail_crawl_backoff.sql", "012_verified_retail_prices.sql"]) {
        await connection.query(await readFile(new URL(`../../db/migrations/${name}`, import.meta.url), "utf8"));
      }
      await connection.query("INSERT INTO medicines(license_number,name,valid_until,source_updated_at) VALUES($1,'虎標萬金油','2099-01-01',now())", [retailLicense]);
      await connection.query("INSERT INTO medicine_retail_license_verifications VALUES($1,'乙類成藥','玻璃瓶裝','2099-01-01',false,now(),$2)", [retailLicense, "a".repeat(64)]);
    } finally { connection.release(); }
  }, 30000);

  beforeEach(async () => {
    client = await connect();
    query.mockImplementation((sql, values) => client.query(sql, values));
    await client.query("DELETE FROM retail_crawl_queue");
    await client.query("DELETE FROM medicine_price_observations");
    await client.query("DELETE FROM source_imports");
    await client.query("DELETE FROM medicine_prices");
    await client.query("UPDATE medicine_price_sources SET crawl_not_before=NULL");
    await client.query("UPDATE medicine_retail_license_verifications SET drug_category='乙類成藥',cancelled=false,valid_until='2099-01-01',verified_at=now()");
    await client.query("UPDATE medicine_retail_license_verifications SET source_sha256=repeat('a',64)");
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => client?.release());
  afterAll(async () => {
    try { await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`); }
    finally { await pool.end(); }
  });

  it("逐批輪流處理兩個來源，重啟後無漏抓、無重複，完成才建立下一輪", async () => {
    const readManifest = manifest();
    const roundId = await ensureRound(client, sources, readManifest);
    const read = vi.fn(async (url: string) => html(url));
    for (let batch = 0; batch < 3; batch += 1) {
      expect(await ensureRound(client, sources, readManifest)).toBe(roundId);
      await crawlBatch(client, { roundId, sources, limit: 3, read });
    }
    const visited = read.mock.calls.map(args => args[0]);
    expect(visited.slice(0, 3)).toEqual([product(sources[0], 1), product(sources[1], 1), product(sources[0], 2)]);
    expect(visited).toHaveLength(7);
    expect(new Set(visited).size).toBe(7);
    expect(readManifest).toHaveBeenCalledTimes(2);
    expect((await progress(client)).map((row: {pending: number}) => row.pending)).toEqual([0, 0]);
    expect((await client.query("SELECT count(*)::int AS count FROM medicine_price_observations")).rows[0].count).toBe(7);
    const nextRound = await ensureRound(client, sources, manifest(5, 3));
    expect(nextRound).not.toBe(roundId);
    expect((await client.query("SELECT count(*)::int AS count FROM retail_crawl_queue WHERE status='pending'")).rows[0].count).toBe(8);
    await crawlBatch(client, { roundId: nextRound, sources, limit: 1, read: async (url: string) => html(url, 13) });
    expect((await client.query("SELECT sale_price FROM medicine_price_observations WHERE source_id=$1 AND external_product_id='1:1001'", [sources[0].id])).rows[0].sale_price).toBe("13.00");
  }, 30000);

  it("解析失敗保留重試；404/410 記錄下架；單批每個 URL 最多嘗試一次", async () => {
    const roundId = await ensureRound(client, sources, manifest(3, 3));
    const read = vi.fn(async (url: string) => {
      if (url === product(sources[0], 1)) return "<html>loading</html>";
      if (url === product(sources[0], 2)) return "<html>loading</html>";
      if (url === product(sources[1], 1)) throw Object.assign(new Error("HTTP 404"), { status: 404 });
      if (url === product(sources[1], 2)) throw Object.assign(new Error("HTTP 410"), { status: 410 });
      return html(url);
    });
    expect(await crawlBatch(client, { roundId, sources, limit: 100, read })).toEqual({ attempted: 6, observations: 2, unavailable: 2, excluded: 0, failed: 2 });
    expect(read).toHaveBeenCalledTimes(6);
    expect(await ensureRound(client, sources, manifest())).toBe(roundId);
    const retry = vi.fn(async (url: string) => html(url));
    expect(await crawlBatch(client, { roundId, sources, read: retry })).toMatchObject({ attempted: 2, observations: 2 });
    expect(new Set(retry.mock.calls.map(args => args[0]))).toEqual(new Set([product(sources[0], 1), product(sources[0], 2)]));
    const rows = (await client.query("SELECT product_url,status,attempts FROM retail_crawl_queue ORDER BY source_id,product_index")).rows;
    expect(rows.filter(row => row.attempts === 2)).toHaveLength(2);
    expect(rows.filter(row => row.status === "pending")).toHaveLength(0);
  }, 30000);

  it("無關商品與歧義規格明確排除，不保存價格、不無限重試", async () => {
    const roundId = await ensureRound(client, sources, manifest(1, 1));
    const result = await crawlBatch(client, { roundId, sources, read: async (url: string) => html(url, 12, { CategoryId: 1, Title: "書籍" }) });
    expect(result).toMatchObject({ attempted: 2, excluded: 2, observations: 0, failed: 0 });
    expect((await client.query("SELECT count(*)::int AS count FROM medicine_price_observations")).rows[0].count).toBe(0);
  });

  it.each(["cancelled=true", "valid_until='2000-01-01'", "verified_at=now()-interval '8 days'", "drug_category='處方藥'"])("官方藥證 %s 不可核准價格", async (change) => {
    const roundId = await ensureRound(client, sources, manifest(1, 1));
    await client.query(`UPDATE medicine_retail_license_verifications SET ${change}`);
    expect(await crawlBatch(client, { roundId, sources, read: async (url: string) => html(url) })).toMatchObject({ excluded: 2, observations: 0 });
    expect((await client.query("SELECT count(*)::int AS count FROM medicine_price_matches")).rows[0].count).toBe(0);
  });

  it("價格、規格、官方 hash 與自動核實證據同時提交", async () => {
    const roundId = await ensureRound(client, sources, manifest(1, 1));
    await crawlBatch(client, { roundId, sources, limit: 1, read: async (url: string) => html(url) });
    const rows = (await client.query("SELECT o.specification_raw,o.sku_id,m.status,m.specification,m.license_source_sha256,m.evidence FROM medicine_price_observations o JOIN medicine_price_matches m USING(observation_id)")).rows;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ specification_raw: "19g/罐", sku_id: "1001", status: "approved", specification: "19g/罐", license_source_sha256: "a".repeat(64), evidence: { licenseNumber: retailLicense, price: 12, skuId: "1001" } });
  });

  it("新增 Cyberbiz 通路沿用同一交易與搜尋核實條件，原通路不受影響", async () => {
    const allSources = [...sources, cyberbizSource];
    const roundId = await ensureRound(client, allSources);
    const fixture = cyberbizFixture();
    const read = async (url: string) => url.startsWith(cyberbizSource.base) ? url.endsWith(".json") ? JSON.stringify(fixture.model) : fixture.html : html(url);
    expect(await crawlBatch(client, { roundId, sources: allSources, limit: 3, read })).toMatchObject({ observations: 3, failed: 0 });
    const item = (await searchMedicines({ keyword: "虎標", page: 1, pageSize: 10 })).items[0];
    expect(item.retailPrices).toHaveLength(3);
    expect(item.retailPrices).toContainEqual(expect.objectContaining({ amount: 80, specification: "500mL", sourceName: cyberbizSource.name, sourceUrl: cyberbizUrl }));
    expect((await client.query("SELECT parser_version FROM medicine_price_observations WHERE source_id=$1", [cyberbizSource.id])).rows[0].parser_version).toBe("cyberbiz-exact-sku-v1");
  });

  it("公開 SKU JSON 取得失敗時不寫入價格，遵守來源冷卻且原通路繼續", async () => {
    const allSources = [...sources, cyberbizSource];
    const roundId = await ensureRound(client, allSources);
    const fixture = cyberbizFixture();
    const read = vi.fn(async (url: string) => {
      if (url.endsWith(".json")) throw Object.assign(new Error("HTTP 429"), { status: 429 });
      return url.startsWith(cyberbizSource.base) ? fixture.html : html(url);
    });
    expect(await crawlBatch(client, { roundId, sources: allSources, read })).toMatchObject({ observations: 7, failed: 1 });
    expect((await client.query("SELECT count(*)::int AS count FROM medicine_price_observations WHERE source_id=$1", [cyberbizSource.id])).rows[0].count).toBe(0);
    expect((await client.query("SELECT status,last_error FROM retail_crawl_queue WHERE source_id=$1", [cyberbizSource.id])).rows[0]).toEqual({ status: "pending", last_error: "HTTP 429" });
    expect((await client.query("SELECT crawl_not_before>now() AS paused FROM medicine_price_sources WHERE source_id=$1", [cyberbizSource.id])).rows[0].paused).toBe(true);
  });

  it("搜尋端只回傳最新核實售價，不混合 19g 與 30g 包裝", async () => {
    const roundId = await ensureRound(client, sources, manifest(1, 1));
    await crawlBatch(client, { roundId, sources, read: async (url: string) => html(url, url.startsWith(sources[0].base) ? 109 : 168, { Title: `虎標萬金油 (${url.startsWith(sources[0].base) ? 19 : 30}g/罐)｜乙類成藥` }) });
    await client.query("INSERT INTO medicine_prices(drug_code,license_number,drug_name,price,effective_from,source_url,source_sha256,source_updated_at) VALUES('TEST',$1,'虎標萬金油',12.5,'2020-01-01','https://info.nhi.gov.tw/',repeat('a',64),now())", [retailLicense]);
    const result = await searchMedicines({ keyword: "虎標", page: 1, pageSize: 10 });
    expect(result.items[0].retailPrices).toEqual([
      expect.objectContaining({ amount: 109, specification: "19g/罐", sourceName: "Test A", sourceUrl: product(sources[0], 1), capturedAt: expect.any(String) }),
      expect.objectContaining({ amount: 168, specification: "30g/罐", sourceName: "Test B" }),
    ]);
    expect(result.items[0].price).toEqual([expect.objectContaining({ amount: 12.5, type: "nhi-reimbursement" })]);
  });

  it("官方快照驗證失敗不覆寫，成功才原子更新；新近快照不重複下載", async () => {
    await expect(refreshRetailLicenses(client, async () => new Response("bad zip"))).rejects.toThrow();
    expect((await client.query("SELECT source_sha256 FROM medicine_retail_license_verifications")).rows[0].source_sha256).toBe("a".repeat(64));
    const csv = "許可證字號,藥品類別,包裝,有效日期,註銷狀態\n" +
      Array.from({ length: 999 }, (_, i) => `衛署成製字第${String(i).padStart(6, "0")}號,乙類成藥,玻璃瓶裝,2099/01/01,`).join("\n") +
      `\n${retailLicense},乙類成藥,玻璃瓶裝,2099/01/01,`;
    const bytes = zipSync({ "36_2.csv": strToU8(csv) });
    await refreshRetailLicenses(client, async () => new Response(bytes));
    const imported = (await client.query("SELECT v.source_sha256,i.row_count FROM medicine_retail_license_verifications v JOIN source_imports i ON i.source_sha256=v.source_sha256")).rows;
    expect(imported).toHaveLength(1);
    expect(imported[0]).toMatchObject({ row_count: 1000, source_sha256: expect.stringMatching(/^[a-f0-9]{64}$/) });
    const read = vi.fn();
    await refreshRetailLicenses(client, read);
    expect(read).not.toHaveBeenCalled();
  });

  it.each([
    "UPDATE medicine_price_observations SET captured_at=now()-interval '8 days'",
    "UPDATE medicine_price_observations SET captured_at=now()+interval '1 day'",
    "UPDATE medicine_price_matches SET status='rejected'",
    "UPDATE medicine_price_matches SET specification='30g/罐'",
    "UPDATE medicine_price_matches SET evidence=jsonb_set(evidence,'{price}','999'::jsonb)",
    "UPDATE medicine_retail_license_verifications SET source_sha256=repeat('b',64)",
    "UPDATE medicine_retail_license_verifications SET verified_at=now()-interval '8 days'",
    "UPDATE medicine_retail_license_verifications SET cancelled=true",
    "UPDATE retail_crawl_queue SET status='unavailable'",
    "UPDATE retail_crawl_queue SET status='excluded'",
    "UPDATE medicine_price_sources SET active=false",
  ])("搜尋端隱藏失效或證據不一致的報價：%s", async (change) => {
    const roundId = await ensureRound(client, sources, manifest(1, 1));
    await crawlBatch(client, { roundId, sources, read: async (url: string) => html(url) });
    await client.query(change);
    expect((await searchMedicines({ keyword: "虎標", page: 1, pageSize: 10 })).items[0].retailPrices).toEqual([]);
  });

  it("同商品更換 SKU 後新觀測未核准，不回退顯示舊 SKU 核准價", async () => {
    const roundId = await ensureRound(client, sources, manifest(1, 1));
    await crawlBatch(client, { roundId, sources, limit: 1, read: async (url: string) => html(url) });
    await client.query("INSERT INTO medicine_price_observations(observation_id,source_id,external_product_id,product_name,specification_raw,sale_price,captured_at,captured_date,product_url,raw_payload_hash,parser_version) SELECT gen_random_uuid(),source_id,external_product_id||':changed-sku',product_name,specification_raw,99,clock_timestamp(),captured_date+1,product_url,raw_payload_hash,parser_version FROM medicine_price_observations");
    expect((await searchMedicines({ keyword: "虎標", page: 1, pageSize: 10 })).items[0].retailPrices).toEqual([]);
  });

  it.each([429, 503, 403])("HTTP %s 停止該來源，跨批次保留冷卻；其他來源照常接續", async (status) => {
    const roundId = await ensureRound(client, sources, manifest(3, 2));
    const read = vi.fn(async (url: string) => {
      if (url.startsWith(sources[0].base)) throw Object.assign(new Error(`HTTP ${status}`), { status, retryAfterMs: 7200000 });
      return html(url);
    });
    expect(await crawlBatch(client, { roundId, sources, read })).toMatchObject({ attempted: 3, observations: 2, failed: 1 });
    expect(read.mock.calls.filter(([url]) => url.startsWith(sources[0].base))).toHaveLength(1);
    const remaining = (await client.query("SELECT extract(epoch FROM crawl_not_before-now())::float8 AS seconds FROM medicine_price_sources WHERE source_id=$1", [sources[0].id])).rows[0].seconds;
    expect(remaining).toBeGreaterThan((status === 403 ? 86400 : 7200) - 20);
    const nextRead = vi.fn(async (url: string) => html(url));
    expect(await crawlBatch(client, { roundId, sources, read: nextRead })).toMatchObject({ attempted: 0 });
    expect(nextRead).not.toHaveBeenCalled();
    await client.query("UPDATE medicine_price_sources SET crawl_not_before=now()-interval '1 second'");
    expect(await crawlBatch(client, { roundId, sources, read: nextRead })).toMatchObject({ attempted: 3, observations: 3 });
    expect(nextRead.mock.calls.map(([url]) => url)).toEqual([product(sources[0], 2), product(sources[0], 3), product(sources[0], 1)]);
  }, 30000);

  it("連續三筆解析失敗後暫停來源，避免整批請求失效頁面", async () => {
    const roundId = await ensureRound(client, sources, manifest(5, 1));
    const read = vi.fn(async (url: string) => url.startsWith(sources[0].base) ? "<html>loading</html>" : html(url));
    expect(await crawlBatch(client, { roundId, sources, read })).toMatchObject({ attempted: 4, failed: 3, observations: 1 });
    expect(read).toHaveBeenCalledTimes(4);
    expect((await client.query("SELECT count(*)::int AS count FROM retail_crawl_queue WHERE source_id=$1 AND attempts=0", [sources[0].id])).rows[0].count).toBe(2);
  }, 30000);

  it("sitemap 限流也保留來源冷卻，下一次不提早重試", async () => {
    const roundId = await ensureRound(client, sources, manifest(1, 1));
    await crawlBatch(client, { roundId, sources, read: async (url: string) => html(url) });
    const read = vi.fn(async () => { throw Object.assign(new Error("HTTP 429"), { status: 429, retryAfterMs: 7200000 }); });
    await expect(ensureRound(client, sources, read)).rejects.toThrow("HTTP 429");
    expect(read).toHaveBeenCalledTimes(1);
    const next = manifest();
    await expect(ensureRound(client, sources, next)).rejects.toThrow("暫停至");
    expect(next).not.toHaveBeenCalled();
    expect((await client.query("SELECT count(*)::int AS count FROM retail_crawl_queue")).rows[0].count).toBe(2);
  }, 30000);

  it("未完成一輪時不受 sitemap 插入、刪除或重排影響", async () => {
    const roundId = await ensureRound(client, sources, manifest(2, 1));
    await crawlBatch(client, { roundId, sources, limit: 1, read: async (url: string) => html(url) });
    const changed = vi.fn(async () => [product(sources[0], 99)]);
    expect(await ensureRound(client, sources, changed)).toBe(roundId);
    expect(changed).not.toHaveBeenCalled();
    const read = vi.fn(async (url: string) => html(url));
    await crawlBatch(client, { roundId, sources, read });
    expect(new Set(read.mock.calls.map(args => args[0]))).toEqual(new Set([product(sources[0], 2), product(sources[1], 1)]));
    await expect(ensureRound(client, sources, async () => { throw new Error("sitemap offline"); })).rejects.toThrow("sitemap offline");
    expect((await client.query("SELECT count(*)::int AS count FROM retail_crawl_queue")).rows[0].count).toBe(3);
  }, 30000);

  it("寫入失敗只回滾當筆；之前的進度保留，下次接續", async () => {
    const roundId = await ensureRound(client, sources, manifest(2, 1));
    await client.query("CREATE FUNCTION fail_checkpoint() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.product_url LIKE '%/2' THEN RAISE EXCEPTION 'checkpoint failed'; END IF; RETURN NEW; END $$");
    await client.query("CREATE TRIGGER fail_checkpoint BEFORE UPDATE ON retail_crawl_queue FOR EACH ROW EXECUTE FUNCTION fail_checkpoint()");
    try {
      await expect(crawlBatch(client, { roundId, sources: [sources[0]], read: async (url: string) => html(url) })).rejects.toThrow("checkpoint failed");
      const rows = (await client.query("SELECT status,attempts FROM retail_crawl_queue WHERE source_id=$1 ORDER BY product_index", [sources[0].id])).rows;
      expect(rows).toEqual([{ status: "succeeded", attempts: 1 }, { status: "pending", attempts: 0 }]);
      expect((await client.query("SELECT count(*)::int AS count FROM medicine_price_observations")).rows[0].count).toBe(1);
    } finally {
      await client.query("DROP TRIGGER fail_checkpoint ON retail_crawl_queue");
      await client.query("DROP FUNCTION fail_checkpoint()");
    }
    const read = vi.fn(async (url: string) => html(url));
    await crawlBatch(client, { roundId, sources, read });
    expect(new Set(read.mock.calls.map(args => args[0]))).toEqual(new Set([product(sources[0], 2), product(sources[1], 1)]));
  }, 30000);

  it("並行工作使用 row lock，不會抓同一筆", async () => {
    const roundId = await ensureRound(client, sources, manifest(2, 1));
    const second = await connect();
    let releaseRead: () => void = () => {};
    let markStarted: () => void = () => {};
    const started = new Promise<void>(resolve => { markStarted = resolve; });
    const gate = new Promise<void>(resolve => { releaseRead = resolve; });
    const firstRead = vi.fn(async (url: string) => { markStarted(); await gate; return html(url); });
    const firstRun = crawlBatch(client, { roundId, sources: [sources[0]], limit: 1, read: firstRead });
    await started;
    try {
      const secondRead = vi.fn(async (url: string) => html(url));
      await crawlBatch(second, { roundId, sources: [sources[0]], limit: 1, read: secondRead });
      expect(secondRead).toHaveBeenCalledWith(product(sources[0], 2));
    } finally {
      releaseRead();
      await firstRun;
      second.release();
    }
    expect(firstRead).toHaveBeenCalledWith(product(sources[0], 1));
    expect((await client.query("SELECT attempts FROM retail_crawl_queue WHERE source_id=$1", [sources[0].id])).rows.map(row => row.attempts)).toEqual([1, 1]);
  }, 30000);

  it("兩個工作同時初始化只建立一份清單", async () => {
    const second = await connect();
    const read = manifest(2, 1);
    try {
      const rounds = await Promise.all([ensureRound(client, sources, read), ensureRound(second, sources, read)]);
      expect(rounds[0]).toBe(rounds[1]);
      expect(read).toHaveBeenCalledTimes(2);
    } finally { second.release(); }
  }, 30000);

  it("到達執行時間上限時不推進尚未處理的商品", async () => {
    const roundId = await ensureRound(client, sources, manifest(1, 1));
    const read = vi.fn(async (url: string) => html(url));
    expect(await crawlBatch(client, { roundId, sources, read, deadline: Date.now() - 1 })).toMatchObject({ attempted: 0 });
    expect(read).not.toHaveBeenCalled();
    expect((await progress(client)).map((row: {pending: number}) => row.pending)).toEqual([1, 1]);
  });
});
