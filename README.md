# MediMate

MediMate 是以手機瀏覽為優先的繁體中文藥局與藥品公開查詢網站。採用 Next.js App Router、TypeScript 與 Neon PostgreSQL，網頁透過伺服器端 API 查詢資料。

## 現行實作與資料狀態

- 網站使用手機優先的 Next.js App Router 與 TypeScript，包含藥局/藥品搜尋介面、分頁與同源 API 路由。
- 藥局支援全台縣市及相依行政區下拉篩選與使用者主動授權的瀏覽器定位；地圖只呈現資料庫已有座標的藥局，沒有座標的資料仍可用清單查詢。行政區清單依內政部戶政司 114 年開放資料核對（22 縣市、368 鄉鎮市區）。
- Render 部署設定位於 `render.yaml`，使用 Free Node Web Service。Free 方案閒置 15 分鐘會休眠，下一次請求約一分鐘喚醒；此方案是網站預覽，不是即時可用承諾。
- 首頁只提供兩個入口：`/pharmacies` 藥局位置與營業資訊、`/medicines` 藥品公開資料。藥局查詢在結果卡先呈現地址、電話、資料狀態與距離，再顯示可定位資料的地圖；沒有座標的資料仍保留在卡片清單。
- 線上查詢由 Next.js server route 連接 Neon PostgreSQL；Render runtime 使用 `DATABASE_URL` pooled URL，資料庫 URL 不會送到瀏覽器。`/api/ready` 檢查資料庫連線，`/api/health` 保持程序存活檢查。
- 三份政府 CSV 已由官方資源重新下載、核對 SHA-256，匯入 Neon。藥局使用健保特約來源；藥品只顯示有效日期未過且註銷狀態空白的資料。細節與更新方式見[資料來源文件](docs/data-sources.md)及[維運文件](docs/operations.md)。
- Parallels SQL Server 不會公開到網際網路，這次遷移來源是官方 CSV，並非從本機 SQL Server dump。
- 網站不提供診斷或治療建議，也不含帳號、個人藥箱或個人查詢歷史。來源資料沒有副作用欄位，網站不會補寫副作用內容。
- 地圖使用 Google Maps JavaScript API；藥局地址會透過同源 `/api/geocode` 代理 Google Geocoding API 即時轉換為座標後顯示。API key 僅由伺服器設定 `GOOGLE_MAP_API_KEY` 讀取，未定位結果不寫回資料庫。
- CSV、資料庫匯出/備份、`.env`、密碼、API key 及其他秘密資訊不得提交 GitHub。Render 管理用 API key 只用於管理平台，不能加入網站執行環境。
- 2026-10-08 已將使用者下載資料夾內與現有功能相符的三份 CSV 核對 hash 後匯入 Neon production。該資料夾的另外幾份醫材、外觀與健保藥價資料尚未納入現有搜尋模型，請先擴充 schema 與 UI/API 再匯入，避免將不同識別碼混合。

## 文件

- [核准的設計範圍與架構](docs/superpowers/specs/2026-10-08-medmate-public-web-design.md)
- [實作計劃](docs/superpowers/plans/2026-10-08-medmate-public-web.md)
- [專案代理規則](AGENTS.md)

## 開發狀態

啟動與部署細節見[維運文件](docs/operations.md)。程式 lint 使用 Biome；production build、TypeScript 型別檢查與測試分別驗證框架相容性、型別及功能。Biome 不包含 Next.js 專屬 ESLint 規則。
