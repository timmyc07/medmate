import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PageHeader from "../../src/components/PageHeader";

describe("PageHeader", () => {
  it("提供全站導覽、目前頁狀態與主題切換入口", () => {
    const { container } = render(<PageHeader currentPath="/medicines" />);

    expect(screen.getByRole("link", { name: "MediMate 首頁" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "首頁" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "藥局地圖" })).toHaveAttribute("href", "/pharmacies");
    expect(screen.getByRole("link", { name: "藥品目錄" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "資料來源" })).toHaveAttribute("class", "desktop-nav-only");
    expect(screen.getByRole("link", { name: "資料來源" })).toHaveAttribute("href", "/#data-status");
    expect(screen.getByRole("link", { name: "前往快速搜尋" })).toHaveAttribute("href", "#quick-search");
    expect(screen.getByRole("img", { name: "全民健康保險標誌" })).toHaveAttribute("src", "/health-insurance-emblem.svg");
    expect(screen.getByRole("button", { name: /切換至夜間模式|切換至白天模式/ })).toBeInTheDocument();
    expect(container.querySelector(".site-header")).toHaveClass("site-header");
    expect(container.querySelector(".header-tools")).toHaveClass("header-tools");
    expect(container.querySelectorAll("svg").length).toBeGreaterThan(0);
    expect(container.querySelector(".material-symbols-outlined")).toBeNull();
  });
});
