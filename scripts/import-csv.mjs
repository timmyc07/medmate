import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { Transform } from "node:stream";
import { parse } from "csv-parse";
import { Pool } from "pg";

export function normalizeDate(value) {
  const input = String(value ?? "").trim();
  if (!input) return null;
  const match = /^(\d{4})(?:\/|-)?(\d{2})(?:\/|-)?(\d{2})$/.exec(input);
  if (!match) return null;
  const [, year, month, day] = match;
  const date = new Date(`${year}-${month}-${day}T00:00:00Z`);
  return date.toISOString().slice(0, 10) === `${year}-${month}-${day}`
    ? `${year}-${month}-${day}`
    : null;
}

export function pharmacyCity(address) {
  const match = /^(.*?[縣市])/.exec(String(address ?? "").trim());
  return match?.[1] || null;
}

const SOURCES = {
  fda_pharmacies: {
    file: "35_2.csv",
    table: "pharmacy_registry_fda",
    url: "https://data.fda.gov.tw/data/opendata/export/35/csv",
    dedupeKey: (r) => r.slice(1, 5).join("\u0000"),
    columns: [
      "機構狀態",
      "機構名稱",
      "地址縣市別",
      "地址鄉鎮市區",
      "地址街道巷弄號",
      "電話",
      "是否為健保特約藥局",
    ],
    insert: `INSERT INTO pharmacy_registry_fda (institution_status,institution_name,city,district,street_address,phone,is_nhi_contracted,source_updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (institution_name,city,district,street_address) DO UPDATE SET institution_status=excluded.institution_status,phone=excluded.phone,is_nhi_contracted=excluded.is_nhi_contracted,source_updated_at=excluded.source_updated_at`,
    values: (r, at) => [
      r.機構狀態,
      r.機構名稱,
      r.地址縣市別,
      r.地址鄉鎮市區,
      r.地址街道巷弄號,
      r.電話,
      r.是否為健保特約藥局 === "Y",
      at,
    ],
  },
  nhi_pharmacies: {
    file: "A21030000I-D21005-001.csv",
    table: "pharmacy_contracts",
    url: "https://info.nhi.gov.tw/api/iode0000s01/Dataset?rId=A21030000I-D21005-001",
    dedupeKey: (r) => r[0],
    columns: [
      "醫事機構代碼",
      "醫事機構名稱",
      "醫事機構種類",
      "電話",
      "地址",
      "分區業務組",
      "特約類別",
      "服務項目",
      "終止合約或歇業日期",
      "合約起日",
    ],
    insert: `INSERT INTO pharmacy_contracts (institution_code,institution_name,institution_type,phone,address,service_area,contract_type,services,termination_date,contract_start_date,source_updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT (institution_code) DO UPDATE SET institution_name=excluded.institution_name,institution_type=excluded.institution_type,phone=excluded.phone,address=excluded.address,service_area=excluded.service_area,contract_type=excluded.contract_type,services=excluded.services,termination_date=excluded.termination_date,contract_start_date=excluded.contract_start_date,source_updated_at=excluded.source_updated_at`,
    values: (r, at) => [
      r.醫事機構代碼,
      r.醫事機構名稱,
      r.醫事機構種類,
      r.電話,
      r.地址,
      r.分區業務組,
      r.特約類別,
      r.服務項目,
      normalizeDate(r.終止合約或歇業日期),
      normalizeDate(r.合約起日),
      at,
    ],
  },
  medicines: {
    file: "36_2.csv",
    table: "medicines",
    url: "https://data.fda.gov.tw/data/opendata/export/36/csv",
    dedupeKey: (r) => r[0],
    columns: [
      "許可證字號",
      "註銷狀態",
      "註銷日期",
      "註銷理由",
      "有效日期",
      "中文品名",
      "英文品名",
      "適應症",
      "劑型",
      "申請商名稱",
      "異動日期",
    ],
    insert: `INSERT INTO medicines (license_number,cancellation_status,cancellation_date,cancellation_reason,valid_until,name,english_name,indications,dosage_form,applicant_name,source_updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT (license_number) DO UPDATE SET cancellation_status=excluded.cancellation_status,cancellation_date=excluded.cancellation_date,cancellation_reason=excluded.cancellation_reason,valid_until=excluded.valid_until,name=excluded.name,english_name=excluded.english_name,indications=excluded.indications,dosage_form=excluded.dosage_form,applicant_name=excluded.applicant_name,source_updated_at=excluded.source_updated_at`,
    values: (r, at) => [
      r.許可證字號,
      r.註銷狀態,
      normalizeDate(r.註銷日期),
      r.註銷理由,
      normalizeDate(r.有效日期),
      r.中文品名,
      r.英文品名,
      r.適應症,
      r.劑型,
      r.申請商名稱,
      at,
    ],
  },
};

async function insertRows(client, source, filepath, retrievedAt) {
  let rowCount = 0;
  const hash = createHash("sha256");
  const hashing = new Transform({
    transform(chunk, _encoding, callback) {
      hash.update(chunk);
      callback(null, chunk);
    },
  });
  let batch = [];
  const parser = createReadStream(filepath)
    .pipe(hashing)
    .pipe(
      parse({ bom: true, columns: true, skip_empty_lines: true, trim: true }),
    );
  for await (const row of parser) {
    if (source.columns.some((column) => !(column in row)))
      throw new Error("CSV 欄位與已核准白名單不符");
    batch.push(source.values(row, retrievedAt));
    rowCount += 1;
    if (batch.length === 300) {
      await flush(client, source.insert, batch, source.dedupeKey);
      batch = [];
    }
  }
  if (batch.length) await flush(client, source.insert, batch, source.dedupeKey);
  return { rowCount, sha256: hash.digest("hex") };
}

async function flush(client, template, rows, dedupeKey) {
  rows = [...new Map(rows.map((row) => [dedupeKey(row), row])).values()];
  const _width = rows[0].length;
  const params = [];
  const values = rows
    .map(
      (row, _index) =>
        `(${row
          .map((value) => {
            params.push(value);
            return `$${params.length}`;
          })
          .join(",")})`,
    )
    .join(",");
  await client.query(
    template
      .replace(
        "VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)",
        `VALUES ${values}`,
      )
      .replace("VALUES ($1,$2,$3,$4,$5,$6,$7,$8)", `VALUES ${values}`),
    params,
  );
}

export async function importCsvFiles({
  connectionString,
  inputDirectory,
  retrievedAt = new Date(),
}) {
  if (!connectionString) throw new Error("需要 direct DATABASE_URL_UNPOOLED");
  const pool = new Pool({
    connectionString,
    max: 1,
    connectionTimeoutMillis: 10_000,
  });
  const client = await pool.connect();
  const batchId = randomUUID();
  const results = {};
  try {
    await client.query("BEGIN");
    await client.query("CREATE TEMP TABLE pharmacy_contract_coordinates ON COMMIT DROP AS SELECT institution_code, latitude, longitude, geocoded_at, geocode_provider FROM pharmacy_contracts WHERE latitude IS NOT NULL AND longitude IS NOT NULL");
    for (const [key, source] of Object.entries(SOURCES)) {
      await client.query(`DELETE FROM ${source.table}`);
      const filepath = `${inputDirectory}/${source.file}`;
      const { rowCount, sha256 } = await insertRows(
        client,
        source,
        filepath,
        retrievedAt,
      );
      await client.query(
        "INSERT INTO source_imports(dataset_key,source_url,retrieved_at,source_sha256,row_count,batch_id) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (dataset_key) DO UPDATE SET source_url=excluded.source_url,retrieved_at=excluded.retrieved_at,source_sha256=excluded.source_sha256,row_count=excluded.row_count,batch_id=excluded.batch_id",
        [key, source.url, retrievedAt, sha256, rowCount, batchId],
      );
      if (key === "nhi_pharmacies") {
        await client.query("UPDATE pharmacy_contracts AS current SET latitude = saved.latitude, longitude = saved.longitude, geocoded_at = saved.geocoded_at, geocode_provider = saved.geocode_provider FROM pharmacy_contract_coordinates AS saved WHERE current.institution_code = saved.institution_code");
      }
      results[key] = { rowCount, sha256 };
    }
    await client.query("COMMIT");
    return { batchId, results };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const connectionString = process.env.DATABASE_URL_UNPOOLED;
  const inputDirectory = process.argv[2];
  if (!connectionString || !inputDirectory) {
    console.error(
      "用法：DATABASE_URL_UNPOOLED=<direct-url> node scripts/import-csv.mjs <csv-directory>",
    );
    process.exitCode = 2;
  } else {
    try {
      const summary = await importCsvFiles({
        connectionString,
        inputDirectory,
      });
      console.log(JSON.stringify(summary, null, 2));
    } catch {
      console.error("匯入失敗；交易已回復，請檢查 CSV 與資料庫 migration。");
      process.exitCode = 1;
    }
  }
}
