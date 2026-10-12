# MediMate

MediMate 是以手機瀏覽為優先的繁體中文藥局與藥品公開查詢網站。採用 Next.js App Router、TypeScript 與 Neon PostgreSQL，網頁透過伺服器端 API 查詢資料。

## 現行實作與資料狀態

- 全站介面依 Warm Mint Health / Stitch MedMate 設計參考統一為暖白 Rice Milk 畫布、森林綠與薄荷色、Plus Jakarta Sans 標題及 Nunito Sans 拉丁字體。資訊標籤、同步狀態、排行標記與外觀快搜輔助徽章採一般文字呈現，不使用不可細節編輯的裝飾膠囊；操作按鈕仍保留圓角以維持觸控辨識。首頁、藥局與藥品頁仍使用各自既有資料元件；靜態範本中的樣本數字與未連接資料的篩選控制不會視為產品資料或功能。

- 網站使用手機優先的 Next.js App Router 與 TypeScript，包含藥局/藥品搜尋介面、分頁與同源 API 路由。
- 藥局支援全台縣市及相依行政區下拉篩選與使用者主動授權的瀏覽器定位；指定縣市/區域後，地圖會載入該區完整有效藥局並即時轉換地址座標，清單仍獨立分頁。Google 地理編碼結果只供當次地圖顯示，不寫入資料庫。行政區清單依內政部戶政司 114 年開放資料核對（22 縣市、368 鄉鎮市區）。
- Render 部署設定位於 `render.yaml`，使用 Free Node Web Service。Free 方案閒置 15 分鐘會休眠，下一次請求約一分鐘喚醒；此方案是網站預覽，不是即時可用承諾。
- 首頁提供兩個主要查詢路由：`/pharmacies` 藥局位置與營業資訊、`/medicines` 藥品資訊，並提供會把關鍵字帶入對應路由的快速搜尋。藥局查詢在結果卡先呈現地址、電話、資料狀態與距離，再顯示可定位資料的地圖；沒有座標的資料仍保留在卡片清單。使用定位時依距離排序且不設固定半徑，確保最近資料即使相距很遠也會顯示。
- 藥局清單每列顯示一張資訊卡，依序呈現藥局資料與操作、政府登記看診時段和一週週曆；週曆保留水平捲動。藥局頁桌面以清單搭配地圖，手機則先顯示地圖再顯示清單。
- TGOS 批次地址比對可供維運人員離線補齊藥局座標；匯出缺少座標的藥局機構代碼與地址，依每日額度分批，再將完成 CSV 精確回匯。匯入器提供 `--dry-run` 預檢，忽略多候選/無效座標並避免覆寫既有座標。附近藥局排序使用資料庫已確認座標即時完成，TGOS 批次服務本身不是即時定位 API。操作流程與批次狀態見[維運文件](docs/operations.md)。
- 首頁、藥局與藥品頁的站內路由使用 Next.js client-side navigation；共用頁面 template 以 React `ViewTransition` 與 CSS 淡入效果處理頁面轉場，並支援 `prefers-reduced-motion` 降級。
- 全站操作圖示使用 `lucide-react` SVG，避免 Material Symbols 字型缺失造成圖示顯示為文字；來源卡、搜尋卡、結果卡、藥品排行卡與外觀快搜卡會在進入 viewport 時以共用 `IntersectionObserver` 淡入，並支援 `prefers-reduced-motion`。
- 藥局與藥品頁共用 Warm Mint 頁首，桌面左側固定品牌、中央提供主要導覽、右側提供快速搜尋錨點與主題切換；窄螢幕將同一組導覽移至固定底部並保留安全區空間。
- 主題沒有已儲存偏好時預設使用範本的淺色 Warm Mint 畫布；使用者主動切換夜間模式後會保留於瀏覽器的 `localStorage`。
- 線上查詢由 Next.js server route 連接 Neon PostgreSQL；Render runtime 使用 `DATABASE_URL` pooled URL，資料庫 URL 不會送到瀏覽器。`/api/ready` 檢查資料庫連線，`/api/health` 保持程序存活檢查。
- 三份政府 CSV 已由官方資源重新下載、核對 SHA-256，匯入 Neon。藥局使用健保特約來源；藥品只顯示有效日期未過且註銷狀態空白的資料。2026-10-08 是來源查證與匯入批次日期，不等於藥品使用量統計期間；後者依申報年月決定，民國 115 年目前涵蓋 11501–11507。細節與更新方式見[資料來源文件](docs/data-sources.md)及[維運文件](docs/operations.md)。
- Parallels SQL Server 不會公開到網際網路，這次遷移來源是官方 CSV，並非從本機 SQL Server dump。
- 網站不提供診斷或治療建議，也不含帳號、個人藥箱或個人查詢歷史。來源資料沒有副作用欄位，網站不會補寫副作用內容。
- `/medicines` 進入後顯示健保藥品使用量排行，每頁最多 50 項、桌面每列 3 張卡片並提供頁碼按鈕；資料期間與彙總申報量限制會清楚標示。外觀快搜沿用同一藥品 API，只接受藥品名稱、許可證字號或刻字關鍵字，不提供未接資料的形狀/顏色辨識。外觀圖片只在 FDA 完整許可證字號精確配對時顯示，否則使用占位圖；目前健保來源與外觀資料缺少已核實的直接識別碼對照。新增資料匯入與來源限制見[資料來源文件](docs/data-sources.md)。
- 所有頁面透過根版型共用健保標誌及資料來源頁尾，列出藥局、藥品、藥品使用量、外觀資料與行政區參考資料來源；來源細節及待核實項目見[資料來源文件](docs/data-sources.md)。
- 首頁底部列出資料來源、更新資訊及使用限制；授權條款與藥品使用量不代表病人數等必要說明也清楚標示。
- 地圖使用 Google Maps JavaScript API；指定區域的藥局會先以資料庫既有座標立即顯示，缺少座標的地址才透過同源 `/api/geocode` 分批代理 Google Geocoding API，即時轉換後補上標記。API key 由伺服器環境讀取，座標不寫回資料庫或快取。未設定地圖金鑰時會停止定位請求；定位服務錯誤會停止後續批次並沿用資料既有座標。
- CSV、資料庫匯出/備份、`.env`、密碼、API key 及其他秘密資訊不得提交 GitHub。Render 管理用 API key 只用於管理平台，不能加入網站執行環境。
- 藥品使用量排行 migration 與匯入器已新增；部署及資料庫匯入仍須先在隔離 Neon branch 驗證，不能直接對 production 執行。來源 CSV 保留在使用者下載資料夾，不提交 repo。
- 藥品使用量排行的外觀圖片使用 Next.js `Image`、響應式 `sizes`、lazy loading 與 quality 70，並只允許 FDA 官方 `mcp.fda.gov.tw` 圖片來源，降低首屏下載量與外部圖片載入時間。

## 文件

- [核准的設計範圍與架構](docs/superpowers/specs/2026-10-08-medmate-public-web-design.md)
- [實作計劃](docs/superpowers/plans/2026-10-08-medmate-public-web.md)
- [專案代理規則](AGENTS.md)

## 開發狀態

啟動與部署細節見[維運文件](docs/operations.md)。程式 lint 使用 Biome；production build、TypeScript 型別檢查與測試分別驗證框架相容性、型別及功能。Biome 不包含 Next.js 專屬 ESLint 規則。
