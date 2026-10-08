"use client";

import { useState, type FormEvent } from "react";
import type { Medicine, Page, Pharmacy } from "../types/catalog";
import { MedicineResult, PharmacyResult } from "./ResultCard";

type Kind = "pharmacies" | "medicines";

export default function SearchPanel({ kind, enabled = false }: { kind: Kind; enabled?: boolean }) {
  const [keyword, setKeyword] = useState("");
  const [city, setCity] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<Page<Pharmacy | Medicine> | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const label = kind === "pharmacies" ? "藥局" : "藥品";

  async function search(event?: FormEvent<HTMLFormElement>, nextPage = 1) {
    event?.preventDefault();
    setLoading(true);
    setError("");
    setPage(nextPage);
    const query = new URLSearchParams({ q: keyword.trim(), page: String(nextPage), pageSize: "20" });
    if (kind === "pharmacies" && city.trim()) query.set("city", city.trim());
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

  return (
    <section className="lookup-section" id={kind} aria-labelledby={`${kind}-title`}>
      <div className="section-heading">
        <div><span className="section-index">{kind === "pharmacies" ? "01" : "02"}</span><h2 id={`${kind}-title`}>{label}查詢</h2></div>
        <span className="section-caption">公開資料・關鍵字搜尋</span>
      </div>
      <form className="search-form" onSubmit={(event) => void search(event)}>
        <label className="search-field"><span className="sr-only">搜尋{label}名稱或相關文字</span><input type="search" value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder={kind === "pharmacies" ? "輸入藥局名稱或地址" : "輸入藥品名稱或許可證字號"} maxLength={100} required disabled={!enabled} /></label>
        {kind === "pharmacies" && <label className="city-field"><span className="sr-only">縣市</span><input value={city} onChange={(event) => setCity(event.target.value)} placeholder="縣市（選填）" maxLength={50} disabled={!enabled} /></label>}
        <button className="search-button" type="submit" disabled={!enabled || loading}>{!enabled ? "資料尚未開放" : loading ? "查詢中…" : "搜尋"}</button>
      </form>
      {!enabled && <p className="state-message" role="status">資料來源核實完成後開放搜尋。</p>}
      {loading && <p className="state-message" role="status">正在查詢{label}資料…</p>}
      {error && <p className="state-message state-error" role="alert">{error}</p>}
      {result && result.items.length === 0 && <p className="state-message" role="status">沒有符合條件的{label}資料。</p>}
      {result && result.items.length > 0 && <>
        <div className="result-summary">找到 {result.total.toLocaleString()} 筆，第 {result.page} 頁</div>
        <div className="results-list">{result.items.map((item) => kind === "pharmacies"
          ? <PharmacyResult key={item.id} item={item as Pharmacy} />
          : <MedicineResult key={item.id} item={item as Medicine} />)}</div>
        <nav className="pagination" aria-label={`${label}結果分頁`}>
          <button type="button" onClick={() => void search(undefined, page - 1)} disabled={page <= 1 || loading}>上一頁</button>
          <span>第 {page} 頁</span>
          <button type="button" onClick={() => void search(undefined, page + 1)} disabled={page * result.pageSize >= result.total || loading}>下一頁</button>
        </nav>
      </>}
    </section>
  );
}
