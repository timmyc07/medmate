import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SearchPanel from "../../src/components/SearchPanel";
import { TAIWAN_ADMINISTRATIVE_AREAS, TAIWAN_CITIES } from "../../src/lib/taiwan-administrative-areas";

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

  it("包含全台 22 個縣市與 368 個鄉鎮市區", () => {
    expect(TAIWAN_CITIES).toHaveLength(22);
    expect(Object.values(TAIWAN_ADMINISTRATIVE_AREAS).reduce((total, districts) => total + districts.length, 0)).toBe(368);
  });

  it("藥局可用縣市與區域查詢，不必輸入關鍵字", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ items: [], page: 1, pageSize: 20, total: 0 }), { status: 200 }));
    render(<SearchPanel kind="pharmacies" enabled />);
    fireEvent.change(screen.getByRole("combobox", { name: "縣市" }), { target: { value: "臺北市" } });
    fireEvent.change(screen.getByRole("combobox", { name: "區域" }), { target: { value: "中正區" } });
    fireEvent.click(screen.getByRole("button", { name: "搜尋" }));

    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledWith(expect.stringContaining("city=%E8%87%BA%E5%8C%97%E5%B8%82"), expect.anything()));
    expect(globalThis.fetch).toHaveBeenCalledWith(expect.stringContaining("district=%E4%B8%AD%E6%AD%A3%E5%8D%80"), expect.anything());
  });

  it("藥局未填條件時仍可查詢全部資料", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ items: [], page: 1, pageSize: 20, total: 0 }), { status: 200 }));
    render(<SearchPanel kind="pharmacies" enabled />);

    fireEvent.click(screen.getByRole("button", { name: "搜尋" }));

    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/pharmacies?q=&page=1&pageSize=20"),
      expect.anything(),
    ));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("選擇縣市後只顯示對應行政區，換縣市會清除區域", () => {
    render(<SearchPanel kind="pharmacies" enabled />);
    const city = screen.getByRole("combobox", { name: "縣市" });
    const district = screen.getByRole("combobox", { name: "區域" });

    expect(district).toBeDisabled();
    expect(screen.getAllByRole("option").some((option) => option.textContent === "臺北市")).toBe(true);

    fireEvent.change(city, { target: { value: "臺北市" } });
    expect(district).toBeEnabled();
    expect(screen.getByRole("option", { name: "中正區" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "板橋區" })).not.toBeInTheDocument();
    fireEvent.change(district, { target: { value: "中正區" } });
    fireEvent.change(city, { target: { value: "新北市" } });
    expect(district).toHaveValue("");
    expect(screen.getByRole("option", { name: "板橋區" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "中正區" })).not.toBeInTheDocument();
  });

  it("帶入 URL 關鍵字時自動查詢並同步輸入框", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ items: [], page: 1, pageSize: 20, total: 0 }), { status: 200 }));
    render(<SearchPanel kind="medicines" enabled initialQuery="阿斯匹靈" />);

    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledWith(expect.stringContaining("q=%E9%98%BF%E6%96%AF%E5%8C%B9%E9%9D%88"), expect.anything()));
    expect(screen.getByRole("searchbox")).toHaveValue("阿斯匹靈");
  });

  it("URL 清除 q 時清除舊結果與輸入值", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ items: [{ id: "m1", licenseNumber: "A", name: "舊藥品", indications: null, licenseStatus: null, validUntil: null, sourceUpdatedAt: null }], page: 1, pageSize: 20, total: 1 }), { status: 200 }));
    const view = render(<SearchPanel kind="medicines" enabled initialQuery="舊藥品" />);
    await waitFor(() => expect(screen.getByText("舊藥品")).toBeInTheDocument());

    view.rerender(<SearchPanel kind="medicines" enabled initialQuery="" />);
    await waitFor(() => expect(screen.getByRole("searchbox")).toHaveValue(""));
    expect(screen.queryByText("舊藥品")).not.toBeInTheDocument();
  });

  it("定位期間切換縣市會取消定位並解除 loading", async () => {
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: { getCurrentPosition: vi.fn() },
    });
    render(<SearchPanel kind="pharmacies" enabled />);
    fireEvent.click(screen.getByRole("button", { name: "使用目前位置找附近藥局" }));
    expect(screen.getByRole("button", { name: "查詢中…" })).toBeDisabled();

    fireEvent.change(screen.getByRole("combobox", { name: "縣市" }), { target: { value: "臺北市" } });
    await waitFor(() => expect(screen.getByRole("button", { name: "搜尋" })).toBeEnabled());
    expect(screen.getByRole("button", { name: "使用目前位置找附近藥局" })).toBeEnabled();
  });
});
