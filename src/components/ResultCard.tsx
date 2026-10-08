import type { Medicine, Pharmacy } from "../types/catalog";

export function PharmacyResult({ item }: { item: Pharmacy }) {
  return (
    <article className="result-row pharmacy-card">
      <div className="pharmacy-card-image" aria-hidden="true"><span>＋</span></div>
      <div className="result-main">
        <h3>{item.name}</h3>
        <p>{item.address || "地址資料未提供"}</p>
        <div className="card-meta"><span>{item.phone ? `電話 ${item.phone}` : "電話資料未提供"}</span><span>{item.status ? `資料狀態 ${item.status}` : "營業狀況待查"}</span></div>
        {item.city && <span className="result-meta">{item.city}</span>}
        {item.distanceKm != null && <span className="result-meta">距離約 {item.distanceKm.toFixed(1)} 公里</span>}
      </div>
      {item.phone && <a className="call-link" href={`tel:${item.phone}`} aria-label={`撥打 ${item.name}`}>撥打電話</a>}
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
        {(item.licenseStatus || item.validUntil) && <span className="result-meta">{[item.licenseStatus, item.validUntil && `有效至 ${item.validUntil}`].filter(Boolean).join("・")}</span>}
      </div>
    </article>
  );
}
