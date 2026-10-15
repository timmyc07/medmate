import { describe, expect, it } from "vitest";
import { normalizeMedicinePriceRow } from "../../scripts/import-medicine-prices.mjs";

describe("健保支付價正規化", () => {
  const row = {
    異動: "", 藥品代號: "A000000100", 藥品英文名稱: "Drug", 藥品中文名稱: "測試藥",
    成分: "成分", 規格量: "10", 規格單位: "毫克", 單複方: "單方", 支付價: "1.22",
    有效起日: "1150101", 有效迄日: "9991231", 藥品代碼超連結: "https://lmspiq.fda.gov.tw/web/DRPIQ/DRPIQ1000Result?licId=01000001",
  };

  it("將民國日轉西元並保留精確官方識別碼", () => {
    expect(normalizeMedicinePriceRow(row, "2026-10-15", "a".repeat(64))).toMatchObject({
      drugCode: "A000000100", effectiveFrom: "2026-01-01", effectiveUntil: null,
      price: "1.22", licenseId: "01000001", specification: "10 毫克",
    });
  });

  it("拒絕零價、異動及無效日期作為可展示價格", () => {
    expect(() => normalizeMedicinePriceRow({ ...row, 支付價: "0" }, "2026-10-15", "a".repeat(64))).toThrow();
    expect(() => normalizeMedicinePriceRow({ ...row, 異動: "刪除" }, "2026-10-15", "a".repeat(64))).toThrow();
    expect(() => normalizeMedicinePriceRow({ ...row, 有效起日: "1150230" }, "2026-10-15", "a".repeat(64))).toThrow();
  });
});
