import { beforeEach, describe, expect, it, vi } from "vitest";

const query = vi.fn();
vi.mock("../../src/lib/db/pool", () => ({ getPool: () => ({ query }) }));

import { getMedicineUsagePage } from "../../src/lib/db/medicine-usage";
import { searchMedicines } from "../../src/lib/db/medicines";
import { searchPharmacies } from "../../src/lib/db/pharmacies";

describe("Neon 公開資料查詢", () => {
  beforeEach(() => query.mockReset());

  it("只查有效藥品、參數化搜尋並回傳分頁總數", async () => {
    query
      .mockResolvedValueOnce({ rows: [{ total: "3" }] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "x",
            license_number: "藥字1",
            name: "藥品甲",
            indications: null,
            license_status: "有效",
            valid_until: "2099-01-01",
            source_updated_at: "2026-10-08",
          },
        ],
      });
    const result = await searchMedicines({
      keyword: "藥%_\\",
      page: 2,
      pageSize: 10,
    });

    expect(result).toEqual({
      items: [
        {
          id: "藥字1",
          licenseNumber: "藥字1",
          name: "藥品甲",
          indications: null,
          licenseStatus: "有效",
          validUntil: "2099-01-01",
          sourceUpdatedAt: "2026-10-08",
        },
      ],
      page: 2,
      pageSize: 10,
      total: 3,
    });
    expect(query.mock.calls[0][0]).toContain("cancellation_status = ''");
    expect(query.mock.calls[0][0]).toContain(
      "valid_until >= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Taipei')::date",
    );
    expect(query.mock.calls[0][1]).toEqual(["%藥!%!_\\%"]);
    expect(query.mock.calls[1][1]).toEqual(["%藥!%!_\\%", 10, 10]);
  });

  it("依最新年度含包裹醫令量排名分頁並帶出外觀圖", async () => {
    query
      .mockResolvedValueOnce({
        rows: [
          {
            total: "81",
            fee_year: 115,
            period_start: "11501",
            period_end: "11507",
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            rank: "51",
            drug_code: "A0001",
            name: "藥品甲",
            english_name: "Drug A",
            ingredient: "成分甲",
            dosage_form: "錠劑",
            claim_quantity: "123.5",
            license_number: "衛部藥製字第1號",
            appearance_image_url: "https://mcp.fda.gov.tw/shape.jpg",
            source_updated_at: "2026-10-09",
          },
        ],
      });

    const result = await getMedicineUsagePage(2, 50);

    expect(result).toMatchObject({
      page: 2,
      pageSize: 50,
      total: 81,
      feeYear: 115,
      periodStart: "11501",
      periodEnd: "11507",
    });
    expect(result.items[0]).toMatchObject({
      rank: 51,
      drugCode: "A0001",
      claimQuantity: 123.5,
      licenseNumber: "衛部藥製字第1號",
      appearanceImageUrl: "https://mcp.fda.gov.tw/shape.jpg",
    });
    expect(query.mock.calls[0][0]).toContain("MAX(fee_year)");
    expect(query.mock.calls[1][0]).toContain(
      "ORDER BY usage.package_claim_quantity DESC, usage.drug_code ASC",
    );
    expect(query.mock.calls[1][1]).toEqual([115, 50, 50]);
    expect(query.mock.calls[1][0]).not.toContain("LIKE '%'");
  });

  it("只查未終止或未歇業的健保藥局並可限制縣市", async () => {
    query
      .mockResolvedValueOnce({ rows: [{ total: "1" }] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "5901",
            name: "安心藥局",
            address: "臺北市中正區",
            phone: "02",
            city: "臺北市",
            status: "健保特約",
            opening_hours: "星期一上午看診",
            source_updated_at: "2026-10-08",
          },
        ],
      });
    const result = await searchPharmacies({
      keyword: "安心",
      city: "臺北市",
      page: 1,
      pageSize: 20,
    });

    expect(result.total).toBe(1);
    expect(result.items[0].openingHours).toBe("星期一上午看診");
    expect(query.mock.calls[0][0]).toContain(
      "termination_date IS NULL OR termination_date >= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Taipei')::date",
    );
    expect(query.mock.calls[0][1]).toEqual(["%安心%", "臺北市%"]);
    expect(query.mock.calls[1][1]).toEqual(["%安心%", "臺北市%", 20, 0]);
  });

  it("藥局無關鍵字時不加入文字篩選並仍套用分頁", async () => {
    query
      .mockResolvedValueOnce({ rows: [{ total: "2" }] })
      .mockResolvedValueOnce({ rows: [] });

    await searchPharmacies({ keyword: "", page: 1, pageSize: 20 });

    expect(query.mock.calls[0][0]).not.toContain("institution_name ILIKE");
    expect(query.mock.calls[1][0]).not.toContain("institution_name ILIKE");
    expect(query.mock.calls[1][1]).toEqual([20, 0]);
  });

  it("位置查詢只回傳有座標的藥局並以距離排序", async () => {
    query
      .mockResolvedValueOnce({ rows: [{ total: "1" }] })
      .mockResolvedValueOnce({
        rows: [
          {
            institution_code: "5901",
            institution_name: "安心藥局",
            address: "臺北市中正區",
            phone: "02",
            city: "臺北市",
            termination_date: null,
            source_updated_at: "2026-10-08",
            latitude: "25.04",
            longitude: "121.52",
            distance_km: "0.42",
          },
        ],
      });
    const result = await searchPharmacies({
      keyword: "",
      city: "臺北市",
      district: "中正區",
      latitude: 25.04,
      longitude: 121.52,
      radiusKm: 10,
      page: 1,
      pageSize: 20,
    });

    expect(result.items[0]).toMatchObject({
      latitude: 25.04,
      longitude: 121.52,
      distanceKm: 0.42,
    });
    expect(query.mock.calls[0][0]).toContain("latitude IS NOT NULL");
    expect(query.mock.calls[0][0]).toContain("acos");
    expect(query.mock.calls[0][1]).toEqual([
      "臺北市%",
      "%中正區%",
      25.04,
      121.52,
      10,
    ]);
  });
  it("定位查詢未指定半徑時仍依距離排序且不套用距離上限", async () => {
    query
      .mockResolvedValueOnce({ rows: [{ total: "1" }] })
      .mockResolvedValueOnce({
        rows: [
          {
            institution_code: "5902",
            institution_name: "遠方藥局",
            address: "高雄市",
            phone: "07",
            city: "高雄市",
            termination_date: null,
            source_updated_at: "2026-10-08",
            latitude: "22.63",
            longitude: "120.30",
            distance_km: "300",
          },
        ],
      });
    const result = await searchPharmacies({
      keyword: "",
      latitude: 25.04,
      longitude: 121.52,
      page: 1,
      pageSize: 20,
    });

    expect(result.items[0]).toMatchObject({ id: "5902", distanceKm: 300 });
    expect(query.mock.calls[0][0]).not.toContain("<=");
    expect(query.mock.calls[0][1]).toEqual([]);
    expect(query.mock.calls[1][0]).toContain("ORDER BY distance_km");
    expect(query.mock.calls[1][1]).toEqual([25.04, 121.52, 20, 0]);
  });
});
