import MedicineUsageCatalog from "../../components/MedicineUsageCatalog";
import PageHeader from "../../components/PageHeader";
import SearchPanel from "../../components/SearchPanel";

export default function MedicinesPage() {
  return (
    <main className="page-shell page-shell--inner">
      <PageHeader href="/pharmacies" label="找藥局" />
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
      </section>
      <MedicineUsageCatalog />
      <SearchPanel kind="medicines" />
    </main>
  );
}
