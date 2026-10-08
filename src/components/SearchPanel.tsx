"use client";

import { useState, type FormEvent } from "react";
import type { Medicine, Page, Pharmacy } from "../types/catalog";
import { MedicineResult, PharmacyResult } from "./ResultCard";
import PharmacyMap from "./PharmacyMap";
import { TAIWAN_ADMINISTRATIVE_AREAS, TAIWAN_CITIES } from "../lib/taiwan-administrative-areas";

type Kind = "pharmacies" | "medicines";

export default function SearchPanel({ kind, enabled = true }: { kind: Kind; enabled?: boolean }) {
  const [keyword, setKeyword] = useState("");
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<Page<Pharmacy | Medicine> | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const label = kind === "pharmacies" ? "藥局" : "藥品";

  async function search(event?: FormEvent<HTMLFormElement>, nextPage = 1, locationOverride = location) {
    event?.preventDefault();
    setLoading(true);
    setError("");
    setPage(nextPage);
    const query = new URLSearchParams({ q: keyword.trim(), page: String(nextPage), pageSize: "20" });
    if (kind === "pharmacies" && city.trim()) query.set("city", city.trim());
    if (kind === "pharmacies" && district.trim()) query.set("district", district.trim());
    if (kind === "pharmacies" && locationOverride) {
      query.set("lat", String(locationOverride.latitude));
      query.set("lng", String(locationOverride.longitude));
      query.set("radiusKm", "10");
    }
    try {
      const response = await fetch(`/api/${kind}?${query.toString()}`, { headers: { Accept: "application/json" } });
      const body = await response.json();
      if (!response.ok) {
        setError(body.error?.message ?? "查詢服務暫時無法使用，請稍後再試。");
        setResult(null);
        return;
      }
      setResult(body as Page<Pharmacy | Medicine>);
    } catch {
      setError("目前無法連線，請確認網路後再試。");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      setError("此瀏覽器不支援定位，請改用縣市與區域查詢。");
      return;
    }
    setLoading(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude });
        setCity("");
        setDistrict("");
        setTimeout(() => void search(undefined, 1, { latitude: position.coords.latitude, longitude: position.coords.longitude }), 0);
      },
      () => {
        setLoading(false);
        setError("無法取得位置。你可以允許定位權限，或改用縣市與區域查詢。");
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    );
  }

  return (
    <section className="lookup-section" id={kind} aria-labelledby={`${kind}-title`}>
      <div className="section-heading">
        <div><span className="section-index">{kind === "pharmacies" ? "01" : "02"}</span><h2 id={`${kind}-title`}>{label}查詢</h2></div>
        <span className="section-caption">公開資料・關鍵字搜尋</span>
      </div>
      <form className="search-form" onSubmit={(event) => void search(event)}>
        <label className="search-field"><span className="sr-only">搜尋{label}名稱或相關文字</span><input type="search" value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder={kind === "pharmacies" ? "藥局名稱或地址（可留空）" : "輸入藥品名稱或許可證字號"} maxLength={100} required={kind === "medicines"} disabled={!enabled} /></label>
        {kind === "pharmacies" && <>
          <label className="city-field"><span className="sr-only">縣市</span><select value={city} onChange={(event) => { setCity(event.target.value); setDistrict(""); setLocation(null); }} disabled={!enabled}>
            <option value="">選擇縣市</option>
            {TAIWAN_CITIES.map((name) => <option key={name} value={name}>{name}</option>)}
          </select></label>
          <label className="district-field"><span className="sr-only">區域</span><select value={district} onChange={(event) => { setDistrict(event.target.value); setLocation(null); }} disabled={!enabled || !city}>
            <option value="">全部區域</option>
            {(TAIWAN_ADMINISTRATIVE_AREAS[city] ?? []).map((name) => <option key={name} value={name}>{name}</option>)}
          </select></label>
        </>}
        <button className="search-button" type="submit" disabled={!enabled || loading}>{!enabled ? "資料尚未開放" : loading ? "查詢中…" : "搜尋"}</button>
      </form>
      {kind === "pharmacies" && <button className="location-button" type="button" onClick={useMyLocation} disabled={!enabled || loading}>使用目前位置找附近藥局</button>}
      {!enabled && <p className="state-message" role="status">資料查詢目前暫停，請稍後再試。</p>}
      {loading && <p className="state-message" role="status">正在查詢{label}資料…</p>}
      {error && <p className="state-message state-error" role="alert">{error}</p>}
      {kind === "pharmacies" && result && <>
        <div className="result-summary">找到 {result.total.toLocaleString()} 筆，第 {result.page} 頁</div>
        <div className="results-list">{(result.items as Pharmacy[]).map((item) => <PharmacyResult key={item.id} item={item} />)}</div>
        <PharmacyMap pharmacies={result.items as Pharmacy[]} userLocation={location} />
      </>}
      {result && result.items.length === 0 && <p className="state-message" role="status">沒有符合條件的{label}資料。</p>}
      {result && result.items.length > 0 && <>
        {kind === "medicines" && <><div className="result-summary">找到 {result.total.toLocaleString()} 筆，第 {result.page} 頁</div><div className="results-list">{result.items.map((item) => <MedicineResult key={item.id} item={item as Medicine} />)}</div></>}
        <nav className="pagination" aria-label={`${label}結果分頁`}>
          <button type="button" onClick={() => void search(undefined, page - 1)} disabled={page <= 1 || loading}>上一頁</button>
          <span>第 {page} 頁</span>
          <button type="button" onClick={() => void search(undefined, page + 1)} disabled={page * result.pageSize >= result.total || loading}>下一頁</button>
        </nav>
      </>}
    </section>
  );
}
