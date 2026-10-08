# 維運與部署

## 本機開發

- 使用 Node.js 24.x 與 npm。
- 安裝相依套件：`npm ci`
- 啟動開發環境：`npm run dev`
- 驗證：`npm run lint`、`npm run typecheck`、`npm test -- --run`、`npm run build`
- `/api/health` 回傳網站程序健康狀態，不代表資料庫可用。

## SQL Server 連線狀態

目前尚未確認 Parallels SQL Server 的實際 schema、連線驗證模式及唯讀帳號，所以沒有啟用資料庫 repository。不得將本機 SQL Server 對外 port-forward，也不得為通過測試改變 VM 網路或 SQL 驗證設定。Tedious 不支援 Windows/Trusted Connection；只有已存在 SQL Authentication 和唯讀專用帳號時，才可評估部署端可安全連線的託管 SQL Server。

`.env.example` 列出未來連線變數名稱。真正密碼只能放在本機被忽略的 `.env.local` 或託管平台的秘密變數，不能放 GitHub；本輪 Render 服務不需要或設定任何 SQL 憑證。

## Render

`render.yaml` 定義 Node Web Service，使用 `npm ci && npm run build` 建置、`npm start` 啟動，健康路徑為 `/api/health`，計算方案為 Free。Node 版本固定為 `.node-version` 的 24.21.0。Free Web Service 閒置 15 分鐘會休眠，收到下一個請求後約一分鐘重新喚醒；檔案系統為暫存性質，不應將本機檔案當持久資料保存。這適合預覽，不保證可用性或隨時即時回應；升級為付費方案前應先確認費用。

目前公開預覽網址：[https://medmate-53s1.onrender.com](https://medmate-53s1.onrender.com)。2026-10-08 已確認 Render deploy `dep-db3jc5navr4c73a24dfg` 狀態為 Live（commit `4fb0e064dbf822c7a2f96bd2ef1f35b2be29fb4c`）；首頁與 `/api/health` 回應 HTTP 200。藥局/藥品搜尋因尚未連接託管資料庫而回 HTTP 503，前端搜尋控制項保持停用。Render Free 閒置時休眠，恢復服務可能延遲 50 秒以上。

Render API key 僅是平台管理憑證，不要加入 Render 網站的 runtime env、Render Blueprint 或 Git。若需在本機供 Render CLI/管理腳本使用，可存於被 `.gitignore` 忽略的 `.env.local`，使用 `RENDER_API_KEY` 名稱；此檔只存在本機，不要複製到 Render 網站環境。此專案目前沒有程式會讀取該變數，也不會把它傳給瀏覽器。已在對話中提供的 key 應儘速輪替。

本部署只提供網站預覽。由於託管網站不能直接連到私人 Parallels VM，且資料發布資格未核實，藥局/藥品搜尋不會展示真實資料。
