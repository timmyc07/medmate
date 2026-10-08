# MediMate

MediMate 是以手機瀏覽為優先的繁體中文藥局與藥品公開查詢網站。首版採用 Next.js App Router 與 TypeScript，網頁透過伺服器端 API 查詢資料；瀏覽器不會直接連接 SQL Server。

## 目前範圍

- 首版規劃提供藥局與藥品公開查詢，不提供診斷或治療建議。
- 開發階段只使用 Parallels 虛擬機內的本機 SQL Server；不將該伺服器暴露到公開網路。
- Azure SQL Database 與 Azure App Service 是後續線上部署方向。GitHub 用於版本控制與部署流程，不是資料庫主機；建立雲端資源前須先確認資料來源授權、資料時效、Azure 訂閱與成本。
- 首版不包含帳號、個人藥箱或個人查詢歷史。
- 使用者提供的 CSV、資料庫匯出/備份、`.env`、密碼、金鑰及其他秘密資訊不得提交到 GitHub。
- 來源與授權尚未核實前，不複製資料到雲端，也不宣稱查詢結果為最新。來源資料沒有副作用欄位，因此網站不得補寫或暗示副作用資訊。

## 文件

- [核准的設計範圍與架構](docs/superpowers/specs/2026-10-08-medmate-public-web-design.md)
- [實作計劃](docs/superpowers/plans/2026-10-08-medmate-public-web.md)
- [專案代理規則](AGENTS.md)

## 開發狀態

目前專案處於實作階段；本 README 所述為核准範圍與安全界線，不代表網站、資料庫連線或雲端部署已完成。程式 lint 使用 Biome；Next.js production build、TypeScript 型別檢查與測試分別驗證框架相容性、型別及功能。Biome 不包含 Next.js 專屬 ESLint 規則。
