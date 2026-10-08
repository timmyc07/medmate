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
  const filter = `(${eligibility}) AND (name ILIKE $1 ESCAPE '!' OR license_number ILIKE $1 ESCAPE '!')`;
  const count = await pool.query<{ total: string }>(`SELECT COUNT(*)::text AS total FROM medicines WHERE ${filter}`, [pattern]);
  const offset = (params.page - 1) * params.pageSize;
  const rows = await pool.query<{
    license_number: string; name: string; indications: string | null;
    valid_until: string; source_updated_at: string;
  }>(`SELECT license_number AS id, license_number, name, NULLIF(indications, '') AS indications,
      CASE WHEN cancellation_status = '' THEN '有效' ELSE cancellation_status END AS license_status,
      valid_until::text, source_updated_at::date::text AS source_updated_at
    FROM medicines WHERE ${filter}
    ORDER BY name, license_number LIMIT $2 OFFSET $3`, [pattern, params.pageSize, offset]);

  return {
    items: rows.rows.map((row) => ({
      id: row.license_number,
      licenseNumber: row.license_number,
      name: row.name,
      indications: row.indications,
      licenseStatus: "有效",
      validUntil: row.valid_until,
      sourceUpdatedAt: row.source_updated_at,
    })),
    page: params.page,
    pageSize: params.pageSize,
    total: Number(count.rows[0]?.total ?? 0),
  };
}
