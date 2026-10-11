import Link from "next/link";
import ThemeToggle from "./ThemeToggle";

type PagePath = "/" | "/pharmacies" | "/medicines";

const navigation: Array<{ href: PagePath | "/#health-guide"; label: string; icon: string; mobileOnly?: boolean }> = [
  { href: "/", label: "首頁", icon: "⌂" },
  { href: "/pharmacies", label: "藥局地圖", icon: "藥" },
  { href: "/medicines", label: "藥品目錄", icon: "藥" },
  { href: "/#health-guide", label: "健康手冊", icon: "冊", mobileOnly: true },
];

export default function PageHeader({ currentPath }: { currentPath: PagePath }) {
  return (
      <header className="site-header">
        <div className="brand-cluster">
          <Link className="brand" href="/" aria-label="MediMate 首頁">
            <span className="brand-mark material-symbols-outlined" aria-hidden="true">藥</span>
            <span className="brand-copy">
              <span className="brand-name-row"><span>MediMate</span><span className="brand-tag">TW</span></span>
              <small>台灣公開健康資料</small>
            </span>
          </Link>
          <span className="header-sync-pill">
            <span>政府公開資料集</span>
          </span>
        </div>
        <nav className="site-nav" aria-label="主要導覽">
          {navigation.map(({ href, label, icon, mobileOnly }) => (
            <Link key={href} className={mobileOnly ? "mobile-nav-only" : undefined} href={href} aria-current={currentPath === href ? "page" : undefined}>
              <span className="nav-icon material-symbols-outlined" aria-hidden="true">{icon}</span>
              {label}
            </Link>
          ))}
          <Link className="desktop-nav-only" href="/#data-status"><span className="nav-icon material-symbols-outlined" aria-hidden="true">資</span>資料來源</Link>
        </nav>
        <div className="header-tools">
          <Link className="header-quick-link" href="/#quick-search" aria-label="前往快速搜尋">
            <span className="icon material-symbols-outlined" aria-hidden="true">⌕</span>
            <span className="header-quick-label">快速搜尋</span>
          </Link>
          <ThemeToggle />
        </div>
      </header>
  );
}
