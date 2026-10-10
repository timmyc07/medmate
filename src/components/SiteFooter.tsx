import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-brand">
        <img src="/health-insurance-emblem.svg" alt="全民健康保險標誌" width="48" height="48" loading="lazy" />
        <span>MediMate · 政府開放資料整理</span>
      </div>
      <section className="footer-sources" aria-labelledby="footer-sources-title">
        <h2 id="footer-sources-title">資料來源與授權</h2>
        <p>首頁已完整列出各資料集用途、更新頻率與限制；共用頁尾保留原始入口，方便在任何頁面回查。</p>
        <ul>
          <li><Link href="https://data.gov.tw/dataset/39284" target="_blank" rel="noreferrer">健保特約醫事機構－藥局</Link></li>
          <li><Link href="https://data.gov.tw/dataset/6134" target="_blank" rel="noreferrer">藥局基本資料</Link></li>
          <li><Link href="https://data.gov.tw/dataset/9122" target="_blank" rel="noreferrer">全部藥品許可證資料</Link></li>
          <li><Link href="https://data.nhi.gov.tw/" target="_blank" rel="noreferrer">健保藥品使用量與目錄</Link></li>
          <li><Link href="https://mcp.fda.gov.tw/" target="_blank" rel="noreferrer">FDA 藥品外觀官方入口</Link></li>
          <li><Link href="https://www.ris.gov.tw/rs-opendata/api/v1/datastore/ODRP019/114" target="_blank" rel="noreferrer">內政部行政區參考資料</Link></li>
          <li><Link href="https://data.gov.tw/license" target="_blank" rel="noreferrer">政府資料開放授權條款第 1 版</Link></li>
        </ul>
        <p>資料內容與更新時間依各發布機關為準。健保藥品使用量為彙總申報量，不代表病人數或實際服藥量。</p>
      </section>
      <p className="footer-disclaimer">資訊僅供參考；用藥疑問請諮詢藥師或醫療專業人員。</p>
    </footer>
  );
}
