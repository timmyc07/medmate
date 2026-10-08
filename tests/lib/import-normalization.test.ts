import { describe, expect, it } from "vitest";
import { normalizeDate, pharmacyCity } from "../../scripts/import-csv.mjs";

describe("CSV 匯入正規化", () => {
  it("正規化 YYYYMMDD 與 YYYY/MM/DD 日期，忽略空值與無效日期", () => {
    expect(normalizeDate("20261129")).toBe("2026-11-29");
    expect(normalizeDate("2026/11/29")).toBe("2026-11-29");
    expect(normalizeDate("")).toBeNull();
    expect(normalizeDate("20260231")).toBeNull();
  });

  it("只從公開地址取縣市，空值維持空值", () => {
    expect(pharmacyCity("臺北市中正區忠孝東路")).toBe("臺北市");
    expect(pharmacyCity("新竹縣竹北市" )).toBe("新竹縣");
    expect(pharmacyCity("")).toBeNull();
  });
});
