import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import MedicineUsageCatalog from "../../src/components/MedicineUsageCatalog";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("藥品使用量目錄", () => {
  it("排行卡不展示未經官方識別碼精確配對的藥證詳細資料", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      items: [{ rank: 1, drugCode: "D001", name: "測試藥品", englishName: "", ingredient: "", dosageForm: "錠", claimQuantity: 100 }],
      page: 1, pageSize: 50, total: 1, feeYear: null, periodStart: null, periodEnd: null,
    }), { status: 200 }));
    await act(async () => { render(<MedicineUsageCatalog />); });

    expect(await screen.findByText("測試藥品")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /官方用藥資料/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/許可證字號：/)).not.toBeInTheDocument();
  });

  it("顯示排行資料且隱藏英文品名", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      items: [{ rank: 1, drugCode: "D001", name: "測試藥品", englishName: "TEST TABLET 500MG", ingredient: "", dosageForm: "錠", claimQuantity: 100 }],
      page: 1, pageSize: 50, total: 1, feeYear: null, periodStart: null, periodEnd: null,
    }), { status: 200 }));
    await act(async () => { render(<MedicineUsageCatalog />); });

    expect(await screen.findByText("測試藥品")).toBeInTheDocument();
    expect(screen.queryByText("TEST TABLET 500MG")).not.toBeInTheDocument();
  });
});
