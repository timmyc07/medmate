import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import RootLayout from "../src/app/layout";
import HomePage from "../src/app/page";
import Template from "../src/app/template";

describe("首頁", () => {
  it("顯示繁體中文品牌及藥局、藥品兩種查詢入口", () => {
    render(<HomePage />);

    expect(screen.getByRole("link", { name: /MediMate 首頁/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /藥局地圖/ })).toHaveAttribute("href", "/pharmacies");
    expect(screen.getByRole("link", { name: /探索藥局/ })).toHaveAttribute("href", "/pharmacies");
    expect(screen.getByRole("link", { name: /查詢藥品/ })).toHaveAttribute("href", "/medicines");
    expect(screen.getByRole("link", { name: /藥品目錄/ })).toHaveAttribute("href", "/medicines");
    expect(screen.queryByRole("heading", { name: "從一個關鍵字開始" })).not.toBeInTheDocument();
    expect(screen.queryByText(/健康提醒/)).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "健康手冊" })).not.toBeInTheDocument();
    expect(document.querySelector(".home-hero-inner")).toHaveClass("home-hero-inner");
  });

  it("在共用版型底部顯示健保標誌與政府資料來源", () => {
    render(<RootLayout><HomePage /></RootLayout>);

    expect(screen.getAllByRole("img", { name: "全民健康保險標誌" }).some((image) => image.getAttribute("src") === "/health-insurance-emblem.svg")).toBe(true);
    expect(screen.getByRole("heading", { name: "資料來源與授權" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "健保特約醫事機構－藥局" })).toHaveAttribute("href", "https://data.gov.tw/dataset/39284");
    const footer = screen.getByRole("contentinfo");
    expect(footer.querySelector(".footer-disclaimer")).toBeNull();
    expect(within(footer).getByRole("link", { name: "政府資料開放授權條款第 1 版" })).toHaveAttribute("href", "https://data.gov.tw/license");
  });

  it("以共用頁面轉場容器包住路由內容", () => {
    const { container } = render(<Template><HomePage /></Template>);

    expect(container.querySelector(".page-transition")).toBeInTheDocument();
  });
});
