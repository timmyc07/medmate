"use client";

import { useState, type FormEvent } from "react";

export default function PillFeatureFinder({ onCompare }: { onCompare: (marking: string) => void }) {
  const [expanded, setExpanded] = useState(true);
  const [marking, setMarking] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = marking.trim();
    if (value) onCompare(value);
  }

  return (
    <section className={`pill-feature-finder ${expanded ? "is-expanded" : ""}`} aria-labelledby="pill-feature-title">
      <button className="pill-feature-toggle" type="button" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded}>
        <span className="pill-feature-icon material-symbols-outlined" aria-hidden="true">manage_search</span>
        <span className="pill-feature-copy"><strong id="pill-feature-title">外觀特徵快搜</strong><span className="pill-feature-badge">手邊藥丸對照</span><small>輸入刻字或許可證資訊，快速查詢公開資料</small></span>
        <span className="pill-feature-arrow material-symbols-outlined" aria-hidden="true">expand_more</span>
      </button>
      {expanded && (
        <form className="pill-feature-content" onSubmit={submit}>
          <fieldset className="pill-marking-fieldset">
            <legend>輸入表面壓痕或刻字代碼</legend>
            <p className="pill-feature-note">目前以藥品名稱、許可證字號或刻字關鍵字查詢公開資料。</p>
            <div className="pill-marking-row"><input value={marking} onChange={(event) => setMarking(event.target.value)} placeholder="例：15/850、ST、20…" maxLength={40} /><button className="button button--primary" type="submit"><span className="material-symbols-outlined" aria-hidden="true">search</span>開始查詢</button></div>
          </fieldset>
        </form>
      )}
    </section>
  );
}
