import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SearchPanel from "../../src/components/SearchPanel";

describe("搜尋面板", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("資料尚未啟用時停用搜尋並說明原因", () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    render(<SearchPanel kind="pharmacies" />);

    expect(screen.getByRole("searchbox")).toBeDisabled();
    expect(screen.getByRole("button", { name: "資料尚未開放" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("資料來源核實完成後開放搜尋");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
