import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PharmacyMap from "../../src/components/PharmacyMap";

describe("藥局地圖", () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => cleanup());

  it("以圖片語意角色標示互動式藥局地圖", () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ enabled: false }), { status: 200 }));
    render(<PharmacyMap pharmacies={[]} userLocation={null} />);

    expect(screen.getByRole("img", { name: "藥局分布地圖" })).toHaveAttribute("aria-roledescription", "互動式地圖");
  });
});
