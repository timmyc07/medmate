# 健保藥品支付價 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 將健保署藥品有效支付價匯入資料庫，並在精確對應的藥品卡片上以淺白文字顯示。

**Architecture:** 以健保藥品代碼和有效區間保存歷史價格，使用官方 CSV 連結內的完整 licId 對應許可證。搜尋 API 只查台灣當日有效、正值價格；卡片標示健保支付基準而非零售價格。

**Tech Stack:** Next.js 16.4、PostgreSQL/Neon、Node.js、csv-parse、Vitest、pg。

**Spec:** `docs/superpowers/specs/2026-10-15-nhi-medicine-prices-design.md`

## Global Constraints

- 僅使用健保署官方 `A21030000I-E41001-001` CSV 支付價與效期。
- 許可證關聯只使用官方完整 licId，不得名稱或尾碼猜測。
- 0 點不顯示為免費；健保支付價不得標示為藥局售價。
- 匯入使用單一交易；原始 CSV 不進版控。
- 正式匯入前先在 Neon 隔離 branch 驗證。

---

### Task 1: Schema、migration runner 與價格匯入

**Files:** Create `db/migrations/007_medicine_prices.sql`, Modify `scripts/migrate.mjs`, Create `scripts/import-medicine-prices.mjs`, Modify `package.json`, Test `tests/lib/medicine-prices.test.ts`.

- [ ] 測試民國日期 `1150101 → 2026-01-01`、`9991231 → 無限迄日`、零價不作顯示價格、有效區間與 ROC 無效日期。
- [ ] 建版本資料表，保存 drug_code、license_number nullable、drug_name、specification、price、effective_from/to、source URL/hash/time，唯一鍵 `(drug_code,effective_from,price_type)`。
- [ ] migration runner 明確依序執行 migrations 001–007，避免略過既有 006。
- [ ] 建立白名單 CSV 解析、URL `licId` 精確驗證、metadata 記錄與單交易 upsert/import。
- [ ] 測試相同代碼/日期可冪等重匯，歷史價格保留，欄位不符及壞資料拒絕。

### Task 2: API 與卡片呈現

**Files:** Modify `src/types/catalog.ts`, `src/lib/db/medicines.ts`, `src/components/ResultCard.tsx`, `tests/lib/catalog-repositories.test.ts`, `tests/components/medicine-official-information.test.tsx`.

- [ ] SQL 對完整 license_number 精確 JOIN，依台灣當日有效日期找每一 drug_code 最新價格；一證多代碼以 JSON 聚合保留規格。
- [ ] DTO 回傳金額、健保點數單位、規格、有效起日及官方來源 URL。
- [ ] 卡片顯示「健保支付價參考：…點」，加上「健保核定支付基準，不是一般藥局自費售價」及效期/來源連結；沒有正價不展示金額。
- [ ] 驗證查詢 SQL、API DTO、卡片多價格/無價格的實際文字。

### Task 3: 文件與舊關聯修正

**Files:** Modify `scripts/import-csv.mjs`, `docs/data-sources.md`, `docs/operations.md`, `docs/database-schema.md`, `src/components/SiteFooter.tsx`, Obsidian 專案筆記。

- [ ] 移除以通關簽審編號尾碼猜測 FDA 藥證的程式，不再寫入未核實 `fda_license_id`。
- [ ] 記錄來源 URL、價格意義、匯入步驟、schema、branch 驗證與正式匯入流程。
- [ ] 頁尾新增健保藥品支付價查詢來源連結。
- [ ] 更新 Obsidian 專案筆記。

### Task 4: 驗證及發布

- [ ] 跑匯入器 dry-run：確認欄位、SHA-256、列數、效期分布及 licId 對應統計。
- [ ] 在隔離 Neon branch 套 migration/import，確認重匯冪等、價格/API 樣本精確且異動/零價列不誤顯示。
- [ ] 執行 `npm test -- --run`、`npm run typecheck`、`npm run lint`、`npm run build`。
- [ ] production 套 migration/import，驗證 `/api/ready` 與藥品搜尋 API，再 commit/push 並核對 Render 部署版本。
