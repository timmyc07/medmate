import { cleanup, render, screen } from "@testing-library/react";
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
});
