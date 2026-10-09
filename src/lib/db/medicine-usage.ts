import "server-only";
import type { MedicineUsageItem, MedicineUsagePage } from "../../types/catalog";
import { getPool } from "./pool";

export async function getMedicineUsagePage(
  page = 1,
  pageSize = 50,
): Promise<MedicineUsagePage> {
  const pool = getPool();
  const count = await pool.query<{
    total: string;
    fee_year: number;
    period_start: string;
    period_end: string;
  }>(
    `SELECT COUNT(*)::text AS total, MAX(fee_year)::int AS fee_year,
      MIN(reporting_period_start) AS period_start, MAX(reporting_period_end) AS period_end
     FROM medicine_usage WHERE fee_year = (SELECT MAX(fee_year) FROM medicine_usage)`,
  );
  const latest = count.rows[0];
  if (!latest?.fee_year)
    return {
      items: [],
      page,
      pageSize,
      total: 0,
      feeYear: null,
      periodStart: null,
      periodEnd: null,
    };
  const offset = (page - 1) * pageSize;
  const rows = await pool.query<{
    rank: string;
    drug_code: string;
    name: string;
    english_name: string;
    ingredient: string;
    dosage_form: string;
    claim_quantity: string;
    license_number: string | null;
    appearance_image_url: string | null;
    appearance_shape: string | null;
    appearance_color: string | null;
  }>(
    `SELECT ROW_NUMBER() OVER (ORDER BY usage.package_claim_quantity DESC, usage.drug_code ASC)::text AS rank,
      catalog.drug_code, catalog.name, catalog.english_name, catalog.ingredient, catalog.dosage_form,
      usage.package_claim_quantity::text AS claim_quantity, medicine.license_number, appearance.image_url AS appearance_image_url,
      appearance.shape AS appearance_shape, appearance.color AS appearance_color
     FROM medicine_usage AS usage
     JOIN nhi_medicine_catalog AS catalog ON catalog.drug_code = usage.drug_code
     LEFT JOIN medicines AS medicine ON medicine.license_number = catalog.fda_license_id
     LEFT JOIN medicine_appearances AS appearance ON appearance.license_number = medicine.license_number
     WHERE usage.fee_year = $1
     ORDER BY usage.package_claim_quantity DESC, usage.drug_code ASC
     LIMIT $2 OFFSET $3`,
    [latest.fee_year, pageSize, offset],
  );
  const items: MedicineUsageItem[] = rows.rows.map((row) => ({
    rank: Number(row.rank),
    drugCode: row.drug_code,
    name: row.name,
    englishName: row.english_name,
    ingredient: row.ingredient,
    dosageForm: row.dosage_form,
    claimQuantity: Number(row.claim_quantity),
    licenseNumber: row.license_number,
    appearanceImageUrl: row.appearance_image_url,
    appearanceShape: row.appearance_shape,
    appearanceColor: row.appearance_color,
  }));
  return {
    items,
    page,
    pageSize,
    total: Number(latest.total),
    feeYear: latest.fee_year,
    periodStart: latest.period_start,
    periodEnd: latest.period_end,
  };
}
