# 維運與部署

全站頁面由根 layout 共用健保標誌及政府開放資料來源頁尾。若增加新的政府資料或參考來源，請同步更新 `src/components/SiteFooter.tsx` 與 `docs/data-sources.md`；目前 FDA 外觀資料的精確資料集頁及授權資訊尚待核實。

藥局卡片只顯示文字資訊，圖片與 Google Street View 抓圖功能已移除，因此不會產生街景 metadata 或 Static API 請求與相關費用。地圖、地址定位與 Google Maps 導航仍為獨立功能。

藥局卡片會顯示健保署「固定看診時段」原文及依台灣時區判讀的目前半日時段。來源只有上午、下午、晚上三段，沒有精確鐘點或即時營業回報；畫面明確標示為政府登記看診安排，出發前應電話確認。資料未提供時不推定休診。

藥局搜尋結果採單欄資訊卡；卡片先顯示藥局地址、電話、資料狀態及導航/撥號操作，再於下方顯示看診時段與週曆。週曆直接呈現在卡片內，不需要額外點擊展開，並可水平捲動。桌面頁面以藥局清單搭配地圖；窄螢幕先顯示地圖再顯示清單。

首頁、藥局與藥品頁的站內導覽使用 Next.js `Link` 進行 client-side navigation。共用 `src/app/template.tsx` 透過 React `ViewTransition` 淡入路由內容；瀏覽器不支援 View Transitions API 時仍有一般 CSS 入場效果，使用者啟用 `prefers-reduced-motion` 時會縮短動畫。

藥局與藥品頁的 `PageHeader` 共用 Warm Mint header 版型：品牌使用 `public/health-insurance-emblem.svg`，桌面左側品牌、中央主要導覽、右側主題切換；窄螢幕將同一組導覽固定在底部並只顯示圖示，預留 safe-area 空間。搜尋從各自的藥局或藥品目錄頁進入，不在導航列提供快速搜尋浮動視窗。

主題切換首次載入時以範本指定的淺色 Warm Mint 為預設；只有使用者主動切換後才會在瀏覽器 `localStorage` 保存夜間模式偏好。

## 本機開發

- 使用 Node.js 24.x 與 npm。
- 安裝相依套件：`npm ci`
- 啟動開發環境：`npm run dev`
- 驗證：`npm run lint`、`npm run typecheck`、`npm test -- --run`、`npm run build`
- `/api/health` 回傳網站程序健康狀態，不代表資料庫可用。

## TGOS 批次補齊藥局座標

TGOS「批次門牌地址比對服務」是人工上傳 CSV、完成後以電子郵件通知下載的非同步服務，官方說明作業約 1–2 天、每日最多 10,000 筆。它不能用於網站即時定位請求。官方頁面：[批次地址比對](https://www.tgos.tw/TGOS/Addr/addrCompare)。

TGOS 範本欄位為 `id,Address,Response_Address,Response_X,Response_Y`。需先用 direct Neon URL 在本機匯出待定位資料：

```sh
DATABASE_URL_UNPOOLED='請使用本機秘密環境變數' npm run tgos:export -- /安全的本機路徑/pharmacies-tgos.csv
```

匯出檔包含所有沒有座標的藥局機構代碼及原始地址，超過 10,000 筆時會自動拆成 `-part1`、`-part2` 等檔案。登入 TGOS 依序上傳各批 CSV，選擇 `EPSG:4326 (WGS84)`，依需要選擇完全或模糊比對；每日上限 10,000 筆，因此超過額度的批次要等次日再提交。下載完成檔後執行：

```sh
DATABASE_URL_UNPOOLED='請使用本機秘密環境變數' npm run tgos:import -- /安全的本機路徑/TGOS完成檔.csv
```

可以先用 `npm run tgos:import -- /安全的本機路徑/TGOS完成檔.csv --dry-run` 預檢筆數、未命中及座標問題，不會修改資料庫。正式回匯採單一資料庫交易，只接受 CSV 欄位完全符合官方格式、`id` 與原地址同時吻合資料庫機構，且 WGS84 座標落在台灣範圍內的結果。單一座標只填入空白主座標；多候選座標依回傳地址、經度、緯度順序寫入 `pharmacy_coordinate_candidates`，不會猜選或丟棄候選點。附近搜尋以最接近使用者的候選點計算距離，區域地圖會呈現所有候選點。缺少/無效座標、欄位筆數不一致、未命中及已有座標均分類統計，資料庫錯誤則整批 rollback。CSV 僅供本機操作，已由 `.gitignore` 排除。

2026-10-12 已匯入 TGOS 完成檔 `Address_Finish.csv`：10,000 筆中 9,737 筆單一座標寫入主座標欄，157 家藥局的 529 個多候選點寫入候選座標表，106 筆沒有有效座標。候選點欄位完整性、機構代碼/原始地址及台灣 WGS84 範圍均通過檢查；無拒收候選點。資料庫目前有 9,737 筆主座標與 529 筆候選點，仍有 293 家藥局沒有任何位置（第二批 187 筆尚待提交，加上本批 106 筆無結果）。附近搜尋距離及導航目的地使用同一個最近候選點；重匯候選資料時會同步同機構的候選點集合，避免殘留已移除項目。

Migration `004_pharmacy_coordinate_candidates.sql` 新增候選座標表及索引，回滾時需先確認應保留的候選位置資料，再備份該表並手動移除表及索引；不得直接刪表造成候選座標遺失。

TGOS 憑證放在被忽略的 `.env.local`，範例變數名稱為 `TGOS_BATCH_APP_ID` 與 `TGOS_BATCH_API_KEY`。目前這兩個變數僅供人工批次作業管理，不由腳本或網站讀取；TGOS 線上頁面本身仍要求登入並在表單輸入 APIKEY。不要設定到 Render、不要傳到瀏覽器或提交 Git。若憑證曾公開，應向 TGOS 輪替後再用。附近搜尋只會使用資料庫已核可的座標，地圖則仍依現有地圖服務顯示。

## 前端圖示、圖片與卡片動畫

頁面操作圖示統一使用 `lucide-react` SVG；不要重新加入依賴字型 ligature 的 Material Symbols class，避免字型未載入時顯示成不可讀文字。藥品排行卡的 FDA 外觀圖使用 Next.js `Image`，`next.config.ts` 僅允許 `mcp.fda.gov.tw` 的 HTTPS 圖片，元件設定響應式 `sizes` 與 lazy loading，並以 `quality={55}` 透過圖片最佳化服務傳送縮小預覽，避免卡片直接載入全尺寸來源圖；圖片載入失敗時顯示占位圖。藥品卡片只顯示中文品名。若新增圖片來源，必須同步檢查來源授權並加入明確的 `remotePatterns`。

來源清單、搜尋視窗、藥局/藥品結果卡、藥品排行卡與外觀快搜卡共用 `src/components/ScrollReveal.tsx`。來源區塊採無卡片陰影的清單，授權限制採扁平 reference block；首頁不另顯示健康提醒區塊，醫療提醒保留於全站頁尾。元件以單一 `IntersectionObserver` 觀察內容，進入 viewport 後套用淡入與上移效果；SSR、未支援 IntersectionObserver 或 `prefers-reduced-motion` 時保持內容可見。新增內容時應沿用此元件，不要在各頁重複建立 observer。

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

網站路由：`/pharmacies` 專注藥局位置與資訊卡，`/medicines` 專注藥品查詢及使用量排行；首頁不直接載入查詢結果。藥局資料目前只有地址、電話、合約/資料狀態與部分座標，沒有可信的即時營業時間或官方圖片欄位，因此介面會標示「營業狀況待查」或資料狀態，不將合約狀態冒充即時營業中。若日後啟用 Google Places，須確認 API、帳務與儲存政策後才可補充營業時間或照片。

Render API key 僅是平台管理憑證，不要加入 Render 網站的 runtime env、Render Blueprint 或 Git。若需在本機供 Render CLI/管理腳本使用，可存於被 `.gitignore` 忽略的 `.env.local`，使用 `RENDER_API_KEY` 名稱；此檔只存在本機，不要複製到 Render 網站環境。此專案目前沒有程式會讀取該變數，也不會把它傳給瀏覽器。已在對話中提供的 key 應儘速輪替。

Render 只連 Neon，不直接連私人 Parallels VM。資料匯入來源為官方 CSV，發布條件與欄位白名單見資料來源文件。

## 位置與地圖查詢

### Google Maps 與地址定位

網站地圖目前使用 Google Maps JavaScript API。Render 或本機執行環境可設定 `GOOGLE_MAPS_BROWSER_KEY` 與 `GOOGLE_GEOCODING_API_KEY`；未分拆時會回退使用 `GOOGLE_MAP_API_KEY`。前者只允許網站網域，後者只允許伺服器 IP，並分別啟用 Maps JavaScript API 與 Geocoding API。Google 官方服務仍受帳務、配額、API key referrer/IP 限制與服務條款約束，不能以程式繞過計費。前端只呼叫同源 `/api/maps-config` 載入地圖，地址定位由 `/api/geocode` 伺服器端代理，單次最多處理 20 個地址且只保留在當次查詢結果。

2026-10-11 線上診斷曾觀察到 `/api/geocode` 回 503，且 `/api/maps-config` 回傳未啟用；表示 Render 缺少地圖瀏覽器金鑰與伺服器端 Geocoding 金鑰（或舊共用金鑰）。此情況下應在 Render `medmate` 服務環境設定 `GOOGLE_MAPS_BROWSER_KEY` 及 `GOOGLE_GEOCODING_API_KEY`，不要把瀏覽器金鑰當伺服器金鑰使用。前端現先檢查地圖設定，未啟用時不發送 geocode 請求；遇到定位 HTTP 錯誤則停止剩餘批次並顯示狀態，仍以資料中既有座標標示可用藥局。新增/修改環境變數後須重新部署，再檢查 `/api/maps-config` 的 `enabled` 與 `/api/geocode` 的回應；檢查時勿輸出金鑰值。

地址轉換依附件官方範例採用 `geocode({ address })` 的概念，改用 Geocoding Web Service 以避免暴露伺服器 key。無法定位的地址仍顯示於文字清單，不以行政區中心點代替。若未設定 key 或 Google 回傳錯誤，地圖會顯示服務狀態而不影響藥局文字搜尋。

藥局查詢提供兩種流程：使用者可在 HTTPS 網站按下「使用目前位置找附近藥局」，瀏覽器才會請求 Geolocation 權限；或填寫縣市與區域查詢。精確座標只在當次瀏覽器狀態中使用，不送入資料庫、不寫應用程式日誌。API 以 `lat`、`lng` 查詢 Neon 中已有座標的紀錄並以距離排序；定位搜尋預設不設固定半徑，因此即使最近資料距離數百或數千公里仍會顯示。只有呼叫端明確傳入 `radiusKm` 時才套用 0.5 至 50 公里的驗證與距離限制。

縣市與鄉鎮市區選單涵蓋全台 22 縣市、368 鄉鎮市區；清單核對來源為[內政部戶政司人口統計資料開放平台](https://www.ris.gov.tw/rs-opendata/api/v1/datastore/ODRP019/114) 114 年村里戶數、單一年齡人口資料的行政區欄位。選定縣市後區域選單只顯示該縣市行政區，改選縣市會清除已選區域。

目前匯入的健保藥局 CSV 只有地址文字。使用者選定縣市或行政區後，`/api/pharmacies/map` 會查出該區全部有效藥局，不受資訊清單分頁影響；地圖先建立 Google Maps 並立即顯示資料庫已有座標，再將缺少座標的地址去重後，每 20 筆一批呼叫同源 `/api/geocode` 補上標記。每次載入仍會重新向 Google Geocoding API 定位缺少座標的地址，成功結果只在當次地圖記憶體中使用，不寫入資料庫或快取。Google API key 僅由伺服器環境讀取。未能定位的地址不畫點，仍保留於藥局文字清單。全台未指定縣市時不啟動全量地理編碼；大型縣市仍會依缺少座標的地址數產生多次 Google API 請求，需留意專案配額與帳單。不可用 Nominatim 公共服務做系統化批次查詢，也不可用區域中心點冒充藥局地址座標。匯入器只在藥局地址未變時保留資料庫原有座標，地址變更會使舊座標不再沿用。

## 2026-10-09 視覺更新

## 2026-10-10 Warm Mint Stitch 介面更新

首頁、藥局與藥品頁依 `/Users/reikous/Downloads/stitch_medmate_design_system/` 的 Warm Mint Health token 重整為 Rice Milk 畫布、森林綠操作色、薄荷狀態色、膠囊控制項與柔和圓角卡片。範本中的統計、評分、熱門藥局、帳號、收藏和健康手冊入口沒有接到真實 API，因此不呈現為產品功能。

藥局頁維持查詢 API、縣市/區域、定位、地圖、固定看診週曆與分頁。桌面結果以左側清單、右側地圖呈現，手機先顯示地圖再顯示清單；Google Maps 設定或腳本失敗時顯示明確狀態，文字清單與導航仍可使用。藥品頁維持許可證查詢與政府使用量排行，桌面使用三欄卡片、手機單欄，並標示申報期間和彙總量限制。

首頁與頁尾的 2026-10-08 文案指來源查證／匯入批次日期；藥品使用量期間仍由 API 回傳的申報年月決定，115 年目前是 11501–11507。藥局固定看診時段不代表即時營業，所有頁面保留資料來源、授權與醫療提醒。production build、TypeScript 型別檢查、測試與 lint 均已執行；桌面版及 390px 手機版首頁、藥局與藥品頁預覽已檢查，手機固定底部導覽未遮擋頁面操作區。

## 2026-10-11 圖示與裝飾元件收尾

移除 Material Symbols subset 字型依賴，避免字型載入失敗時將圖示渲染成破圖或不可讀字串；頁面圖示改用穩定的 Unicode／短文字替代，按鈕的中文標籤與互動行為維持不變。同步狀態、來源類型、資料頻率、排行、區段編號、外觀快搜徽章及熱門藥局狀態改為一般文字，移除狀態圓點與不可細節編輯的裝飾膠囊。搜尋、定位、分頁、API、資料庫與地圖流程未更動。

## 2026-10-11 全站文案精簡

移除品牌旁「台灣公開健康資料」、首頁公開資料口號、導覽同步標籤、搜尋區段編號與重複欄位說明，以及藥品卡上的 `RANK` 裝飾。保留藥品使用排行這項真實功能、資料來源入口、授權條款、申報量限制與看診時段非即時營業提醒；未改動查詢、定位、地圖、分頁或資料 API。

## Responsive layout

`globals.css` 使用流體容器、`clamp()` 與 `auto-fit` grid 讓首頁、搜尋結果、藥品卡片與頁尾依解析度調整；768–1120px 的頁首工具列收斂為圖示，手機與平板不會因固定按鈕寬度造成文字直排。地圖高度與藥局營業時間表也會隨 viewport 收縮。

## 首頁健康提醒區塊

首頁不再顯示獨立的健康提醒 reference block，也移除導向該區塊的手機導覽入口；全站頁尾保留醫療提醒文字。

## 頁首授權 disclaimer

授權與使用限制以全站共用 `site-disclaimer` 顯示於導覽列正上方，緊貼頁首並連到政府資料開放授權條款；首頁不再重複顯示獨立授權區塊。窄螢幕會自動換行，避免壓縮導覽列。

## 首頁版面微調

首頁主視覺使用明確的 `place-items: center` 保持內容水平與垂直置中；頁首 disclaimer 採滿版橫條；頁尾醫療提醒改為無卡片、無圓角的左色線提示，並縮小頁尾上方留白。

## 來源清單標籤排列

來源卡片的類型與更新頻率應以自然間距排列並允許換行，不使用 `space-between` 將兩者推至卡片兩端，以維持窄欄與寬螢幕下的閱讀群組。

## 頁首按鈕間距

頁首 grid 欄位使用流體 `column-gap`，確保資料來源導覽與主題切換按鈕在寬螢幕與中等解析度下保持可讀間距。

## 全屏頁首背景

`site-header-shell` 明確脫離首頁內容寬度限制並使用 `width: 100%`，讓 disclaimer、導覽背景與底線延伸至完整 viewport；頁首內部欄位仍由 padding 與 grid 控制內容寬度。
