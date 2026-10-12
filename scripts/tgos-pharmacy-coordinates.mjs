import { createReadStream, createWriteStream } from "node:fs";
import { basename, dirname, extname, join } from "node:path";
import { parse } from "csv-parse";
import { Pool } from "pg";

const HEADERS = ["id", "Address", "Response_Address", "Response_X", "Response_Y"];

function csv(value) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

async function exportAddresses(filepath) {
  const connectionString = process.env.DATABASE_URL_UNPOOLED;
  if (!connectionString) throw new Error("請設定 DATABASE_URL_UNPOOLED（Neon direct URL）。");
  const pool = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 10_000 });
  try {
    const { rows } = await pool.query(`SELECT institution_code, address FROM pharmacy_contracts
      WHERE address <> '' AND (latitude IS NULL OR longitude IS NULL)
      ORDER BY institution_code`);
    const batchSize = 10_000;
    const extension = extname(filepath) || ".csv";
    const stem = basename(filepath, extname(filepath));
    for (let offset = 0; offset < rows.length; offset += batchSize) {
      const batch = rows.slice(offset, offset + batchSize);
      const part = Math.floor(offset / batchSize) + 1;
      const outputPath = rows.length > batchSize ? join(dirname(filepath), `${stem}-part${part}${extension}`) : filepath;
      const output = createWriteStream(outputPath, { encoding: "utf8", flags: "wx" });
      output.write(`\uFEFF${HEADERS.join(",")}\r\n`);
      for (const row of batch) output.write(`${csv(row.institution_code)},${csv(row.address)},,,\r\n`);
      await new Promise((resolve, reject) => { output.end(resolve); output.on("error", reject); });
      console.log(`已匯出第 ${part} 批 ${batch.length} 筆地址：${outputPath}`);
    }
    if (rows.length === 0) console.log("沒有需要轉換的地址。");
    console.log("TGOS 上傳時請選擇 EPSG:4326 (WGS84)；每日上限 10,000 筆，請依序送出批次並下載完成檔。");
  } finally { await pool.end(); }
}

async function importResults(filepath) {
  const connectionString = process.env.DATABASE_URL_UNPOOLED;
  if (!connectionString) throw new Error("請設定 DATABASE_URL_UNPOOLED（Neon direct URL）。");
  const pool = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 10_000 });
  const client = await pool.connect();
  let updated = 0;
  let unmatched = 0;
  try {
    await client.query("BEGIN");
    const parser = createReadStream(filepath).pipe(parse({ bom: true, columns: true, skip_empty_lines: true, trim: true, relax_column_count: false }));
    for await (const row of parser) {
      if (Object.keys(row).join(",") !== HEADERS.join(",")) throw new Error("TGOS CSV 欄位不符，預期 id,Address,Response_Address,Response_X,Response_Y。");
      const id = String(row.id ?? "").trim();
      const address = String(row.Address ?? "").trim();
      const longitude = Number(String(row.Response_X ?? "").trim());
      const latitude = Number(String(row.Response_Y ?? "").trim());
      if (!id || !address || !Number.isFinite(latitude) || !Number.isFinite(longitude)) { unmatched += 1; continue; }
      // 此批次固定使用 WGS84，且只接受台灣本島、澎湖及金馬範圍內的結果。
      if (latitude < 21.5 || latitude > 26.5 || longitude < 118 || longitude > 123) { unmatched += 1; continue; }
      const result = await client.query(`UPDATE pharmacy_contracts SET latitude = $3, longitude = $4,
        geocoded_at = CURRENT_TIMESTAMP, geocode_provider = 'TGOS batch EPSG:4326'
        WHERE institution_code = $1 AND address = $2`, [id, address, latitude, longitude]);
      if (result.rowCount === 1) updated += 1;
      else unmatched += 1;
    }
    await client.query("COMMIT");
    console.log(`TGOS 座標回匯完成：更新 ${updated} 筆，略過 ${unmatched} 筆（未命中、失敗或座標超出範圍）。`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); await pool.end(); }
}

const [mode, filepath] = process.argv.slice(2);
if (!filepath) throw new Error("用法：npm run tgos:export -- <輸出.csv> 或 npm run tgos:import -- <TGOS結果.csv>");
if (mode === "export") await exportAddresses(filepath);
else if (mode === "import") await importResults(filepath);
else throw new Error("模式必須是 export 或 import。");
