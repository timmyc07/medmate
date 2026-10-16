import { createHash, randomUUID } from "node:crypto";
import { parseArgs } from "node:util";
import { pathToFileURL } from "node:url";
import { gunzipSync } from "node:zlib";
import { Pool } from "pg";

export const SOURCES = [
  { id: "f7c48f30-3c3c-4b09-9b0d-0d6e0e10ad01", name: "康是美網購 eShop", base: "https://shop.cosmed.com.tw", sitemap: "https://shop.cosmed.com.tw/Sitemap/2131/Sitemap_Index.xml" },
  { id: "48d8bf3d-3c42-40d0-a94f-37d91b00f6a2", name: "杏一健康生活館", base: "https://www.medfirst.com.tw", sitemap: "https://www.medfirst.com.tw/Sitemap/41218/Sitemap_Index.xml" },
];
const USER_AGENT = "MediMatePublicPriceBot/1.0 (+https://medmate-53s1.onrender.com/data-status)";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let lastRequestAt = 0;

export function xmlUrls(xml) {
  return [...xml.matchAll(/<(?:\w+:)?loc\b[^>]*>\s*(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?\s*<\/(?:\w+:)?loc>/gis)]
    .map((match) => match[1].trim().replaceAll("&amp;", "&"));
}

export function htmlPrice(html, url) {
  const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() || "";
  const id = url.match(/\/SalePage\/Index\/(\d+)/i)?.[1];
  const listed = html.match(/"(?:MaxPrice|Price)"\s*:\s*([0-9]+(?:\.[0-9]+)?)/i)?.[1];
  const sale = html.match(/"(?:MinPrice|Price)"\s*:\s*([0-9]+(?:\.[0-9]+)?)/i)?.[1];
  const salePrice = Number(sale);
  const listedPrice = Number(listed || sale);
  if (!id || !sale || ![salePrice, listedPrice].every(price => Number.isFinite(price) && price >= 0.01 && price <= 9_999_999_999.99)) return null;
  return { id, name: title.replace(/\s+/g, " "), listedPrice, salePrice, url };
}

export async function get(url) {
  await sleep(Math.max(0, 2500 - (Date.now() - lastRequestAt)));
  lastRequestAt = Date.now();
  const response = await fetch(url, {
    headers: { "user-agent": USER_AGENT, accept: "text/html,application/xml" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw Object.assign(new Error(`HTTP ${response.status} ${url}`), { status: response.status });
  const bytes = Buffer.from(await response.arrayBuffer());
  return (bytes[0] === 0x1f && bytes[1] === 0x8b ? gunzipSync(bytes) : bytes).toString("utf8");
}

export async function collectProducts(source, read = get) {
  const maps = [source.sitemap];
  const visited = new Set();
  const products = new Set();
  for (let i = 0; i < maps.length; i += 1) {
    const url = maps[i];
    if (visited.has(url)) continue;
    visited.add(url);
    const xml = await read(url);
    if (!/<(?:\w+:)?(?:sitemapindex|urlset)\b/i.test(xml)) throw new Error(`無效 sitemap：${url}`);
    const index = /<(?:\w+:)?sitemapindex\b/i.test(xml);
    for (const location of xmlUrls(xml)) {
      const entry = new URL(location);
      if (entry.origin !== source.base) throw new Error(`sitemap 包含其他網域：${url}`);
      if (index) maps.push(entry.href);
      else {
        const productId = entry.pathname.match(/^\/SalePage\/Index\/(\d+)\/?$/i)?.[1];
        if (productId) products.add(`${source.base}/SalePage/Index/${productId}`);
      }
    }
  }
  if (!products.size) throw new Error(`${source.name} sitemap 沒有商品，保留目前清單`);
  return [...products];
}

export async function ensureRound(client, sources = SOURCES, read = get) {
  await client.query("BEGIN");
  try {
    // Serialize manifest replacement; product workers use row locks instead.
    await client.query("SELECT pg_advisory_xact_lock('retail_crawl_queue'::regclass::oid::bigint)");
    const pending = await client.query("SELECT round_id FROM retail_crawl_queue WHERE status='pending' LIMIT 1");
    if (pending.rowCount) {
      await client.query("COMMIT");
      return pending.rows[0].round_id;
    }
    const manifests = [];
    for (const source of sources) manifests.push({ source, urls: await collectProducts(source, read) });
    const roundId = randomUUID();
    await client.query("DELETE FROM retail_crawl_queue");
    for (const { source, urls } of manifests) {
      await client.query("INSERT INTO medicine_price_sources (source_id,name,source_kind,base_url,terms_url,robots_checked_at,source_updated_at) VALUES ($1,$2,'ecommerce',$3,$4,now(),now()) ON CONFLICT (source_id) DO UPDATE SET source_updated_at=excluded.source_updated_at", [source.id, source.name, source.base, `${source.base}/robots.txt`]);
      await client.query("INSERT INTO retail_crawl_queue (source_id,product_url,round_id,product_index) SELECT $1,url,$2,ordinality FROM unnest($3::text[]) WITH ORDINALITY AS products(url,ordinality)", [source.id, roundId, urls]);
    }
    await client.query("COMMIT");
    console.log(JSON.stringify({ roundId, manifests: manifests.map(({ source, urls }) => ({ name: source.name, products: urls.length })) }));
    return roundId;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

export async function crawlBatch(client, { roundId, sources = SOURCES, limit = 100, read = get, deadline = Date.now() + 10 * 60_000 }) {
  const startedAt = new Date();
  const result = { attempted: 0, observations: 0, unavailable: 0, failed: 0 };
  const exhausted = new Set();
  for (let i = 0; result.attempted < limit && exhausted.size < sources.length && Date.now() < deadline; i += 1) {
    const source = sources[i % sources.length];
    if (exhausted.has(source.id)) continue;
    await client.query("BEGIN");
    try {
      const selected = await client.query("SELECT product_url FROM retail_crawl_queue WHERE round_id=$1 AND source_id=$2 AND status='pending' AND (last_attempt_at IS NULL OR last_attempt_at<$3) ORDER BY last_attempt_at NULLS FIRST,product_index FOR UPDATE SKIP LOCKED LIMIT 1", [roundId, source.id, startedAt]);
      if (!selected.rowCount) {
        exhausted.add(source.id);
        await client.query("COMMIT");
        continue;
      }
      const url = selected.rows[0].product_url;
      let row;
      let status = "succeeded";
      let lastError = null;
      try {
        row = htmlPrice(await read(url), url);
        if (!row) throw new Error("頁面沒有可解析的正值價格");
      } catch (error) {
        status = [404, 410].includes(error.status) ? "unavailable" : "pending";
        lastError = error.message;
        console.warn(`${status === "unavailable" ? "已下架" : "保留重試"}：${url} ${lastError}`);
      }
      if (row) {
        const now = new Date();
        await client.query("INSERT INTO medicine_price_observations (observation_id,source_id,external_product_id,product_name,listed_price,sale_price,captured_at,captured_date,product_url,raw_payload_hash,parser_version) VALUES ($1,$2,$3,$4,$5,$6,$7,($7::timestamptz AT TIME ZONE 'Asia/Taipei')::date,$8,$9,'91app-v1') ON CONFLICT (source_id,external_product_id,captured_date) DO UPDATE SET product_name=excluded.product_name,listed_price=excluded.listed_price,sale_price=excluded.sale_price,captured_at=excluded.captured_at,product_url=excluded.product_url,raw_payload_hash=excluded.raw_payload_hash", [randomUUID(), source.id, row.id, row.name, row.listedPrice, row.salePrice, now, row.url, createHash("sha256").update(JSON.stringify(row)).digest("hex")]);
      }
      await client.query("UPDATE retail_crawl_queue SET status=$3,last_attempt_at=clock_timestamp(),attempts=attempts+1,last_error=$4 WHERE source_id=$1 AND product_url=$2", [source.id, url, status, lastError]);
      // Price and checkpoint commit together, so a crash cannot skip an unsaved price.
      await client.query("COMMIT");
      result.attempted += 1;
      if (status === "succeeded") result.observations += 1;
      else if (status === "unavailable") result.unavailable += 1;
      else result.failed += 1;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }
  return result;
}

export async function progress(client) {
  return (await client.query("SELECT q.round_id,s.name,count(*)::int AS total,count(*) FILTER (WHERE q.status='pending')::int AS pending,count(*) FILTER (WHERE q.status='succeeded')::int AS succeeded,count(*) FILTER (WHERE q.status='unavailable')::int AS unavailable FROM retail_crawl_queue q JOIN medicine_price_sources s USING(source_id) GROUP BY q.round_id,s.name ORDER BY s.name")).rows;
}

async function main() {
  const { values } = parseArgs({ options: { "dry-run": { type: "boolean" }, limit: { type: "string" } } });
  const limit = Number(values.limit ?? (values["dry-run"] ? 10 : 100));
  if (!Number.isSafeInteger(limit) || limit <= 0) throw new Error("--limit 必須是正整數");
  if (values["dry-run"]) {
    const urls = [];
    for (const source of SOURCES) urls.push(await collectProducts(source));
    console.log(JSON.stringify({ manifests: SOURCES.map((source, i) => ({ name: source.name, products: urls[i].length })) }));
    let attempted = 0;
    for (let i = 0; attempted < limit && urls.some((products) => products.length); i += 1) {
      const url = urls[i % SOURCES.length].shift();
      if (!url) continue;
      console.log(JSON.stringify({ url, parsed: Boolean(htmlPrice(await get(url), url)) }));
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
