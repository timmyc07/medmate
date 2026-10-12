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
  const dryRun = process.argv.includes("--dry-run");
  try {
    await client.query("BEGIN");
    await client.query(`CREATE TEMP TABLE tgos_import (
      id text, address text, response_address text, longitude_text text, latitude_text text,
      longitude double precision, latitude double precision, reason text
    ) ON COMMIT DROP`);
    await client.query(`CREATE TEMP TABLE tgos_candidates (
      id text, address text, candidate_index integer, response_address text,
      longitude_text text, latitude_text text, longitude double precision, latitude double precision,
      reason text
    ) ON COMMIT DROP`);
    const records = [];
    const parser = createReadStream(filepath).pipe(parse({ bom: true, columns: true, skip_empty_lines: true, trim: true, relax_column_count: false }));
    for await (const row of parser) {
      if (records.length === 0 && Object.keys(row).join(",") !== HEADERS.join(",")) throw new Error("TGOS CSV 欄位不符，預期 id,Address,Response_Address,Response_X,Response_Y。");
      records.push(row);
    }
    if (records.length === 0) throw new Error("TGOS CSV 沒有資料列。");
    const candidates = [];
    for (const row of records) {
      const longitudes = String(row.Response_X ?? "").split(";").map((value) => value.trim());
      const latitudes = String(row.Response_Y ?? "").split(";").map((value) => value.trim());
      const addresses = String(row.Response_Address ?? "").split(";").map((value) => value.trim());
      if (longitudes.length < 2 && latitudes.length < 2) continue;
      if (longitudes.length !== latitudes.length || longitudes.length !== addresses.length) {
        candidates.push({ id: row.id, address: row.Address, index: 0, responseAddress: "", longitudeText: "", latitudeText: "", reason: "多候選欄位筆數不一致" });
        continue;
      }
      for (let index = 0; index < longitudes.length; index += 1) candidates.push({ id: row.id, address: row.Address, index: index + 1, responseAddress: addresses[index], longitudeText: longitudes[index], latitudeText: latitudes[index], reason: "" });
    }
    for (let offset = 0; offset < records.length; offset += 1000) {
      const batch = records.slice(offset, offset + 1000);
      const values = [];
      const placeholders = batch.map((row, index) => {
        const base = index * 5;
        values.push(row.id ?? "", row.Address ?? "", row.Response_Address ?? "", row.Response_X ?? "", row.Response_Y ?? "");
        return `($${base + 1}::text,$${base + 2}::text,$${base + 3}::text,$${base + 4}::text,$${base + 5}::text)`;
      });
      await client.query(`INSERT INTO tgos_import (id,address,response_address,longitude_text,latitude_text) VALUES ${placeholders.join(",")}`, values);
    }
    await client.query(`UPDATE tgos_import SET reason = CASE
      WHEN COALESCE(id, '') = '' OR COALESCE(address, '') = '' THEN '缺少機構代碼或地址'
      WHEN id IN (SELECT id FROM tgos_import GROUP BY id HAVING COUNT(*) > 1) THEN '機構代碼重複'
      WHEN COALESCE(longitude_text, '') LIKE '%;%' OR COALESCE(latitude_text, '') LIKE '%;%' THEN '多個候選座標'
      WHEN longitude_text !~ '^-?[0-9]+(\\.[0-9]+)?$' OR latitude_text !~ '^-?[0-9]+(\\.[0-9]+)?$' THEN '沒有有效座標'
      ELSE NULL END`);
    await client.query(`UPDATE tgos_import SET longitude = longitude_text::double precision, latitude = latitude_text::double precision WHERE reason IS NULL`);
    if (candidates.length) {
      for (let offset = 0; offset < candidates.length; offset += 500) {
        const batch = candidates.slice(offset, offset + 500);
        const values = [];
        const placeholders = batch.map((candidate, index) => {
          const base = index * 7;
          values.push(candidate.id ?? "", candidate.address ?? "", candidate.index, candidate.responseAddress ?? "", candidate.longitudeText ?? "", candidate.latitudeText ?? "", candidate.reason ?? "");
          return `($${base + 1}::text,$${base + 2}::text,$${base + 3}::integer,$${base + 4}::text,$${base + 5}::text,$${base + 6}::text,$${base + 7}::text)`;
        });
        await client.query(`INSERT INTO tgos_candidates (id,address,candidate_index,response_address,longitude_text,latitude_text,reason) VALUES ${placeholders.join(",")}`, values);
      }
      await client.query(`UPDATE tgos_candidates SET reason=CASE
        WHEN reason <> '' THEN reason
        WHEN candidate_index < 1 OR id='' OR address='' THEN '候選欄位不完整'
        WHEN longitude_text !~ '^-?[0-9]+(\\.[0-9]+)?$' OR latitude_text !~ '^-?[0-9]+(\\.[0-9]+)?$' THEN '候選座標格式無效'
        ELSE NULL END`);
      await client.query(`UPDATE tgos_candidates SET longitude=longitude_text::double precision, latitude=latitude_text::double precision WHERE reason IS NULL`);
      await client.query(`UPDATE tgos_candidates SET reason='候選座標超出台灣範圍' WHERE reason IS NULL AND (latitude<21.5 OR latitude>26.5 OR longitude<118 OR longitude>123)`);
      await client.query(`UPDATE tgos_candidates AS source SET reason='候選地址所屬機構不符' WHERE reason IS NULL AND NOT EXISTS (SELECT 1 FROM pharmacy_contracts p WHERE p.institution_code=source.id AND p.address=source.address)`);
    }
    await client.query(`UPDATE tgos_import SET reason = '座標超出台灣範圍' WHERE reason IS NULL AND (latitude < 21.5 OR latitude > 26.5 OR longitude < 118 OR longitude > 123)`);
    await client.query(`UPDATE tgos_import AS source SET reason = '機構代碼或原始地址不符' WHERE reason IS NULL AND NOT EXISTS (SELECT 1 FROM pharmacy_contracts p WHERE p.institution_code=source.id AND p.address=source.address)`);
    await client.query(`UPDATE tgos_import AS source SET reason = '資料庫已有座標' WHERE reason IS NULL AND EXISTS (SELECT 1 FROM pharmacy_contracts p WHERE p.institution_code=source.id AND p.address=source.address AND (p.latitude IS NOT NULL OR p.longitude IS NOT NULL))`);
    const summary = await client.query(`SELECT COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE reason IS NULL)::int AS valid,
      COUNT(*) FILTER (WHERE reason='多個候選座標')::int AS multiple,
      COUNT(*) FILTER (WHERE reason='沒有有效座標')::int AS no_coordinates,
      COUNT(*) FILTER (WHERE reason='座標超出台灣範圍')::int AS out_of_range,
      COUNT(*) FILTER (WHERE reason='機構代碼或原始地址不符')::int AS unmatched,
      COUNT(*) FILTER (WHERE reason='資料庫已有座標')::int AS existing,
      COUNT(*) FILTER (WHERE reason='機構代碼重複')::int AS duplicate_ids,
      COUNT(*) FILTER (WHERE reason='缺少機構代碼或地址')::int AS malformed FROM tgos_import`);
    const counts = summary.rows[0];
    if (dryRun) {
      const candidateSummary = await client.query("SELECT COUNT(*) FILTER (WHERE reason IS NULL)::int AS valid, COUNT(*) FILTER (WHERE reason IS NOT NULL)::int AS rejected FROM tgos_candidates");
      await client.query("ROLLBACK");
      console.log(`TGOS 座標預檢：檔案 ${counts.total} 筆，可寫入單點 ${counts.valid} 筆，多候選藥局 ${counts.multiple} 家，候選點 ${candidateSummary.rows[0].valid} 個（拒收 ${candidateSummary.rows[0].rejected} 個），無座標 ${counts.no_coordinates} 筆，超出台灣範圍 ${counts.out_of_range} 筆，資料不匹配 ${counts.unmatched} 筆，已有座標 ${counts.existing} 筆，重複機構代碼 ${counts.duplicate_ids} 筆，格式異常 ${counts.malformed} 筆。`);
      return;
    }
    await client.query(`UPDATE pharmacy_contracts AS p SET latitude=s.latitude, longitude=s.longitude,
      geocoded_at=CURRENT_TIMESTAMP, geocode_provider='TGOS batch EPSG:4326'
      FROM tgos_import s WHERE s.reason IS NULL AND p.institution_code=s.id AND p.address=s.address
        AND p.latitude IS NULL AND p.longitude IS NULL`);
    await client.query(`DELETE FROM pharmacy_coordinate_candidates stored USING (
      SELECT id FROM tgos_candidates GROUP BY id
      HAVING id <> '' AND COUNT(*) FILTER (WHERE reason IS NULL) = COUNT(*)
    ) synced WHERE stored.institution_code=synced.id`);
    await client.query(`INSERT INTO pharmacy_coordinate_candidates (institution_code,candidate_index,response_address,latitude,longitude,geocoded_at)
      SELECT source.id,source.candidate_index,source.response_address,source.latitude,source.longitude,CURRENT_TIMESTAMP
      FROM tgos_candidates source WHERE source.reason IS NULL
      ON CONFLICT (institution_code,candidate_index) DO UPDATE SET response_address=EXCLUDED.response_address,
        latitude=EXCLUDED.latitude,longitude=EXCLUDED.longitude,geocoded_at=EXCLUDED.geocoded_at`);
    const candidateSummary = await client.query("SELECT COUNT(*) FILTER (WHERE reason IS NULL)::int AS valid, COUNT(*) FILTER (WHERE reason IS NOT NULL)::int AS rejected FROM tgos_candidates");
    await client.query("COMMIT");
    console.log(`TGOS 座標回匯完成：更新單點 ${counts.valid} 筆，保存候選座標 ${candidateSummary.rows[0].valid} 個（拒收 ${candidateSummary.rows[0].rejected} 個），多候選藥局 ${counts.multiple} 家，無座標 ${counts.no_coordinates} 筆，超出台灣範圍 ${counts.out_of_range} 筆，資料不匹配 ${counts.unmatched} 筆，已有座標 ${counts.existing} 筆，重複機構代碼 ${counts.duplicate_ids} 筆，格式異常 ${counts.malformed} 筆。`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); await pool.end(); }
}

const [mode, filepath] = process.argv.slice(2);
if (!filepath) throw new Error("用法：npm run tgos:export -- <輸出.csv> 或 npm run tgos:import -- <TGOS結果.csv> [--dry-run]");
if (mode === "export") await exportAddresses(filepath);
else if (mode === "import") await importResults(filepath);
else throw new Error("模式必須是 export 或 import。");
