import { describe, expect, it } from "vitest";
import { parseSearchParams } from "../../src/lib/api/search-params";

describe("搜尋參數", () => {
  it("裁去首尾空格並套用預設分頁", () => {
    expect(parseSearchParams(new URLSearchParams("q=%20台北%20"))).toEqual({
      keyword: "台北",
      page: 1,
      pageSize: 20,
    });
  });

  it("拒絕空關鍵字、超長關鍵字與超出上限的分頁", () => {
    for (const query of ["", "q=%20", `q=${"a".repeat(101)}`, "q=藥&page=0", "q=藥&pageSize=51"]) {
      expect(() => parseSearchParams(new URLSearchParams(query))).toThrow();
    }
  });

  it("藥局位置查詢可只使用縣市與區域，並驗證座標範圍", () => {
    expect(parseSearchParams(new URLSearchParams("city=臺北市&district=中正區"), true, true)).toEqual({
      keyword: "",
      city: "臺北市",
      district: "中正區",
      page: 1,
      pageSize: 20,
    });
    expect(() => parseSearchParams(new URLSearchParams("lat=91&lng=121"), true, true)).toThrow();
    expect(() => parseSearchParams(new URLSearchParams("city=&district="), true, true)).toThrow();
  });
});
