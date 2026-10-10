import MedicineUsageCatalog from "../../components/MedicineUsageCatalog";
import MedicineAppearanceSection from "../../components/MedicineAppearanceSection";
import PageHeader from "../../components/PageHeader";
import SearchPanel from "../../components/SearchPanel";

type PageProps = {
  searchParams: Promise<{ q?: string | string[] }>;
};

export default async function MedicinesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q : "";

  return (
    <main className="page-shell page-shell--inner">
      <PageHeader currentPath="/medicines" />
      <section className="data-status-bar" aria-label="資料狀態">
        <span className="data-status-detail"><span className="status-dot" />資料來源：食品藥物管理署與中央健康保險署</span>
        <span className="data-status-detail"><strong>資料期間依申報年月</strong>　使用量為彙總申報量</span>
      </section>
      <section className="inner-hero">
        <p className="eyebrow">
          <span className="status-dot" />
          MEDICINE REFERENCE
        </p>
        <h1>
          藥品使用排行
          <br />
          <span>公開資料一覽</span>
        </h1>
        <p>
          依健保申報醫令量呈現藥品品項排名，搭配政府藥品外觀與許可資料，提供公開資訊參考。
        </p>
        <section className="medicine-overview-card" aria-labelledby="medicine-overview-title">
          <h2 id="medicine-overview-title" className="sr-only">藥品資料摘要</h2>
          <div className="medicine-overview-metric"><span className="material-symbols-outlined" aria-hidden="true">database</span><div><span>藥品許可資料</span><strong>品名・成分</strong><small>有效期限與許可證</small></div></div>
          <div className="medicine-overview-metric"><span className="material-symbols-outlined" aria-hidden="true">calendar_month</span><div><span>使用量統計</span><strong>申報年月</strong><small>彙總申報量</small></div></div>
        </section>
      </section>
      <SearchPanel
        kind="medicines"
        initialQuery={query}
        showPillFeatureFinder={false}
      />
      <MedicineUsageCatalog />
      <MedicineAppearanceSection />
    </main>
  );
}
