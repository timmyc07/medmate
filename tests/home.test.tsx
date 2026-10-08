import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import HomePage from "../src/app/page";

describe("首頁", () => {
  it("顯示繁體中文品牌及藥局、藥品兩種查詢入口", () => {
    const html = renderToStaticMarkup(createElement(HomePage));

    expect(html).toContain("MediMate");
    expect(html).toContain("藥局查詢");
    expect(html).toContain("藥品查詢");
  });
});
