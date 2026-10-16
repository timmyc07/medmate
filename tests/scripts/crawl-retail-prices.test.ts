// @vitest-environment node
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Pool, type PoolClient } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { backoffMs, collectProducts, crawlBatch, ensureRound, get, htmlPrice, progress, retryAfterMs, xmlUrls } from "../../scripts/crawl-retail-prices.mjs";

const sources = [
  { id: "00000000-0000-4000-8000-000000000001", name: "Test A", base: "https://a.test", sitemap: "https://a.test/index.xml" },
  { id: "00000000-0000-4000-8000-000000000002", name: "Test B", base: "https://b.test", sitemap: "https://b.test/index.xml" },
];
const product = (source: (typeof sources)[number], id: number) => `${source.base}/SalePage/Index/${id}`;
const xml = (urls: string[], root = "urlset") => `<${root}>${urls.map(url => `<loc>${url}</loc>`).join("")}</${root}>`;
const html = '<title>Test product</title>{"MinPrice":12,"MaxPrice":15}';
const manifest = (countA = 4, countB = 3) => vi.fn(async (url: string) => {
  const index = sources.findIndex(source => source.sitemap === url);
  if (index === -1) throw new Error(`Unexpected manifest: ${url}`);
  return xml(Array.from({ length: index === 0 ? countA : countB }, (_, i) => product(sources[index], i + 1)));
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

  it("支援 namespace、CDATA 與 XML escaping", () => {
    expect(xmlUrls('<sm:loc><![CDATA[https://a.test/a?x=1&y=2]]></sm:loc><loc>https://a.test/b?x=1&amp;y=2</loc>')).toEqual([
      "https://a.test/a?x=1&y=2", "https://a.test/b?x=1&y=2",
    ]);
  });

  it("走完巢狀 sitemap，去除重複 URL 與循環", async () => {
    const source = sources[0];
    const documents: Record<string, string> = {
      [source.sitemap]: xml(["https://a.test/child.xml", "https://a.test/products.xml", source.sitemap], "sitemapindex"),
      "https://a.test/child.xml": xml(["https://a.test/products.xml", "https://a.test/last.xml"], "sitemapindex"),
      "https://a.test/products.xml": xml([product(source, 1), product(source, 2), "https://a.test/category"]),
      "https://a.test/last.xml": xml([product(source, 2), "https://a.test/salepage/index/2/?tracking=1", product(source, 3)]),
    };
    const read = vi.fn(async (url: string) => documents[url]);
    expect(await collectProducts(source, read)).toEqual([1, 2, 3].map(id => product(source, id)));
    expect(read).toHaveBeenCalledTimes(4);
  });

  it("拒絕失效、空白及跨網域清單", async () => {
    for (const document of ["<html>blocked</html>", "<urlset></urlset>", xml(["https://other.test/SalePage/Index/1"])]) {
      await expect(collectProducts(sources[0], async () => document)).rejects.toThrow();
    }
  });

  it("沒有價格、零價或超出資料庫範圍的價格不視為成功", () => {
    expect(htmlPrice(html, product(sources[0], 1))).toMatchObject({ salePrice: 12, listedPrice: 15 });
    expect(htmlPrice("<html>loading</html>", product(sources[0], 1))).toBeNull();
    for (const price of [0, 0.001, 10_000_000_000]) {
      expect(htmlPrice(JSON.stringify({ Price: price }), product(sources[0], 1))).toBeNull();
    }
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
      await connection.query("CREATE TABLE medicines (license_number text PRIMARY KEY)");
      for (const name of ["008_retail_price_observations.sql", "009_retail_crawl_state.sql", "010_retail_crawl_queue.sql", "011_retail_crawl_backoff.sql"]) {
        await connection.query(await readFile(new URL(`../../db/migrations/${name}`, import.meta.url), "utf8"));
      }
    } finally { connection.release(); }
  }, 30000);

  beforeEach(async () => {
    client = await connect();
    await client.query("DELETE FROM retail_crawl_queue");
    await client.query("DELETE FROM medicine_price_observations");
    await client.query("UPDATE medicine_price_sources SET crawl_not_before=NULL");
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
    const read = vi.fn(async (_url: string) => html);
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
    await crawlBatch(client, { roundId: nextRound, sources, limit: 1, read: async () => html.replace("12", "13") });
    expect((await client.query("SELECT sale_price FROM medicine_price_observations WHERE source_id=$1 AND external_product_id='1'", [sources[0].id])).rows[0].sale_price).toBe("13.00");
  }, 30000);

  it("解析失敗保留重試；404/410 記錄下架；單批每個 URL 最多嘗試一次", async () => {
    const roundId = await ensureRound(client, sources, manifest(3, 3));
    const read = vi.fn(async (url: string) => {
      if (url === product(sources[0], 1)) return "<html>loading</html>";
      if (url === product(sources[0], 2)) return "<html>loading</html>";
      if (url === product(sources[1], 1)) throw Object.assign(new Error("HTTP 404"), { status: 404 });
      if (url === product(sources[1], 2)) throw Object.assign(new Error("HTTP 410"), { status: 410 });
      return html;
    });
    expect(await crawlBatch(client, { roundId, sources, limit: 100, read })).toEqual({ attempted: 6, observations: 2, unavailable: 2, failed: 2 });
    expect(read).toHaveBeenCalledTimes(6);
    expect(await ensureRound(client, sources, manifest())).toBe(roundId);
    const retry = vi.fn(async (_url: string) => html);
    expect(await crawlBatch(client, { roundId, sources, read: retry })).toMatchObject({ attempted: 2, observations: 2 });
    expect(new Set(retry.mock.calls.map(args => args[0]))).toEqual(new Set([product(sources[0], 1), product(sources[0], 2)]));
    const rows = (await client.query("SELECT product_url,status,attempts FROM retail_crawl_queue ORDER BY source_id,product_index")).rows;
    expect(rows.filter(row => row.attempts === 2)).toHaveLength(2);
    expect(rows.filter(row => row.status === "pending")).toHaveLength(0);
  }, 30000);

  it.each([429, 503, 403])("HTTP %s 停止該來源，跨批次保留冷卻；其他來源照常接續", async (status) => {
    const roundId = await ensureRound(client, sources, manifest(3, 2));
    const read = vi.fn(async (url: string) => {
      if (url.startsWith(sources[0].base)) throw Object.assign(new Error(`HTTP ${status}`), { status, retryAfterMs: 7200000 });
      return html;
    });
    expect(await crawlBatch(client, { roundId, sources, read })).toMatchObject({ attempted: 3, observations: 2, failed: 1 });
    expect(read.mock.calls.filter(([url]) => url.startsWith(sources[0].base))).toHaveLength(1);
    const remaining = (await client.query("SELECT extract(epoch FROM crawl_not_before-now())::float8 AS seconds FROM medicine_price_sources WHERE source_id=$1", [sources[0].id])).rows[0].seconds;
    expect(remaining).toBeGreaterThan((status === 403 ? 86400 : 7200) - 20);
    const nextRead = vi.fn(async (_url: string) => html);
    expect(await crawlBatch(client, { roundId, sources, read: nextRead })).toMatchObject({ attempted: 0 });
    expect(nextRead).not.toHaveBeenCalled();
    await client.query("UPDATE medicine_price_sources SET crawl_not_before=now()-interval '1 second'");
    expect(await crawlBatch(client, { roundId, sources, read: nextRead })).toMatchObject({ attempted: 3, observations: 3 });
    expect(nextRead.mock.calls.map(([url]) => url)).toEqual([product(sources[0], 2), product(sources[0], 3), product(sources[0], 1)]);
  }, 30000);

  it("連續三筆解析失敗後暫停來源，避免整批請求失效頁面", async () => {
    const roundId = await ensureRound(client, sources, manifest(5, 1));
    const read = vi.fn(async (url: string) => url.startsWith(sources[0].base) ? "<html>loading</html>" : html);
    expect(await crawlBatch(client, { roundId, sources, read })).toMatchObject({ attempted: 4, failed: 3, observations: 1 });
    expect(read).toHaveBeenCalledTimes(4);
    expect((await client.query("SELECT count(*)::int AS count FROM retail_crawl_queue WHERE source_id=$1 AND attempts=0", [sources[0].id])).rows[0].count).toBe(2);
  }, 30000);

  it("sitemap 限流也保留來源冷卻，下一次不提早重試", async () => {
    const roundId = await ensureRound(client, sources, manifest(1, 1));
    await crawlBatch(client, { roundId, sources, read: async () => html });
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
    await crawlBatch(client, { roundId, sources, limit: 1, read: async () => html });
    const changed = vi.fn(async () => xml([product(sources[0], 99)]));
    expect(await ensureRound(client, sources, changed)).toBe(roundId);
    expect(changed).not.toHaveBeenCalled();
    const read = vi.fn(async (_url: string) => html);
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
      await expect(crawlBatch(client, { roundId, sources: [sources[0]], read: async () => html })).rejects.toThrow("checkpoint failed");
      const rows = (await client.query("SELECT status,attempts FROM retail_crawl_queue WHERE source_id=$1 ORDER BY product_index", [sources[0].id])).rows;
      expect(rows).toEqual([{ status: "succeeded", attempts: 1 }, { status: "pending", attempts: 0 }]);
      expect((await client.query("SELECT count(*)::int AS count FROM medicine_price_observations")).rows[0].count).toBe(1);
    } finally {
      await client.query("DROP TRIGGER fail_checkpoint ON retail_crawl_queue");
      await client.query("DROP FUNCTION fail_checkpoint()");
    }
    const read = vi.fn(async (_url: string) => html);
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
    const firstRead = vi.fn(async (_url: string) => { markStarted(); await gate; return html; });
    const firstRun = crawlBatch(client, { roundId, sources: [sources[0]], limit: 1, read: firstRead });
    await started;
    try {
      const secondRead = vi.fn(async (_url: string) => html);
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
    const read = vi.fn(async (_url: string) => html);
    expect(await crawlBatch(client, { roundId, sources, read, deadline: Date.now() - 1 })).toMatchObject({ attempted: 0 });
    expect(read).not.toHaveBeenCalled();
    expect((await progress(client)).map((row: {pending: number}) => row.pending)).toEqual([1, 1]);
  });
});
