"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Search, X } from "lucide-react";

export default function QuickSearch() {
  const router = useRouter();
  const [keyword, setKeyword] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const sync = () => setOpen(window.location.hash === "#quick-search");
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = keyword.trim();
    if (!value) return;
    const kind = /(藥局|診所|地址|路|街|區|市|縣|號|健保特約)/.test(value)
      ? "pharmacies"
      : "medicines";
    router.push(`/${kind}?q=${encodeURIComponent(value)}`);
  }

  function close() {
    setOpen(false);
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
  }

  return (
    <section className={`quick-search-modal${open ? " is-open" : ""}`} id="quick-search" aria-labelledby="quick-search-title">
      <div className="quick-search-dialog">
        <div className="quick-search-dialog-heading">
          <div><p className="eyebrow">快速查詢</p><h2 id="quick-search-title">搜尋藥局或藥品</h2></div>
          <button className="quick-search-close" type="button" onClick={close} aria-label="關閉快速搜尋"><X aria-hidden="true" /></button>
        </div>
        <form className="quick-search-form" onSubmit={submit}>
          <label className="input-with-icon">
            <Search className="input-icon" aria-hidden="true" />
            <span className="sr-only">搜尋藥局或藥品</span>
            <input
              type="search"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="搜尋藥局名稱、地址、藥品名稱或許可證字號"
              maxLength={100}
            />
          </label>
          <button className="quick-search-submit" type="submit" aria-label="送出搜尋"><Search aria-hidden="true" /></button>
        </form>
        <p className="quick-search-note">系統會依關鍵字自動前往藥局或藥品目錄。</p>
      </div>
    </section>
  );
}
