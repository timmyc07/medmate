"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Pill } from "lucide-react";
import type { Medicine, Pharmacy } from "../types/catalog";
import { getCurrentPharmacyHoursStatus, parsePharmacyWeeklySchedule } from "../lib/pharmacy-hours";
import ScrollReveal from "./ScrollReveal";

export function PharmacyResult({ item }: { item: Pharmacy }) {
  const [currentHours, setCurrentHours] = useState<ReturnType<typeof getCurrentPharmacyHoursStatus> | null>(null);
  useEffect(() => {
    const update = () => setCurrentHours(getCurrentPharmacyHoursStatus(item.openingHours));
    update();
    const timer = window.setInterval(update, 60_000);
    return () => window.clearInterval(timer);
  }, [item.openingHours]);
  const weeklySchedule = parsePharmacyWeeklySchedule(item.openingHours);
  const mapUrl =
    item.latitude !== null && item.longitude !== null
      ? `https://www.google.com/maps/dir/?api=1&destination=${item.latitude},${item.longitude}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.address ?? item.name)}`;
  return (
    <ScrollReveal as="article" className="result-row pharmacy-card">
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
            <strong className={currentHours ? `pharmacy-current-hours pharmacy-current-hours--${currentHours.status}` : "pharmacy-current-hours"} aria-live="polite">
              {currentHours?.label ?? "正在判斷目前看診時段…"}
            </strong>
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
            <p>未提供固定看診時段</p>
          )}
        </section>
      </div>
    </ScrollReveal>
  );
}

export function MedicineResult({ item }: { item: Medicine }) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  return (
    <ScrollReveal as="article" className="result-row result-row--medicine">
      <div className="result-main">
        <div className="medicine-card-topline">
          <div className="medicine-card-image" aria-label={`${item.name}外觀圖`} role="img">
            {item.appearance?.imageUrl ? <img src={item.appearance.imageUrl} alt={`${item.name}外觀`} /> : <Pill aria-hidden="true" />}
            {!item.appearance?.imageUrl && <small>外觀圖待補</small>}
          </div>
          <div className="medicine-card-heading">
            <h3>{item.name}</h3>
            {item.price?.length ? (
              <div className="medicine-card-price">
                {item.price.map((price) => <p key={`${price.drugCode}-${price.effectiveFrom}`}>
                  <strong>健保支付價參考：{price.amount.toLocaleString("zh-TW")} 點</strong>{price.specification ? `（規格：${price.specification}）` : ""}
                  <br /><small>健保核定支付基準，不是一般藥局自費售價；自 {price.effectiveFrom} 起</small>
                </p>)}
                <a href={item.price[0].sourceUrl} target="_blank" rel="noreferrer">查看健保署官方資料</a>
              </div>
            ) : <p className="medicine-card-price">健保支付價：目前查不到精確對應的官方價格</p>}
          </div>
        </div>
        {item.indications ? (
          <p className="indications"><strong>這個藥通常用來：</strong>{item.indications}</p>
        ) : (
          <p className="indications"><strong>用途：</strong>目前沒有找到簡單的用途說明，請問藥師。</p>
        )}
        <p className="medicine-card-license">許可證字號：{item.licenseNumber}</p>
        {item.appearance && <p className="medicine-card-license">外觀：{[item.appearance.color, item.appearance.shape, item.appearance.imprint && `刻字 ${item.appearance.imprint}`].filter(Boolean).join("、") || "請以藥袋核對"}</p>}
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
        <button className="medicine-details-toggle" type="button" onClick={() => setDetailsOpen((open) => !open)} aria-expanded={detailsOpen}>
          <span aria-hidden="true">{detailsOpen ? "先收起詳細資料" : "想看更多用法與安全提醒"}</span>
          <span className="sr-only">查看官方用藥與安全資料</span>
          <ChevronDown aria-hidden="true" />
        </button>
        {detailsOpen && (
          <div className="medicine-official-details">
            <section>
              <h4>官方用法用量</h4>
              <p>{item.usageDosage || "官方資料未提供此藥品的用法用量。"}</p>
            </section>
            <section>
              <h4>官方處方成分</h4>
              {item.ingredients.length ? <ul>{item.ingredients.map((ingredient) => <li key={JSON.stringify(ingredient)}>
                {[ingredient.prescriptionLabel, ingredient.ingredientName, ingredient.contentDescription || [ingredient.contentValue, ingredient.contentUnit].filter(Boolean).join(" ")].filter(Boolean).join("｜")}
              </li>)}</ul> : <p>官方資料未提供此藥品的處方成分。</p>}
            </section>
            <section>
              <h4>精確許可證安全公告</h4>
              {item.safetyCommunications.length ? item.safetyCommunications.map((communication) => <article key={`${communication.publicationDate}-${communication.sourceUrl}`}>
                <p><strong>{communication.publicationDate}</strong>{communication.reason ? `｜${communication.reason}` : ""}</p>
                {communication.scopeText && <p>公告涵蓋範圍：{communication.scopeText}</p>}
                {communication.indications && <p>公告適應症：{communication.indications}</p>}
                {communication.mechanism && <p>公告作用機轉：{communication.mechanism}</p>}
                {communication.safetyAnalysis && <p>{communication.safetyAnalysis}</p>}
                {communication.tfdaCommunication && <p>{communication.tfdaCommunication}</p>}
                <a href={communication.sourceUrl} target="_blank" rel="noreferrer">TFDA 公告來源</a>
              </article>) : <p>目前沒有可用完整許可證字號精確配對的安全公告。</p>}
              <p>副作用、禁忌與交互作用資料未由目前來源提供；請洽藥師或醫療人員。</p>
              <p>安全公告來源目前涵蓋 2014-01-21 至 2022-12-16；未列入公告不代表沒有風險。</p>
            </section>
          </div>
        )}
      </div>
    </ScrollReveal>
  );
}
