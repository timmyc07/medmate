# MediMate 公開查詢網頁實作計劃

> **已由後續決策取代（2026-10-08）：** 資料庫改用 Neon PostgreSQL、網站部署於 Render。三份官方 CSV 已核對並先匯入 Neon 測試 branch；現行實作/發布紀錄見 `docs/data-sources.md` 與 `docs/operations.md`。以下保留原計劃作歷史紀錄，不再作為當前部署指令。

> **狀態（2026-10-08）：** 手機優先網站、搜尋 API 邊界、Render Free Blueprint 與官方來源文件已完成；無資料預覽已部署並確認 Live：https://medmate-53s1.onrender.com（commit `4fb0e064dbf822c7a2f96bd2ef1f35b2be29fb4c`）。首頁與健康檢查回 HTTP 200；搜尋 API 在尚未連接資料庫時回 HTTP 503，前端搜尋停用。官方頁面已確認三個資料集的來源/開放授權，但附件版本核對、有效狀態規則、Parallels SQL schema/驗證模式及雲端資料庫尚未完成，不能展示真實資料。
>
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立可在手機與桌面使用的繁體中文 MediMate 網頁，包含具界線的藥局/藥品搜尋 API，並以 Render Free 提供無資料預覽；附件版本、狀態規則和託管資料庫完成驗證前不公開資料列。

**Architecture:** 使用 Next.js App Router、TypeScript 與有界的 Route Handlers；瀏覽器只呼叫同源 API。Render Free 提供網站預覽，不會連至本機 Parallels SQL Server。只有在資料來源發布資格、雲端 SQL Server 和唯讀身分都確認後，才可啟用 server-only `mssql` repository；Azure SQL 可作為未來雲端資料庫選項。

**Tech Stack:** Node.js 24 LTS；Next.js 16.4.0；React/React DOM 19.3.0；TypeScript 5.9.x（固定 patch 版本並提交 lockfile，暫不採用尚未確認與 Next.js 建置相容性的 TypeScript 7）；`mssql` 12.7.4；Vitest 與 React Testing Library（以建立當日官方文件確認版本）。

**Spec:** `docs/superpowers/specs/2026-10-08-medmate-public-web-design.md`

## Global Constraints

- 所有介面、文件與新增程式註解以繁體中文為主。
- SQL Server 憑證只從本機環境變數讀取；`.env*`、CSV、資料庫備份與個資資料必須排除於 Git。
- 前端不得直接連 SQL Server；只允許 server-side、參數化、唯讀查詢。
- API 搜尋字串長度最多 100 字元，每頁最多 50 筆；錯誤回應不回傳資料庫細節，應用日誌不得記錄藥品搜尋原字串。
- 不納入負責人姓名/性別欄位、不建立帳號/藥箱/個人查詢歷史、不提供診斷或治療建議。
- 官方頁已查證的資料集網址、授權與更新頻率列於 `docs/data-sources.md`；附件版本及狀態規則未驗證前，不複製附件 CSV 到雲端、不把資料標示為最新或供公開網際網路查詢。
- 本機 SQL Server 若僅有 Windows/Trusted Connection，`mssql`/Tedious 不支援該驗證方式；需先確認現有連線模式。只在已有 SQL Authentication 且可建立唯讀專用帳號時使用環境變數連線；不得為了通過測試而開啟 VM 對外連線或變更伺服器驗證模式。
- Azure 資源建立、付費資料庫建立及正式公開部署不在此本機實作計劃內；待 Azure 訂閱/成本界線與資料發布資格確認後另案執行。
- 每次變更前讀取對應程式與文件並核對官方文件；實作前/PR 前/推送前完成三輪獨立審查。依 AGENTS.md 於完成後 commit/push；敏感資料不得進入公開 GitHub。
- AGENTS.md 要求同步 Obsidian 筆記，但本機未找到 vault 路徑或同步設定；計劃末列為需向使用者補足的外部路徑，不猜測或複製到公開 repo。

---

## 檔案責任圖

- `README.md`：繁體中文專案說明、啟動方式、資料/安全範圍。
- `AGENTS.md`：版本化專案工作規則。
- `docs/first_demo_plan.md`：保留歷史並加上 superseded 標示，避免舊技術規格被當成現行設計。
- `.gitignore`：排除依賴、build、`.env`、資料 CSV、SQL 備份與本機資料匯出。
- `package.json`、`package-lock.json`、`tsconfig.json`、`next.config.ts`、`vitest.config.ts`：Next/TypeScript 與測試設定。
- `src/lib/config.ts`：驗證 SQL 環境變數，不輸出敏感值。
- `src/lib/db/pool.ts`：建立並重用 server-only SQL 連線池。
- `src/lib/db/pharmacies.ts`、`src/lib/db/medicines.ts`：型別化參數化唯讀查詢及資料列 mapping。
- `src/app/api/pharmacies/route.ts`、`src/app/api/medicines/route.ts`：驗證 query/page/pageSize、回傳穩定 JSON。
- `src/app/page.tsx`、`src/app/globals.css`：手機優先查詢介面與 responsive 樣式。
- `src/components/SearchPanel.tsx`、`src/components/ResultCard.tsx`：可重用搜尋狀態與結果呈現。
- `src/types/catalog.ts`：API/畫面共用的 Pharmacy、Medicine 型別。
- `tests/`：設定驗證、查詢輸入、route 與畫面互動測試，mock DB driver，不需要讀取真實資料列。
- `docs/data-sources.md`：記錄官方來源查證狀態、待核對事項、欄位白名單和匯入/上線 gate。
- `docs/operations.md`：本機啟動、環境變數、驗證命令及資料不進 GitHub 的操作方式。
- Obsidian vault 內的同期筆記：使用者提供實際 vault/path 後建立，避免猜測路徑。

## 任務

### Task 1：納入專案規則並隔離敏感資料

**Files:**
- Modify: `README.md`
- Modify: `docs/first_demo_plan.md`
- Modify: `.gitignore`
- Add/track: `AGENTS.md`

**Interfaces:** 不涉及程式介面。

- [ ] 將 README 改為繁體中文，記錄核准的 Next.js 架構、目前只支援本機資料、禁止提交 CSV/備份/密鑰。
- [ ] 在舊計劃最前面加入「已由新設計取代」與新 spec 連結；舊內容保留供歷史參考，不將其端點實作。
- [ ] 建立 `.gitignore`，至少忽略 `node_modules/`、`.next/`、`coverage/`、`.env*`（保留 `.env.example`）、`*.csv`、`*.bak`、`*.dump`、`*.bacpac`、`*.mdf`、`*.ldf`。
- [ ] 執行 `git status --short --ignored` 與 `git ls-files`，確認沒有附件資料或秘密檔被 stage；檢查尚未推送的 commit tree。
- [ ] 驗證文件一致性並提交 `chore(repo): 建立 MediMate 專案安全基線`。

### Task 2：建立鎖定版本的 Next.js 與測試骨架

**Files:**
- Add: `package.json`
- Add: `package-lock.json`
- Add: `tsconfig.json`
- Add: `next.config.ts`
- Add: `vitest.config.ts`
- Add: `src/app/layout.tsx`
- Add: `src/app/page.tsx`
- Add: `src/app/globals.css`
- Add: `tests/setup.ts`
- Add: `src/types/catalog.ts`

**Interfaces:** `Pharmacy` 含 `id/name/address/phone/city/status/sourceUpdatedAt`；`Medicine` 含 `id/licenseNumber/name/indications/licenseStatus/validUntil/sourceUpdatedAt`，可空欄位使用 `string | null`。這些是 API 和前端共用 DTO，不含來源未提供的 side effects。

- [ ] 先依 Next.js 官方安裝文件建立最小可啟動頁，鎖定已查證 Node 24、Next 16.4.0、React 19.3.0、TypeScript 5.9 最新 patch，Vitest 等版本以官方文件/registry 當日查證並固定。
- [ ] 加入 `typecheck`、`lint`、`test`、`build` scripts；使用 npm lockfile 固定所有依賴。
- [ ] 寫第一個根頁 render 測試，確認繁體中文站名與藥局/藥品兩個查詢入口。
- [ ] 執行 `npm ci && npm test -- --run && npm run typecheck && npm run build`，確認乾淨安裝成功。
- [ ] 檢查手機 viewport 不需水平捲動，提交 `feat(web): 建立 TypeScript 網頁骨架`。

### Task 3：安全 SQL 設定及唯讀 repository

**Files:**
- Add: `src/lib/config.ts`
- Add: `src/lib/db/pool.ts`
- Add: `src/lib/db/pharmacies.ts`
- Add: `src/lib/db/medicines.ts`
- Add: `tests/lib/config.test.ts`
- Add: `tests/lib/db/*.test.ts`
- Add: `.env.example`
- Add: `docs/operations.md`

**Interfaces:**
- `getDatabaseConfig(env: NodeJS.ProcessEnv): DatabaseConfig` 驗證 `SQL_SERVER`、`SQL_DATABASE`、`SQL_USER`、`SQL_PASSWORD`，預設 TLS 加密及關閉未驗證憑證信任；缺設定時提供不含值的錯誤。
- `searchPharmacies({ keyword, city, page, pageSize }): Promise<Page<Pharmacy>>`
- `searchMedicines({ keyword, page, pageSize }): Promise<Page<Medicine>>`
- `Page<T> = { items: T[]; page: number; pageSize: number; total: number }`。

- [ ] 寫 config 測試：必要設定缺漏報錯、預設加密、錯誤字串不可包含密碼。
- [ ] 寫 repository 測試：只允許 SELECT；值走 typed parameters；排序欄位不可由使用者控制；OFFSET/FETCH 和 count query 共用篩選條件。
- [ ] 先讀取本機 SQL schema（只看欄位結構，不讀輸出個資資料列），確定實際 table/schema/欄位名後再建立 mapping；任何欄位猜測以文件記錄為待查，不直接塞入 SQL。
- [ ] 連線池設定有限 `connectionTimeout/requestTimeout`；module singleton 避免每 request 新建 pool；pool 不可用時回傳通用服務錯誤並僅記錄錯誤代碼。
- [ ] `.env.example` 使用假值並註明 `.env.local` 不可提交；文件說明若 VM 僅 Windows 驗證則不支援且需停止，禁止更改 VM 網路或 SQL 驗證模式。
- [ ] 執行單元測試、型別檢查及靜態搜尋，確認客戶端 bundle 不引用 `mssql`/config；提交 `feat(db): 加入唯讀 SQL repository`。

### Task 4：建立有界、無敏感 query logging 的 API

**Files:**
- Add: `src/lib/api/search-params.ts`
- Add: `src/app/api/pharmacies/route.ts`
- Add: `src/app/api/medicines/route.ts`
- Add: `tests/api/search-params.test.ts`
- Add: `tests/api/pharmacies-route.test.ts`
- Add: `tests/api/medicines-route.test.ts`

**Interfaces:** GET `/api/pharmacies?q=&city=&page=1&pageSize=20`; GET `/api/medicines?q=&page=1&pageSize=20`; successful body uses `Page<T>`; invalid request returns 400 `{ error: { code: "INVALID_QUERY", message: string } }`; database failure returns generic 503 `{ error: { code: "SERVICE_UNAVAILABLE", message: string } }`.

- [ ] 寫 route 測試：空 keyword、超過 100 字元、page 非正整數、pageSize > 50 均回 400，並斷言 repository 沒被呼叫。
- [ ] 寫 route 測試：合法值被裁去首尾空格後傳至 repository；資料庫例外只回通用錯誤，回應與 mock logger 不含輸入 keyword/密碼/stack。
- [ ] 實作參數驗證與 Route Handlers；不將原始 query 寫 console/logger，不回應 SQL 錯誤細節。
- [ ] 執行 API 測試與 lint/typecheck，提交 `feat(api): 加入公開唯讀搜尋端點`。

### Task 5：手機優先的繁體中文搜尋體驗

**Files:**
- Add: `src/components/SearchPanel.tsx`
- Add: `src/components/ResultCard.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/app/globals.css`
- Add: `tests/components/search-panel.test.tsx`

**Interfaces:** `SearchPanel` 接收 `kind: "pharmacies" | "medicines"`，自行管理輸入、loading、錯誤、空結果和分頁狀態，透過同源 API fetch。位置權限/精確定位功能不在首版。

- [ ] 寫互動測試：切換藥局/藥品、送出搜尋、顯示 loading/結果/空結果/錯誤、下一頁。
- [ ] 實作語意化表單、鍵盤可操作控制項、清楚的 loading/error/empty 文案；藥局電話用 `tel:`；藥品適應症原文呈現，不做沒有醫藥審核的字串替換。
- [ ] 加上資料來源未核實提示與「資訊僅供參考，請向藥師/醫療專業人員確認」說明，並顯示每筆資料來源更新時間（若 DB 有可信 metadata）。
- [ ] 用 CSS grid/flex 和彈性寬度完成窄螢幕與桌面排版，確認無硬編碼固定 viewport 寬度。
- [ ] 執行元件測試及 production build，提交 `feat(ui): 完成手機版藥局藥品搜尋`。

### Task 6：資料來源、授權與維運文件

**Files:**
- Add: `docs/data-sources.md`
- Modify: `docs/operations.md`
- Modify: 設計/計劃文件如查證結論要求更新

- [ ] 逐一在官方資料集頁確認 35_2、36_2、A21030000I-D21005-001 的正式名稱、發布機關、下載/API URL、授權條款、更新頻率、最後更新日及欄位定義；保存頁面網址與查證日期。
- [ ] 若官方頁仍無法查得授權、來源或狀態語意，將該資料集列為不可公開匯入並在 UI 保持明確資料限制，不推斷下載 URL/授權。
- [ ] 若後續有明確來源，列出匯入欄位白名單：排除負責人姓名/性別；保留來源 URL/取得時間/批次/原狀態/有效日；藥局合約終止/歇業需排除 current；藥品須同時解析註銷狀態、註銷日期與有效日期。
- [ ] 文件化可重複匯入、重複 key、異常資料隔離、匯入筆數驗證、資料 snapshot/rollback、來源 stale 標示與無搜尋字串日誌策略。
- [ ] 更新 README 的資料來源及開發狀態，再次檢查無猜測的官方聲明；提交 `docs(data): 記錄資料來源與上線限制`。

### Task 7：三輪審查、驗證與公開 GitHub 推送

**Files:** 所有前述專案檔案。

- [ ] 審查一：對照最新官方 Next.js、Node、mssql、Azure 文件及鎖定版本，檢查 app/build/driver 用法。
- [ ] 審查二：檢查輸入驗證、SQL 參數、最小權限、錯誤回應、日誌隱私、responsive/accessibility、資料有效性。
- [ ] 審查三：檢查 README/AGENTS/舊文件一致性、部署邊界、repo 歷史與 `git status --short --ignored`；確認 CSV、SQL backup、`.env`、密鑰從未進入 commit tree。
- [ ] 執行 `npm ci && npm run lint && npm run typecheck && npm test -- --run && npm run build`；若 SQL 驗證方式允許，使用已存在唯讀帳號做一次無資料列曝光的連線健康檢查，不列印憑證或個資。
- [ ] 執行 `git diff --check` 與 `git log --stat`，確保只包含程式碼/文件/lockfile。
- [ ] 依 Conventional Commits 完成提交，再 `git push -u origin main`；若推送因遠端已有不同歷史或認證失敗，停止 force push，保留本地 commit 並回報安全阻塞。
- [ ] 最後整理驗證結果、GitHub commit/repo 連結、無法完成的外部前置（Azure 訂閱/官方資料授權/Obsidian vault path）。

## 目前外部前置與停止條件

- GitHub 公開空倉庫已核實，推送程式碼與非敏感文件已由使用者明確授權；不可推 CSV/資料庫匯出/憑證。
- 官方 dataset 授權與更新規則本輪無法確認，故不做雲端資料庫匯入或宣稱當前。
- Azure 訂閱、成本上限及 resource group 尚未提供；不建立可能計費資源。
- SSMS 正在 Parallels 中執行，但本輪無法確認連線驗證模式。若沒有 SQL Authentication 專用唯讀帳號，保留 UI/API mock 測試通過，但不更動 VM 安全設定。
- 找不到 Obsidian vault 設定。完成可執行本機軟體與 Git 推送後，筆記同步需等待使用者提供 vault 絕對路徑；不得猜測位置或把私有筆記上傳公開倉庫。
