import Link from "next/link";
import { BookOpen, Database, House, Map as MapIcon, Pill, Search } from "lucide-react";
import ThemeToggle from "./ThemeToggle";

type PagePath = "/" | "/pharmacies" | "/medicines";

const navigation: Array<{ href: PagePath | "/#health-guide"; label: string; icon: typeof House; mobileOnly?: boolean }> = [
  { href: "/", label: "首頁", icon: House },
  { href: "/pharmacies", label: "藥局地圖", icon: MapIcon },
  { href: "/medicines", label: "藥品目錄", icon: Pill },
  { href: "/#health-guide", label: "健康手冊", icon: BookOpen, mobileOnly: true },
];

export default function PageHeader({ currentPath }: { currentPath: PagePath }) {
  return (
      <header className="site-header">
        <div className="brand-cluster">
          <Link className="brand" href="/" aria-label="MediMate 首頁">
            <span className="brand-mark" aria-hidden="true"><Pill /></span>
            <span className="brand-copy">
              <span className="brand-name-row"><span>MediMate</span></span>
            </span>
          </Link>
        </div>
        <nav className="site-nav" aria-label="主要導覽">
          {navigation.map(({ href, label, icon: Icon, mobileOnly }) => (
            <Link key={href} className={mobileOnly ? "mobile-nav-only" : undefined} href={href} aria-current={currentPath === href ? "page" : undefined}>
              <Icon className="nav-icon" aria-hidden="true" />
              {label}
            </Link>
          ))}
          <Link className="desktop-nav-only" href="/#data-status"><Database className="nav-icon" aria-hidden="true" />資料來源</Link>
        </nav>
        <div className="header-tools">
          <Link className="header-quick-link" href="/#quick-search" aria-label="前往快速搜尋">
            <Search className="icon" aria-hidden="true" />
            <span className="header-quick-label">快速搜尋</span>
          </Link>
          <ThemeToggle />
        </div>
      </header>
  );
}
