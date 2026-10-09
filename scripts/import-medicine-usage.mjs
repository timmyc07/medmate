import { importMedicineUsageFiles } from "./import-csv.mjs";

const connectionString = process.env.DATABASE_URL_UNPOOLED;
const inputDirectory = process.argv[2];
if (!connectionString || !inputDirectory) {
  console.error(
    "用法：DATABASE_URL_UNPOOLED=<direct-url> node scripts/import-medicine-usage.mjs <藥品資料夾>",
  );
  process.exit(2);
}

try {
  const summary = await importMedicineUsageFiles({
    connectionString,
    inputDirectory,
  });
  console.log(JSON.stringify(summary, null, 2));
} catch {
  console.error(
    "藥品使用量匯入失敗；新增資料交易已回復，請檢查來源 CSV 與 migration。",
  );
  process.exitCode = 1;
}
