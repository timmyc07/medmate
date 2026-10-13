import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import MedicineUsageCatalog from "../../src/components/MedicineUsageCatalog";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("藥品使用量目錄", () => {
  it("直接載入 FDA 外觀照片且隱藏英文品名", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      items: [{ rank: 1, drugCode: "D001", name: "測試藥品", englishName: "TEST TABLET 500MG", ingredient: "", dosageForm: "錠", claimQuantity: 100, licenseNumber: "A1", appearanceImageUrl: "https://mcp.fda.gov.tw/image.jpg", appearanceShape: "圓形", appearanceColor: "白色" }],
      page: 1, pageSize: 50, total: 1, feeYear: null, periodStart: null, periodEnd: null,
    }), { status: 200 }));
    await act(async () => { render(<MedicineUsageCatalog />); });

    const image = await screen.findByRole("img", { name: "測試藥品藥品外觀" });
    await waitFor(() => expect(image).toHaveAttribute("src", "https://mcp.fda.gov.tw/image.jpg"));
    expect(image).toHaveAttribute("loading", "lazy");
    expect(screen.queryByText("TEST TABLET 500MG")).not.toBeInTheDocument();
  });

  it("外觀圖片載入失敗時顯示占位內容", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      items: [{ rank: 1, drugCode: "D001", name: "測試藥品", englishName: "", ingredient: "", dosageForm: "錠", claimQuantity: 100, licenseNumber: "A1", appearanceImageUrl: "https://mcp.fda.gov.tw/image.jpg", appearanceShape: "圓形", appearanceColor: "白色" }],
      page: 1, pageSize: 50, total: 1, feeYear: null, periodStart: null, periodEnd: null,
    }), { status: 200 }));
    await act(async () => { render(<MedicineUsageCatalog />); });

    const image = await screen.findByRole("img", { name: "測試藥品藥品外觀" });
    await act(async () => { image.dispatchEvent(new Event("error")); });

    expect(screen.getByRole("img", { name: "未提供此藥品外觀圖片" })).toBeInTheDocument();
  });
});
