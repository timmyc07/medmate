import { describe, expect, it, vi } from "vitest";
import { GET } from "../../src/app/api/ready/route";
import { getPool } from "../../src/lib/db/pool";

vi.mock("../../src/lib/db/pool", () => ({ getPool: vi.fn() }));

describe("資料庫 readiness API", () => {
  it("連線正常時回覆 ready", async () => {
    vi.mocked(getPool).mockReturnValue({ query: vi.fn().mockResolvedValue({ rows: [{ "?column?": 1 }] }) } as never);
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ready" });
  });

  it("資料庫離線時回覆不含底層錯誤的 503", async () => {
    vi.mocked(getPool).mockReturnValue({ query: vi.fn().mockRejectedValue(new Error("secret connection URL")) } as never);
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("secret connection URL");
  });
});
