# MediMate

MediMate 是以手機瀏覽為優先的繁體中文藥局與藥品公開查詢網站。首版採用 Next.js App Router 與 TypeScript，網頁透過伺服器端 API 查詢資料；瀏覽器不會直接連接 SQL Server。

## 現行實作與資料狀態

- 網站使用手機優先的 Next.js App Router 與 TypeScript，包含藥局/藥品搜尋介面、分頁與同源 API 路由。
- Render 部署設定位於 `render.yaml`，使用 Free Node Web Service。Free 方案閒置 15 分鐘會休眠，下一次請求約一分鐘喚醒；此方案是網站預覽，不是即時可用承諾。
- Neon 專案已連結至 `production` branch，並加入最小 `neon.ts` 設定；目前尚未建立 MediMate 資料表或將網站 repository 接到 Neon，因此資料查詢功能仍未啟用。設定方式見[維運文件](docs/operations.md)。
- 目前未連接資料庫，API 會安全回覆服務暫時無法使用。Parallels SQL Server 不會公開到網際網路。
- 官方資料集與開放授權已完成初步核實；附件是否為現行官方版本，以及藥局/藥品有效狀態規則仍待比對確認。沒有上傳或公開附件 CSV，啟用查詢前必須依[來源查證文件](docs/data-sources.md)重新取得官方資料並完成狀態驗證。
- 網站不提供診斷或治療建議，也不含帳號、個人藥箱或個人查詢歷史。來源資料沒有副作用欄位，網站不會補寫副作用內容。
- CSV、資料庫匯出/備份、`.env`、密碼、API key 及其他秘密資訊不得提交 GitHub。Render 管理用 API key 只用於管理平台，不能加入網站執行環境。

## 文件

- [核准的設計範圍與架構](docs/superpowers/specs/2026-10-08-medmate-public-web-design.md)
- [實作計劃](docs/superpowers/plans/2026-10-08-medmate-public-web.md)
- [專案代理規則](AGENTS.md)

## 開發狀態

啟動與部署細節見[維運文件](docs/operations.md)。程式 lint 使用 Biome；production build、TypeScript 型別檢查與測試分別驗證框架相容性、型別及功能。Biome 不包含 Next.js 專屬 ESLint 規則。
