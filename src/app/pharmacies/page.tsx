import PageHeader from "../../components/PageHeader";
import SearchPanel from "../../components/SearchPanel";

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
        <span className="data-status-detail"><strong>查詢結果依公開資料呈現</strong>　固定看診時段不代表即時營業</span>
      </section>
      <section className="inner-hero" aria-labelledby="pharmacy-page-title">
        <p className="eyebrow">PHARMACY DIRECTORY</p>
        <div className="page-title-row">
          <div>
            <h1 id="pharmacy-page-title">藥局位置與<br /><span>營業資訊</span></h1>
            <p>選定縣市、區域或允許定位後，先查看藥局資訊卡，再檢視地圖分布。</p>
          </div>
          <div className="data-period-card">
            <span>資料使用方式</span>
            <strong>公開資料查詢</strong>
            <span>出發前請先電話確認</span>
          </div>
        </div>
      </section>
      <SearchPanel kind="pharmacies" initialQuery={query} />
    </main>
  );
}
