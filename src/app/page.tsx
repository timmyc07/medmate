import Link from "next/link";
import { ArrowRight, BarChart3, Database, FileText, HeartPulse, Image as ImageIcon, MapPinned, Pill, ShieldCheck } from "lucide-react";
import PageHeader from "../components/PageHeader";
import ScrollReveal from "../components/ScrollReveal";

const sources = [
  {
    type: "查詢核心",
    cadence: "每日更新",
    title: "健保特約醫事機構－藥局",
    description: "藥局名稱、地址、電話、定位與政府登記看診時段。",
    href: "https://data.gov.tw/dataset/39284",
    icon: MapPinned,
  },
  {
    type: "查詢核心",
    cadence: "每 7 日更新",
    title: "全部藥品許可證資料",
    description: "有效藥品許可證、品名、適應症與有效期限。",
    href: "https://data.gov.tw/dataset/9122",
    icon: Pill,
  },
  {
    type: "延伸參考",
    cadence: "依申報年月更新",
    title: "健保藥品使用量統計",
    description: "排行依含包裹支付的醫令量合計，不代表病人數或實際服藥量。",
    href: "https://data.nhi.gov.tw/",
    icon: BarChart3,
  },
  {
    type: "延伸參考",
    cadence: "配對條件嚴格",
    title: "FDA 藥品外觀資料",
    description: "僅在完整許可證字號精確配對時顯示官方外觀圖片。",
    href: "https://mcp.fda.gov.tw/",
    icon: ImageIcon,
  },
  {
    type: "延伸參考",
    cadence: "行政區參考",
    title: "內政部行政區資料",
    description: "供縣市與行政區選單使用，不代表地址已完成座標轉換。",
    href: "https://www.ris.gov.tw/rs-opendata/api/v1/datastore/ODRP019/114",
    icon: Database,
  },
  {
    type: "授權說明",
    cadence: "使用條款",
    title: "政府資料開放授權條款第 1 版",
    description: "資料欄位、發布時間與使用條件仍以原始機關公告為準。",
    href: "https://data.gov.tw/license",
    icon: FileText,
  },
];

export default function HomePage() {
  return (
    <main className="page-shell--home">
      <PageHeader currentPath="/" />
      <section className="home-hero" aria-labelledby="welcome-title">
        <div className="home-hero-inner">
          <div className="home-hero-copy">
            <p className="eyebrow"><HeartPulse aria-hidden="true" /> 你的日常健康查詢夥伴</p>
            <h1 id="welcome-title">藥局與藥品，<br /><span>一站安心查。</span></h1>
            <p className="hero-description">
              從附近藥局到藥品資訊，把查詢內容整理成清楚、可核對的日常工具。
            </p>
            <div className="hero-actions">
              <Link className="button button--primary" href="/pharmacies">
                探索藥局 <ArrowRight aria-hidden="true" />
              </Link>
              <Link className="button button--secondary" href="/medicines">
                查詢藥品
              </Link>
            </div>
            <p className="hero-source-note"><ShieldCheck aria-hidden="true" /> 整理政府公開資料，讓每次查詢都有依據。</p>
          </div>
          <div className="home-entry-panel">
            <div className="home-entry-heading">
              <span className="home-entry-symbol" aria-hidden="true"><HeartPulse /></span>
              <div><p className="eyebrow">從你需要的資訊開始</p><h2>今天，想先了解什麼？</h2></div>
            </div>
            <Link className="home-entry-card" href="/pharmacies">
              <span className="home-entry-icon"><MapPinned aria-hidden="true" /></span>
              <span><strong>找到身邊的藥局</strong><small>查地址、電話與政府登記看診時段</small></span>
              <ArrowRight className="home-entry-arrow" aria-hidden="true" />
            </Link>
            <Link className="home-entry-card" href="/medicines">
              <span className="home-entry-icon"><Pill aria-hidden="true" /></span>
              <span><strong>認識藥品用途</strong><small>從症狀、藥名或許可證字號開始查</small></span>
              <ArrowRight className="home-entry-arrow" aria-hidden="true" />
            </Link>
            <p className="home-entry-note">先查清楚，再與醫師或藥師討論用藥。</p>
          </div>
        </div>
      </section>

      <section className="home-source-band" id="data-status" aria-labelledby="data-status-title">
        <div className="home-source-inner">
          <div className="source-heading">
            <div>
              <p className="eyebrow">公開透明・安心查詢</p>
              <h2 id="data-status-title">每筆資訊，都有來源可查。</h2>
            </div>
            <p>來源資料擷取於 2026-10-08；後續更新時間依各發布機關公告為準。</p>
          </div>
          <div className="source-grid">
            {sources.map((source) => (
              <ScrollReveal as="article" className="source-card" key={source.title}>
                <div className="source-card-main">
                  <source.icon className="source-icon" aria-hidden="true" />
                  <div>
                  <div className="source-card-top">
                    <span className="source-type">{source.type}</span>
                    <span className="source-cadence">{source.cadence}</span>
                  </div>
                  <h3>{source.title}</h3>
                  <p>{source.description}</p>
                  </div>
                </div>
                <Link className="source-card-link" href={source.href} target="_blank" rel="noreferrer">
                  查看原始入口 <span aria-hidden="true">↗</span>
                </Link>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
