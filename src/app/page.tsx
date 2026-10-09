import Link from "next/link";
import ThemeToggle from "../components/ThemeToggle";

export default function HomePage() {
  return (
    <main className="page-shell landing-page">
      <header className="site-header">
        <Link className="brand" href="/" aria-label="MediMate 首頁">
          <span className="brand-mark" aria-hidden="true">＋</span>
          <span>MediMate</span>
        </Link>
        <nav className="landing-nav" aria-label="主要導覽">
          <a href="/pharmacies" aria-label="藥局地圖，藥局查詢">藥局查詢</a>
          <a href="/medicines">藥品查詢</a>
          <a href="#data-status">資料說明</a>
        </nav>
        <ThemeToggle />
      </header>

      <section className="hero" aria-labelledby="welcome-title">
        <div className="hero-copy-block landing-hero-copy">
          <p className="eyebrow"><span className="status-dot" />TAIWAN PUBLIC HEALTH DATA</p>
          <h1 id="welcome-title">找到需要的<br /><span className="hero-title-accent">健康資訊。</span></h1>
          <p className="hero-copy">用清楚、可靠的公開資料，快速找到附近藥局，查閱藥品許可證與使用資訊。</p>
          <div className="hero-actions"><a className="hero-primary" href="/pharmacies">探索藥局 <span className="hero-primary-icon" aria-hidden="true">↗</span></a><a className="hero-secondary" href="/medicines">查詢藥品</a></div>
        </div>
        <aside className="hero-side landing-hero-side" aria-label="資料摘要">
          <div className="hero-orbit" aria-hidden="true"><span /><span /><span /></div>
          <div className="hero-stat"><span className="hero-stat-label">OPEN DATA INDEX</span><strong>24/7</strong><span>隨時查詢公開健康資料</span></div>
          <p className="hero-side-note">政府資料整理 · 持續更新</p>
        </aside>
      </section>

      <nav className="quick-nav" aria-label="查詢類別">
        <a href="/pharmacies"><span className="quick-index">01</span><span>找藥局</span><span aria-hidden="true">↗</span></a>
        <a href="/medicines"><span className="quick-index">02</span><span>查藥品</span><span aria-hidden="true">↗</span></a>
      </nav>

      <section className="data-status" id="data-status" aria-label="資料狀態">
        <span className="status-label"><span className="status-dot" />資料連線</span>
        <p>藥局與藥品資料來自政府公開資料；查詢結果會標示資料更新日期，使用前請再向藥師或醫療專業人員確認。</p>
        <span className="status-code">PUBLIC DATA · NEON</span>
      </section>

      <section className="home-guidance" aria-label="使用方式">
        <p className="section-caption">兩種查詢入口</p>
        <p>先選擇要找的內容。藥局頁提供地區、定位、地址與聯絡資訊；藥品頁整理許可證與公開適應症資料。</p>
      </section>

    </main>
  );
}
