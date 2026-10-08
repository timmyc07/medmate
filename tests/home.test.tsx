import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HomePage from "../src/app/page";

describe("首頁", () => {
  it("顯示繁體中文品牌及藥局、藥品兩種查詢入口", () => {
    render(<HomePage />);

    expect(screen.getByRole("link", { name: /MediMate 首頁/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /藥局查詢/ })).toHaveAttribute("href", "#pharmacies");
    expect(screen.getByRole("link", { name: /藥品查詢/ })).toHaveAttribute("href", "#medicines");
    expect(screen.getByRole("heading", { name: "藥局查詢" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "藥品查詢" })).toBeInTheDocument();
  });
});
