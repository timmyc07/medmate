// @vitest-environment node
import { describe, expect, it } from "vitest";
import { strToU8, zipSync } from "fflate";
import { normalizeRetailPackage, parseRetailProduct } from "../../scripts/retail-price-verification.mjs";
import { parseRetailLicenses } from "../../scripts/refresh-retail-licenses.mjs";
import { retailHtml, retailLicense } from "../fixtures/retail-product";

const source = { base: "https://a.test", shopId: 41218, categoryId: 410434 };
const url = `${source.base}/SalePage/Index/1`;

describe("藥品售價與規格核實", () => {
  it("只接受完整藥證、同一單一 SKU、同一包裝與同一公開價格", () => {
    expect(parseRetailProduct(retailHtml(url), url, source)).toMatchObject({ id: "1:1001", licenseNumber: retailLicense, specification: "19g/罐", salePrice: 12, skuId: "1001" });
    expect(normalizeRetailPackage("500毫升/瓶")).toBe("500mL/瓶");
    for (const pack of ["19g/罐 30g/罐", "500ml+噴頭", "2盒任選", "0g/罐", `${"9".repeat(400)}g/罐`]) expect(normalizeRetailPackage(pack)).toBeNull();
  });

  it.each([
    { CategoryId: 1, Title: "書籍" },
    { ShortDescription: "保健食品" },
    { ShortDescription: `${retailLicense}、衛部成製字第016844號` },
    { Title: "乙類成藥 (19g/罐) (30g/罐)" },
    { SKUPropertySetList: [{ SaleProductSKUId: 1001, Price: 12 }, { SaleProductSKUId: 1002, Price: 20 }] },
    { MinPrice: 10, MaxPrice: 20 },
    { IsSalePageBundle: true },
    { IsPurchaseExtra: true },
    { IsAPPOnly: true },
    { HasSKU: true },
    { IsComingSoon: true },
    { SaleProductSKUIdList: ["1001"], SKUPropertySetList: [{ SaleProductSKUId: "1001", Price: 12 }] },
    { SKUPropertySetList: [{ SaleProductSKUId: 1001, Price: 12, IsShow: false }] },
  ])("拒絕無關商品、歧義規格或條件價：%j", (overrides) => {
    expect(parseRetailProduct(retailHtml(url, 12, overrides), url, source)).toHaveProperty("excluded");
  });

  it("推薦區的藥證不能替主要商品配對，價格不可跨商品或幣別", () => {
    expect(parseRetailProduct(`${retailHtml(url, 12, { ShortDescription: "" })}<p>${retailLicense}</p>`, url, source)).toHaveProperty("excluded");
    expect(parseRetailProduct(retailHtml(url).replace('"priceCurrency":"TWD"', '"priceCurrency":"USD"'), url, source)).toHaveProperty("excluded");
    expect(() => parseRetailProduct(retailHtml(url), `${source.base}/SalePage/Index/2`, source)).toThrow("識別碼");
    expect(() => parseRetailProduct("<html>loading</html>", url, source)).toThrow("未載入");
    for (const price of [0, 0.001, 10_000_000_000]) expect(() => parseRetailProduct(retailHtml(url, price), url, source)).toThrow("售價");
    expect(parseRetailProduct(retailHtml(url, 12, { SuggestPrice: "優惠價" }), url, source)).toMatchObject({ salePrice: 12, listedPrice: null });
  });
});

describe("TFDA 藥證核實快照", () => {
  const header = "許可證字號,藥品類別,包裝,有效日期,註銷狀態\n";
  const rows = Array.from({ length: 1000 }, (_, i) => `衛署成製字第${String(i + 1).padStart(6, "0")}號,乙類成藥,玻璃瓶裝,2030/01/01,`).join("\n");
  const zip = (csv: string) => zipSync({ "36_2.csv": strToU8(csv) });
  it("只保存必要的官方核實欄位與來源 hash", () => {
    const result = parseRetailLicenses(zip(header + rows));
    expect(result.licenses).toHaveLength(1000);
    expect(result.licenses[0]).toMatchObject({ category: "乙類成藥", validUntil: "2030-01-01", cancelled: false });
    expect(result.sha256).toMatch(/^[a-f0-9]{64}$/);
  });
  it("來源不完整、欄位不符或同藥證內容衝突時停止，不覆寫核實資料", () => {
    expect(() => parseRetailLicenses(zip(header))).toThrow();
    expect(() => parseRetailLicenses(zip("許可證字號\n錯誤"))).toThrow();
    expect(() => parseRetailLicenses(zip(`${header}${rows}\n衛署成製字第000001號,處方藥,玻璃瓶裝,2030/01/01,`))).toThrow("衝突");
  });
});
