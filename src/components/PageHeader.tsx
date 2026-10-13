import Link from "next/link";
import Image from "next/image";
import { Database, House, Map as MapIcon, Pill } from "lucide-react";
import ThemeToggle from "./ThemeToggle";

type PagePath = "/" | "/pharmacies" | "/medicines";

const navigation: Array<{ href: PagePath; label: string; icon: typeof House }> = [
  { href: "/", label: "首頁", icon: House },
  { href: "/pharmacies", label: "藥局地圖", icon: MapIcon },
  { href: "/medicines", label: "藥品目錄", icon: Pill },
];

export default function PageHeader({ currentPath }: { currentPath: PagePath }) {
  return (
    <div className="site-header-shell">
      <aside className="site-disclaimer" aria-label="授權與使用限制">
        <strong>授權與使用限制</strong>
        <span>政府資料依<a href="https://data.gov.tw/license" target="_blank" rel="noreferrer">政府資料開放授權條款第 1 版</a>使用。本網站不提供診斷或治療建議。</span>
      </aside>
      <header className="site-header">
        <div className="brand-cluster">
          <Link className="brand" href="/" aria-label="MediMate 首頁">
            <span className="brand-mark"><Image src="/health-insurance-emblem.svg" alt="全民健康保險標誌" width={42} height={42} priority /></span>
            <span className="brand-copy">
              <span className="brand-name-row"><span>MediMate</span></span>
            </span>
          </Link>
        </div>
        <nav className="site-nav" aria-label="主要導覽">
          {navigation.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} aria-current={currentPath === href ? "page" : undefined}>
              <Icon className="nav-icon" aria-hidden="true" />
              {label}
            </Link>
          ))}
          <Link className="desktop-nav-only" href="/#data-status"><Database className="nav-icon" aria-hidden="true" />資料來源</Link>
        </nav>
        <div className="header-tools">
          <ThemeToggle />
        </div>
      </header>
    </div>
  );
}
