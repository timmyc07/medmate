export const retailLicense = "衛署成製字第015702號";

export function retailHtml(url: string, price = 12, overrides: Record<string, unknown> = {}) {
  const id = Number(new URL(url).pathname.split("/").at(-1));
  const model = {
    Id: id, ShopId: 41218, CategoryId: 410434, Title: "虎標 萬金油 白色軟膏 (19g/罐)｜乙類成藥",
    ShortDescription: `<p>${retailLicense}</p>`, Price: price, MinPrice: price, MaxPrice: price, SuggestPrice: 15,
    HasSKU: false, SaleProductSKUIdList: [id + 1000], SKUPropertySetList: [{ SaleProductSKUId: id + 1000, Price: price, PropertyNameSet: "-1:-1:-1:-1" }],
    StatusDef: "Normal", SalePageKindDef: "Normal", IsSalePageBundle: false, IsPurchaseExtra: false, IsAPPOnly: false, IsRestricted: false, EnableIsComingSoon: true, IsComingSoon: false,
    ...overrides,
  };
  const schema = { "@type": "Product", name: model.Title, offers: { "@type": "Offer", url, price: String(model.Price), priceCurrency: "TWD" } };
  return `<script>window.ServerRenderData["SalePageIndexViewModel"] = ${JSON.stringify(model)};</script><script type="application/ld+json">${JSON.stringify(schema)}</script>`;
}
