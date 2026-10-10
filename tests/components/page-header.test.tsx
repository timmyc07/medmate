import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PageHeader from "../../src/components/PageHeader";

describe("PageHeader", () => {
  it("提供回首頁、跨頁查詢與主題切換入口", () => {
    render(<PageHeader href="/medicines" label="查詢藥品" />);

    expect(screen.getByRole("link", { name: "MediMate 首頁" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: /查詢藥品/ })).toHaveAttribute("href", "/medicines");
    expect(screen.getByRole("button", { name: /切換至夜間模式|切換至白天模式/ })).toBeInTheDocument();
  });
});
