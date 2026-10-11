import { describe, expect, it, vi } from "vitest";
import { GET } from "../../src/app/api/pharmacies/map/route";
import { listPharmaciesForMap } from "../../src/lib/db/pharmacies";

vi.mock("../../src/lib/db/pharmacies", () => ({
  listPharmaciesForMap: vi.fn().mockResolvedValue([]),
}));

describe("藥局地圖資料 API", () => {
  it("必須指定縣市並查詢未分頁區域資料", async () => {
    const response = await GET(new Request("https://example.test/api/pharmacies/map?city=%E8%87%BA%E5%8C%97%E5%B8%82&district=%E4%B8%AD%E6%AD%A3%E5%8D%80"));
    expect(response.status).toBe(200);
    expect(listPharmaciesForMap).toHaveBeenCalledWith("臺北市", "中正區");
  });

  it("未指定縣市時拒絕全台無界查詢", async () => {
    const response = await GET(new Request("https://example.test/api/pharmacies/map"));
    expect(response.status).toBe(400);
  });
});
