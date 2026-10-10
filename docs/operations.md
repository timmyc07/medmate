# 維運與部署

全站頁面由根 layout 共用健保標誌及政府開放資料來源頁尾。若增加新的政府資料或參考來源，請同步更新 `src/components/SiteFooter.tsx` 與 `docs/data-sources.md`；目前 FDA 外觀資料的精確資料集頁及授權資訊尚待核實。

藥局卡片只顯示政府公開資料中的文字資訊，圖片與 Google Street View 抓圖功能已移除，因此不會產生街景 metadata 或 Static API 請求與相關費用。地圖、地址定位與 Google Maps 導航仍為獨立功能。

藥局卡片會顯示健保署「固定看診時段」原文及依台灣時區判讀的目前半日時段。來源只有上午、下午、晚上三段，沒有精確鐘點或即時營業回報；畫面明確標示為政府登記看診安排，出發前應電話確認。資料未提供時不推定休診。

藥局搜尋結果採單欄資訊卡；卡片先顯示藥局地址、電話、資料狀態及導航/撥號操作，再於下方顯示看診時段與週曆。週曆直接呈現在卡片內，不需要額外點擊展開，並可水平捲動。桌面頁面以藥局清單搭配地圖；窄螢幕先顯示地圖再顯示清單。

首頁、藥局與藥品頁的站內導覽使用 Next.js `Link` 進行 client-side navigation。共用 `src/app/template.tsx` 透過 React `ViewTransition` 淡入路由內容；瀏覽器不支援 View Transitions API 時仍有一般 CSS 入場效果，使用者啟用 `prefers-reduced-motion` 時會縮短動畫。

藥局與藥品頁的 `PageHeader` 共用 Warm Mint header 版型：桌面左側品牌、中央主要導覽、右側快速搜尋錨點與主題切換；窄螢幕將同一組導覽固定在底部，並預留 safe-area 空間。首頁的 `QuickSearch` 會以 query string 導向對應目錄。

## 本機開發

- 使用 Node.js 24.x 與 npm。
- 安裝相依套件：`npm ci`
- 啟動開發環境：`npm run dev`
- 驗證：`npm run lint`、`npm run typecheck`、`npm test -- --run`、`npm run build`
- `/api/health` 回傳網站程序健康狀態，不代表資料庫可用。

## SQL Server 連線狀態

目前尚未確認 Parallels SQL Server 的實際 schema、連線驗證模式及唯讀帳號，所以沒有啟用資料庫 repository。2026-10-08 唯讀檢查確認 Windows VM 位址為私有 NAT `10.211.55.3`，SQL Server 服務正在執行，但 TCP 僅在 loopback `127.0.0.1:1434` 接聽，沒有可供 Render 連線的 VM 網路介面 listener。Render 因而無法直接連線。不得將本機 SQL Server 對外 port-forward，也不得為通過測試改變 VM 網路或 SQL 驗證設定。Tedious 不支援 Windows/Trusted Connection；若要讓雲端直連，需先評估受控 VPN/隧道、現有 SQL Authentication 與唯讀專用帳號，不能將 SQL 埠公開至網際網路。

`.env.example` 列出未來連線變數名稱。真正密碼只能放在本機被忽略的 `.env.local` 或託管平台的秘密變數，不能放 GitHub；本輪 Render 服務不需要或設定任何 SQL 憑證。

## Neon PostgreSQL

Neon CLI 8.0.12 已登入本機帳號，專案 `lingering-sun-32547332` 已連結 `production` branch。`neon.ts` 使用官方 `@neon/config` 的空 policy，`@neon/config` 與 `@neon/env` 已加入 npm dependencies。`.neon` 連結資料與 `.env.local` 連線變數均由 Git 忽略；不要提交 API key、資料庫 URL 或其他秘密。Codex 專案 MCP 設定在 `.codex/config.toml`，採 OAuth、只限定該 Neon project 並限制唯讀；Neon agent skills 安裝於 `.agents/skills/`。

執行 `neon config plan --project-id lingering-sun-32547332 --branch production` 確認 policy 無變更後，`neon deploy` 已套用設定。資料表由 `db/migrations/001_catalog.sql` 管理，查詢 repository 位於 `src/lib/db/`。Neon 官方建議 Render 等長駐 Node 服務使用 `pg`，web query 使用 pooled connection；migration/import 使用 direct connection。官方參考：[連線方式](https://neon.com/docs/connect/choose-connection.md)、[連線池](https://neon.com/docs/connect/connection-pooling.md)、[branching](https://neon.com/docs/introduction/branching.md)。

藥品使用量排行新增 `002_medicine_usage.sql` 與 `npm run db:import-medicines -- <資料夾>`。此命令會將 111–115 年用量及健保藥品目錄、FDA 外觀匯入同一交易；必須先把 `DATABASE_URL_UNPOOLED` 明確切到隔離測試 branch，migration 和匯入驗證成功後才能安排 production。榜單 API 是 `/api/medicines/usage?page=N&pageSize=50`，頁面提供數字按鈕；使用量資料期間與申報量限制會顯示於頁首。詳細來源及識別碼規則見[資料來源文件](data-sources.md)。

藥品頁的外觀快搜只提供現有藥品查詢 API 支援的藥品名稱、許可證字號或刻字關鍵字，範本中的形狀與顏色控制不會被當成可用辨識功能。外觀圖片仍須通過 FDA 完整許可證字號精確配對，不能以品名或模糊相似度推測。

Render 必須設定 `DATABASE_URL` 為 Neon pooled URL。direct `DATABASE_URL_UNPOOLED` 僅供本機人工執行 `npm run db:migrate` / `npm run db:import`，不可加入 Render runtime。不要列印連線 URL、寫進 Git 或前端。Pool 上限每個服務程序 5 條連線；查詢錯誤不寫入日誌。`/api/ready` 檢查資料庫是否可查詢，`/api/health` 只用於程序存活。

首次 schema/import 驗證使用有到期時間的 Neon branch `medmate-import-test-20261008`。2026-10-08 已在驗證 branch 測試後，將 `001_catalog.sql` 套用 production 並從 `/Users/reikous/Downloads/藥品資料庫` 匯入三個受支援 CSV：FDA 藥局 9,155 原始列（去重後 9,153）、健保特約藥局 10,187 列、FDA 藥品許可證 72,074 原始列（去重後 66,510）；每個來源 SHA-256 與筆數寫入 `source_imports`。其餘新增 CSV/B5 檔案尚未納入產品功能。正式查詢與匯入帳號應分開管理並授予最小權限；Neon 預設 app connection 若仍使用 owner role，應另建唯讀角色。CSV 匯入命令和白名單/來源更新策略見[資料來源文件](data-sources.md)。原始 CSV 不應提交到 GitHub。

## Render

`render.yaml` 定義 Node Web Service，使用 `npm ci && npm run build` 建置、`npm start` 啟動，健康路徑為 `/api/health`，計算方案為 Free。Node 版本固定為 `.node-version` 的 24.21.0。Free Web Service 閒置 15 分鐘會休眠，收到下一個請求後約一分鐘重新喚醒；檔案系統為暫存性質，不應將本機檔案當持久資料保存。這適合預覽，不保證可用性或隨時即時回應；升級為付費方案前應先確認費用。

公開網站：[https://medmate-53s1.onrender.com](https://medmate-53s1.onrender.com)。Render Web Service `medmate` 使用 GitHub `main` 自動部署，`autoDeployTrigger` 固定為 `commit`。2026-10-09 曾發現 GitHub push 未進入部署佇列，已透過 Render API 重新寫入 `branch=main` 與 `autoDeployTrigger=commit`，重新註冊自動部署觸發並手動補部署最新 commit；若再次發生，應先在 Render Deploys 確認 commit 是否出現，再檢查 GitHub/Render webhook 連線，不要重複提交程式碼。部署完成後需以首頁、`/api/ready`、兩個搜尋 API 驗證。Render Free 閒置時休眠，恢復服務可能延遲 50 秒以上，故不代表隨時即時可用性。

網站路由：`/pharmacies` 專注藥局位置與資料卡，`/medicines` 專注藥品公開資料；首頁不直接載入查詢結果。藥局資料來源目前只有地址、電話、合約/資料狀態與部分座標，沒有可信的即時營業時間或官方圖片欄位，因此介面會標示「營業狀況待查」或資料狀態，不將合約狀態冒充即時營業中。若日後啟用 Google Places，須確認 API、帳務與儲存政策後才可補充營業時間或照片。

Render API key 僅是平台管理憑證，不要加入 Render 網站的 runtime env、Render Blueprint 或 Git。若需在本機供 Render CLI/管理腳本使用，可存於被 `.gitignore` 忽略的 `.env.local`，使用 `RENDER_API_KEY` 名稱；此檔只存在本機，不要複製到 Render 網站環境。此專案目前沒有程式會讀取該變數，也不會把它傳給瀏覽器。已在對話中提供的 key 應儘速輪替。

Render 只連 Neon，不直接連私人 Parallels VM。資料匯入來源為官方 CSV，發布條件與欄位白名單見資料來源文件。

## 位置與地圖查詢

### Google Maps 與地址定位

網站地圖目前使用 Google Maps JavaScript API。Render 或本機執行環境可設定 `GOOGLE_MAPS_BROWSER_KEY` 與 `GOOGLE_GEOCODING_API_KEY`；未分拆時會回退使用 `GOOGLE_MAP_API_KEY`。前者只允許網站網域，後者只允許伺服器 IP，並分別啟用 Maps JavaScript API 與 Geocoding API。Google 官方服務仍受帳務、配額、API key referrer/IP 限制與服務條款約束，不能以程式繞過計費。前端只呼叫同源 `/api/maps-config` 載入地圖，地址定位由 `/api/geocode` 伺服器端代理，單次最多處理 20 個地址且只保留在當次查詢結果。

地址轉換依附件官方範例採用 `geocode({ address })` 的概念，改用 Geocoding Web Service 以避免暴露伺服器 key。無法定位的地址仍顯示於文字清單，不以行政區中心點代替。若未設定 key 或 Google 回傳錯誤，地圖會顯示服務狀態而不影響藥局文字搜尋。

藥局查詢提供兩種流程：使用者可在 HTTPS 網站按下「使用目前位置找附近藥局」，瀏覽器才會請求 Geolocation 權限；或填寫縣市與區域查詢。精確座標只在當次瀏覽器狀態中使用，不送入資料庫、不寫應用程式日誌。API 以 `lat`、`lng` 查詢 Neon 中已有座標的紀錄並以距離排序；定位搜尋預設不設固定半徑，因此即使最近資料距離數百或數千公里仍會顯示。只有呼叫端明確傳入 `radiusKm` 時才套用 0.5 至 50 公里的驗證與距離限制。

縣市與鄉鎮市區選單涵蓋全台 22 縣市、368 鄉鎮市區；清單核對來源為[內政部戶政司人口統計資料開放平台](https://www.ris.gov.tw/rs-opendata/api/v1/datastore/ODRP019/114) 114 年村里戶數、單一年齡人口資料的行政區欄位。選定縣市後區域選單只顯示該縣市行政區，改選縣市會清除已選區域。

目前匯入的健保藥局 CSV 只有地址文字，未包含經緯度，因此地圖只畫出資料庫中已有座標的藥局，未定位地址仍顯示於文字清單。尚未找到已核實條款且可合法批次處理本專案全量地址的政府/商用服務；不可用 Nominatim 公共服務做系統化批次查詢，也不可用區域中心點冒充藥局地址座標。未來若接入經核准的座標來源，應透過 `geocode_provider`、`geocoded_at` 欄位記錄來源與時間，先在測試 branch 驗證後再更新 production。

## 2026-10-09 視覺更新

## 2026-10-10 Warm Mint Stitch 介面更新

首頁、藥局與藥品頁依 `/Users/reikous/Downloads/stitch_medmate_design_system/` 的 Warm Mint Health token 重整為 Rice Milk 畫布、森林綠操作色、薄荷狀態色、膠囊控制項與柔和圓角卡片。首頁桌面保留主視覺與資料可信度區，手機改為垂直 CTA、快搜、資料來源卡及固定底部導覽；範本中的統計、評分、熱門藥局、帳號、收藏和健康手冊入口沒有接到真實 API，因此不呈現為產品功能。

藥局頁維持查詢 API、縣市/區域、定位、地圖、固定看診週曆與分頁。桌面結果以左側清單、右側地圖呈現，手機先顯示地圖再顯示清單；Google Maps 設定或腳本失敗時顯示明確狀態，文字清單與導航仍可使用。藥品頁維持許可證查詢與政府使用量排行，桌面使用三欄卡片、手機單欄，並標示申報期間和彙總量限制。

首頁與頁尾的 2026-10-08 文案指來源查證／匯入批次日期；藥品使用量期間仍由 API 回傳的申報年月決定，115 年目前是 11501–11507。藥局固定看診時段不代表即時營業，所有頁面保留資料來源、授權與醫療提醒。production build、TypeScript 型別檢查、測試與 lint 均已執行；桌面版及 390px 手機版首頁、藥局與藥品頁預覽已檢查，手機固定底部導覽未遮擋頁面操作區。
