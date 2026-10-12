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
    ? `CASE WHEN latitude IS NOT NULL AND longitude IS NOT NULL THEN (6371 * acos(least(1, cos(radians($${values.length + 1})) * cos(radians(latitude)) * cos(radians(longitude) - radians($${values.length + 2})) + sin(radians($${values.length + 1})) * sin(radians(latitude))))) END`
    : null;
  const candidateDistanceExpression = hasCoordinates
    ? `(SELECT MIN(6371 * acos(least(1, cos(radians($${values.length + 1})) * cos(radians(candidate.latitude)) * cos(radians(candidate.longitude) - radians($${values.length + 2})) + sin(radians($${values.length + 1})) * sin(radians(candidate.latitude))))) FROM pharmacy_coordinate_candidates candidate WHERE candidate.institution_code=pharmacy_contracts.institution_code)`
    : null;
  const nearestCandidateLatitude = hasCoordinates
    ? `(SELECT candidate.latitude FROM pharmacy_coordinate_candidates candidate WHERE candidate.institution_code=pharmacy_contracts.institution_code ORDER BY (6371 * acos(least(1, cos(radians($${values.length + 1})) * cos(radians(candidate.latitude)) * cos(radians(candidate.longitude) - radians($${values.length + 2})) + sin(radians($${values.length + 1})) * sin(radians(candidate.latitude))))), candidate.candidate_index LIMIT 1)`
    : `(SELECT candidate.latitude FROM pharmacy_coordinate_candidates candidate WHERE candidate.institution_code=pharmacy_contracts.institution_code ORDER BY candidate.candidate_index LIMIT 1)`;
  const nearestCandidateLongitude = hasCoordinates
    ? `(SELECT candidate.longitude FROM pharmacy_coordinate_candidates candidate WHERE candidate.institution_code=pharmacy_contracts.institution_code ORDER BY (6371 * acos(least(1, cos(radians($${values.length + 1})) * cos(radians(candidate.latitude)) * cos(radians(candidate.longitude) - radians($${values.length + 2})) + sin(radians($${values.length + 1})) * sin(radians(candidate.latitude))))), candidate.candidate_index LIMIT 1)`
    : `(SELECT candidate.longitude FROM pharmacy_coordinate_candidates candidate WHERE candidate.institution_code=pharmacy_contracts.institution_code ORDER BY candidate.candidate_index LIMIT 1)`;
  if (hasCoordinates) {
    clauses.push("((latitude IS NOT NULL AND longitude IS NOT NULL) OR EXISTS (SELECT 1 FROM pharmacy_coordinate_candidates candidate WHERE candidate.institution_code=pharmacy_contracts.institution_code))");
    if (params.radiusKm !== undefined) {
      values.push(latitude, longitude, params.radiusKm);
      clauses.push(`COALESCE(${distanceExpression}, ${candidateDistanceExpression}) <= $${values.length}`);
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
      COALESCE(latitude, ${nearestCandidateLatitude}) AS latitude,
      COALESCE(longitude, ${nearestCandidateLongitude}) AS longitude${distanceExpression ? `, COALESCE(${distanceExpression}, ${candidateDistanceExpression}) AS distance_km` : ", NULL::text AS distance_km"}
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

export async function listPharmaciesForMap(city: string, district?: string): Promise<Pharmacy[]> {
  const values: string[] = [`${escapeLike(city)}%`];
  let districtClause = "";
  if (district) {
    values.push(`%${escapeLike(district)}%`);
    districtClause = ` AND address ILIKE $${values.length} ESCAPE '!'`;
  }
  const rows = await getPool().query<{
    institution_code: string; institution_name: string; address: string; phone: string;
    city: string | null; opening_hours: string | null; termination_date: string | null; source_updated_at: string;
    latitude: string | null; longitude: string | null;
    coordinate_candidates: Array<{ latitude: number; longitude: number; address: string }> | null;
  }>(`SELECT institution_code, institution_name, address, NULLIF(phone, '') AS phone,
      substring(address from '^.*?[縣市]') AS city, opening_hours, termination_date::text,
      source_updated_at::date::text AS source_updated_at,
      COALESCE(latitude, (SELECT candidate.latitude FROM pharmacy_coordinate_candidates candidate WHERE candidate.institution_code=pharmacy_contracts.institution_code ORDER BY candidate.candidate_index LIMIT 1)) AS latitude,
      COALESCE(longitude, (SELECT candidate.longitude FROM pharmacy_coordinate_candidates candidate WHERE candidate.institution_code=pharmacy_contracts.institution_code ORDER BY candidate.candidate_index LIMIT 1)) AS longitude,
      COALESCE((SELECT json_agg(json_build_object('latitude',candidate.latitude,'longitude',candidate.longitude,'address',candidate.response_address) ORDER BY candidate.candidate_index)
        FROM pharmacy_coordinate_candidates candidate WHERE candidate.institution_code=pharmacy_contracts.institution_code), '[]'::json) AS coordinate_candidates
    FROM pharmacy_contracts
    WHERE (termination_date IS NULL OR termination_date >= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Taipei')::date)
      AND address ILIKE $1 ESCAPE '!'${districtClause}
    ORDER BY institution_name, institution_code`, values);
  return rows.rows.map((row) => ({
    id: row.institution_code, name: row.institution_name, address: row.address || null, phone: row.phone,
    city: row.city, status: row.termination_date ? "健保特約（有效至終止日）" : "健保特約",
    openingHours: row.opening_hours ?? null, sourceUpdatedAt: row.source_updated_at,
    latitude: row.latitude == null ? null : Number(row.latitude),
    longitude: row.longitude == null ? null : Number(row.longitude),
    coordinateCandidates: row.coordinate_candidates ?? [],
  }));
}
