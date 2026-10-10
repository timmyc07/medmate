import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <section aria-labelledby="footer-brand-title">
          <h2 id="footer-brand-title" className="sr-only">資料來源與授權</h2>
          <div className="site-footer-brand">
            <img src="/health-insurance-emblem.svg" alt="全民健康保險標誌" width="48" height="48" loading="lazy" />
            <span>MediMate · 公開健康資料</span>
          </div>
          <p>把政府公開的藥局與藥品資料整理成可查詢的日常工具，方便回到原始來源核對。</p>
        </section>
        <section className="footer-sources" aria-labelledby="footer-sources-title">
          <h2 id="footer-sources-title">官方資料來源</h2>
          <ul>
            <li><Link href="https://data.gov.tw/dataset/39284" target="_blank" rel="noreferrer">健保特約醫事機構－藥局</Link></li>
            <li><Link href="https://data.gov.tw/dataset/9122" target="_blank" rel="noreferrer">全部藥品許可證資料</Link></li>
            <li><Link href="https://data.nhi.gov.tw/" target="_blank" rel="noreferrer">健保藥品使用量與目錄</Link></li>
            <li><Link href="https://mcp.fda.gov.tw/" target="_blank" rel="noreferrer">FDA 藥品外觀官方入口</Link></li>
          </ul>
        </section>
        <section className="footer-terms" aria-labelledby="footer-terms-title">
          <h2 id="footer-terms-title">資料使用說明</h2>
          <p>網站資料於 2026-10-08 擷取；更新時間以各發布機關公告為準。</p>
          <ul>
            <li><Link href="https://data.gov.tw/license" target="_blank" rel="noreferrer">政府資料開放授權條款第 1 版</Link></li>
            <li><Link href="/#data-status">查看完整來源與限制</Link></li>
          </ul>
        </section>
      </div>
      <p className="footer-disclaimer"><strong>健康提醒：</strong>資訊僅供參考；用藥疑問請諮詢藥師或醫療專業人員，出發前請先致電確認。</p>
      <div className="footer-bottom">
        <span>© 2026 MediMate Taiwan Open Health Data Project</span>
        <span className="footer-links"><Link href="/#data-status">資料來源</Link><Link href="https://data.gov.tw/license" target="_blank" rel="noreferrer">使用條款</Link></span>
      </div>
    </footer>
  );
}
