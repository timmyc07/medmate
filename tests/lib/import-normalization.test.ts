import { describe, expect, it } from "vitest";
import {
  normalizeDate,
  normalizeUsageRow,
  pharmacyCity,
} from "../../scripts/import-csv.mjs";

import {
  extractExactLicenseNumbers,
  normalizeIngredientRows,
  normalizeSafetyCommunication,
} from "../../scripts/import-medicine-information.mjs";

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

  it("保留同一許可證的多筆成分列並只移除完全重複列", () => {
    const rows = normalizeIngredientRows([
      {
        許可證字號: "衛部藥製字第000001號",
        處方標示: "每錠",
        成分名稱: "成分甲",
        成分代碼: "A",
        含量描述: "10",
        含量: "10",
        含量單位: "MG",
      },
      {
        許可證字號: "衛部藥製字第000001號",
        處方標示: "每錠",
        成分名稱: "成分甲",
        成分代碼: "A",
        含量描述: "20",
        含量: "20",
        含量單位: "MG",
      },
      {
        許可證字號: "衛部藥製字第000001號",
        處方標示: "每錠",
        成分名稱: "成分甲",
        成分代碼: "A",
        含量描述: "10",
        含量: "10",
        含量單位: "MG",
      },
    ]);
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.componentIndex)).toEqual([1, 2]);
    expect(rows[0].contentValue).toBe("10");
  });

  it("安全公告只從自由文字抽取完整許可證字號，不做成分模糊配對", () => {
    const row = normalizeSafetyCommunication(
      {
        發布日期: "2022/04/01",
        藥品成分: "成分甲",
        藥品名稱及許可證字號: "某藥（衛部藥輸字第027028號）",
        適應症: "原文適應症",
        藥理作用機轉: "原文機轉",
        訊息緣由: "原文緣由",
        藥品安全有關資訊分析及描述: "原文分析",
        TFDA風險溝通說明: "原文說明",
      },
      "https://data.fda.gov.tw/data/opendata/export/53/csv",
      new Date("2026-10-14T00:00:00Z"),
    );
    expect(row.publicationDate).toBe("2022-04-01");
    expect(row.licenseNumbers).toEqual(["衛部藥輸字第027028號"]);
    expect(row.linkMethod).toBe("exact-license-text");

    const unknown = extractExactLicenseNumbers(
      "含成分甲之藥品共計 10 張許可證",
    );
    expect(unknown).toEqual([]);
    expect(
      normalizeSafetyCommunication(
        {
          發布日期: "2022/04/01",
          藥品成分: "成分甲",
          藥品名稱及許可證字號: "含成分甲之藥品",
          適應症: "",
          藥理作用機轉: "",
          訊息緣由: "",
          藥品安全有關資訊分析及描述: "",
          TFDA風險溝通說明: "",
        },
        "https://data.gov.tw/dataset/9573",
        new Date("2026-10-14T00:00:00Z"),
      ).licenseNumbers,
    ).toEqual([]);
  });

  it("抽取許可證字號時會正規化號字前的空白", () => {
    expect(
      extractExactLicenseNumbers("許可證：衛部藥輸字第027028 號。"),
    ).toEqual(["衛部藥輸字第027028號"]);
  });

  it("用法資料允許相同許可證的完全相同重複列", async () => {
    const importer = await import(
      "../../scripts/import-medicine-information.mjs"
    );
    expect(
      importer.normalizeUsageRows([
        { 許可證字號: "衛部藥製字第000001號", 用法用量: "每日一次" },
        { 許可證字號: "衛部藥製字第000001號", 用法用量: "每日一次" },
      ]),
    ).toEqual([["衛部藥製字第000001號", "每日一次"]]);
  });

  it("用法資料遇到同一許可證的不同內容時拒絕匯入", async () => {
    const importer = await import(
      "../../scripts/import-medicine-information.mjs"
    );
    expect(importer.normalizeUsageRows).toBeTypeOf("function");
    expect(() =>
      importer.normalizeUsageRows([
        { 許可證字號: "衛部藥製字第000001號", 用法用量: "每日一次" },
        { 許可證字號: "衛部藥製字第000001號", 用法用量: "每日兩次" },
      ]),
    ).toThrow("同一許可證的用法用量內容不一致");
  });

  it("同一份安全公告在不同匯入時間仍維持穩定識別碼", () => {
    const source = {
      發布日期: "2022/04/01",
      藥品成分: "成分甲",
      藥品名稱及許可證字號: "某藥（衛部藥輸字第027028號）",
      適應症: "原文適應症",
      藥理作用機轉: "原文機轉",
      訊息緣由: "原文緣由",
      藥品安全有關資訊分析及描述: "原文分析",
      TFDA風險溝通說明: "原文說明",
    };
    expect(
      normalizeSafetyCommunication(
        source,
        "https://data.fda.gov.tw/data/opendata/export/53/csv",
        new Date("2026-10-14T00:00:00Z"),
      ).messageId,
    ).toBe(
      normalizeSafetyCommunication(
        source,
        "https://data.fda.gov.tw/data/opendata/export/53/csv",
        new Date("2026-10-15T00:00:00Z"),
      ).messageId,
    );
  });
});
