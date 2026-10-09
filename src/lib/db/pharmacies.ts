import "server-only";
import { getPool } from "./pool";
import type { SearchParams } from "../api/search-params";
import type { Page, Pharmacy } from "../../types/catalog";

function escapeLike(value: string): string {
  return value.replace(/!/g, "!!").replace(/[%_]/g, "!$&");
}

export async function searchPharmacies(params: SearchParams): Promise<Page<Pharmacy>> {
  const pool = getPool();
  const clauses = ["(termination_date IS NULL OR termination_date >= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Taipei')::date)"];
  const values: (string | number)[] = [];
  if (params.keyword) {
    values.push(`%${escapeLike(params.keyword)}%`);
    clauses.push(`(institution_name ILIKE $${values.length} ESCAPE '!' OR address ILIKE $${values.length} ESCAPE '!' OR institution_code ILIKE $${values.length} ESCAPE '!')`);
  }
  if (params.city) {
    values.push(`${escapeLike(params.city)}%`);
    clauses.push(`address ILIKE $${values.length} ESCAPE '!'`);
  }
  if (params.district) {
    values.push(`%${escapeLike(params.district)}%`);
    clauses.push(`address ILIKE $${values.length} ESCAPE '!'`);
  }
  const latitude = params.latitude;
  const longitude = params.longitude;
  const hasCoordinates = latitude !== undefined && longitude !== undefined;
  let countValues: (string | number)[];
  const distanceExpression = hasCoordinates
    ? `(6371 * acos(least(1, cos(radians($${values.length + 1})) * cos(radians(latitude)) * cos(radians(longitude) - radians($${values.length + 2})) + sin(radians($${values.length + 1})) * sin(radians(latitude)))))`
    : null;
  if (hasCoordinates) {
    clauses.push("latitude IS NOT NULL AND longitude IS NOT NULL");
    if (params.radiusKm !== undefined) {
      values.push(latitude, longitude, params.radiusKm);
      clauses.push(`${distanceExpression} <= $${values.length}`);
      countValues = [...values];
    } else {
      values.push(latitude, longitude);
      countValues = values.slice(0, -2);
    }
  } else {
    countValues = [...values];
  }
  const filter = clauses.map((clause) => `(${clause})`).join(" AND ");
  const count = await pool.query<{ total: string }>(`SELECT COUNT(*)::text AS total FROM pharmacy_contracts WHERE ${filter}`, countValues);
  const offset = (params.page - 1) * params.pageSize;
  const rows = await pool.query<{
    institution_code: string; institution_name: string; address: string; phone: string;
    city: string | null; opening_hours: string | null; termination_date: string | null; source_updated_at: string;
    latitude: string | null; longitude: string | null; distance_km: string | null;
  }>(`SELECT institution_code, institution_name, address, NULLIF(phone, '') AS phone,
      substring(address from '^.*?[縣市]') AS city, opening_hours, termination_date::text, source_updated_at::date::text AS source_updated_at,
      latitude, longitude${distanceExpression ? `, ${distanceExpression} AS distance_km` : ", NULL::text AS distance_km"}
    FROM pharmacy_contracts WHERE ${filter}
    ORDER BY ${distanceExpression ? "distance_km, " : ""}institution_name, institution_code LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
    [...values, params.pageSize, offset]);

  return {
    items: rows.rows.map((row) => ({
      id: row.institution_code,
      name: row.institution_name,
      address: row.address || null,
      phone: row.phone,
      city: row.city,
      status: row.termination_date ? "健保特約（有效至終止日）" : "健保特約",
      openingHours: row.opening_hours ?? null,
      sourceUpdatedAt: row.source_updated_at,
      latitude: row.latitude == null ? null : Number(row.latitude),
      longitude: row.longitude == null ? null : Number(row.longitude),
      distanceKm: row.distance_km == null ? null : Number(row.distance_km),
    })),
    page: params.page,
    pageSize: params.pageSize,
    total: Number(count.rows[0]?.total ?? 0),
  };
}
