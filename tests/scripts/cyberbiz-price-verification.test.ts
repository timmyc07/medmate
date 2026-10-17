// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { parseCyberbizProduct } from "../../scripts/cyberbiz-price-verification.mjs";
import { collectProducts, readRetailProduct } from "../../scripts/crawl-retail-prices.mjs";
import { cyberbizFixture, cyberbizSource as source, cyberbizUrl as url } from "../fixtures/cyberbiz-product";
import { retailLicense } from "../fixtures/retail-product";

describe("Cyberbiz 跨通路精確配對", () => {
  it("核對頁面、公開 JSON、SKU、藥證、容量及三處同幣售價", async () => {
    const fixture = cyberbizFixture();
    expect(parseCyberbizProduct(fixture.html, fixture.model, url, source)).toMatchObject({ id: "1:2", skuId: "2", specification: "500mL", salePrice: 80, licenseNumber: retailLicense, parserVersion: "cyberbiz-exact-sku-v1" });
    const read = vi.fn(async (address: string) => address.endsWith(".json") ? JSON.stringify(fixture.model) : fixture.html);
    expect(await readRetailProduct(url, source, read)).toHaveProperty("salePrice", 80);
    expect(read.mock.calls.map(([address]) => address)).toEqual([url, `${url}.json`]);
    expect(await collectProducts(source)).toEqual([url]);
    await expect(collectProducts({ ...source, products: [{ ...source.products[0], path: "https://evil.test/products/1" }] })).rejects.toThrow("網址");
    await expect(collectProducts({ ...source, products: [] })).rejects.toThrow("清單");
  });

  it.each([
    { options: ["規格"] },
    { variants: [{ id: 2 }, { id: 3 }] },
    { variants: [{ id: 2, product_id: 1, sku: "WRONG" }] },
    { title: "藥用酒精 100ml" },
    { title: "藥用酒精 500ml 6瓶組" },
    { title: "測試藥用酒精 500ml 2入" },
    { title: "藥用酒精 500ml / 4000ml" },
    { hide_price: true },
    { sales_mode_purchasable: false },
    { available: false },
    { purchase_eligibility: { required: true, eligible: true } },
    { sell_from: "2099-01-01T00:00:00Z" },
    { sell_to: "2000-01-01T00:00:00Z" },
    { sell_from: "bad date" },
    { other_descriptions: [{ setting_name: "product_description_section_spec", body_html: "衛署成製字第014632號" }] },
    { other_descriptions: [{ setting_name: "product_description_section_spec", body_html: `${retailLicense}、衛署成製字第014632號` }] },
  ])("排除不一致或條件價：%j", overrides => {
    const fixture = cyberbizFixture(overrides);
    expect(parseCyberbizProduct(fixture.html, fixture.model, url, source)).toHaveProperty("excluded");
  });

  it("不能借用推薦區藥證，亦不接受幣別、價格或結構化 SKU 不一致", () => {
    const fixture = cyberbizFixture();
    for (const html of [
      `${fixture.html.replace(`容量：500ml</p><p>${retailLicense}`, "容量：500ml")}<aside>${retailLicense}</aside>`,
      fixture.html.replace('"priceCurrency":"TWD"', '"priceCurrency":"USD"'),
      fixture.html.replace('data-amount="80"', 'data-amount="1"'),
      fixture.html.replace('"sku":"2"', '"sku":"3"'),
    ]) expect(parseCyberbizProduct(html, fixture.model, url, source)).toHaveProperty("excluded");
    expect(() => parseCyberbizProduct(fixture.html, { ...fixture.model, id: 3 }, url, source)).toThrow("識別碼");
    expect(() => parseCyberbizProduct("loading", fixture.model, url, source)).toThrow("未載入");
    for (const price of [0, 0.001, 10_000_000_000]) {
      const bad = cyberbizFixture({ price, variants: [{ ...fixture.model.variants[0], price }] });
      expect(() => parseCyberbizProduct(bad.html, bad.model, url, source)).toThrow("售價");
    }
  });

  it("乙類成藥可在主標題揭露；4L 容量轉成 4000mL，不推測容器", () => {
    const fixture = cyberbizFixture({ title: "乙類成藥 500ml", brief: "" });
    expect(parseCyberbizProduct(fixture.html, fixture.model, url, { ...source, products: [{ ...source.products[0], name: fixture.model.title }] })).toHaveProperty("specification", "500mL");
    const fourLitres = cyberbizFixture({ title: "藥用酒精 (4L/桶)" });
    expect(parseCyberbizProduct(fourLitres.html, fourLitres.model, url, { ...source, products: [{ ...source.products[0], name: fourLitres.model.title, specification: "4000mL" }] })).toHaveProperty("specification", "4000mL");
  });
});
