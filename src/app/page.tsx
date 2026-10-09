import Link from "next/link";
import ThemeToggle from "../components/ThemeToggle";

export default function HomePage() {
  return (
    <main className="landing-page">
      <div className="landing-stage">
        <header className="landing-header">
          <Link className="landing-brand" href="/" aria-label="MediMate 首頁">
            <span className="brand-mark" aria-hidden="true">＋</span>
            <span>MediMate</span>
          </Link>
          <nav className="landing-nav" aria-label="主要導覽">
            <Link href="/pharmacies" aria-label="藥局地圖，藥局查詢">藥局地圖</Link>
            <Link href="/medicines">藥品目錄</Link>
            <a href="#data-status">資料來源</a>
          </nav>
          <div className="landing-tools"><ThemeToggle /></div>
        </header>

        <section className="landing-hero" aria-labelledby="welcome-title">
          <div className="landing-hero-copy">
            <p className="landing-kicker"><span className="status-dot" />台灣公開健康資料</p>
            <h1 id="welcome-title">
              <span className="landing-title-accent">藥局與藥品，</span>
              <span>一站安心查。</span>
            </h1>
            <p className="landing-description">
              從附近藥局到藥品公開資訊，讓可信賴的資料更容易找到。
            </p>
            <div className="landing-actions">
              <Link className="landing-button landing-button--primary" href="/pharmacies">
                探索藥局 <span aria-hidden="true">↗</span>
              </Link>
              <Link className="landing-button landing-button--secondary" href="/medicines">
                查詢藥品
              </Link>
            </div>
          </div>
          <div className="landing-artwork" aria-hidden="true">
            <img src="/medmate-health-scene.svg" alt="" />
          </div>
          <a className="landing-scroll-cue" href="#data-status" aria-label="往下查看資料說明">
            <span aria-hidden="true">↓</span>
            <span className="sr-only">往下查看資料說明</span>
          </a>
        </section>
      </div>

      <section className="landing-information" id="data-status" aria-label="資料狀態">
        <div className="landing-information-heading">
          <p className="landing-kicker"><span className="status-dot" />公開資料・清楚呈現</p>
          <h2>健康資訊，<span>就在需要時。</span></h2>
        </div>
        <div className="landing-information-content">
          <p>藥局與藥品資料整理自政府公開來源，查詢結果會標示資料更新日期。藥局頁提供地區、定位、地址與聯絡資訊；藥品頁整理許可證與公開適應症資料。</p>
          <Link href="/pharmacies">開始查詢 <span aria-hidden="true">↗</span></Link>
        </div>
      </section>
    </main>
  );
}
