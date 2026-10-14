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
  }>(
    `SELECT ROW_NUMBER() OVER (ORDER BY usage.package_claim_quantity DESC, usage.drug_code ASC)::text AS rank,
      catalog.drug_code, catalog.name, catalog.english_name, catalog.ingredient, catalog.dosage_form,
      usage.package_claim_quantity::text AS claim_quantity
     FROM medicine_usage AS usage
     JOIN nhi_medicine_catalog AS catalog ON catalog.drug_code = usage.drug_code
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
