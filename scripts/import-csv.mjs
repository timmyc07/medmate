import { createHash, randomUUID } from "node:crypto";
import { createReadStream, existsSync } from "node:fs";
import { Transform } from "node:stream";
import { parse } from "csv-parse";
import { Pool } from "pg";

const USAGE_COLUMNS = [
  "費用年",
  "藥品代碼",
  "藥品分類分組名稱",
  "申報起始年月",
  "申報結束年月",
  "醫令量_男性",
  "醫令量_女性",
  "醫令量_合計",
  "含包裹支付的醫令量_男性",
  "含包裹支付的醫令量_女性",
  "含包裹支付的醫令量_合計",
];

export function normalizeUsageRow(row, expectedYear) {
  let values = Array.isArray(row)
    ? [...row]
    : USAGE_COLUMNS.map((column) => row[column]);
  if (values.length === 10) {
    const embeddedPeriod = /(\d{5})\s*$/.exec(String(values[2] ?? ""));
    if (!embeddedPeriod)
      throw new Error("健保使用量分類欄缺少可還原的申報起始年月");
    values = [
      values[0],
      values[1],
      String(values[2]).slice(0, embeddedPeriod.index).trim(),
      embeddedPeriod[1],
      ...values.slice(3),
    ];
  } else if (values.length > 11) {
    values = [
      ...values.slice(0, 2),
      values.slice(2, values.length - 8).join(","),
      ...values.slice(-8),
    ];
  }
  if (values.length !== 11) throw new Error("健保藥品使用量資料欄數不符");
  const [
    yearValue,
    codeValue,
    _group,
    startValue,
    endValue,
    maleValue,
    femaleValue,
    totalValue,
    packageMaleValue,
    packageFemaleValue,
    packageTotalValue,
  ] = values.map((value) => String(value ?? "").trim());
  const year = Number(yearValue);
  const code = codeValue;
  const start = startValue;
  const end = endValue;
  const quantities = [
    maleValue,
    femaleValue,
    totalValue,
    packageMaleValue,
    packageFemaleValue,
    packageTotalValue,
  ].map(Number);
  if (
    year !== expectedYear ||
    !/^[A-Z0-9]{6,12}$/.test(code) ||
    !/^\d{5}$/.test(start) ||
    !/^\d{5}$/.test(end) ||
    Number(start.slice(0, 3)) !== year ||
    Number(end.slice(0, 3)) !== year ||
    quantities.some((quantity) => !Number.isFinite(quantity) || quantity < 0)
  ) {
    throw new Error("健保藥品使用量資料列驗證失敗");
  }
  return { year, code, start, end, quantities };
}

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

export async function importUsageCsv(
  client,
  filepath,
  expectedYear,
  retrievedAt,
  batchId,
) {
  let rowCount = 0;
  let periodStart = "99999";
  let periodEnd = "00000";
  const hash = createHash("sha256");
  const hashing = new Transform({
    transform(chunk, _encoding, callback) {
      hash.update(chunk);
      callback(null, chunk);
    },
  });
  const parser = createReadStream(filepath)
    .pipe(hashing)
    .pipe(
      parse({
        bom: true,
        columns: false,
        skip_empty_lines: true,
        relax_quotes: true,
        relax_column_count: true,
        trim: true,
      }),
    );
  let header = true;
  const usageByCode = new Map();
  for await (const row of parser) {
    if (header) {
      if (
        JSON.stringify(row.map((value) => value.trim())) !==
        JSON.stringify(USAGE_COLUMNS)
      )
        throw new Error("健保藥品使用量 CSV 欄位與白名單不符");
      header = false;
      continue;
    }
    const normalized = normalizeUsageRow(row, expectedYear);
    periodStart =
      normalized.start < periodStart ? normalized.start : periodStart;
    periodEnd = normalized.end > periodEnd ? normalized.end : periodEnd;
    const previous = usageByCode.get(normalized.code);
    if (previous) {
      previous[2] =
        previous[2] < normalized.start ? previous[2] : normalized.start;
      previous[3] = previous[3] > normalized.end ? previous[3] : normalized.end;
      previous[4] += normalized.quantities[2];
      previous[5] += normalized.quantities[5];
    } else {
      usageByCode.set(normalized.code, [
        normalized.year,
        normalized.code,
        normalized.start,
        normalized.end,
        normalized.quantities[2],
        normalized.quantities[5],
        retrievedAt,
      ]);
    }
    rowCount += 1;
  }
  if (rowCount === 0) throw new Error("健保藥品使用量資料為空");
  const upsert =
    "INSERT INTO medicine_usage(fee_year,drug_code,reporting_period_start,reporting_period_end,claim_quantity,package_claim_quantity,source_updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (fee_year,drug_code) DO UPDATE SET reporting_period_start=excluded.reporting_period_start,reporting_period_end=excluded.reporting_period_end,claim_quantity=excluded.claim_quantity,package_claim_quantity=excluded.package_claim_quantity,source_updated_at=excluded.source_updated_at";
  const usageRows = [...usageByCode.values()];
  for (let index = 0; index < usageRows.length; index += 300)
    await flush(
      client,
      upsert,
      usageRows.slice(index, index + 300),
      (values) => values[1],
    );
  const sourceUrl = "https://data.nhi.gov.tw/";
  await client.query(
    "INSERT INTO medicine_usage_imports(fee_year,source_url,retrieved_at,source_sha256,row_count,reporting_period_start,reporting_period_end,batch_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (fee_year) DO UPDATE SET source_url=excluded.source_url,retrieved_at=excluded.retrieved_at,source_sha256=excluded.source_sha256,row_count=excluded.row_count,reporting_period_start=excluded.reporting_period_start,reporting_period_end=excluded.reporting_period_end,batch_id=excluded.batch_id",
    [
      expectedYear,
      sourceUrl,
      retrievedAt,
      hash.digest("hex"),
      usageByCode.size,
      periodStart,
      periodEnd,
      batchId,
    ],
  );
  return {
    sourceRows: rowCount,
    uniqueDrugs: usageByCode.size,
    periodStart,
    periodEnd,
  };
}

export async function importMedicineCatalog(
  client,
  directory,
  retrievedAt,
  batchId,
) {
  const catalogPath = `${directory}/A21030000I-E41001-001.csv`;
  const appearancePath = `${directory}/42_2.csv`;
  if (!existsSync(catalogPath) || !existsSync(appearancePath)) return null;
  const catalog = new Map();
  const licenseNumbers = new Map();
  const medicineLicensePath = `${directory}/36_2.csv`;
  if (!existsSync(medicineLicensePath))
    throw new Error("缺少 FDA 藥品許可證資料 CSV");
  const licenseParser = createReadStream(medicineLicensePath).pipe(
    parse({
      bom: true,
      columns: true,
      skip_empty_lines: true,
      relax_quotes: true,
      relax_column_count: true,
      trim: true,
    }),
  );
  for await (const row of licenseParser) {
    const id = /([0-9]{6})[0-9]{2}$/.exec(row.通關簽審文件編號 ?? "")?.[1];
    const licenseNumber = row.許可證字號?.trim();
    if (!id || !licenseNumber) continue;
    const matches = licenseNumbers.get(id) ?? new Set();
    matches.add(licenseNumber);
    licenseNumbers.set(id, matches);
  }
  const catalogHash = createHash("sha256");
  let rowCount = 0;
  const catalogHashing = new Transform({
    transform(chunk, _encoding, callback) {
      catalogHash.update(chunk);
      callback(null, chunk);
    },
  });
  const catalogParser = createReadStream(catalogPath)
    .pipe(catalogHashing)
    .pipe(
      parse({
        bom: true,
        columns: true,
        skip_empty_lines: true,
        relax_quotes: true,
        relax_column_count: true,
        trim: true,
      }),
    );
  for await (const row of catalogParser) {
    const code = row.藥品代號?.trim();
    const sourceLicenseId =
      /[?&]licId=([^&]+)/.exec(row.藥品代碼超連結 ?? "")?.[1] ?? null;
    const licenseMatches = sourceLicenseId?.match(/^\d{8}$/)
      ? [...(licenseNumbers.get(sourceLicenseId.slice(2)) ?? [])]
      : [];
    const licenseId = licenseMatches.length === 1 ? licenseMatches[0] : null;
    if (!code || !/^[A-Z0-9]{6,12}$/.test(code)) continue;
    const existing = catalog.get(code);
    const entry = {
      code,
      name: row.藥品中文名稱?.trim() || row.藥品英文名稱?.trim() || code,
      englishName: row.藥品英文名稱?.trim() ?? "",
      ingredient: row.成分?.trim() ?? "",
      dosageForm: row.劑型?.trim() ?? "",
      licenseId,
    };
    if (!existing || (!existing.licenseId && licenseId))
      catalog.set(code, entry);
    rowCount += 1;
  }
  const catalogBatch = [...catalog.values()].map((entry) => [
    entry.code,
    entry.name,
    entry.englishName,
    entry.ingredient,
    entry.dosageForm,
    entry.licenseId,
    retrievedAt,
  ]);
  const catalogInsert =
    "INSERT INTO nhi_medicine_catalog(drug_code,name,english_name,ingredient,dosage_form,fda_license_id,source_updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (drug_code) DO UPDATE SET name=excluded.name,english_name=excluded.english_name,ingredient=excluded.ingredient,dosage_form=excluded.dosage_form,fda_license_id=excluded.fda_license_id,source_updated_at=excluded.source_updated_at";
  for (let index = 0; index < catalogBatch.length; index += 300)
    await flush(
      client,
      catalogInsert,
      catalogBatch.slice(index, index + 300),
      (values) => values[0],
    );
  const appearances = new Map();
  const appearanceParser = createReadStream(appearancePath).pipe(
    parse({
      bom: true,
      columns: true,
      skip_empty_lines: true,
      relax_quotes: true,
      trim: true,
    }),
  );
  for await (const row of appearanceParser) {
    const licenseNumber = row.許可證字號?.trim();
    const imageUrl = row.外觀圖檔連結?.split(";;")[0]?.trim() ?? "";
    if (!licenseNumber || !/^https:\/\/mcp\.fda\.gov\.tw\//.test(imageUrl))
      continue;
    appearances.set(licenseNumber, {
      licenseNumber,
      shape: row.形狀?.split(";;")[0]?.trim() ?? "",
      color: row.顏色?.split(";;")[0]?.trim() ?? "",
      imprint: [row.標註一, row.標註二].filter(Boolean).join(" / "),
      imageUrl,
    });
  }
  await client.query("DELETE FROM medicine_appearances");
  const appearanceRows = [...appearances.values()].map((appearance) => [
    appearance.licenseNumber,
    appearance.shape,
    appearance.color,
    appearance.imprint,
    appearance.imageUrl,
    retrievedAt,
  ]);
  const appearanceInsert =
    "INSERT INTO medicine_appearances(license_number,shape,color,imprint,image_url,source_updated_at) VALUES ($1,$2,$3,$4,$5,$6)";
  for (let index = 0; index < appearanceRows.length; index += 300)
    await flush(
      client,
      appearanceInsert,
      appearanceRows.slice(index, index + 300),
      (values) => values[0],
    );
  await client.query(
    "INSERT INTO source_imports(dataset_key,source_url,retrieved_at,source_sha256,row_count,batch_id) VALUES ('nhi_medicine_catalog','https://data.nhi.gov.tw/',$1,$2,$3,$4) ON CONFLICT (dataset_key) DO UPDATE SET retrieved_at=excluded.retrieved_at,source_sha256=excluded.source_sha256,row_count=excluded.row_count,batch_id=excluded.batch_id",
    [retrievedAt, catalogHash.digest("hex"), rowCount, batchId],
  );
  return { catalogCodes: catalog.size, appearanceRecords: appearances.size };
}

export async function importMedicineUsageFiles({
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
    const catalog = await importMedicineCatalog(
      client,
      inputDirectory,
      retrievedAt,
      batchId,
    );
    if (!catalog) throw new Error("缺少健保藥品清單或 FDA 外觀 CSV");
    results.catalog = catalog;
    for (const year of [111, 112, 113, 114, 115]) {
      const filepath = `${inputDirectory}/A21030000I-E41005-${String(year - 110).padStart(3, "0")}.csv`;
      if (!existsSync(filepath))
        throw new Error(`缺少民國 ${year} 年藥品使用量 CSV`);
      await client.query("DELETE FROM medicine_usage WHERE fee_year = $1", [
        year,
      ]);
      results[`usage${year}`] = await importUsageCsv(
        client,
        filepath,
        year,
        retrievedAt,
        batchId,
      );
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
      "固定看診時段",
      "終止合約或歇業日期",
      "合約起日",
    ],
    insert: `INSERT INTO pharmacy_contracts (institution_code,institution_name,institution_type,phone,address,service_area,contract_type,services,opening_hours,termination_date,contract_start_date,source_updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT (institution_code) DO UPDATE SET institution_name=excluded.institution_name,institution_type=excluded.institution_type,phone=excluded.phone,address=excluded.address,service_area=excluded.service_area,contract_type=excluded.contract_type,services=excluded.services,opening_hours=excluded.opening_hours,termination_date=excluded.termination_date,contract_start_date=excluded.contract_start_date,source_updated_at=excluded.source_updated_at`,
    values: (r, at) => [
      r.醫事機構代碼,
      r.醫事機構名稱,
      r.醫事機構種類,
      r.電話,
      r.地址,
      r.分區業務組,
      r.特約類別,
      r.服務項目,
      r.固定看診時段 || null,
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
  const query = template.replace(
    /VALUES \(\$1(?:,\$\d+)*\)/,
    `VALUES ${values}`,
  );
  await client.query(query, params);
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
    await client.query(
      "CREATE TEMP TABLE pharmacy_contract_coordinates ON COMMIT DROP AS SELECT institution_code, latitude, longitude, geocoded_at, geocode_provider FROM pharmacy_contracts WHERE latitude IS NOT NULL AND longitude IS NOT NULL",
    );
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
        await client.query(
          "UPDATE pharmacy_contracts AS current SET latitude = saved.latitude, longitude = saved.longitude, geocoded_at = saved.geocoded_at, geocode_provider = saved.geocode_provider FROM pharmacy_contract_coordinates AS saved WHERE current.institution_code = saved.institution_code",
        );
      }
      results[key] = { rowCount, sha256 };
    }
    const medicineCatalog = await importMedicineCatalog(
      client,
      inputDirectory,
      retrievedAt,
      batchId,
    );
    if (medicineCatalog) {
      results.medicineCatalog = medicineCatalog;
      for (const year of [111, 112, 113, 114, 115]) {
        const filepath = `${inputDirectory}/A21030000I-E41005-${String(year - 110).padStart(3, "0")}.csv`;
        if (!existsSync(filepath)) continue;
        await client.query("DELETE FROM medicine_usage WHERE fee_year = $1", [
          year,
        ]);
        const usage = await importUsageCsv(
          client,
          filepath,
          year,
          retrievedAt,
          batchId,
        );
        results[`medicineUsage${year}`] = usage;
      }
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
