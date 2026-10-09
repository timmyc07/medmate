import { readFile } from "node:fs/promises";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL_UNPOOLED;
if (!connectionString) {
  console.error("需要設定 migration 專用 direct DATABASE_URL_UNPOOLED。");
  process.exit(2);
}

const pool = new Pool({
  connectionString,
  max: 1,
  connectionTimeoutMillis: 10_000,
});
try {
  for (const filename of ["001_catalog.sql", "002_medicine_usage.sql", "003_pharmacy_opening_hours.sql"]) {
    const sql = await readFile(
      new URL(`../db/migrations/${filename}`, import.meta.url),
      "utf8",
    );
    await pool.query(sql);
    console.log(`${filename} 已套用。`);
  }
} catch {
  console.error("Migration 失敗；未輸出資料庫錯誤或連線資訊。");
  process.exitCode = 1;
} finally {
  await pool.end();
}
