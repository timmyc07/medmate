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
  it("搜尋欄使用可見的向量圖示", () => {
    const { container } = render(<QuickSearch />);
    expect(container.querySelector(".quick-search-form svg")).toBeInTheDocument();
    expect(container.querySelector(".material-symbols-outlined")).toBeNull();
  });

  it("依藥品關鍵字導向藥品目錄", () => {
    render(<QuickSearch />);

    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "阿斯匹靈" } });
    fireEvent.submit(screen.getByRole("searchbox").closest("form") as HTMLFormElement);

    expect(push).toHaveBeenCalledWith("/medicines?q=%E9%98%BF%E6%96%AF%E5%8C%B9%E9%9D%88");
  });

  it("沒有關鍵字時不送出查詢", () => {
    render(<QuickSearch />);

    fireEvent.submit(screen.getByRole("searchbox").closest("form") as HTMLFormElement);

    expect(push).not.toHaveBeenCalled();
  });
});
