import { createHash, randomUUID } from "node:crypto";
import { parseArgs } from "node:util";
import { pathToFileURL } from "node:url";
import { Pool } from "pg";
import { parseRetailProduct } from "./retail-price-verification.mjs";
import { refreshRetailLicenses } from "./refresh-retail-licenses.mjs";

export const SOURCES = [
  {
    id: "fc160e83-8127-4a53-9344-7116cdad0071", name: "杏一健康生活館｜乙類成藥", base: "https://www.medfirst.com.tw", shopId: 41218, categoryId: 410434,
    catalog: "https://www.medfirst.com.tw/v2/official/SalePageCategory/410434",
    // 限定已核對專區的商品；新增品項先審查來源，不自動納入全商城推薦商品。
    productIds: [10792109,10792107,10792105,10617941,10613828,10613827,10613807,10610545,10517760,10517631,10415240,10415220,10275408,10223532,10223530,10223526,9957785,9957742,8493827,7559100,7559083,7554845],
  },
];
const USER_AGENT = "MediMatePublicPriceBot/1.0 (+https://medmate-53s1.onrender.com/medicines)";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let lastRequestAt = 0;

export function retryAfterMs(value, now = Date.now()) {
  const text = value?.trim() || "";
  const until = /^\d+$/.test(text) ? now + Number(text) * 1000 : Date.parse(text);
  return Number.isFinite(new Date(until).getTime()) ? Math.max(0, until - now) : 0;
}

export function backoffMs(error) {
  let minimum = 0;
  if (error.status === 403) minimum = 24 * 60 * 60_000;
  else if (error.status === 429 || error.status >= 500 || ["TimeoutError", "AbortError", "TypeError"].includes(error.name)) minimum = 30 * 60_000;
  return Math.max(minimum, error.retryAfterMs || 0);
}

async function pauseSource(client, sourceId, delay) {
  await client.query("UPDATE medicine_price_sources SET crawl_not_before=GREATEST(COALESCE(crawl_not_before,now()),clock_timestamp()+$2*interval '1 millisecond') WHERE source_id=$1", [sourceId, delay]);
}

export async function get(url) {
  await sleep(Math.max(0, 2500 - (Date.now() - lastRequestAt)));
  lastRequestAt = Date.now();
  const response = await fetch(url, {
    headers: { "user-agent": USER_AGENT, accept: "text/html" },
    redirect: "error",
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw Object.assign(new Error(`HTTP ${response.status} ${url}`), { status: response.status, retryAfterMs: retryAfterMs(response.headers.get("retry-after")) });
  return response.text();
}

export async function collectProducts(source) {
  if (!source.productIds?.length || source.productIds.some(id => !Number.isSafeInteger(id) || id <= 0)) throw new Error("藥品來源清單無效");
  return [...new Set(source.productIds)].map(id => `${source.base}/SalePage/Index/${id}`);
}

export async function ensureRound(client, sources = SOURCES, collect = collectProducts) {
  let fetchingSource;
  await client.query("BEGIN");
  try {
    // Serialize manifest replacement; product workers use row locks instead.
    await client.query("SELECT pg_advisory_xact_lock('retail_crawl_queue'::regclass::oid::bigint)");
    const pending = await client.query("SELECT q.round_id FROM retail_crawl_queue q JOIN medicine_price_sources s USING(source_id) WHERE q.status='pending' AND s.active AND q.source_id=ANY($1::uuid[]) LIMIT 1", [sources.map(source => source.id)]);
    if (pending.rowCount) {
      await client.query("COMMIT");
      return pending.rows[0].round_id;
    }
    const manifests = [];
    for (const source of sources) {
      const paused = await client.query("SELECT crawl_not_before FROM medicine_price_sources WHERE source_id=$1 AND crawl_not_before>now()", [source.id]);
      if (paused.rowCount) throw new Error(`${source.name} 暫停至 ${paused.rows[0].crawl_not_before.toISOString()}`);
      fetchingSource = source;
      const urls = await collect(source);
      if (!urls.length || urls.some(url => new URL(url).origin !== source.base)) throw new Error("藥品清單為空或包含其他網域");
      manifests.push({ source, urls });
      fetchingSource = undefined;
    }
    const roundId = randomUUID();
    await client.query("DELETE FROM retail_crawl_queue");
    for (const { source, urls } of manifests) {
      await client.query("INSERT INTO medicine_price_sources (source_id,name,source_kind,base_url,terms_url,robots_checked_at,source_updated_at) VALUES ($1,$2,'ecommerce',$3,$4,now(),now()) ON CONFLICT (source_id) DO UPDATE SET active=true,source_updated_at=excluded.source_updated_at", [source.id, source.name, source.base, `${source.base}/robots.txt`]);
      await client.query("INSERT INTO retail_crawl_queue (source_id,product_url,round_id,product_index) SELECT $1,url,$2,ordinality FROM unnest($3::text[]) WITH ORDINALITY AS products(url,ordinality)", [source.id, roundId, urls]);
    }
    await client.query("COMMIT");
    console.log(JSON.stringify({ roundId, manifests: manifests.map(({ source, urls }) => ({ name: source.name, products: urls.length })) }));
    return roundId;
  } catch (error) {
    await client.query("ROLLBACK");
    if (fetchingSource && backoffMs(error)) await pauseSource(client, fetchingSource.id, backoffMs(error));
    throw error;
  }
}

export async function crawlBatch(client, { roundId, sources = SOURCES, limit = 150, read = get, deadline = Date.now() + 10 * 60_000 }) {
  const attemptedUrls = new Set();
  const result = { attempted: 0, observations: 0, unavailable: 0, excluded: 0, failed: 0 };
  const exhausted = new Set();
  const failures = new Map();
  for (let i = 0; result.attempted < limit && exhausted.size < sources.length && Date.now() < deadline; i += 1) {
    const source = sources[i % sources.length];
    if (exhausted.has(source.id)) continue;
    await client.query("BEGIN");
    try {
      const selected = await client.query("SELECT q.product_url FROM retail_crawl_queue q JOIN medicine_price_sources s USING(source_id) WHERE q.round_id=$1 AND q.source_id=$2 AND s.active AND q.status='pending' AND NOT(q.product_url=ANY($3::text[])) AND (s.crawl_not_before IS NULL OR s.crawl_not_before<=clock_timestamp()) ORDER BY q.last_attempt_at NULLS FIRST,q.product_index FOR UPDATE OF q SKIP LOCKED LIMIT 1", [roundId, source.id, [...attemptedUrls]]);
      if (!selected.rowCount) {
        exhausted.add(source.id);
        await client.query("COMMIT");
        continue;
      }
      const url = selected.rows[0].product_url;
      let row;
      let licenseHash;
      let status = "succeeded";
      let lastError = null;
      let delay = 0;
      try {
        row = parseRetailProduct(await read(url), url, source);
        if (!row.excluded) {
          const license = await client.query("SELECT source_sha256 FROM medicine_retail_license_verifications WHERE license_number=$1 AND drug_category='乙類成藥' AND NOT cancelled AND valid_until >= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Taipei')::date AND verified_at > now()-interval '7 days'", [row.licenseNumber]);
          licenseHash = license.rows[0]?.source_sha256;
          if (!licenseHash) row = { excluded: "沒有新近、有效的 TFDA 乙類成藥完整藥證配對" };
        }
        if (row.excluded) { status = "excluded"; lastError = row.excluded; row = null; }
      } catch (error) {
        row = null;
        status = [404, 410].includes(error.status) ? "unavailable" : "pending";
        lastError = error.message;
        if (status === "pending") delay = backoffMs(error);
        console.warn(`${status === "unavailable" ? "已下架" : "保留重試"}：${url} ${lastError}`);
      }
      const consecutive = status === "pending" ? (failures.get(source.id) || 0) + 1 : 0;
      failures.set(source.id, consecutive);
      if (consecutive >= 3) delay = Math.max(delay, 30 * 60_000);
      if (delay) {
        await pauseSource(client, source.id, delay);
        exhausted.add(source.id);
        console.warn(`來源暫停：${source.name} 至少 ${Math.ceil(delay / 60_000)} 分鐘`);
      }
      if (row) {
        const now = new Date();
        const observation = await client.query("INSERT INTO medicine_price_observations (observation_id,source_id,external_product_id,product_name,specification_raw,listed_price,sale_price,captured_at,captured_date,product_url,raw_payload_hash,parser_version,sku_id,license_number,match_method,match_confidence,availability) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,($8::timestamptz AT TIME ZONE 'Asia/Taipei')::date,$9,$10,'91app-exact-sku-v2',$11,$12,'exact-license',1,'unknown') ON CONFLICT (source_id,external_product_id,captured_date) DO UPDATE SET product_name=excluded.product_name,specification_raw=excluded.specification_raw,listed_price=excluded.listed_price,sale_price=excluded.sale_price,captured_at=excluded.captured_at,product_url=excluded.product_url,raw_payload_hash=excluded.raw_payload_hash,parser_version=excluded.parser_version,sku_id=excluded.sku_id,license_number=excluded.license_number,match_method=excluded.match_method,match_confidence=excluded.match_confidence RETURNING observation_id", [randomUUID(), source.id, row.id, row.name, row.specification, row.listedPrice, row.salePrice, now, row.url, createHash("sha256").update(JSON.stringify(row.evidence)).digest("hex"), row.skuId, row.licenseNumber]);
        await client.query("INSERT INTO medicine_price_matches(observation_id,license_number,match_method,status,evidence_url,reviewed_at,reviewed_by,specification,evidence,license_source_sha256) VALUES ($1,$2,'exact-license','approved',$3,$4,'automated-exact-license-single-sku-v2',$5,$6,$7) ON CONFLICT(observation_id) DO UPDATE SET license_number=excluded.license_number,status=excluded.status,evidence_url=excluded.evidence_url,reviewed_at=excluded.reviewed_at,reviewed_by=excluded.reviewed_by,specification=excluded.specification,evidence=excluded.evidence,license_source_sha256=excluded.license_source_sha256", [observation.rows[0].observation_id, row.licenseNumber, row.url, now, row.specification, row.evidence, licenseHash]);
      }
      await client.query("UPDATE retail_crawl_queue SET status=$3,last_attempt_at=clock_timestamp(),attempts=attempts+1,last_error=$4 WHERE source_id=$1 AND product_url=$2", [source.id, url, status, lastError]);
      // Price and checkpoint commit together, so a crash cannot skip an unsaved price.
      await client.query("COMMIT");
      attemptedUrls.add(url);
      result.attempted += 1;
      if (status === "succeeded") result.observations += 1;
      else if (status === "unavailable") result.unavailable += 1;
      else if (status === "excluded") result.excluded += 1;
      else result.failed += 1;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }
  return result;
}

export async function progress(client) {
  return (await client.query("SELECT q.round_id,s.name,s.crawl_not_before,count(*)::int AS total,count(*) FILTER (WHERE q.status='pending')::int AS pending,count(*) FILTER (WHERE q.status='succeeded')::int AS succeeded,count(*) FILTER (WHERE q.status='unavailable')::int AS unavailable,count(*) FILTER (WHERE q.status='excluded')::int AS excluded FROM retail_crawl_queue q JOIN medicine_price_sources s USING(source_id) WHERE s.active GROUP BY q.round_id,s.name,s.crawl_not_before ORDER BY s.name")).rows;
}

async function main() {
  const { values } = parseArgs({ options: { "dry-run": { type: "boolean" }, limit: { type: "string" } } });
  const limit = Number(values.limit ?? (values["dry-run"] ? 10 : 150));
  if (!Number.isSafeInteger(limit) || limit <= 0) throw new Error("--limit 必須是正整數");
  if (values["dry-run"]) {
    const urls = [];
    for (const source of SOURCES) urls.push(await collectProducts(source));
    console.log(JSON.stringify({ manifests: SOURCES.map((source, i) => ({ name: source.name, products: urls[i].length })) }));
    let attempted = 0;
    for (let i = 0; attempted < limit && urls.some((products) => products.length); i += 1) {
      const url = urls[i % SOURCES.length].shift();
      if (!url) continue;
      console.log(JSON.stringify({ url, product: parseRetailProduct(await get(url), url, SOURCES[i % SOURCES.length]) }));
      attempted += 1;
    }
    return;
  }
  const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!connectionString) throw new Error("需要 DATABASE_URL_UNPOOLED 或 DATABASE_URL；GitHub Actions 請在 Settings → Secrets and variables → Actions 設定。");
  const pool = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 10_000 });
  try {
    const client = await pool.connect();
    try {
      const deadline = Date.now() + 10 * 60_000;
      await refreshRetailLicenses(client);
      const roundId = await ensureRound(client);
      const result = await crawlBatch(client, { roundId, limit, deadline });
      console.log(JSON.stringify({ roundId, ...result, progress: await progress(client) }));
      if (result.failed) process.exitCode = 1;
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => { console.error(`爬取失敗：${error.code || error.message}`); process.exitCode = 1; });
}
