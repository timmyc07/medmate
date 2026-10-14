import { createHash, randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { parse } from "csv-parse/sync";
import { Pool } from "pg";

const INGREDIENT_COLUMNS = [
  "許可證字號",
  "處方標示",
  "成分名稱",
  "成分代碼",
  "含量描述",
  "含量",
  "含量單位",
];
const SAFETY_COLUMNS = [
  "發布日期",
  "藥品成分",
  "藥品名稱及許可證字號",
  "適應症",
  "藥理作用機轉",
  "訊息緣由",
  "藥品安全有關資訊分析及描述",
  "TFDA風險溝通說明",
];

function text(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .trim();
}

function sourceHash(filepath) {
  return createHash("sha256").update(readFileSync(filepath)).digest("hex");
}

export function extractExactLicenseNumbers(value) {
  const matches =
    text(value).match(
      /(?:內衛|衛署|衛部)[\p{L}\p{N}]*?字第[0-9A-Z]{6,12}\s*號/gu,
    ) ?? [];
  return [...new Set(matches.map((match) => match.replace(/\s+(?=號$)/u, "")))];
}

export function normalizeIngredientRecord(row) {
  const result = {
    licenseNumber: text(row["許可證字號"]),
    prescriptionLabel: text(row["處方標示"]),
    ingredientName: text(row["成分名稱"]),
    ingredientCode: text(row["成分代碼"]),
    contentDescription: text(row["含量描述"]),
    contentValue: text(row["含量"]),
    contentUnit: text(row["含量單位"]),
  };
  if (!result.licenseNumber) throw new Error("成分資料缺少許可證字號");
  return result;
}

export function normalizeIngredientRows(rows) {
  const deduped = new Map();
  for (const source of rows) {
    const record = normalizeIngredientRecord(source);
    const key = JSON.stringify(record);
    if (!deduped.has(key)) deduped.set(key, record);
  }
  const grouped = new Map();
  for (const record of deduped.values()) {
    const list = grouped.get(record.licenseNumber) ?? [];
    list.push(record);
    grouped.set(record.licenseNumber, list);
  }
  return [...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right, "zh-Hant"))
    .flatMap(([, records]) =>
      records.map((record, index) => ({
        ...record,
        componentIndex: index + 1,
      })),
    );
}

export function normalizeUsageRows(rows) {
  const usageByLicense = new Map();
  for (const row of rows) {
    const license = text(row["許可證字號"]);
    if (!license) continue;
    const usage = text(row["用法用量"]);
    if (usageByLicense.has(license) && usageByLicense.get(license) !== usage)
      throw new Error(`同一許可證的用法用量內容不一致：${license}`);
    usageByLicense.set(license, usage);
  }
  return [...usageByLicense.entries()];
}

function normalizePublicationDate(value) {
  const match = /^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})$/.exec(text(value));
  if (!match) throw new Error(`安全公告日期格式無效：${value}`);
  const [, year, month, day] = match;
  const date = new Date(
    `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T00:00:00Z`,
  );
  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !==
      `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`
  )
    throw new Error(`安全公告日期無效：${value}`);
  return date.toISOString().slice(0, 10);
}

export function normalizeSafetyCommunication(row, sourceUrl, retrievedAt) {
  const licenseNumbers = extractExactLicenseNumbers(
    row["藥品名稱及許可證字號"],
  );
  const values = {
    publicationDate: normalizePublicationDate(row["發布日期"]),
    ingredient: text(row["藥品成分"]),
    scopeText: text(row["藥品名稱及許可證字號"]),
    indications: text(row["適應症"]),
    mechanism: text(row["藥理作用機轉"]),
    reason: text(row["訊息緣由"]),
    safetyAnalysis: text(row["藥品安全有關資訊分析及描述"]),
    tfdaCommunication: text(row["TFDA風險溝通說明"] || row["TFDA風險溝通說明"]),
    licenseNumbers,
    linkMethod: licenseNumbers.length
      ? "exact-license-text"
      : "announcement-only",
    sourceUrl,
  };
  const messageId = createHash("sha256")
    .update(JSON.stringify(values))
    .digest("hex");
  return { ...values, messageId, retrievedAt };
}

function parseCsv(filepath, columns) {
  const rows = parse(readFileSync(filepath), {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
    trim: true,
  });
  if (!rows.length || columns.some((column) => !(column in rows[0])))
    throw new Error(`${filepath} 欄位與白名單不符`);
  return rows;
}

function flush(client, template, rows) {
  if (!rows.length) return client.query("SELECT 1");
  const params = [];
  const values = rows
    .map(
      (row) =>
        `(${row
          .map((value) => {
            params.push(value);
            return `$${params.length}`;
          })
          .join(",")})`,
    )
    .join(",");
  return client.query(
    template.replace(/VALUES \(\$1(?:,\$\d+)*\)/, `VALUES ${values}`),
    params,
  );
}

export async function importMedicineInformation({
  connectionString,
  inputDirectory,
  retrievedAt = new Date(),
}) {
  if (!connectionString) throw new Error("需要 direct DATABASE_URL_UNPOOLED");
  const files = {
    licenses: `${inputDirectory}/36_2.csv`,
    ingredients: `${inputDirectory}/43_2.csv`,
    safety: `${inputDirectory}/53_2.csv`,
  };
  for (const filepath of Object.values(files))
    if (!existsSync(filepath)) throw new Error(`缺少藥品資料檔：${filepath}`);
  const ingredientSourceRows = parseCsv(files.ingredients, INGREDIENT_COLUMNS);
  const ingredientRows = normalizeIngredientRows(ingredientSourceRows);
  const safetyRows = parseCsv(files.safety, SAFETY_COLUMNS).map((row) =>
    normalizeSafetyCommunication(
      row,
      "https://data.fda.gov.tw/data/opendata/export/53/csv",
      retrievedAt,
    ),
  );
  const licenseRows = parseCsv(files.licenses, ["許可證字號", "用法用量"]);
  const usageRows = normalizeUsageRows(licenseRows);
  const pool = new Pool({
    connectionString,
    max: 1,
    connectionTimeoutMillis: 10_000,
  });
  const client = await pool.connect();
  const batchId = randomUUID();
  try {
    await client.query("BEGIN");
    await client.query("UPDATE medicines SET usage_dosage = ''");
    for (let index = 0; index < usageRows.length; index += 300) {
      await flush(
        client,
        "UPDATE medicines AS medicine SET usage_dosage = source.dosage FROM (VALUES ($1,$2)) AS source(license_number,dosage) WHERE medicine.license_number = source.license_number",
        usageRows.slice(index, index + 300),
      );
    }
    const existing = await client.query("SELECT license_number FROM medicines");
    const licenses = new Set(existing.rows.map((row) => row.license_number));
    const unmatchedUsageLicenses = usageRows.filter(
      ([license]) => !licenses.has(license),
    ).length;
    const missingIngredients = ingredientRows.filter(
      (row) => !licenses.has(row.licenseNumber),
    );
    if (missingIngredients.length)
      throw new Error(
        `成分資料有 ${missingIngredients.length} 筆找不到對應許可證`,
      );
    await client.query("DELETE FROM medicine_safety_license_links");
    await client.query("DELETE FROM medicine_safety_communications");
    await client.query("DELETE FROM medicine_ingredients");
    for (let index = 0; index < ingredientRows.length; index += 300) {
      await flush(
        client,
        "INSERT INTO medicine_ingredients(license_number,component_index,prescription_label,ingredient_name,ingredient_code,content_description,content_value,content_unit,source_updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)",
        ingredientRows
          .slice(index, index + 300)
          .map((row) => [
            row.licenseNumber,
            row.componentIndex,
            row.prescriptionLabel,
            row.ingredientName,
            row.ingredientCode,
            row.contentDescription,
            row.contentValue,
            row.contentUnit,
            retrievedAt,
          ]),
      );
    }
    for (let index = 0; index < safetyRows.length; index += 100) {
      const batch = safetyRows.slice(index, index + 100);
      await flush(
        client,
        "INSERT INTO medicine_safety_communications(message_id,publication_date,ingredient,scope_text,indications,mechanism,reason,safety_analysis,tfda_communication,link_method,source_url,retrieved_at,source_updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT (message_id) DO UPDATE SET publication_date=excluded.publication_date,ingredient=excluded.ingredient,scope_text=excluded.scope_text,indications=excluded.indications,mechanism=excluded.mechanism,reason=excluded.reason,safety_analysis=excluded.safety_analysis,tfda_communication=excluded.tfda_communication,link_method=excluded.link_method,retrieved_at=excluded.retrieved_at,source_updated_at=excluded.source_updated_at",
        batch.map((row) => [
          row.messageId,
          row.publicationDate,
          row.ingredient,
          row.scopeText,
          row.indications,
          row.mechanism,
          row.reason,
          row.safetyAnalysis,
          row.tfdaCommunication,
          row.linkMethod,
          row.sourceUrl,
          retrievedAt,
          retrievedAt,
        ]),
      );
      const links = batch.flatMap((row) =>
        row.licenseNumbers
          .filter((license) => licenses.has(license))
          .map((license) => [
            row.messageId,
            license,
            "exact-license-text",
            row.scopeText,
          ]),
      );
      if (links.length)
        await flush(
          client,
          "INSERT INTO medicine_safety_license_links(message_id,license_number,link_method,evidence) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING",
          links,
        );
    }
    const sources = [
      [
        "fda_medicine_licenses_36",
        "https://data.fda.gov.tw/data/opendata/export/36/csv",
        files.licenses,
        licenseRows.length,
      ],
      [
        "fda_medicine_ingredients_43",
        "https://data.fda.gov.tw/data/opendata/export/43/csv",
        files.ingredients,
        ingredientSourceRows.length,
      ],
      [
        "fda_safety_communications_53",
        "https://data.fda.gov.tw/data/opendata/export/53/csv",
        files.safety,
        safetyRows.length,
      ],
    ];
    for (const [key, url, filepath, rowCount] of sources)
      await client.query(
        "INSERT INTO source_imports(dataset_key,source_url,retrieved_at,source_sha256,row_count,batch_id) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (dataset_key) DO UPDATE SET source_url=excluded.source_url,retrieved_at=excluded.retrieved_at,source_sha256=excluded.source_sha256,row_count=excluded.row_count,batch_id=excluded.batch_id",
        [key, url, retrievedAt, sourceHash(filepath), rowCount, batchId],
      );
    await client.query("COMMIT");
    const exactSafetyLinks = safetyRows.reduce(
      (total, row) =>
        total +
        row.licenseNumbers.filter((license) => licenses.has(license)).length,
      0,
    );
    return {
      batchId,
      usageLicenses: usageRows.length,
      unmatchedUsageLicenses,
      ingredientRows: ingredientRows.length,
      safetyRows: safetyRows.length,
      exactSafetyCandidates: safetyRows.filter(
        (row) => row.licenseNumbers.length,
      ).length,
      exactSafetyLinks,
    };
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
      "用法：DATABASE_URL_UNPOOLED=<direct-url> node scripts/import-medicine-information.mjs <藥品資料夾>",
    );
    process.exitCode = 2;
  } else {
    try {
      console.log(
        JSON.stringify(
          await importMedicineInformation({ connectionString, inputDirectory }),
          null,
          2,
        ),
      );
    } catch {
      console.error(
        "藥品詳細資料匯入失敗；交易已回復，請檢查 CSV 與 migration。",
      );
      process.exitCode = 1;
    }
  }
}
