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
          找到適合你的藥品資訊
          <br />
          <span>先從症狀開始查</span>
        </h1>
        <p>
          輸入你現在的不舒服（例如頭痛、咳嗽、過敏），或直接輸入藥名，看看公開資料中這些藥通常用來處理什麼問題。
          查到的內容僅供認識藥品，吃藥前請先問醫師或藥師。
        </p>
      </section>
      <SearchPanel
        kind="medicines"
        initialQuery={query}
        showPillFeatureFinder={false}
      />
    </main>
  );
}
