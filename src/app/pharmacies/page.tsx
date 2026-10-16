import PageHeader from "../../components/PageHeader";
import SearchPanel from "../../components/SearchPanel";
import { MapPinned } from "lucide-react";

type PageProps = {
  searchParams: Promise<{ q?: string | string[] }>;
};

export default async function PharmaciesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q : "";

  return (
    <main className="page-shell page-shell--inner">
      <PageHeader currentPath="/pharmacies" />
      <section className="data-status-bar" aria-label="資料狀態">
        <span className="data-status-detail">資料來源：中央健康保險署</span>
      </section>
      <section className="inner-hero" aria-labelledby="pharmacy-page-title">
        <div className="page-title-row">
          <div>
            <p className="eyebrow">讓日常照護，離你更近</p>
            <h1 id="pharmacy-page-title">身邊的藥局，<span>一查就清楚。</span></h1>
            <p>選定縣市、區域或允許定位後，先查看藥局資訊卡，再檢視地圖分布。</p>
          </div>
          <span className="page-hero-icon" aria-hidden="true"><MapPinned /></span>
        </div>
      </section>
      <SearchPanel kind="pharmacies" initialQuery={query} />
    </main>
  );
}
