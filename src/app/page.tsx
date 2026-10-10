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

      <section className="landing-information" id="data-status" aria-labelledby="data-status-title">
        <div className="landing-information-heading">
          <p className="landing-kicker"><span className="status-dot" />公開資料・清楚呈現</p>
          <h2 id="data-status-title">每筆資訊，<span>都有來源可查。</span></h2>
          <p className="landing-information-intro">以下列出本網站查詢、排行與行政區篩選所使用的資料集。資料擷取日期為 2026-10-08，後續更新時間依各發布機關公告為準。</p>
        </div>
        <div className="landing-source-groups">
          <section className="landing-source-group" aria-labelledby="source-core-title">
            <div className="source-group-heading">
              <span className="source-group-index">01</span>
              <div>
                <p>查詢核心</p>
                <h3 id="source-core-title">藥局與藥品目錄</h3>
              </div>
            </div>
            <ul className="source-card-list">
              <li className="source-card">
                <div><h4>健保特約醫事機構－藥局</h4><p>中央健康保險署・每日更新</p></div>
                <Link href="https://data.gov.tw/dataset/39284" target="_blank" rel="noreferrer">查看資料集 <span aria-hidden="true">↗</span></Link>
              </li>
              <li className="source-card">
                <div><h4>藥局基本資料</h4><p>食品藥物管理署・不定期更新</p></div>
                <Link href="https://data.gov.tw/dataset/6134" target="_blank" rel="noreferrer">查看資料集 <span aria-hidden="true">↗</span></Link>
              </li>
              <li className="source-card">
                <div><h4>全部藥品許可證資料</h4><p>食品藥物管理署・每 7 日更新</p></div>
                <Link href="https://data.gov.tw/dataset/9122" target="_blank" rel="noreferrer">查看資料集 <span aria-hidden="true">↗</span></Link>
              </li>
            </ul>
          </section>
          <section className="landing-source-group" aria-labelledby="source-reference-title">
            <div className="source-group-heading">
              <span className="source-group-index">02</span>
              <div>
                <p>延伸參考</p>
                <h3 id="source-reference-title">排行、圖片與行政區</h3>
              </div>
            </div>
            <ul className="source-card-list">
              <li className="source-card">
                <div><h4>健保藥品使用量統計與藥品目錄</h4><p>中央健康保險署・依申報年月更新；醫令量不代表病人數或實際服藥量</p></div>
                <Link href="https://data.nhi.gov.tw/" target="_blank" rel="noreferrer">查看資料入口 <span aria-hidden="true">↗</span></Link>
              </li>
              <li className="source-card">
                <div><h4>FDA 藥品外觀資料</h4><p>食品藥物管理署・本機來源檔；官方資料集頁、更新頻率與授權仍待核實</p></div>
                <Link href="https://mcp.fda.gov.tw/" target="_blank" rel="noreferrer">查看官方入口 <span aria-hidden="true">↗</span></Link>
              </li>
              <li className="source-card">
                <div><h4>村里戶數、單一年齡人口資料</h4><p>內政部戶政司・行政區篩選參考，不代表地址已完成座標轉換</p></div>
                <Link href="https://www.ris.gov.tw/rs-opendata/api/v1/datastore/ODRP019/114" target="_blank" rel="noreferrer">查看資料集 <span aria-hidden="true">↗</span></Link>
              </li>
            </ul>
          </section>
        </div>
        <div className="landing-information-footnote">
          <p><strong>授權與使用限制</strong>　政府資料依<a href="https://data.gov.tw/license" target="_blank" rel="noreferrer">政府資料開放授權條款第 1 版</a>使用；本網站僅整理公開資訊，不提供診斷或治療建議。藥品外觀圖僅接受 `https://mcp.fda.gov.tw/` 官方網址，尚未核實的資料不宣稱涵蓋率或另行推定授權。</p>
          <Link className="landing-information-action" href="/pharmacies">開始查詢 <span aria-hidden="true">↗</span></Link>
        </div>
      </section>
    </main>
  );
}
