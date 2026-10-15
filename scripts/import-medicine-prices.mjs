import { createHash, randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { parse } from "csv-parse/sync";
import { Pool } from "pg";
import { from as copyFrom } from "pg-copy-streams";

export const PRICE_SOURCE_URL = "https://info.nhi.gov.tw/api/iode0000s01/Dataset?rId=A21030000I-E41001-001";
const REQUIRED_COLUMNS = ["異動", "藥品代號", "藥品英文名稱", "藥品中文名稱", "成分", "規格量", "規格單位", "支付價", "有效起日", "有效迄日", "藥品代碼超連結"];

function text(value) { return String(value ?? "").replace(/^\uFEFF/, "").trim(); }

export function rocDate(value) {
  const input = text(value);
  if (input === "9991231" || input === "") return null;
  const match = input.length === 6
    ? /^(\d{2})(\d{2})(\d{2})$/.exec(input)
    : /^(\d{3})(\d{2})(\d{2})$/.exec(input);
  if (!match) throw new Error(`健保日期格式無效：${input}`);
  const [, year, month, day] = match;
  const date = new Date(`${Number(year) + 1911}-${month}-${day}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== `${Number(year) + 1911}-${month}-${day}`)
    throw new Error(`健保日期無效：${input}`);
  return date.toISOString().slice(0, 10);
}

export function normalizeMedicinePriceRow(row, retrievedAt, sourceSha256) {
  const drugCode = text(row["藥品代號"]);
  const changeStatus = text(row["異動"]);
  const price = text(row["支付價"]);
  if (changeStatus || !/^[A-Z0-9]{6,16}$/.test(drugCode)) throw new Error("健保價格列不是可用品項");
  if (!price || !/^\d+(?:\.\d+)?$/.test(price) || Number(price) <= 0) throw new Error("健保價格不是可展示的正值");
  const effectiveFrom = rocDate(row["有效起日"]);
  if (!effectiveFrom) throw new Error("健保價格缺少有效起日");
  const effectiveUntil = rocDate(row["有效迄日"]);
  const licenseId = /[?&]licId=([^&]+)/i.exec(text(row["藥品代碼超連結"]))?.[1] ?? null;
  if (licenseId && !/^[0-9A-Z]{6,12}$/i.test(licenseId)) throw new Error("健保 licId 格式無效");
  return {
    drugCode, licenseId, drugName: text(row["藥品中文名稱"]) || text(row["藥品英文名稱"]),
    specification: [text(row["規格量"]), text(row["規格單位"])].filter(Boolean).join(" "),
    price, effectiveFrom, effectiveUntil, changeStatus, sourceUrl: PRICE_SOURCE_URL,
    sourceSha256, retrievedAt,
  };
}

export function parseMedicinePrices(filepath, retrievedAt = new Date().toISOString()) {
  const bytes = readFileSync(filepath);
  const sourceSha256 = createHash("sha256").update(bytes).digest("hex");
  const rows = parse(bytes, { bom: true, columns: true, skip_empty_lines: true, relax_quotes: true, trim: true });
  if (!rows.length || REQUIRED_COLUMNS.some((column) => !(column in rows[0]))) throw new Error("健保價格 CSV 欄位與白名單不符");
  const records = [];
  let skippedZero = 0;
  for (const row of rows) {
    if (text(row["異動"]) || !/^\d+(?:\.\d+)?$/.test(text(row["支付價"])) || Number(text(row["支付價"])) <= 0) { skippedZero += 1; continue; }
    records.push(normalizeMedicinePriceRow(row, retrievedAt, sourceSha256));
  }
  return { records, sourceSha256, sourceRows: rows.length, skippedZero };
}

async function main() {
  const filepath = process.argv[2];
  if (!filepath || !existsSync(filepath)) throw new Error("請提供健保支付價 CSV 路徑");
  const parsed = parseMedicinePrices(filepath);
  if (process.argv.includes("--dry-run")) { console.log(JSON.stringify({ sourceRows: parsed.sourceRows, importRows: parsed.records.length, skippedZero: parsed.skippedZero, sourceSha256: parsed.sourceSha256 })); return; }
  const connectionString = process.env.DATABASE_URL_UNPOOLED;
  if (!connectionString) throw new Error("需要設定 DATABASE_URL_UNPOOLED");
  const pool = new Pool({ connectionString, max: 1 });
  const client = await pool.connect();
  const batchId = randomUUID();
  try {
    await client.query("BEGIN");
    // 健保資料的 licId 尚未證實等於 TFDA 完整許可證字號；沒有正式對照表時一律保留 NULL，避免錯套價格。
    const mapping = new Map();
    const sql = `INSERT INTO medicine_prices (drug_code,license_number,drug_name,specification,price,currency,price_type,effective_from,effective_until,change_status,source_url,source_sha256,source_updated_at) VALUES ($1,$2,$3,$4,$5,'TWD','nhi-reimbursement',$6,$7,$8,$9,$10,$11) ON CONFLICT (drug_code,effective_from,price_type) DO UPDATE SET license_number=excluded.license_number,drug_name=excluded.drug_name,specification=excluded.specification,price=excluded.price,effective_until=excluded.effective_until,change_status=excluded.change_status,source_url=excluded.source_url,source_sha256=excluded.source_sha256,source_updated_at=excluded.source_updated_at`;
    await client.query("CREATE TEMP TABLE medicine_prices_stage (drug_code text, license_number text, drug_name text, specification text, price numeric, effective_from date, effective_until date, change_status text, source_url text, source_sha256 text, source_updated_at timestamptz) ON COMMIT DROP");
    const copy = client.query(copyFrom("COPY medicine_prices_stage FROM STDIN WITH (FORMAT csv, DELIMITER E'\\t', NULL '\\N')"));
    for (const record of parsed.records) {
      const fields = [record.drugCode, mapping.get(record.drugCode) ?? "\\N", record.drugName, record.specification, record.price, record.effectiveFrom, record.effectiveUntil ?? "\\N", record.changeStatus, record.sourceUrl, record.sourceSha256, record.retrievedAt];
      copy.write(`${fields.map((field) => field === "\\N" ? field : String(field).replaceAll("\\", "\\\\").replaceAll("\t", " ").replaceAll("\n", " ")).join("\t")}\n`);
    }
    copy.end();
    await copy;
    await client.query("INSERT INTO medicine_prices (drug_code,license_number,drug_name,specification,price,currency,price_type,effective_from,effective_until,change_status,source_url,source_sha256,source_updated_at) SELECT drug_code,license_number,drug_name,specification,price,'TWD','nhi-reimbursement',effective_from,effective_until,change_status,source_url,source_sha256,source_updated_at FROM medicine_prices_stage ON CONFLICT (drug_code,effective_from,price_type) DO UPDATE SET license_number=excluded.license_number,drug_name=excluded.drug_name,specification=excluded.specification,price=excluded.price,effective_until=excluded.effective_until,change_status=excluded.change_status,source_url=excluded.source_url,source_sha256=excluded.source_sha256,source_updated_at=excluded.source_updated_at");
    await client.query("INSERT INTO source_imports(dataset_key,source_url,retrieved_at,source_sha256,row_count,batch_id) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (dataset_key) DO UPDATE SET source_url=excluded.source_url,retrieved_at=excluded.retrieved_at,source_sha256=excluded.source_sha256,row_count=excluded.row_count,batch_id=excluded.batch_id", ["nhi_medicine_prices", PRICE_SOURCE_URL, parsed.records[0]?.retrievedAt ?? new Date().toISOString(), parsed.sourceSha256, parsed.sourceRows, batchId]);
    await client.query("COMMIT");
    console.log(JSON.stringify({ batchId, sourceRows: parsed.sourceRows, importedRows: parsed.records.length, mappedRows: 0, skippedZero: parsed.skippedZero }));
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); await pool.end(); }
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
