import { JSDOM } from "jsdom";
import { extractExactLicenseNumbers } from "./import-medicine-information.mjs";
import { isRetailPrice } from "./retail-price-verification.mjs";

export function parseCyberbizProduct(html, model, url, source) {
  const productUrl = new URL(url);
  const expected = source.products.find(product => new URL(product.path, source.base).href === productUrl.href);
  if (!expected || productUrl.origin !== source.base) throw new Error("商品不在已核實來源清單");
  const document = JSDOM.fragment(html);
  const info = document.querySelector("#product_info");
  const specification = document.querySelector("#desc_section_2");
  const title = info?.querySelector("h1")?.textContent.trim();
  if (!info || !specification || !title) throw new Error("主要商品與規格資料未載入");
  if (model.id !== expected.productId || model.title !== title || model.handle !== decodeURIComponent(productUrl.pathname.split("/").at(-1))) throw new Error("主要商品識別碼不符");
  if (title !== expected.name) return { excluded: "品名或包裝標籤已改變，需重新審查" };
  const mainText = `${title}\n${info.querySelector(".product_brief")?.textContent || ""}\n${specification.textContent}`;
  const licenses = extractExactLicenseNumbers(mainText);
  const jsonSpec = model.other_descriptions?.filter(section => section.setting_name === "product_description_section_spec").map(section => section.body_html).join("\n") || "";
  const jsonLicenses = extractExactLicenseNumbers(`${model.brief || ""}\n${jsonSpec}`);
  if (licenses.length !== 1 || licenses[0] !== expected.licenseNumber || jsonLicenses.length !== 1 || jsonLicenses[0] !== licenses[0] || !/乙類成藥/.test(mainText)) return { excluded: "主要商品沒有一致、唯一的完整乙類成藥藥證" };
  const variants = model.variants;
  if (model.options?.length !== 0 || !Array.isArray(variants) || variants.length !== 1 || variants[0].id !== expected.variantId || variants[0].product_id !== model.id || variants[0].sku !== expected.sku || [variants[0].option1, variants[0].option2, variants[0].option3].some(option => option !== null)) return { excluded: "無法核實單一 SKU 與包裝規格" };
  // 容量只採主標題，避免把仿單用量或其他尺寸當成商品包裝；不補猜容器。
  const quantities = [...title.normalize("NFKC").matchAll(/(\d+(?:\.\d+)?)\s*(mL|ml|毫升|L|公升|g|公克|克)(?![A-Za-z])/g)].map(match => `${Number(match[1]) * (/^(L|公升)$/.test(match[2]) ? 1000 : 1)}${/^(g|公克|克)$/.test(match[2]) ? "g" : "mL"}`);
  if (quantities.length !== 1 || quantities[0] !== expected.specification || /組|任選|加購|附贈|附噴頭|[x×*]\s*\d/i.test(title)) return { excluded: "包裝容量或單品數量不明確" };
  const eligibility = JSON.parse(info.getAttribute("data-purchase-eligibility") || "null");
  if (model.hide_price !== false || model.sales_mode_purchasable !== true || model.available !== true || variants[0].available !== true || model.purchase_eligibility?.required !== false || model.purchase_eligibility?.eligible !== true || eligibility?.required !== false || eligibility?.eligible !== true || info.getAttribute("data-hide-price") !== "false" || info.getAttribute("data-sales-mode-purchasable") !== "true" || (model.sell_from && (!Number.isFinite(Date.parse(model.sell_from)) || Date.parse(model.sell_from) > Date.now())) || (model.sell_to && (!Number.isFinite(Date.parse(model.sell_to)) || Date.parse(model.sell_to) <= Date.now()))) return { excluded: "非一般單品公開售價或目前不可售" };
  const price = variants[0].price;
  if (!isRetailPrice(price)) throw new Error("無效自費售價");
  const visible = info.querySelector("#price_title .price .money_tag");
  if (model.price !== price || Number(visible?.getAttribute("data-amount")) !== price || visible?.getAttribute("data-currency-from") !== "TWD") return { excluded: "SKU 與頁面價格不一致" };
  const schemas = [...document.querySelectorAll('script[type="application/ld+json"]')].map(script => JSON.parse(script.textContent));
  const schema = schemas.find(item => item["@type"] === "Product" && item.productId === model.id && item.name === title && item.sku === expected.sku);
  const offers = Array.isArray(schema?.offers) ? schema.offers : [schema?.offers];
  const offer = offers[0];
  if (offers.length !== 1 || offer?.["@type"] !== "Offer" || offer.priceCurrency !== "TWD" || Number(offer.price) !== price || new URL(offer.url).href !== productUrl.href || (offer.sku && offer.sku !== String(variants[0].id))) return { excluded: "缺少同商品、同幣別的結構化售價佐證" };
  const productId = String(model.id);
  const skuId = String(variants[0].id);
  return {
    id: `${productId}:${skuId}`, name: title, licenseNumber: licenses[0], specification: expected.specification,
    skuId, listedPrice: isRetailPrice(variants[0].compare_at_price) ? variants[0].compare_at_price : null,
    salePrice: price, availability: "unknown", url, parserVersion: "cyberbiz-exact-sku-v1",
    evidence: { productId, skuId, merchantSku: expected.sku, title, specification: expected.specification, price, currency: "TWD", licenseNumber: licenses[0] },
  };
}
