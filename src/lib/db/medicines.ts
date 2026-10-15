import "server-only";
import { getPool } from "./pool";
import type { SearchParams } from "../api/search-params";
import type { Medicine, Page } from "../../types/catalog";

function escapeLike(value: string): string {
  return value.replace(/!/g, "!!").replace(/[%_]/g, "!$&");
}

export async function searchMedicines(params: SearchParams): Promise<Page<Medicine>> {
  const pool = getPool();
  const pattern = `%${escapeLike(params.keyword)}%`;
  const eligibility = "cancellation_status = '' AND valid_until >= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Taipei')::date";
  // 適應症欄位本身已是 TFDA 公開文字；直接比對可避免 migration 尚未套用時整個查詢失效。
  const filter = `(${eligibility}) AND (medicine.name ILIKE $1 ESCAPE '!' OR medicine.license_number ILIKE $1 ESCAPE '!' OR medicine.indications ILIKE $1 ESCAPE '!')`;
  const count = await pool.query<{ total: string }>(`SELECT COUNT(*)::text AS total FROM medicines AS medicine WHERE ${filter}`, [pattern]);
  const offset = (params.page - 1) * params.pageSize;
  const rows = await pool.query<{
    license_number: string; name: string; indications: string | null;
    usage_dosage: string | null;
    ingredients: Medicine["ingredients"];
    safety_communications: Medicine["safetyCommunications"];
    appearance_shape: string | null; appearance_color: string | null; appearance_imprint: string | null; appearance_image_url: string | null;
    valid_until: string; source_updated_at: string; prices: Medicine["price"];
  }>(`SELECT medicine.license_number AS id, medicine.license_number, medicine.name,
      NULLIF(medicine.indications, '') AS indications, NULLIF(medicine.usage_dosage, '') AS usage_dosage,
      CASE WHEN medicine.cancellation_status = '' THEN '有效' ELSE medicine.cancellation_status END AS license_status,
      medicine.valid_until::text, medicine.source_updated_at::date::text AS source_updated_at,
      COALESCE((SELECT json_agg(json_build_object(
        'prescriptionLabel', ingredient.prescription_label, 'ingredientName', ingredient.ingredient_name,
        'ingredientCode', ingredient.ingredient_code, 'contentDescription', ingredient.content_description,
        'contentValue', ingredient.content_value, 'contentUnit', ingredient.content_unit
      ) ORDER BY ingredient.component_index) FROM medicine_ingredients AS ingredient
        WHERE ingredient.license_number = medicine.license_number), '[]'::json) AS ingredients,
      COALESCE((SELECT json_agg(json_build_object(
        'publicationDate', communication.publication_date::text, 'ingredient', communication.ingredient,
        'scopeText', communication.scope_text, 'indications', communication.indications,
        'mechanism', communication.mechanism, 'reason', communication.reason,
        'safetyAnalysis', communication.safety_analysis, 'tfdaCommunication', communication.tfda_communication,
        'sourceUrl', communication.source_url
      ) ORDER BY communication.publication_date DESC) FROM medicine_safety_license_links AS safety_link
        JOIN medicine_safety_communications AS communication ON communication.message_id = safety_link.message_id
        WHERE safety_link.license_number = medicine.license_number), '[]'::json) AS safety_communications
      ,appearance.shape AS appearance_shape, appearance.color AS appearance_color,
      appearance.imprint AS appearance_imprint, appearance.image_url AS appearance_image_url,
      COALESCE((SELECT json_agg(json_build_object(
        'amount', price.price, 'currency', price.currency, 'type', price.price_type,
        'drugCode', price.drug_code, 'specification', price.specification,
        'effectiveFrom', price.effective_from::text, 'sourceUrl', price.source_url
      ) ORDER BY price.drug_code) FROM medicine_prices AS price
        WHERE price.license_number = medicine.license_number
          AND price.price > 0
          AND price.effective_from <= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Taipei')::date
          AND (price.effective_until IS NULL OR price.effective_until >= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Taipei')::date)
          AND price.change_status = ''), '[]'::json) AS prices
    FROM medicines AS medicine
    LEFT JOIN medicine_appearances AS appearance ON appearance.license_number = medicine.license_number
    WHERE ${filter}
    ORDER BY medicine.name, medicine.license_number LIMIT $2 OFFSET $3`, [pattern, params.pageSize, offset]);

  return {
    items: rows.rows.map((row) => ({
      id: row.license_number,
      licenseNumber: row.license_number,
      name: row.name,
      indications: row.indications,
      usageDosage: row.usage_dosage,
      ingredients: row.ingredients ?? [],
      safetyCommunications: row.safety_communications ?? [],
      licenseStatus: "有效",
      validUntil: row.valid_until,
      sourceUpdatedAt: row.source_updated_at,
      appearance: row.appearance_image_url || row.appearance_shape || row.appearance_color ? {
        shape: row.appearance_shape ?? "", color: row.appearance_color ?? "", imprint: row.appearance_imprint ?? "", imageUrl: row.appearance_image_url ?? "",
      } : null,
      price: row.prices ?? null,
    })),
    page: params.page,
    pageSize: params.pageSize,
    total: Number(count.rows[0]?.total ?? 0),
  };
}
