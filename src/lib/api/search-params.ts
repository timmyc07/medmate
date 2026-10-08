export interface SearchParams {
  keyword: string;
  city?: string;
  district?: string;
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
  page: number;
  pageSize: number;
}

export class InvalidSearchParamsError extends Error {
  constructor() {
    super("查詢條件無效，請確認搜尋文字與分頁設定。");
    this.name = "InvalidSearchParamsError";
  }
}

export function parseSearchParams(params: URLSearchParams, allowCity = false, allowLocation = false): SearchParams {
  const keyword = (params.get("q") ?? "").trim();
  const city = (params.get("city") ?? "").trim();
  const district = (params.get("district") ?? "").trim();
  const latitudeValue = params.get("lat");
  const longitudeValue = params.get("lng");
  const radiusValue = params.get("radiusKm");
  const latitude = latitudeValue === null ? undefined : Number(latitudeValue);
  const longitude = longitudeValue === null ? undefined : Number(longitudeValue);
  const radiusKm = radiusValue === null ? undefined : Number(radiusValue);
  const page = Number(params.get("page") ?? "1");
  const pageSize = Number(params.get("pageSize") ?? "20");
  const hasArea = city.length > 0 || district.length > 0;
  const hasCoordinates = latitude !== undefined || longitude !== undefined;
  const validCoordinates = latitude !== undefined && longitude !== undefined && Number.isFinite(latitude) && Number.isFinite(longitude) && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;

  if (
    (keyword.length === 0 && (!allowLocation || (!hasArea && !validCoordinates))) || keyword.length > 100 ||
    (!allowCity && (city.length > 0 || district.length > 0)) ||
    (allowCity && (city.length > 50 || district.length > 50)) ||
    (allowLocation && ((hasCoordinates && !validCoordinates) || (validCoordinates && radiusKm !== undefined && (!Number.isFinite(radiusKm) || radiusKm < 0.5 || radiusKm > 50)))) ||
    !Number.isSafeInteger(page) || page < 1 ||
    !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 50
  ) {
    throw new InvalidSearchParamsError();
  }

  return { keyword, ...(allowCity && city ? { city } : {}), ...(allowCity && district ? { district } : {}), ...(allowLocation && validCoordinates ? { latitude, longitude, radiusKm } : {}), page, pageSize };
}
