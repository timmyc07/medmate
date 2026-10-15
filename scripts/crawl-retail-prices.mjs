import { createHash, randomUUID } from "node:crypto";
import { Pool } from "pg";
import { gunzipSync } from "node:zlib";

const SOURCES = [
  { id: "f7c48f30-3c3c-4b09-9b0d-0d6e0e10ad01", name: "康是美網購 eShop", base: "https://shop.cosmed.com.tw", sitemap: "https://shop.cosmed.com.tw/Sitemap/2131/Sitemap_Index.xml" },
  { id: "48d8bf3d-3c42-40d0-a94f-37d91b00f6a2", name: "杏一健康生活館", base: "https://www.medfirst.com.tw", sitemap: "https://www.medfirst.com.tw/Sitemap/41218/Sitemap_Index.xml" },
];
const USER_AGENT = "MediMatePublicPriceBot/1.0 (+https://medmate-53s1.onrender.com/data-status)";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
function xmlUrls(xml) { return [...xml.matchAll(/<loc>([^<]+)<\/loc>/gi)].map((m) => m[1].trim()); }
function htmlPrice(html, url) {
  const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() || "";
  const id = url.match(/\/SalePage\/Index\/(\d+)/i)?.[1];
  const listed = html.match(/"(?:MaxPrice|Price)"\s*:\s*([0-9]+(?:\.[0-9]+)?)/i)?.[1];
  const sale = html.match(/"(?:MinPrice|Price)"\s*:\s*([0-9]+(?:\.[0-9]+)?)/i)?.[1];
  if (!id || !sale) return null;
  return { id, name: title.replace(/\s+/g, " "), listedPrice: Number(listed || sale), salePrice: Number(sale), url };
}
async function get(url) {
  const response = await fetch(url, { headers: { "user-agent": USER_AGENT, accept: "text/html,application/xml" } });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  return url.endsWith(".gz") ? gunzipSync(bytes).toString("utf8") : bytes.toString("utf8");
}
async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const maxProducts = Number(process.env.CRAWL_MAX_PRODUCTS ?? (dryRun ? 10 : 500));
  const connectionString = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!dryRun && !connectionString) throw new Error("需要 DATABASE_URL_UNPOOLED");
  const now = new Date(); const rows = [];
  const pool = !dryRun ? new Pool({ connectionString, max: 1 }) : null;
  const client = pool ? await pool.connect() : null;
  const nextStates = [];
  for (const source of SOURCES) {
    const index = await get(source.sitemap); const maps = xmlUrls(index).filter((url) => /sitemap/i.test(url));
    const state = client ? (await client.query("SELECT sitemap_index, product_offset FROM retail_crawl_state WHERE source_id=$1", [source.id])).rows[0] ?? { sitemap_index: 0, product_offset: 0 } : { sitemap_index: 0, product_offset: 0 };
    for (let mapIndex = state.sitemap_index; mapIndex < maps.length; mapIndex += 1) {
      const mapUrl = maps[mapIndex];
      const sitemap = await get(mapUrl);
      const products = xmlUrls(sitemap).filter((url) => /\/SalePage\/Index\//i.test(url));
      const start = mapIndex === state.sitemap_index ? state.product_offset : 0;
      for (const productUrl of products.slice(start, start + maxProducts - rows.length)) {
        await sleep(2500);
        try { const parsed = htmlPrice(await get(productUrl), productUrl); if (parsed) rows.push({ source, ...parsed }); } catch (error) { console.warn(`略過商品：${error.message}`); }
        if (rows.length >= maxProducts) break;
      }
      nextStates.push({ sourceId: source.id, sitemapIndex: mapIndex, productOffset: Math.min(start + maxProducts, products.length) });
      if (rows.length >= maxProducts) break;
    }
    if (rows.length >= maxProducts) break;
  }
  if (dryRun) { console.log(JSON.stringify({ observations: rows.length, sources: SOURCES.map((source) => ({ name: source.name, count: rows.filter((row) => row.source.id === source.id).length })) })); return; }
  try {
    await client.query("BEGIN");
    for (const source of SOURCES) await client.query("INSERT INTO medicine_price_sources (source_id,name,source_kind,base_url,terms_url,robots_checked_at,source_updated_at) VALUES ($1,$2,'ecommerce',$3,$4,$5,$5) ON CONFLICT (source_id) DO UPDATE SET source_updated_at=excluded.source_updated_at", [source.id, source.name, source.base, `${source.base}/robots.txt`, now]);
    for (const row of rows) await client.query("INSERT INTO medicine_price_observations (observation_id,source_id,external_product_id,product_name,listed_price,sale_price,captured_at,captured_date,product_url,raw_payload_hash,parser_version) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'91app-v1') ON CONFLICT DO NOTHING", [randomUUID(), row.source.id, row.id, row.name, row.listedPrice, row.salePrice, now, now.toISOString().slice(0, 10), row.url, sha256(JSON.stringify(row))]);
    for (const state of nextStates) await client.query("INSERT INTO retail_crawl_state(source_id,sitemap_index,product_offset,updated_at) VALUES ($1,$2,$3,$4) ON CONFLICT (source_id) DO UPDATE SET sitemap_index=excluded.sitemap_index,product_offset=excluded.product_offset,updated_at=excluded.updated_at", [state.sourceId, state.sitemapIndex, state.productOffset, now]);
    await client.query("COMMIT"); console.log(JSON.stringify({ observations: rows.length }));
  } catch (error) { if (client) await client.query("ROLLBACK"); throw error; } finally { if (client) client.release(); if (pool) await pool.end(); }
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
