import "server-only";
import { Pool } from "pg";

let pool: Pool | undefined;

export function getPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL 未設定");
  if (!pool) {
    pool = new Pool({
      connectionString,
      max: 5,
      connectionTimeoutMillis: 5_000,
      idleTimeoutMillis: 30_000,
      statement_timeout: 10_000,
      application_name: "medmate-web",
    });
    pool.on("error", () => {
      // 不記錄連線錯誤細節，避免憑證或查詢內容進入公開日誌。
    });
  }
  return pool;
}
