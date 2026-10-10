import PageHeader from "../../components/PageHeader";
import SearchPanel from "../../components/SearchPanel";

export default function PharmaciesPage() {
  return <main className="page-shell page-shell--inner">
    <PageHeader href="/medicines" label="查詢藥品" />
    <section className="inner-hero"><p className="eyebrow"><span className="status-dot" />PHARMACY DIRECTORY</p><h1>藥局位置與<br /><span>營業資訊</span></h1><p>選定縣市、區域或允許定位後，先查看藥局資訊卡，再檢視地圖分布。</p></section>
    <SearchPanel kind="pharmacies" />
  </main>;
}
