import { describe, expect, it } from "vitest";
import {
  normalizeDate,
  normalizeUsageRow,
  pharmacyCity,
} from "../../scripts/import-csv.mjs";

describe("CSV 匯入正規化", () => {
  it("正規化 YYYYMMDD 與 YYYY/MM/DD 日期，忽略空值與無效日期", () => {
    expect(normalizeDate("20261129")).toBe("2026-11-29");
    expect(normalizeDate("2026/11/29")).toBe("2026-11-29");
    expect(normalizeDate("")).toBeNull();
    expect(normalizeDate("20260231")).toBeNull();
  });

  it("只從公開地址取縣市，空值維持空值", () => {
    expect(pharmacyCity("臺北市中正區忠孝東路")).toBe("臺北市");
    expect(pharmacyCity("新竹縣竹北市")).toBe("新竹縣");
    expect(pharmacyCity("")).toBeNull();
  });

  it("修復未引用逗號造成的分類欄位偏移並保留最後年度醫令量", () => {
    const row = [
      "111",
      "A019788100",
      "THIAMINE 2MG + NIACIN 15MG， 一般錠",
      "11101",
      "11112",
      "0.0",
      "0.0",
      "0.0",
      "39560.5",
      "64348.5",
      "103909.0",
    ];
    expect(normalizeUsageRow(row, 111)).toMatchObject({
      code: "A019788100",
      quantities: [0, 0, 0, 39560.5, 64348.5, 103909],
    });
  });

  it("修復健保原始 CSV 尾端分類欄黏住起始年月的欄位錯位", () => {
    const row = [
      "111",
      "A019788100",
      "THIAMINE 2MG + NIACIN 15MG, 一般錠11101",
      "11112",
      "0",
      "0",
      "0",
      "39560.5",
      "64348.5",
      "103909",
    ];
    expect(normalizeUsageRow(row, 111)).toMatchObject({
      start: "11101",
      end: "11112",
      quantities: [0, 0, 0, 39560.5, 64348.5, 103909],
    });
  });

  it("拒絕費用年度不符或負使用量的來源列", () => {
    expect(() =>
      normalizeUsageRow(
        ["114", "A019788100", "drug", "11401", "11412", 0, 0, 0, 0, 0, -1],
        115,
      ),
    ).toThrow("驗證失敗");
  });
});
