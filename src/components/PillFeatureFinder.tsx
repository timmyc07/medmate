"use client";

import { useState, type FormEvent } from "react";
import { ChevronDown, Search } from "lucide-react";
import ScrollReveal from "./ScrollReveal";

export default function PillFeatureFinder({ onCompare }: { onCompare: (marking: string) => void }) {
  const [expanded, setExpanded] = useState(true);
  const [marking, setMarking] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = marking.trim();
    if (value) onCompare(value);
  }

  return (
    <ScrollReveal as="section" className={`pill-feature-finder ${expanded ? "is-expanded" : ""}`} ariaLabelledby="pill-feature-title">
      <button className="pill-feature-toggle" type="button" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded}>
        <span className="pill-feature-icon" aria-hidden="true"><Search /></span>
        <span className="pill-feature-copy"><strong id="pill-feature-title">外觀特徵快搜</strong><small>輸入刻字或許可證資訊查找藥品</small></span>
        <span className="pill-feature-arrow" aria-hidden="true"><ChevronDown /></span>
      </button>
      {expanded && (
        <form className="pill-feature-content" onSubmit={submit}>
          <fieldset className="pill-marking-fieldset">
            <legend>輸入表面壓痕或刻字代碼</legend>
            <p className="pill-feature-note">可用藥品名稱、許可證字號或刻字關鍵字查詢。</p>
            <div className="pill-marking-row"><input value={marking} onChange={(event) => setMarking(event.target.value)} placeholder="例：15/850、ST、20…" maxLength={40} /><button className="button button--primary" type="submit"><Search aria-hidden="true" />開始查詢</button></div>
          </fieldset>
        </form>
      )}
    </ScrollReveal>
  );
}
