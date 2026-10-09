import Link from "next/link";
import MedicineUsageCatalog from "../../components/MedicineUsageCatalog";
import SearchPanel from "../../components/SearchPanel";
import ThemeToggle from "../../components/ThemeToggle";

export default function MedicinesPage() {
  return (
    <main className="page-shell page-shell--inner">
      <header className="site-header">
        <Link className="brand" href="/">
          <span className="brand-mark" aria-hidden="true">
            ＋
          </span>
          <span>MediMate</span>
        </Link>
        <Link className="header-link" href="/pharmacies">
          找藥局 ↗
        </Link>
        <ThemeToggle />
      </header>
      <section className="inner-hero">
        <p className="eyebrow">
          <span className="status-dot" />
          MEDICINE REFERENCE
        </p>
        <h1>
          藥品使用排行
          <br />
          <span>公開資料一覽</span>
        </h1>
        <p>
          依健保申報醫令量呈現藥品品項排名，搭配政府藥品外觀與許可資料，提供公開資訊參考。
        </p>
      </section>
      <MedicineUsageCatalog />
      <SearchPanel kind="medicines" />
      <footer className="site-footer">
        <Link href="/">回到首頁</Link>
        <span className="footer-credit">MEDMATE · PUBLIC INFORMATION</span>
      </footer>
    </main>
  );
}
