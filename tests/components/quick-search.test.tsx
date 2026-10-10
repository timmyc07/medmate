import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import QuickSearch from "../../src/components/QuickSearch";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

beforeEach(() => push.mockClear());
afterEach(() => cleanup());

describe("首頁快速搜尋", () => {
  it("以藥品模式將關鍵字導向藥品目錄", () => {
    render(<QuickSearch />);

    fireEvent.click(screen.getByRole("button", { name: "藥品" }));
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "阿斯匹靈" } });
    fireEvent.submit(screen.getByRole("searchbox").closest("form") as HTMLFormElement);

    expect(push).toHaveBeenCalledWith("/medicines?q=%E9%98%BF%E6%96%AF%E5%8C%B9%E9%9D%88");
  });

  it("藥局模式允許空白關鍵字並導向藥局目錄", () => {
    render(<QuickSearch />);

    fireEvent.submit(screen.getByRole("searchbox").closest("form") as HTMLFormElement);

    expect(push).toHaveBeenCalledWith("/pharmacies");
  });
});
