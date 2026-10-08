import { NextResponse } from "next/server";

type GeocodeResult = { address: string; latitude: number | null; longitude: number | null; formattedAddress: string | null; status: string };

export async function POST(request: Request): Promise<Response> {
  const key = process.env.GOOGLE_MAP_API_KEY;
  if (!key) return NextResponse.json({ error: { code: "GEOCODER_NOT_CONFIGURED", message: "地址定位服務尚未設定。" } }, { status: 503 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: { code: "INVALID_JSON", message: "請提供有效的 JSON。" } }, { status: 400 }); }
  const addresses = Array.isArray((body as { addresses?: unknown })?.addresses)
    ? (body as { addresses: unknown[] }).addresses.filter((address): address is string => typeof address === "string" && address.trim().length > 0).slice(0, 20)
    : [];
  if (addresses.length === 0) return NextResponse.json({ items: [] satisfies GeocodeResult[] });

  const items = await Promise.all(addresses.map(async (address): Promise<GeocodeResult> => {
    const query = new URLSearchParams({ address, region: "tw", language: "zh-TW", key });
    try {
      const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${query.toString()}`, { cache: "no-store" });
      const payload = await response.json() as { status?: string; results?: Array<{ formatted_address?: string; geometry?: { location?: { lat?: number; lng?: number } } }> };
      const result = payload.results?.[0];
      const latitude = result?.geometry?.location?.lat;
      const longitude = result?.geometry?.location?.lng;
      return { address, latitude: typeof latitude === "number" ? latitude : null, longitude: typeof longitude === "number" ? longitude : null, formattedAddress: result?.formatted_address ?? null, status: payload.status ?? "UNKNOWN" };
    } catch { return { address, latitude: null, longitude: null, formattedAddress: null, status: "REQUEST_FAILED" }; }
  }));
  return NextResponse.json({ items });
}
