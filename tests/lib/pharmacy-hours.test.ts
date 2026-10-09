import { describe, expect, it } from "vitest";
import { formatPharmacyOpeningHours, getCurrentPharmacyHoursStatus, parsePharmacyWeeklySchedule } from "../../src/lib/pharmacy-hours";

describe("政府固定看診時段目前區段判斷", () => {
  const fullHours = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"]
    .flatMap((day) => ["上午", "下午", "晚上"].map((period) => `${day}${period}看診`))
    .join("、");

  it("使用台灣時區判斷星期與上午區段", () => {
    expect(getCurrentPharmacyHoursStatus(fullHours, new Date("2026-10-11T02:00:00Z"))).toMatchObject({
      status: "listed",
      label: "政府資料列示：星期日上午有看診安排",
      period: "上午",
    });
  });

  it("將正午歸入下午、18 時歸入晚上", () => {
    expect(getCurrentPharmacyHoursStatus(fullHours, new Date("2026-10-09T04:00:00Z")).period).toBe("下午");
    expect(getCurrentPharmacyHoursStatus(fullHours, new Date("2026-10-09T10:00:00Z")).period).toBe("晚上");
  });

  it("區分未列看診安排與時段資料未提供", () => {
    expect(getCurrentPharmacyHoursStatus("星期日晚上休診", new Date("2026-10-11T12:00:00Z"))).toMatchObject({
      status: "not-listed",
      label: "政府資料列示：星期日晚上未列看診安排",
    });
    expect(getCurrentPharmacyHoursStatus(null)).toMatchObject({
      status: "unavailable",
      label: "看診時段資料未提供",
    });
  });
});

describe("看診時段易讀格式", () => {
  it("按星期合併看診時段並保留休診區段", () => {
    expect(formatPharmacyOpeningHours("星期一上午看診、星期一下午看診、星期一晚上休診、星期二上午休診"))
      .toBe("週一上/下午 看診；週一晚上休診・週二上休診");
  });

  it("為週曆提供看診、休診與未提供三種狀態", () => {
    expect(parsePharmacyWeeklySchedule("星期一上午看診、星期一晚上休診")[0]).toEqual({
      day: "一",
      periods: [
        { name: "上午", status: "看診" },
        { name: "下午", status: "未提供" },
        { name: "晚上", status: "休診" },
      ],
    });
  });
});
