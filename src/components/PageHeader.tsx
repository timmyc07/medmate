import Link from "next/link";
import ThemeToggle from "./ThemeToggle";

type PageHeaderProps = {
  href: "/pharmacies" | "/medicines";
  label: string;
};

export default function PageHeader({ href, label }: PageHeaderProps) {
  return (
    <header className="landing-header page-header">
      <Link className="landing-brand" href="/" aria-label="MediMate 首頁">
        <span className="brand-mark" aria-hidden="true">＋</span>
        <span>MediMate</span>
      </Link>
      <nav className="landing-nav page-header-nav" aria-label="頁面導覽">
        <Link className="page-header-link" href={href}>{label} <span aria-hidden="true">↗</span></Link>
      </nav>
      <div className="landing-tools"><ThemeToggle /></div>
    </header>
  );
}
