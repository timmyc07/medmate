import { listPharmaciesForMap } from "../../../../lib/db/pharmacies";

export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const city = (params.get("city") ?? "").trim();
  const district = (params.get("district") ?? "").trim();
  if (!city || city.length > 50 || district.length > 50) {
    return Response.json({ error: { code: "INVALID_QUERY", message: "請先選擇有效縣市與區域。" } }, { status: 400 });
  }
  try {
    return Response.json({ items: await listPharmaciesForMap(city, district || undefined) });
  } catch {
    return Response.json({ error: { code: "SERVICE_UNAVAILABLE", message: "查詢服務暫時無法使用，請稍後再試。" } }, { status: 503 });
  }
}
