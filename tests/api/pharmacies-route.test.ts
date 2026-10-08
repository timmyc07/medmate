import { describe, expect, it, vi } from "vitest";
import { GET } from "../../src/app/api/pharmacies/route";

vi.mock("../../src/lib/db/pharmacies", () => ({
  searchPharmacies: vi.fn().mockRejectedValue(new Error("DB unavailable")),
}));

describe("藥局搜尋 API", () => {
  it("不帶搜尋文字時回傳 400", async () => {
    const response = await GET(new Request("https://example.test/api/pharmacies"));
    expect(response.status).toBe(400);
  });

  it("資料庫失敗時回傳不含底層細節的 503", async () => {
    const response = await GET(new Request("https://example.test/api/pharmacies?q=%E5%8C%97%E5%B8%82"));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: { code: "SERVICE_UNAVAILABLE", message: "查詢服務暫時無法使用，請稍後再試。" },
    });
  });
});
