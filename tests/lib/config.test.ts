import { describe, expect, it } from "vitest";
import { getDatabaseConfig } from "../../src/lib/config";

describe("資料庫設定", () => {
  it("必要設定缺漏時拒絕啟動且不洩漏密碼", () => {
    expect(() => getDatabaseConfig({ SQL_PASSWORD: "do-not-leak" })).toThrow();
    try {
      getDatabaseConfig({ SQL_PASSWORD: "do-not-leak" });
    } catch (error) {
      expect(String(error)).not.toContain("do-not-leak");
    }
  });

  it("預設啟用 TLS 並拒絕未驗證憑證", () => {
    const config = getDatabaseConfig({
      SQL_SERVER: "localhost",
      SQL_DATABASE: "PharmacyDB",
      SQL_USER: "readonly",
      SQL_PASSWORD: "test-password",
    });

    expect(config.options.encrypt).toBe(true);
    expect(config.options.trustServerCertificate).toBe(false);
  });
});
