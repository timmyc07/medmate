import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SearchPanel from "../../src/components/SearchPanel";

describe("搜尋面板", () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => cleanup());

  it("資料尚未啟用時停用搜尋並說明原因", () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    render(<SearchPanel kind="pharmacies" enabled={false} />);

    expect(screen.getByRole("searchbox")).toBeDisabled();
    expect(screen.getByRole("button", { name: "資料尚未開放" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("資料查詢目前暫停，請稍後再試。");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("資料啟用後允許搜尋輸入", () => {
    render(<SearchPanel kind="medicines" enabled />);
    expect(screen.getByRole("searchbox")).toBeEnabled();
    expect(screen.getByRole("button", { name: "搜尋" })).toBeEnabled();
  });

  it("藥局可用縣市與區域查詢，不必輸入關鍵字", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ items: [], page: 1, pageSize: 20, total: 0 }), { status: 200 }));
    render(<SearchPanel kind="pharmacies" enabled />);
    fireEvent.change(screen.getByPlaceholderText("縣市，例如臺北市"), { target: { value: "臺北市" } });
    fireEvent.change(screen.getByPlaceholderText("區域，例如中正區"), { target: { value: "中正區" } });
    fireEvent.click(screen.getByRole("button", { name: "搜尋" }));

    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledWith(expect.stringContaining("city=%E8%87%BA%E5%8C%97%E5%B8%82"), expect.anything()));
    expect(globalThis.fetch).toHaveBeenCalledWith(expect.stringContaining("district=%E4%B8%AD%E6%AD%A3%E5%8D%80"), expect.anything());
  });
});
