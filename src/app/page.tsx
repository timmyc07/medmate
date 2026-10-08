import Link from "next/link";
import SearchPanel from "../components/SearchPanel";

export default function HomePage() {
  return (
    <main className="page-shell">
      <header className="site-header">
        <Link className="brand" href="/" aria-label="MediMate 首頁">
          <span className="brand-mark" aria-hidden="true">＋</span>
          <span>MediMate</span>
        </Link>
        <a className="header-link" href="#pharmacies">開始查詢 <span aria-hidden="true">↓</span></a>
      </header>

      <section className="hero" aria-labelledby="welcome-title">
        <div className="hero-copy-block">
          <p className="eyebrow"><span className="status-dot" />公開資訊查詢</p>
          <h1 id="welcome-title">藥局與藥品<br /><span>一站查詢</span></h1>
          <p className="hero-copy">找到附近服務據點，查閱藥品公開資訊。</p>
        </div>
        <aside className="hero-side" aria-label="查詢項目">
          <p><span>01</span> 藥局位置與聯絡資訊</p>
          <p><span>02</span> 藥品許可與適應症</p>
          <p className="hero-side-note">資料來源核實後提供查詢</p>
        </aside>
      </section>

      <nav className="quick-nav" aria-label="查詢類別">
        <a href="#pharmacies"><span className="quick-index">01</span><span>找藥局</span><span aria-hidden="true">↗</span></a>
        <a href="#medicines"><span className="quick-index">02</span><span>查藥品</span><span aria-hidden="true">↗</span></a>
      </nav>

      <section className="data-status" aria-label="資料狀態">
        <span className="status-label"><span className="status-dot" />資料連線</span>
        <p>藥局與藥品資料來自政府公開資料；查詢結果會標示資料更新日期。</p>
        <span className="status-code">PUBLIC DATA · NEON</span>
      </section>

      <div className="lookup-stack">
        <SearchPanel kind="pharmacies" />
        <SearchPanel kind="medicines" />
      </div>

      <footer className="site-footer">
        <p>資料僅供參考；用藥疑問請向藥師或醫療專業人員確認。</p>
        <span className="footer-credit">MEDMATE · PUBLIC INFORMATION</span>
      </footer>
    </main>
  );
}
