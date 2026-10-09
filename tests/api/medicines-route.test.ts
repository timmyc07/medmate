import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "../../src/app/api/medicines/route";
import { GET as usageGET } from "../../src/app/api/medicines/usage/route";
import { getMedicineUsagePage } from "../../src/lib/db/medicine-usage";
import { searchMedicines } from "../../src/lib/db/medicines";

vi.mock("../../src/lib/db/medicines", () => ({
  searchMedicines: vi.fn(),
}));

vi.mock("../../src/lib/db/medicine-usage", () => ({
  getMedicineUsagePage: vi.fn(),
}));

describe("藥品搜尋 API", () => {
  beforeEach(() => vi.mocked(searchMedicines).mockReset());

  it("正規化合法搜尋條件後傳給 repository", async () => {
    vi.mocked(searchMedicines).mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 20,
      total: 0,
    });
    const response = await GET(
      new Request(
        "https://example.test/api/medicines?q=%20普拿疼%20&page=2&pageSize=10",
      ),
    );

    expect(response.status).toBe(200);
    expect(searchMedicines).toHaveBeenCalledWith({
      keyword: "普拿疼",
      page: 2,
      pageSize: 10,
    });
  });

  it("拒絕超長搜尋字並且不呼叫 repository", async () => {
    const keyword = "藥".repeat(101);
    const response = await GET(
      new Request(
        `https://example.test/api/medicines?q=${encodeURIComponent(keyword)}`,
      ),
    );

    expect(response.status).toBe(400);
    expect(searchMedicines).not.toHaveBeenCalled();
  });

  it("藥品榜單 API 預設每頁 50 筆並可指定頁碼", async () => {
    vi.mocked(getMedicineUsagePage).mockResolvedValue({
      items: [],
      page: 2,
      pageSize: 50,
      total: 100,
      feeYear: 115,
      periodStart: "11501",
      periodEnd: "11507",
    });
    const response = await usageGET(
      new Request("https://example.test/api/medicines/usage?page=2"),
    );
    expect(response.status).toBe(200);
    expect(getMedicineUsagePage).toHaveBeenCalledWith(2, 50);
  });

  it("藥品榜單 API 拒絕超過 50 筆的頁面", async () => {
    const response = await usageGET(
      new Request("https://example.test/api/medicines/usage?pageSize=51"),
    );
    expect(response.status).toBe(400);
    expect(getMedicineUsagePage).not.toHaveBeenCalled();
  });
});
