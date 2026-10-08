import Link from "next/link";

const searchOptions = [
  { id: "pharmacies", title: "藥局查詢", description: "搜尋藥局名稱、地址或地區" },
  { id: "medicines", title: "藥品查詢", description: "搜尋藥品名稱或許可證字號" },
];

export default function HomePage() {
  return (
    <main className="page-shell">
      <header className="site-header">
        <Link className="brand" href="/" aria-label="MediMate 首頁">
          <span className="brand-mark" aria-hidden="true">＋</span>
          <span>MediMate</span>
        </Link>
        <span className="header-note">藥局與藥品公開查詢</span>
      </header>

      <section className="hero" aria-labelledby="welcome-title">
        <p className="eyebrow">安心查詢，清楚掌握</p>
        <h1 id="welcome-title">健康資訊，<span>一查就知道</span></h1>
        <p className="hero-copy">查找藥局資訊與藥品公開資料，方便你快速找到需要的資訊。</p>
      </section>

      <section className="search-grid" aria-label="選擇查詢類型" id="search">
        {searchOptions.map((option, index) => (
          <a className="search-card" href={`#${option.id}`} key={option.id}>
            <span className="card-icon" aria-hidden="true">{index === 0 ? "⌖" : "✚"}</span>
            <span className="card-content">
              <span className="card-title">{option.title}</span>
              <span className="card-description">{option.description}</span>
            </span>
            <span className="card-arrow" aria-hidden="true">→</span>
          </a>
        ))}
      </section>

      <section className="search-destinations" aria-label="查詢入口">
        <div id="pharmacies"><h2>藥局查詢</h2><p>藥局搜尋功能即將提供。</p></div>
        <div id="medicines"><h2>藥品查詢</h2><p>藥品搜尋功能即將提供。</p></div>
      </section>

      <p className="notice">查詢資料僅供參考；如有用藥疑問，請向藥師或醫療專業人員確認。</p>
    </main>
  );
}
