import Link from "next/link";
import SearchPanel from "../../components/SearchPanel";

export default function MedicinesPage() {
  return <main className="page-shell page-shell--inner">
    <header className="site-header"><Link className="brand" href="/"><span className="brand-mark" aria-hidden="true">＋</span><span>MediMate</span></Link><Link className="header-link" href="/pharmacies">找藥局 ↗</Link></header>
    <section className="inner-hero"><p className="eyebrow"><span className="status-dot" />MEDICINE REFERENCE</p><h1>藥品公開資料<br /><span>清楚查詢</span></h1><p>依名稱或許可證字號查詢公開許可資料與適應症文字，作為與專業人員溝通的參考。</p></section>
    <SearchPanel kind="medicines" />
    <footer className="site-footer"><Link href="/">回到首頁</Link><span className="footer-credit">MEDMATE · PUBLIC INFORMATION</span></footer>
  </main>;
}
