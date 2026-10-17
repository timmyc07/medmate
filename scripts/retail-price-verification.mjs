import { extractExactLicenseNumbers } from "./import-medicine-information.mjs";

export function normalizeRetailPackage(value) {
  const text = String(value).normalize("NFKC").trim();
  const match = /^(\d+(?:\.\d+)?)\s*(ml|mL|毫升|g|公克|克|錠|粒|片)\s*\/\s*(瓶|罐|盒|包)$/u.exec(text);
  if (!match || !Number.isFinite(Number(match[1])) || Number(match[1]) <= 0) return null;
  const unit = /^(ml|mL|毫升)$/.test(match[2]) ? "mL" : /^(g|公克|克)$/.test(match[2]) ? "g" : match[2];
  return `${Number(match[1])}${unit}/${match[3]}`;
}

export function parseRetailProduct(html, url, source) {
  const data = html.match(/window\.ServerRenderData\["SalePageIndexViewModel"\]\s*=\s*(\{[^\r\n]*\});/);
  if (!data) throw new Error("主要商品資料未載入");
  const model = JSON.parse(data[1]);
  const productId = new URL(url).pathname.match(/^\/SalePage\/Index\/(\d+)$/)?.[1];
  if (new URL(url).origin !== source.base || String(model.Id) !== productId || model.ShopId !== source.shopId) throw new Error("主要商品識別碼不符");
  if (model.CategoryId !== source.categoryId || !/乙類成藥/.test(model.Title)) return { excluded: "非指定乙類成藥商品" };
  const licenses = extractExactLicenseNumbers(model.ShortDescription);
  if (licenses.length !== 1) return { excluded: "缺少唯一完整藥品許可證" };
  const packs = [...model.Title.normalize("NFKC").matchAll(/\(([^()]*)\)/g)].map(match => normalizeRetailPackage(match[1])).filter(Boolean);
  const sku = model.SKUPropertySetList;
  if (packs.length !== 1 || model.HasSKU !== false || !Array.isArray(sku) || sku.length !== 1 || sku[0].PropertyNameSet !== "-1:-1:-1:-1" || !Number.isSafeInteger(sku[0].SaleProductSKUId) || sku[0].SaleProductSKUId <= 0 || model.SaleProductSKUIdList?.length !== 1 || sku[0].SaleProductSKUId !== model.SaleProductSKUIdList[0]) return { excluded: "無法核實單一 SKU 與包裝規格" };
  if (model.IsSalePageBundle || model.IsPurchaseExtra || model.IsAPPOnly || model.IsRestricted || model.IsComingSoon !== false || sku[0].IsShow === false || model.StatusDef !== "Normal" || model.SalePageKindDef !== "Normal") return { excluded: "非一般單品公開售價" };
  const price = model.Price;
  if (!Number.isFinite(price) || price <= 0 || price > 9_999_999_999.99 || !/^\d+(?:\.\d{1,2})?$/.test(String(price))) throw new Error("無效自費售價");
  if (![model.MinPrice, model.MaxPrice, sku[0].Price].every(amount => amount === price)) return { excluded: "SKU 與頁面價格不一致或為價格區間" };
  const schemas = [...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map(match => JSON.parse(match[1]));
  const schema = schemas.find(item => item["@type"] === "Product" && item.name === model.Title);
  const offer = schema?.offers;
  if (offer?.["@type"] !== "Offer" || offer.priceCurrency !== "TWD" || Number(offer.price) !== price || new URL(offer.url).hostname !== new URL(url).hostname || new URL(offer.url).pathname !== new URL(url).pathname) return { excluded: "缺少同商品、同幣別的結構化售價佐證" };
  return {
    id: `${productId}:${sku[0].SaleProductSKUId}`, name: model.Title, licenseNumber: licenses[0],
    specification: packs[0], skuId: String(sku[0].SaleProductSKUId),
    listedPrice: Number.isFinite(model.SuggestPrice) && model.SuggestPrice > 0 && model.SuggestPrice <= 9_999_999_999.99 && /^\d+(?:\.\d{1,2})?$/.test(String(model.SuggestPrice)) ? model.SuggestPrice : null, salePrice: price,
    availability: "unknown", url,
    evidence: { productId, skuId: String(sku[0].SaleProductSKUId), title: model.Title, specification: packs[0], price, currency: "TWD", licenseNumber: licenses[0] },
  };
}
