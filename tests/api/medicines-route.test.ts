import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "../../src/app/api/medicines/route";
import { searchMedicines } from "../../src/lib/db/medicines";

vi.mock("../../src/lib/db/medicines", () => ({
  searchMedicines: vi.fn(),
}));

describe("藥品搜尋 API", () => {
  beforeEach(() => vi.mocked(searchMedicines).mockReset());

  it("正規化合法搜尋條件後傳給 repository", async () => {
    vi.mocked(searchMedicines).mockResolvedValue({ items: [], page: 1, pageSize: 20, total: 0 });
    const response = await GET(new Request("https://example.test/api/medicines?q=%20普拿疼%20&page=2&pageSize=10"));

    expect(response.status).toBe(200);
    expect(searchMedicines).toHaveBeenCalledWith({ keyword: "普拿疼", page: 2, pageSize: 10 });
  });

  it("拒絕超長搜尋字並且不呼叫 repository", async () => {
    const keyword = "藥".repeat(101);
    const response = await GET(new Request(`https://example.test/api/medicines?q=${encodeURIComponent(keyword)}`));

    expect(response.status).toBe(400);
    expect(searchMedicines).not.toHaveBeenCalled();
  });

});
