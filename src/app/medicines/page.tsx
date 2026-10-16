import PageHeader from "../../components/PageHeader";
import SearchPanel from "../../components/SearchPanel";
import { Pill } from "lucide-react";

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
      <section className="inner-hero" aria-labelledby="medicine-page-title">
        <div className="page-title-row">
          <div>
            <p className="eyebrow">藥品資訊，一起查清楚</p>
            <h1 id="medicine-page-title">認識藥品，<span>從這裡開始。</span></h1>
            <p>輸入症狀、藥品名稱或許可證字號，查閱公開的用途與用藥資訊。吃藥前，請先問醫師或藥師。</p>
          </div>
          <span className="page-hero-icon" aria-hidden="true"><Pill /></span>
        </div>
      </section>
      <SearchPanel
        kind="medicines"
        initialQuery={query}
        showPillFeatureFinder={false}
      />
    </main>
  );
}
