import { describe, expect, it } from "vitest";
import { expandMedicineSearchTerms, MEDICINE_SYMPTOM_ALIASES } from "../../src/lib/medicine-symptoms";

describe("口語症狀搜尋詞", () => {
  it("將腳痛展開為官方適應症可能使用的足部與下肢詞", () => {
    expect(expandMedicineSearchTerms("腳痛")).toEqual(MEDICINE_SYMPTOM_ALIASES["腳痛"]);
  });

  it("未知詞只搜尋原詞，不自行猜測療效", () => {
    expect(expandMedicineSearchTerms("罕見自訂詞")).toEqual(["罕見自訂詞"]);
  });

  it("支援鼻塞與常見口語鼻部症狀", () => {
    expect(expandMedicineSearchTerms("鼻塞")).toContain("鼻炎");
  });
});
