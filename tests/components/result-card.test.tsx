import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PharmacyResult } from "../../src/components/ResultCard";

describe("藥局資訊卡", () => {
  it("保留資料與操作連結，不渲染圖片區塊", () => {
    const { container } = render(
      <PharmacyResult
        item={{
          id: "P001",
          name: "安心藥局",
          address: "臺北市中正區忠孝東路 1 號",
          phone: "02-12345678",
          city: "臺北市",
          status: "健保特約",
          openingHours: "星期一上午看診、星期一下午休診",
          sourceUpdatedAt: null,
          latitude: 25.04,
          longitude: 121.53,
        }}
      />,
    );

    expect(screen.getByRole("heading", { name: "安心藥局" })).toBeInTheDocument();
    expect(screen.getByText("臺北市中正區忠孝東路 1 號")).toBeInTheDocument();
    expect(screen.getByText(/此為政府登記的看診安排/)).toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByLabelText("週一上午看診")).toBeInTheDocument();
    expect(screen.getByLabelText("週一下午休診")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "導航至 安心藥局" })).toHaveAttribute(
      "href",
      "https://www.google.com/maps/dir/?api=1&destination=25.04,121.53",
    );
    expect(screen.getByRole("link", { name: "撥打 安心藥局" })).toHaveAttribute(
      "href",
      "tel:02-12345678",
    );
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector(".pharmacy-card-visual")).toBeNull();
    expect(container.querySelector(".pharmacy-card-layout")).toBeInTheDocument();
    expect(container.querySelector(".pharmacy-card-info")).toBeInTheDocument();
    expect(container.querySelector(".pharmacy-card-hours")).toBeInTheDocument();
    expect(container.querySelector(".pharmacy-hours-panel")).toBeInTheDocument();
    expect(container.querySelector(".pharmacy-hours details")).toBeNull();
    expect(container.querySelector("summary")).toBeNull();
  });
});
