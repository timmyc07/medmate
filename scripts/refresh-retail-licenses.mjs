import { createHash } from "node:crypto";
import { parse } from "csv-parse/sync";
import { unzipSync } from "fflate";
import { from as copyFrom } from "pg-copy-streams";
import { normalizeDate } from "./import-csv.mjs";

export const RETAIL_LICENSE_SOURCE_URL = "https://data.fda.gov.tw/data/opendata/export/36/csv";

export function parseRetailLicenses(bytes) {
  let csvCount = 0;
  const entries = Object.entries(unzipSync(bytes, { filter: file => {
    if (!file.name.endsWith(".csv")) return false;
    csvCount += 1;
    if (csvCount > 1 || file.originalSize > 80_000_000) throw new Error("TFDA CSV 數量或大小不符");
    return true;
  } }));
  if (entries.length !== 1) throw new Error("TFDA 壓縮檔必須包含一份大小受限的 CSV");
  const csv = entries[0][1];
  const rows = parse(csv, { bom: true, columns: true, skip_empty_lines: true });
  const required = ["許可證字號", "藥品類別", "包裝", "有效日期", "註銷狀態"];
  if (rows.length < 1000 || required.some(column => !(column in rows[0]))) throw new Error("TFDA 許可證資料不完整");
  const licenses = new Map();
  for (const row of rows) {
    const license = row.許可證字號.trim();
    if (!license) throw new Error("TFDA 許可證字號空白");
    const record = { licenseNumber: license, category: row.藥品類別.trim(), packaging: row.包裝.trim(), validUntil: normalizeDate(row.有效日期), cancelled: Boolean(row.註銷狀態.trim()) };
    const previous = licenses.get(license);
    if (previous && ["category", "validUntil", "cancelled"].some(key => previous[key] !== record[key])) throw new Error("TFDA 同藥證核實欄位衝突");
    licenses.set(license, record);
  }
  return { licenses: [...licenses.values()], sha256: createHash("sha256").update(csv).digest("hex") };
}

export async function refreshRetailLicenses(client, read = fetch) {
  const current = await client.query("SELECT 1 FROM source_imports WHERE dataset_key='tfda_retail_license_verification' AND retrieved_at > now()-interval '7 days'");
  if (current.rowCount) return;
  const response = await read(RETAIL_LICENSE_SOURCE_URL, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`TFDA 許可證來源 HTTP ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length > 20_000_000) throw new Error("TFDA 壓縮檔超出大小限制");
  const { licenses, sha256 } = parseRetailLicenses(bytes);
  const now = new Date();
  await client.query("BEGIN");
  try {
    await client.query("CREATE TEMP TABLE retail_license_stage (license_number text,drug_category text,package_description text,valid_until date,cancelled boolean) ON COMMIT DROP");
    const copy = client.query(copyFrom("COPY retail_license_stage FROM STDIN WITH (FORMAT csv)"));
    await new Promise((resolve, reject) => {
      copy.once("finish", resolve); copy.once("error", reject);
      for (const row of licenses) copy.write(`${[row.licenseNumber, row.category, row.packaging, row.validUntil, row.cancelled].map(value => value === null ? "" : `"${String(value).replaceAll('"', '""')}"`).join(",")}\n`);
      copy.end();
    });
    await client.query("DELETE FROM medicine_retail_license_verifications");
    await client.query("INSERT INTO medicine_retail_license_verifications SELECT s.license_number,s.drug_category,s.package_description,s.valid_until,s.cancelled,$1,$2 FROM retail_license_stage s JOIN medicines m USING(license_number)", [now, sha256]);
    await client.query("INSERT INTO source_imports(dataset_key,source_url,retrieved_at,source_sha256,row_count,batch_id) VALUES ('tfda_retail_license_verification',$1,$2,$3,$4,gen_random_uuid()) ON CONFLICT(dataset_key) DO UPDATE SET source_url=excluded.source_url,retrieved_at=excluded.retrieved_at,source_sha256=excluded.source_sha256,row_count=excluded.row_count,batch_id=excluded.batch_id", [RETAIL_LICENSE_SOURCE_URL, now, sha256, licenses.length]);
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; }
}
