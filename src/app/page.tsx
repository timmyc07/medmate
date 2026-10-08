import Link from "next/link";

export default function HomePage() {
  return (
    <main className="page-shell">
      <header className="site-header">
        <Link className="brand" href="/" aria-label="MediMate 首頁">
          <span className="brand-mark" aria-hidden="true">＋</span>
          <span>MediMate</span>
        </Link>
        <a className="header-link" href="/pharmacies">開始查詢 · 藥局地圖 <span aria-hidden="true">↗</span></a>
      </header>

      <section className="hero" aria-labelledby="welcome-title">
        <div className="hero-copy-block">
          <p className="eyebrow"><span className="status-dot" />PUBLIC HEALTH DATA · TAIWAN</p>
          <h1 id="welcome-title">藥局與藥品<br /><span className="hero-title-accent">一站查詢</span></h1>
          <p className="hero-copy">找到附近服務據點，查閱藥品公開資訊。</p>
          <div className="hero-actions"><a className="hero-primary" href="/pharmacies">探索藥局 <span className="hero-primary-icon" aria-hidden="true">↗</span></a><a className="hero-secondary" href="/medicines">查詢藥品</a></div>
        </div>
        <aside className="hero-side" aria-label="查詢項目">
          <div className="hero-stat"><span className="hero-stat-label">LIVE INDEX</span><strong>22</strong><span>個縣市資料可查詢</span></div>
          <p className="hero-side-note">政府公開資料 · 持續核實</p>
        </aside>
      </section>

      <nav className="quick-nav" aria-label="查詢類別">
        <a href="/pharmacies"><span className="quick-index">01</span><span>找藥局</span><span aria-hidden="true">↗</span></a>
        <a href="/medicines"><span className="quick-index">02</span><span>查藥品</span><span aria-hidden="true">↗</span></a>
      </nav>

      <section className="data-status" aria-label="資料狀態">
        <span className="status-label"><span className="status-dot" />資料連線</span>
        <p>藥局與藥品資料來自政府公開資料；查詢結果會標示資料更新日期。</p>
        <span className="status-code">PUBLIC DATA · NEON</span>
      </section>

      <section className="home-guidance" aria-label="使用方式">
        <p className="section-caption">兩種查詢入口</p>
        <p>先選擇要找的內容。藥局頁提供地區、定位、地址與聯絡資訊；藥品頁整理許可證與公開適應症資料。</p>
      </section>

      <footer className="site-footer">
        <p>資料僅供參考；用藥疑問請向藥師或醫療專業人員確認。</p>
        <span className="footer-credit">MEDMATE · PUBLIC INFORMATION</span>
      </footer>
    </main>
  );
}
