const WEEKDAYS = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"] as const;
type Period = "上午" | "下午" | "晚上";

export type CurrentPharmacyHours = {
  status: "listed" | "not-listed" | "unavailable";
  label: string;
  period: Period | null;
};

export type PharmacyWeeklySchedule = Array<{
  day: string;
  periods: Array<{ name: Period; status: "看診" | "休診" | "未提供" }>;
}>;

/** 將健保署的原始字串轉成週曆使用的星期與時段資料。 */
export function parsePharmacyWeeklySchedule(openingHours: string | null): PharmacyWeeklySchedule {
  if (!openingHours?.trim()) return [];
  return ["一", "二", "三", "四", "五", "六", "日"].map((day) => ({
    day,
    periods: (["上午", "下午", "晚上"] as const).map((name) => {
      const match = openingHours.match(new RegExp(`星期${day}${name}(看診|休診)`));
      return { name, status: match?.[1] as "看診" | "休診" | undefined ?? "未提供" };
    }),
  }));
}

/** 依政府固定看診時段原文，判讀台灣目前半日時段是否列有看診安排。 */
export function getCurrentPharmacyHoursStatus(
  openingHours: string | null,
  at: Date = new Date(),
): CurrentPharmacyHours {
  if (!openingHours?.trim())
    return { status: "unavailable", label: "看診時段資料未提供", period: null };

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Taipei",
    weekday: "short",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);
  const weekday = parts.find((part) => part.type === "weekday")?.value;
  const hourValue = Number(parts.find((part) => part.type === "hour")?.value);
  const dayIndex = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekday ?? "");
  if (dayIndex < 0 || !Number.isFinite(hourValue))
    return { status: "unavailable", label: "目前看診安排無法判讀", period: null };

  const period: Period = hourValue < 12 ? "上午" : hourValue < 18 ? "下午" : "晚上";
  const weekdayName = WEEKDAYS[dayIndex];
  const escaped = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = openingHours.match(
    new RegExp(`${escaped(weekdayName)}${escaped(period)}(看診|休診)`),
  );
  if (!match)
    return { status: "unavailable", label: `${weekdayName}${period}看診安排未提供`, period };

  return match[1] === "看診"
    ? { status: "listed", label: `政府資料列示：${weekdayName}${period}有看診安排`, period }
    : { status: "not-listed", label: `政府資料列示：${weekdayName}${period}未列看診安排`, period };
}

/** 依星期彙整相同看診狀態的時段，讓卡片更容易掃讀。 */
export function formatPharmacyOpeningHours(openingHours: string | null): string | null {
  if (!openingHours?.trim()) return null;
  return parsePharmacyWeeklySchedule(openingHours).map(({ day, periods }) => {
    const clinic = periods.filter((period) => period.status === "看診").map((period) => period.name === "上午" ? "上" : period.name);
    const closed = periods.filter((period) => period.status === "休診").map((period) => period.name === "上午" ? "上" : period.name);
    return [clinic.length ? `週${day}${clinic.join("/")} 看診` : "", closed.length ? `週${day}${closed.join("/")}休診` : ""].filter(Boolean).join("；");
  }).filter(Boolean).join("・") || null;
}
