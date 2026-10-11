import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PharmacyMap from "../../src/components/PharmacyMap";

describe("藥局地圖", () => {
  beforeEach(() => { vi.restoreAllMocks(); delete window.google; });
  afterEach(() => { cleanup(); delete window.google; });

  it("以圖片語意角色標示互動式藥局地圖", () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ enabled: false }), { status: 200 }));
    render(<PharmacyMap pharmacies={[]} userLocation={null} />);

    expect(screen.getByRole("img", { name: "藥局分布地圖" })).toHaveAttribute("aria-roledescription", "互動式地圖");
  });

  it("地圖設定未啟用時不呼叫地址定位", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ enabled: false }), { status: 200 }));
    await act(async () => { render(<PharmacyMap pharmacies={[{ id: "1", name: "測試藥局", address: "台北市中正區" } as never]} userLocation={null} />); });

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("地圖服務尚未設定"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/maps-config");
  });

  it("地址定位回應失敗時停止後續批次", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ enabled: true, key: "browser-key" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: "GEOCODER_NOT_CONFIGURED" } }), { status: 503 }));
    const pharmacies = Array.from({ length: 21 }, (_, index) => ({ id: String(index), name: `藥局${index}`, address: `台北市中正區${index}號`, latitude: index === 0 ? 25 : null, longitude: index === 0 ? 121 : null } as never));
    let markerCount = 0;
    window.google = { maps: {
      Map: class { fitBounds() {} setCenter() {} },
      LatLngBounds: class { extend() {} isEmpty() { return false; } },
      Marker: class { constructor() { markerCount += 1; } },
      InfoWindow: class { open() {} },
    } } as never;
    await act(async () => { render(<PharmacyMap pharmacies={pharmacies} userLocation={null} />); });

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("地址定位服務尚未設定；已顯示 1 家可用座標"));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe("/api/geocode");
    expect(markerCount).toBe(1);
  });

  it("已有座標的藥局直接標示且不呼叫地址定位", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(JSON.stringify({ enabled: true, key: "browser-key" }), { status: 200 }));
    let markerCount = 0;
    window.google = { maps: {
      Map: class { fitBounds() {} setCenter() {} },
      LatLngBounds: class { extend() {} isEmpty() { return false; } },
      Marker: class { constructor() { markerCount += 1; } },
      InfoWindow: class { open() {} },
    } } as never;
    await act(async () => { render(<PharmacyMap pharmacies={[{ id: "1", name: "已有座標藥局", address: "台北市中正區", latitude: 25, longitude: 121 } as never]} userLocation={null} />); });

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("已標示 1 家藥局"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(markerCount).toBe(1);
  });
});
