import { afterEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "../../src/app/api/streetview/route";

describe("街景 metadata API", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.GOOGLE_STREETVIEW_API_KEY;
    delete process.env.GOOGLE_STREETVIEW_BROWSER_KEY;
    delete process.env.GOOGLE_MAP_API_KEY;
  });

  it("以座標查詢 metadata 並回傳同源街景圖片網址", async () => {
    process.env.GOOGLE_STREETVIEW_API_KEY = "street-key";
    process.env.GOOGLE_STREETVIEW_BROWSER_KEY = "street-browser-key";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          status: "OK",
          pano_id: "temporary-pano",
          date: "2025-04",
          copyright: "© Google Maps",
        }),
        { status: 200 },
      ),
    );

    const response = await POST(
      new Request("https://example.test/api/streetview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [{ id: "P001", latitude: 25.04, longitude: 121.53 }],
        }),
      }),
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toEqual({
      items: [
        {
          id: "P001",
          imageUrl: "https://example.test/api/streetview?lat=25.04&lng=121.53",
          date: "2025-04",
          copyright: "© Google Maps",
        },
      ],
    });
    expect(payload.items[0].imageUrl).toContain("/api/streetview?");
    expect(String(vi.mocked(fetch).mock.calls[0][0])).toContain(
      "metadata?location=25.04%2C121.53",
    );
    expect(vi.mocked(fetch).mock.calls[0][1]).toMatchObject({
      cache: "no-store",
    });
  });

  it("沒有街景時回傳占位狀態且不產生圖片網址", async () => {
    process.env.GOOGLE_MAP_API_KEY = "map-key";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ status: "ZERO_RESULTS" }), { status: 200 }),
    );

    const response = await POST(
      new Request("https://example.test/api/streetview", {
        method: "POST",
        body: JSON.stringify({
          items: [{ id: "P002", latitude: 25, longitude: 121 }],
        }),
      }),
    );

    expect(await response.json()).toEqual({
      items: [{ id: "P002", imageUrl: null, date: null, copyright: null }],
    });
  });

  it("只設定共用 Google Maps key 時同時用於 metadata 與圖片", async () => {
    process.env.GOOGLE_MAP_API_KEY = "shared-map-key";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ status: "OK", pano_id: "shared-pano" }), {
        status: 200,
      }),
    );

    const response = await POST(
      new Request("https://example.test/api/streetview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [{ id: "P003", latitude: 25, longitude: 121 }],
        }),
      }),
    );

    const payload = await response.json();
    expect(payload.items[0].imageUrl).toBe(
      "https://example.test/api/streetview?lat=25&lng=121",
    );
  });

  it("同源圖片端點使用伺服器金鑰回傳 JPEG", async () => {
    process.env.GOOGLE_MAP_API_KEY = "shared-map-key";
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ status: "OK", pano_id: "temporary-pano" }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response("jpeg", {
          status: 200,
          headers: { "Content-Type": "image/jpeg" },
        }),
      );

    const response = await GET(
      new Request("https://example.test/api/streetview?lat=25&lng=121"),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/jpeg");
    expect(Buffer.from(await response.arrayBuffer()).toString()).toBe("jpeg");
  });

  it("限制每次最多查詢 20 個座標", async () => {
    process.env.GOOGLE_STREETVIEW_API_KEY = "street-key";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ status: "ZERO_RESULTS" }), { status: 200 }),
    );
    const items = Array.from({ length: 23 }, (_, index) => ({
      id: `P${index}`,
      latitude: 25,
      longitude: 121,
    }));

    const response = await POST(
      new Request("https://example.test/api/streetview", {
        method: "POST",
        body: JSON.stringify({ items }),
      }),
    );

    expect((await response.json()).items).toHaveLength(20);
    expect(fetch).toHaveBeenCalledTimes(20);
  });
});
