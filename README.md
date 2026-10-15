# MediMate

MediMate 是以手機瀏覽為優先的繁體中文藥局與藥品公開查詢網站。採用 Next.js App Router、TypeScript 與 Neon PostgreSQL，網頁透過伺服器端 API 查詢資料。

## 現行實作與資料狀態

- 全站介面依 Warm Mint Health / Stitch MedMate 設計參考統一為暖白 Rice Milk 畫布、森林綠與薄荷色、Plus Jakarta Sans 標題及 Nunito Sans 拉丁字體。資訊標籤、同步狀態、排行標記與外觀快搜輔助徽章採一般文字呈現，不使用不可細節編輯的裝飾膠囊；操作按鈕仍保留圓角以維持觸控辨識。首頁、藥局與藥品頁仍使用各自既有資料元件；靜態範本中的樣本數字與未連接資料的篩選控制不會視為產品資料或功能。

- 網站使用手機優先的 Next.js App Router 與 TypeScript，包含藥局/藥品搜尋介面、分頁與同源 API 路由。
- 藥局支援全台縣市及相依行政區下拉篩選與使用者主動授權的瀏覽器定位；指定縣市/區域後，地圖會載入該區完整有效藥局並即時轉換地址座標，清單仍獨立分頁。Google 地理編碼結果只供當次地圖顯示，不寫入資料庫。行政區清單依內政部戶政司 114 年開放資料核對（22 縣市、368 鄉鎮市區）。
- Render 部署設定位於 `render.yaml`，使用 Free Node Web Service。Free 方案閒置 15 分鐘會休眠，下一次請求約一分鐘喚醒；此方案是網站預覽，不是即時可用承諾。
- 首頁提供兩個主要查詢路由：`/pharmacies` 藥局位置與營業資訊、`/medicines` 藥品資訊；各目錄頁提供對應搜尋欄位。藥局查詢在結果卡先呈現地址、電話、資料狀態與距離，再顯示可定位資料的地圖；沒有座標的資料仍保留在卡片清單。使用定位時依距離排序且不設固定半徑，確保最近資料即使相距很遠也會顯示。
- 藥局清單每列顯示一張資訊卡，依序呈現藥局資料與操作、依台灣時間判讀的目前上午／下午／晚上看診安排和一週週曆；頁面停留期間會定期更新，週曆保留水平捲動。藥局頁桌面以清單搭配地圖，手機則先顯示地圖再顯示清單。
- TGOS 批次地址比對可供維運人員離線補齊藥局座標；匯出缺少座標的藥局機構代碼與地址，依每日額度分批，再將完成 CSV 精確回匯。匯入器提供 `--dry-run` 預檢，單一座標直接寫入，多候選地址與座標逐組保存；附近排序取每家藥局距離使用者最近的候選點，區域地圖會標示所有候選位置。操作流程與批次狀態見[維運文件](docs/operations.md)。
- 首頁、藥局與藥品頁的站內路由使用 Next.js client-side navigation；共用頁面 template 以 React `ViewTransition` 與 CSS 淡入效果處理頁面轉場，並支援 `prefers-reduced-motion` 降級。
- 全站操作圖示使用 `lucide-react` SVG，品牌與頁尾使用 `public/health-insurance-emblem.svg` 真實全民健康保險標誌，避免 Material Symbols 字型缺失造成圖示顯示為文字；來源清單、搜尋視窗、結果卡、藥品排行卡與外觀快搜卡會在進入 viewport 時以共用 `IntersectionObserver` 淡入，並支援 `prefers-reduced-motion`。
- 藥局與藥品頁共用 Warm Mint 頁首，桌面左側固定品牌、中央提供主要導覽、右側提供主題切換；窄螢幕將同一組導覽移至固定底部並保留安全區空間。
- 主題沒有已儲存偏好時預設使用範本的淺色 Warm Mint 畫布；使用者主動切換夜間模式後會保留於瀏覽器的 `localStorage`。
- 線上查詢由 Next.js server route 連接 Neon PostgreSQL；Render runtime 使用 `DATABASE_URL` pooled URL，資料庫 URL 不會送到瀏覽器。`/api/ready` 檢查資料庫連線，`/api/health` 保持程序存活檢查。
- 既有政府 CSV 已由官方資源重新下載、核對 SHA-256，並匯入 Neon。藥品許可證的官方用法、處方成分與歷史安全公告由 `005_medicine_information.sql` 及 `npm run db:import-medicine-information` 接入程式，但每次更新仍須先在隔離 branch 驗證再套用 production；缺少的副作用、禁忌與交互作用會顯示未提供。藥局使用健保特約來源；藥品只顯示有效日期未過且註銷狀態空白的資料。2026-10-08 是來源查證與匯入批次日期，不等於藥品使用量統計期間；後者依申報年月決定，民國 115 年目前涵蓋 11501–11507。細節與更新方式見[資料來源文件](docs/data-sources.md)及[維運文件](docs/operations.md)。
- Parallels SQL Server 不會公開到網際網路，這次遷移來源是官方 CSV，並非從本機 SQL Server dump。
- 網站不提供診斷或治療建議，也不含帳號、個人藥箱或個人查詢歷史。官方公告資料僅涵蓋 2014-01-21 至 2022-12-16，未列入公告不代表沒有風險；來源沒有完整逐藥品副作用、禁忌或交互作用欄位，網站會標示未提供，不自行推測。
- `/medicines` 進入後顯示健保藥品使用量排行，每頁最多 50 項、桌面每列 3 張卡片並提供頁碼按鈕；資料期間與彙總申報量限制會清楚標示。排行頁不顯示無法由官方識別碼精確配對的藥證、外觀或詳細用藥資料；藥品詳細資料請以完整許可證字號搜尋。藥品卡片僅顯示中文品名，不顯示英文品名。外觀快搜沿用同一藥品 API，只接受藥品名稱、許可證字號或刻字關鍵字，不提供未接資料的形狀/顏色辨識。新增資料匯入與來源限制見[資料來源文件](docs/data-sources.md)。
- 所有頁面透過根版型共用健保標誌及資料來源頁尾，列出藥局、藥品、藥品使用量、外觀資料與行政區參考資料來源；來源細節及待核實項目見[資料來源文件](docs/data-sources.md)。
- 首頁底部列出資料來源、更新資訊及使用限制；授權條款與藥品使用量不代表病人數等必要說明也清楚標示。
- 地圖使用 Google Maps JavaScript API；指定區域的藥局會先以資料庫既有座標立即顯示，缺少座標的地址才透過同源 `/api/geocode` 分批代理 Google Geocoding API，即時轉換後補上標記。API key 由伺服器環境讀取，座標不寫回資料庫或快取。未設定地圖金鑰時會停止定位請求；定位服務錯誤會停止後續批次並沿用資料既有座標。
- CSV、資料庫匯出/備份、`.env`、密碼、API key 及其他秘密資訊不得提交 GitHub。Render 管理用 API key 只用於管理平台，不能加入網站執行環境。
- 藥品使用量排行 migration 與匯入器已新增；部署及資料庫匯入仍須先在隔離 Neon branch 驗證，不能直接對 production 執行。來源 CSV 保留在使用者下載資料夾，不提交 repo。
- 藥品使用量排行的外觀圖片使用 Next.js `Image`、響應式 `sizes` 與 lazy loading，透過圖片最佳化服務以 `quality={55}` 提供較小的卡片預覽圖，不直接載入 FDA 全尺寸原圖；若圖片載入失敗即顯示占位圖。來源仍只允許 FDA 官方 `mcp.fda.gov.tw`。藥品卡片不呈現英文品名。

## 文件

- [資料庫大綱（資料表與欄位）](docs/database-schema.md)
- [核准的設計範圍與架構](docs/superpowers/specs/2026-10-08-medmate-public-web-design.md)
- [實作計劃](docs/superpowers/plans/2026-10-08-medmate-public-web.md)

## 開發狀態

啟動與部署細節見[維運文件](docs/operations.md)。程式 lint 使用 Biome；production build、TypeScript 型別檢查與測試分別驗證框架相容性、型別及功能。Biome 不包含 Next.js 專屬 ESLint 規則。

### Responsive layout

全站版面採用流體寬度、`clamp()` 字級與自適應 grid，頁首工具列會依視窗寬度收縮為圖示，藥品卡片、來源清單、地圖與營業時間表會在桌面、平板與手機解析度自動重排，避免文字直排與水平溢出。藥局頁的桌面／平板結果區讓地圖保持可見、左側資訊清單獨立捲動；手機則先顯示彈性高度地圖，清單在剩餘視高內獨立捲動，底部導覽與安全區不遮擋操作。
