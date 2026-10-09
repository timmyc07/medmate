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
    process.env.GOOGLE_STREETVIEW_BROWSER_KEY ??
    process.env.GOOGLE_MAPS_BROWSER_KEY ??
    sharedKey;
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
    items.map((item) => lookupStreetView(item, metadataKey, imageKey)),
  );
  return NextResponse.json({ items: results });
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
    const imageUrl = new URL("https://maps.googleapis.com/maps/api/streetview");
    imageUrl.search = new URLSearchParams({
      size: "640x360",
      pano: payload.pano_id,
      fov: "80",
      heading: "0",
      pitch: "0",
      key: imageKey,
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
