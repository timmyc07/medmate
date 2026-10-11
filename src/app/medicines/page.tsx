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
        <span className="data-status-detail">資料來源：食品藥物管理署與中央健康保險署</span>
        <span className="data-status-detail"><strong>資料期間依申報年月</strong>　使用量為彙總申報量</span>
      </section>
      <section className="inner-hero">
        <h1>
          藥品使用排行
          <br />
          <span>藥品資訊一覽</span>
        </h1>
        <p>
          依健保申報醫令量呈現藥品品項排名，搭配藥品外觀與許可資料，方便查閱。
        </p>
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
