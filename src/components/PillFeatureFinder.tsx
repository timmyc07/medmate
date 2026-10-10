"use client";

import { useState, type FormEvent } from "react";

const shapes = [
  { label: "圓形", className: "pill-shape-dot" },
  { label: "長橢圓", className: "pill-shape-oval" },
  { label: "菱形/特殊", className: "pill-shape-diamond" },
  { label: "膠囊形", className: "pill-shape-capsule" },
];

const colors = [
  ["白", "#ffffff"], ["黃", "#fde047"], ["橙", "#fdba74"],
  ["粉", "#f9a8d4"], ["淺藍", "#93c5fd"], ["綠", "#86efac"], ["淡褐", "#d6b896"],
] as const;

export default function PillFeatureFinder({ onCompare }: { onCompare: (marking: string) => void }) {
  const [expanded, setExpanded] = useState(true);
  const [shape, setShape] = useState("圓形");
  const [color, setColor] = useState("白");
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
        <span className="pill-feature-copy"><strong id="pill-feature-title">外觀特徵快搜</strong><span className="pill-feature-badge">手邊藥丸對照</span><small>依手邊藥錠形狀、刻字、顏色即時過濾</small></span>
        <span className="pill-feature-arrow material-symbols-outlined" aria-hidden="true">expand_more</span>
      </button>
      {expanded && (
        <form className="pill-feature-content" onSubmit={submit}>
          <fieldset>
            <legend>1. 選擇形狀輪廓</legend>
            <div className="pill-shape-options">
              {shapes.map((item) => (
                <button key={item.label} className={`pill-shape-option ${shape === item.label ? "is-active" : ""}`} type="button" onClick={() => setShape(item.label)} aria-pressed={shape === item.label}>
                  <span className={`pill-shape ${item.className}`} aria-hidden="true" />{item.label}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>2. 選擇藥錠顏色</legend>
            <div className="pill-color-options">
              {colors.map(([label, value]) => (
                <button key={label} className={`pill-color-option ${color === label ? "is-active" : ""}`} type="button" onClick={() => setColor(label)} aria-pressed={color === label}>
                  <span className="pill-color-swatch" style={{ backgroundColor: value }} aria-hidden="true">{color === label ? "✓" : ""}</span>{label}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset className="pill-marking-fieldset">
            <legend>3. 表面壓痕或刻字代碼</legend>
            <div className="pill-marking-row"><input value={marking} onChange={(event) => setMarking(event.target.value)} placeholder="例：15/850、ST、20…" maxLength={40} /><button className="button button--primary" type="submit"><span className="material-symbols-outlined" aria-hidden="true">search</span>外觀比對</button></div>
          </fieldset>
        </form>
      )}
    </section>
  );
}
