import { NextResponse } from "next/server";

type StreetViewInput = { id: string; latitude: number; longitude: number };
type StreetViewItem = {
  id: string;
  imageUrl: string | null;
  date: string | null;
  copyright: string | null;
};

export async function POST(request: Request): Promise<Response> {
  const sharedKey = process.env.GOOGLE_MAP_API_KEY;
  const metadataKey =
    process.env.GOOGLE_STREETVIEW_API_KEY ??
    process.env.GOOGLE_GEOCODING_API_KEY ??
    sharedKey;
  const imageKey =
    process.env.GOOGLE_STREETVIEW_API_KEY ??
    sharedKey ??
    process.env.GOOGLE_GEOCODING_API_KEY ??
    process.env.GOOGLE_STREETVIEW_BROWSER_KEY ??
    process.env.GOOGLE_MAPS_BROWSER_KEY;
  if (!metadataKey)
    return NextResponse.json(
      {
        error: {
          code: "STREETVIEW_NOT_CONFIGURED",
          message: "街景服務尚未設定。",
        },
      },
      { status: 503 },
    );
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "INVALID_JSON", message: "請提供有效的 JSON。" } },
      { status: 400 },
    );
  }
  const rawItems = Array.isArray((body as { items?: unknown })?.items)
    ? (body as { items: unknown[] }).items
    : [];
  const items = rawItems.filter(isStreetViewInput).slice(0, 20);
  if (items.length === 0)
    return NextResponse.json({ items: [] satisfies StreetViewItem[] });

  const results = await Promise.all(
    items.map((item) =>
      lookupStreetView(item, metadataKey, imageKey, request.url),
    ),
  );
  return NextResponse.json({ items: results });
}

export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const latitude = Number(params.get("lat"));
  const longitude = Number(params.get("lng"));
  if (
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90 ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180
  )
    return NextResponse.json(
      { error: { code: "INVALID_QUERY", message: "街景座標無效。" } },
      { status: 400 },
    );

  const metadataKey =
    process.env.GOOGLE_STREETVIEW_API_KEY ??
    process.env.GOOGLE_GEOCODING_API_KEY ??
    process.env.GOOGLE_MAP_API_KEY;
  const imageKey =
    process.env.GOOGLE_STREETVIEW_API_KEY ??
    process.env.GOOGLE_MAP_API_KEY ??
    process.env.GOOGLE_GEOCODING_API_KEY;
  if (!metadataKey || !imageKey)
    return NextResponse.json(
      {
        error: {
          code: "STREETVIEW_NOT_CONFIGURED",
          message: "街景服務尚未設定。",
        },
      },
      { status: 503 },
    );

  try {
    const metadataUrl = new URL(
      "https://maps.googleapis.com/maps/api/streetview/metadata",
    );
    metadataUrl.search = new URLSearchParams({
      location: `${latitude},${longitude}`,
      key: metadataKey,
    }).toString();
    const metadataResponse = await fetch(metadataUrl, { cache: "no-store" });
    const metadata = (await metadataResponse.json()) as {
      status?: string;
      pano_id?: string;
    };
    if (metadata.status !== "OK" || !metadata.pano_id)
      return new Response(null, { status: 404 });
    const imageUrl = new URL("https://maps.googleapis.com/maps/api/streetview");
    imageUrl.search = new URLSearchParams({
      size: "640x360",
      pano: metadata.pano_id,
      fov: "80",
      heading: "0",
      pitch: "0",
      key: imageKey,
    }).toString();
    const imageResponse = await fetch(imageUrl, { cache: "no-store" });
    if (!imageResponse.ok) return new Response(null, { status: 502 });
    return new Response(await imageResponse.arrayBuffer(), {
      headers: {
        "Content-Type":
          imageResponse.headers.get("content-type") ?? "image/jpeg",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return new Response(null, { status: 502 });
  }
}

function isStreetViewInput(value: unknown): value is StreetViewInput {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<StreetViewInput>;
  return (
    typeof item.id === "string" &&
    item.id.length > 0 &&
    item.id.length <= 100 &&
    typeof item.latitude === "number" &&
    Number.isFinite(item.latitude) &&
    item.latitude >= -90 &&
    item.latitude <= 90 &&
    typeof item.longitude === "number" &&
    Number.isFinite(item.longitude) &&
    item.longitude >= -180 &&
    item.longitude <= 180
  );
}

async function lookupStreetView(
  item: StreetViewInput,
  metadataKey: string,
  imageKey: string | undefined,
  requestUrl: string,
): Promise<StreetViewItem> {
  const location = `${item.latitude},${item.longitude}`;
  const metadataUrl = new URL(
    "https://maps.googleapis.com/maps/api/streetview/metadata",
  );
  metadataUrl.search = new URLSearchParams({
    location,
    key: metadataKey,
  }).toString();
  try {
    const response = await fetch(metadataUrl, { cache: "no-store" });
    const payload = (await response.json()) as {
      status?: string;
      pano_id?: string;
      date?: string;
      copyright?: string;
    };
    if (payload.status !== "OK" || !payload.pano_id || !imageKey)
      return { id: item.id, imageUrl: null, date: null, copyright: null };
    const imageUrl = new URL("/api/streetview", requestUrl);
    imageUrl.search = new URLSearchParams({
      lat: String(item.latitude),
      lng: String(item.longitude),
    }).toString();
    return {
      id: item.id,
      imageUrl: imageUrl.toString(),
      date: payload.date ?? null,
      copyright: payload.copyright ?? null,
    };
  } catch {
    return { id: item.id, imageUrl: null, date: null, copyright: null };
  }
}
