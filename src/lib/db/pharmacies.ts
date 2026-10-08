import "server-only";
import { getPool } from "./pool";
import type { SearchParams } from "../api/search-params";
import type { Page, Pharmacy } from "../../types/catalog";

function escapeLike(value: string): string {
  return value.replace(/!/g, "!!").replace(/[%_]/g, "!$&");
}

export async function searchPharmacies(params: SearchParams): Promise<Page<Pharmacy>> {
  const pool = getPool();
  const pattern = `%${escapeLike(params.keyword)}%`;
  const clauses = ["(termination_date IS NULL OR termination_date >= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Taipei')::date)", "(institution_name ILIKE $1 ESCAPE '!' OR address ILIKE $1 ESCAPE '!' OR institution_code ILIKE $1 ESCAPE '!')"];
  const values: (string | number)[] = [pattern];
  if (params.city) {
    values.push(`${escapeLike(params.city)}%`);
    clauses.push(`address ILIKE $${values.length} ESCAPE '!'`);
  }
  const filter = clauses.map((clause) => `(${clause})`).join(" AND ");
  const count = await pool.query<{ total: string }>(`SELECT COUNT(*)::text AS total FROM pharmacy_contracts WHERE ${filter}`, values);
  const offset = (params.page - 1) * params.pageSize;
  const rows = await pool.query<{
    institution_code: string; institution_name: string; address: string; phone: string;
    city: string | null; termination_date: string | null; source_updated_at: string;
  }>(`SELECT institution_code, institution_name, address, NULLIF(phone, '') AS phone,
      substring(address from '^.*?[縣市]') AS city, termination_date::text, source_updated_at::date::text AS source_updated_at
    FROM pharmacy_contracts WHERE ${filter}
    ORDER BY institution_name, institution_code LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
    [...values, params.pageSize, offset]);

  return {
    items: rows.rows.map((row) => ({
      id: row.institution_code,
      name: row.institution_name,
      address: row.address || null,
      phone: row.phone,
      city: row.city,
      status: row.termination_date ? "健保特約（有效至終止日）" : "健保特約",
      sourceUpdatedAt: row.source_updated_at,
    })),
    page: params.page,
    pageSize: params.pageSize,
    total: Number(count.rows[0]?.total ?? 0),
  };
}
