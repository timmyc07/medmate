import Link from "next/link";
import PageHeader from "../components/PageHeader";
import QuickSearch from "../components/QuickSearch";
import ScrollReveal from "../components/ScrollReveal";

const sources = [
  {
    type: "查詢核心",
    cadence: "每日更新",
    title: "健保特約醫事機構－藥局",
    description: "藥局名稱、地址、電話、定位與政府登記看診時段。",
    href: "https://data.gov.tw/dataset/39284",
  },
  {
    type: "查詢核心",
    cadence: "每 7 日更新",
    title: "全部藥品許可證資料",
    description: "有效藥品許可證、品名、適應症與有效期限。",
    href: "https://data.gov.tw/dataset/9122",
  },
  {
    type: "延伸參考",
    cadence: "依申報年月更新",
    title: "健保藥品使用量統計",
    description: "排行依含包裹支付的醫令量合計，不代表病人數或實際服藥量。",
    href: "https://data.nhi.gov.tw/",
  },
  {
    type: "延伸參考",
    cadence: "配對條件嚴格",
    title: "FDA 藥品外觀資料",
    description: "僅在完整許可證字號精確配對時顯示官方外觀圖片。",
    href: "https://mcp.fda.gov.tw/",
  },
  {
    type: "延伸參考",
    cadence: "行政區參考",
    title: "內政部行政區資料",
    description: "供縣市與行政區選單使用，不代表地址已完成座標轉換。",
    href: "https://www.ris.gov.tw/rs-opendata/api/v1/datastore/ODRP019/114",
  },
  {
    type: "授權說明",
    cadence: "使用條款",
    title: "政府資料開放授權條款第 1 版",
    description: "資料欄位、發布時間與使用條件仍以原始機關公告為準。",
    href: "https://data.gov.tw/license",
  },
];

export default function HomePage() {
  return (
    <main className="page-shell--home">
      <PageHeader currentPath="/" />
      <section className="home-hero" aria-labelledby="welcome-title">
        <div className="home-hero-inner">
          <div className="home-hero-copy">
            <h1 id="welcome-title"><span>藥局與藥品，</span>一站安心查。</h1>
            <p className="hero-description">
              從附近藥局到藥品資訊，把查詢內容整理成清楚、可核對的日常工具。
            </p>
            <div className="hero-actions">
              <Link className="button button--primary" href="/pharmacies">
                探索藥局 <span aria-hidden="true">↗</span>
              </Link>
              <Link className="button button--secondary" href="/medicines">
                查詢藥品
              </Link>
            </div>
          </div>
        </div>
      </section>

      <QuickSearch />

      <section className="home-source-band" id="data-status" aria-labelledby="data-status-title">
        <div className="home-source-inner">
          <div className="source-heading">
            <div>
            <p className="eyebrow">來源與限制</p>
              <h2 id="data-status-title">每筆資訊，都有來源可查。</h2>
            </div>
            <p>來源資料擷取於 2026-10-08；後續更新時間依各發布機關公告為準。</p>
          </div>
          <div className="source-grid">
            {sources.map((source) => (
              <ScrollReveal as="article" className="source-card" key={source.title}>
                <div>
                  <div className="source-card-top">
                    <span className="source-type">{source.type}</span>
                    <span className="source-cadence">{source.cadence}</span>
                  </div>
                  <h3>{source.title}</h3>
                  <p>{source.description}</p>
                </div>
                <Link className="source-card-link" href={source.href} target="_blank" rel="noreferrer">
                  查看原始入口 <span aria-hidden="true">↗</span>
                </Link>
              </ScrollReveal>
            ))}
          </div>
          <ScrollReveal className="license-note">
            <p>
              <strong>授權與使用限制</strong>　政府資料依
              <a href="https://data.gov.tw/license" target="_blank" rel="noreferrer">政府資料開放授權條款第 1 版</a>
              使用。本網站不提供診斷或治療建議。
            </p>
            <Link className="button button--secondary" href="/pharmacies">
              開始查詢 <span aria-hidden="true">↗</span>
            </Link>
          </ScrollReveal>
          <ScrollReveal className="health-note" id="health-guide">
            <p>
              <strong>健康提醒</strong>　藥品資訊與政府登記時段僅供參考；用藥或症狀問題請諮詢藥師或醫療專業人員，出發前請先致電確認。
            </p>
          </ScrollReveal>
        </div>
      </section>
    </main>
  );
}
