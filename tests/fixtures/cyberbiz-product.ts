import { retailLicense } from "./retail-product";

export const cyberbizSource = {
  id: "00000000-0000-4000-8000-000000000003", name: "Cyberbiz test", base: "https://c.test", platform: "cyberbiz", catalog: "https://c.test/medicines",
  products: [{ path: "/products/alcohol-500ml", name: "測試藥用酒精 500ml", productId: 1, variantId: 2, sku: "ALC-500ML", licenseNumber: retailLicense, specification: "500mL" }],
};
export const cyberbizUrl = `${cyberbizSource.base}${cyberbizSource.products[0].path}`;

export function cyberbizFixture(overrides: Record<string, unknown> = {}) {
  const model = {
    id: 1, handle: "alcohol-500ml", title: "測試藥用酒精 500ml", price: 80, brief: "乙類成藥",
    variants: [{ id: 2, product_id: 1, option1: null, option2: null, option3: null, available: true, title: "", sku: "ALC-500ML", price: 80, compare_at_price: 100 }],
    options: [], available: true, hide_price: false, sales_mode_purchasable: true,
    purchase_eligibility: { required: false, eligible: true, status: "eligible" }, sell_from: null, sell_to: null,
    other_descriptions: [{ setting_name: "product_description_section_spec", body_html: `<p>容量：500ml</p><p>${retailLicense}</p>` }],
    ...overrides,
  };
  const schema = { "@type": "Product", productId: model.id, name: model.title, sku: "ALC-500ML", offers: [{ "@type": "Offer", url: cyberbizUrl, priceCurrency: "TWD", price: String(model.price), sku: "2" }] };
  const html = `<script type="application/ld+json">${JSON.stringify(schema)}</script>
    <div id="product_info" data-purchase-eligibility='${JSON.stringify(model.purchase_eligibility)}' data-hide-price="${model.hide_price}" data-sales-mode-purchasable="${model.sales_mode_purchasable}">
      <h1>${model.title}</h1><div class="product_brief">${model.brief}</div>
      <div id="price_title"><span class="price"><span class="money_tag" data-currency-from="TWD" data-amount="${model.price}">NT$${model.price}</span></span></div>
    </div><div id="desc_section_2">${model.other_descriptions[0].body_html}</div>`;
  return { html, model };
}
