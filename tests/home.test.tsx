import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import RootLayout from "../src/app/layout";
import HomePage from "../src/app/page";

describe("首頁", () => {
  it("顯示繁體中文品牌及藥局、藥品兩種查詢入口", () => {
    render(<HomePage />);

    expect(screen.getByRole("link", { name: /MediMate 首頁/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /藥局地圖/ })).toHaveAttribute("href", "/pharmacies");
    expect(screen.getByRole("link", { name: /探索藥局/ })).toHaveAttribute("href", "/pharmacies");
    expect(screen.getByRole("link", { name: /查詢藥品/ })).toHaveAttribute("href", "/medicines");
    expect(screen.getByRole("link", { name: /找藥局/ })).toHaveAttribute("href", "/pharmacies");
    expect(screen.getByRole("link", { name: /查藥品/ })).toHaveAttribute("href", "/medicines");
  });

  it("在共用版型底部顯示健保標誌與政府資料來源", () => {
    render(<RootLayout><HomePage /></RootLayout>);

    expect(screen.getByRole("img", { name: "全民健康保險標誌" })).toHaveAttribute("src", "/health-insurance-emblem.svg");
    expect(screen.getByRole("heading", { name: "資料來源與參考" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /健保特約醫事機構/ })).toHaveAttribute("href", "https://data.gov.tw/dataset/39284");
  });
});
