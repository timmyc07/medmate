import type { Medicine, Pharmacy } from "../types/catalog";
import { getCurrentPharmacyHoursStatus, parsePharmacyWeeklySchedule } from "../lib/pharmacy-hours";

export function PharmacyResult({ item }: { item: Pharmacy }) {
  const currentHours = getCurrentPharmacyHoursStatus(item.openingHours);
  const weeklySchedule = parsePharmacyWeeklySchedule(item.openingHours);
  const mapUrl =
    item.latitude !== null && item.longitude !== null
      ? `https://www.google.com/maps/dir/?api=1&destination=${item.latitude},${item.longitude}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.address ?? item.name)}`;
  return (
    <article className="result-row pharmacy-card">
      <div className="pharmacy-card-layout">
        <div className="result-main pharmacy-card-info">
          <h3>{item.name}</h3>
          <p>{item.address || "地址資料未提供"}</p>
          <div className="card-meta">
            <span>{item.phone ? `電話 ${item.phone}` : "電話資料未提供"}</span>
            <span>
              {item.status ? `資料狀態 ${item.status}` : "營業狀況待查"}
            </span>
          </div>
          {item.city && <span className="result-meta">{item.city}</span>}
          {item.distanceKm != null && (
            <span className="result-meta">
              距離約 {item.distanceKm.toFixed(1)} 公里
            </span>
          )}
          <div className="pharmacy-card-actions">
            <a
              className="call-link"
              href={mapUrl}
              target="_blank"
              rel="noreferrer"
              aria-label={`導航至 ${item.name}`}
            >
              前往地圖
            </a>
            {item.phone && (
              <a
                className="call-link"
                href={`tel:${item.phone}`}
                aria-label={`撥打 ${item.name}`}
              >
                撥打電話
              </a>
            )}
          </div>
        </div>
        <section className="pharmacy-hours pharmacy-card-hours" aria-label="政府登記看診時段">
          <strong>{currentHours.label}</strong>
          {weeklySchedule.length ? (
            <div className="pharmacy-hours-panel">
              <section className="pharmacy-calendar-scroll" aria-label="一週看診時間表">
                <table className="pharmacy-calendar">
                  <thead><tr><th scope="col">時段</th>{weeklySchedule.map(({ day }) => <th scope="col" key={day}>週{day}</th>)}</tr></thead>
                  <tbody>
                    {(["上午", "下午", "晚上"] as const).map((period) => (
                      <tr key={period}>
                        <th scope="row">{period}</th>
                        {weeklySchedule.map(({ day, periods }) => {
                          const status = periods.find((entry) => entry.name === period)?.status ?? "未提供";
                          return <td key={day} className={`pharmacy-calendar-${status}`} aria-label={`週${day}${period}${status}`}>{status === "看診" ? "看診" : status === "休診" ? "休診" : "—"}</td>;
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            </div>
          ) : (
            <p>政府資料未提供固定看診時段</p>
          )}
          <small>此為政府登記的看診安排，不代表即時營業狀態；出發前請先電話確認。</small>
        </section>
      </div>
    </article>
  );
}

export function MedicineResult({ item }: { item: Medicine }) {
  return (
    <article className="result-row result-row--medicine">
      <div className="result-main">
        <h3>{item.name}</h3>
        <p>許可證字號：{item.licenseNumber}</p>
        {item.indications && <p className="indications">{item.indications}</p>}
        {(item.licenseStatus || item.validUntil) && (
          <span className="result-meta">
            {[
              item.licenseStatus,
              item.validUntil && `有效至 ${item.validUntil}`,
            ]
              .filter(Boolean)
              .join("・")}
          </span>
        )}
      </div>
    </article>
  );
}
