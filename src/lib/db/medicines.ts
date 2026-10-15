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
  const filter = `(${eligibility}) AND (medicine.name ILIKE $1 ESCAPE '!' OR medicine.license_number ILIKE $1 ESCAPE '!' OR medicine.indications ILIKE $1 ESCAPE '!' OR EXISTS (SELECT 1 FROM medicine_symptoms symptom WHERE symptom.license_number = medicine.license_number AND symptom.symptom ILIKE $1 ESCAPE '!'))`;
  const count = await pool.query<{ total: string }>(`SELECT COUNT(*)::text AS total FROM medicines AS medicine WHERE ${filter}`, [pattern]);
  const offset = (params.page - 1) * params.pageSize;
  const rows = await pool.query<{
    license_number: string; name: string; indications: string | null;
    usage_dosage: string | null;
    ingredients: Medicine["ingredients"];
    safety_communications: Medicine["safetyCommunications"];
    appearance_shape: string | null; appearance_color: string | null; appearance_imprint: string | null; appearance_image_url: string | null;
    price: string | null; price_currency: string | null; price_type: string | null;
    valid_until: string; source_updated_at: string;
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
      price.price::text AS price, price.currency AS price_currency, price.price_type AS price_type
    FROM medicines AS medicine
    LEFT JOIN medicine_appearances AS appearance ON appearance.license_number = medicine.license_number
    LEFT JOIN LATERAL (SELECT * FROM medicine_prices WHERE license_number = medicine.license_number ORDER BY source_updated_at DESC LIMIT 1) AS price ON TRUE
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
      price: row.price ? { amount: Number(row.price), currency: row.price_currency ?? "TWD", type: row.price_type ?? "" } : null,
    })),
    page: params.page,
    pageSize: params.pageSize,
    total: Number(count.rows[0]?.total ?? 0),
  };
}
