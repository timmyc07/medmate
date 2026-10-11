"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

type SearchKind = "pharmacies" | "medicines";

export default function QuickSearch() {
  const router = useRouter();
  const [kind, setKind] = useState<SearchKind>("pharmacies");
  const [keyword, setKeyword] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = keyword.trim();
    if (kind === "medicines" && !value) return;
    const query = value ? `?q=${encodeURIComponent(value)}` : "";
    router.push(`/${kind}${query}`);
  }

  return (
    <section className="quick-search" id="quick-search" aria-labelledby="quick-search-title">
      <div className="section-lead section-lead--split">
        <div>
          <p className="eyebrow">快速查詢</p>
          <h2 id="quick-search-title">從一個關鍵字開始</h2>
        </div>
        <p>藥局可用名稱、地址、健保代碼或所在地查詢；藥品可用名稱與許可證字號查詢。</p>
      </div>
      <div className="quick-search-card">
        <fieldset className="segmented-control">
          <legend className="sr-only">快速搜尋類別</legend>
          <button type="button" aria-pressed={kind === "pharmacies"} className={kind === "pharmacies" ? "is-active" : ""} onClick={() => setKind("pharmacies")}>藥局</button>
          <button type="button" aria-pressed={kind === "medicines"} className={kind === "medicines" ? "is-active" : ""} onClick={() => setKind("medicines")}>藥品</button>
        </fieldset>
        <form className="quick-search-form" onSubmit={submit}>
          <label className="input-with-icon">
            <span className="input-icon material-symbols-outlined" aria-hidden="true">⌕</span>
            <span className="sr-only">搜尋{kind === "pharmacies" ? "藥局" : "藥品"}</span>
            <input
              type="search"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder={kind === "pharmacies" ? "搜尋藥局名稱、地址或健保代碼" : "搜尋藥品名稱或許可證字號"}
              required={kind === "medicines"}
              maxLength={100}
            />
          </label>
          <button className="button button--primary" type="submit">開始查詢 <span aria-hidden="true">→</span></button>
        </form>
        <p className="quick-search-note">查詢結果會帶入對應目錄，可再使用縣市、區域、定位或頁碼功能。</p>
      </div>
    </section>
  );
}
