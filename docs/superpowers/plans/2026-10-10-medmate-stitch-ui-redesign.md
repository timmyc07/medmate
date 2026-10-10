# MediMate Stitch UI 全站重設計實作計劃

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 依六張 Stitch MediMate 範本重新建立全站響應式介面，同時保留所有現有資料與查詢功能。

**Architecture:** 保留 Next.js App Router、API 與資料元件，重建共用導覽、首頁快搜、路由版面及全部全域樣式。藥局頁以響應式 Grid 改變地圖/清單順序，首頁快搜以 URL query 將搜尋交給既有 API 元件。

**Tech Stack:** Next.js 16.4.0 App Router、React 19、TypeScript、全域 CSS、Vitest、Testing Library。

**Spec:** `docs/superpowers/specs/2026-10-10-medmate-stitch-ui-redesign.md`

## 全域限制

- 使用繁體中文；API 與資料庫查詢契約維持不變。
- 使用 `#f9faf7`、`#ffffff`、`#006c4b`、`#34d399`、Plus Jakarta Sans、Nunito Sans，遵守 8px 間距與膠囊控制項規格。
- 不加入範本的示意統計、假資料、未連資料的篩選或不存在的產品功能。
- 主要控制至少 48px，支援 320px 起的 viewport 與 prefers-reduced-motion。

---

## 檔案責任圖

- `src/app/globals.css`：完整設計 token、元件樣式、路由版面、響應式與暗色主題；刪除疊加在舊基礎上的規則。
- `src/app/page.tsx`：首頁主視覺、快搜、資料來源與提醒。
- `src/app/pharmacies/page.tsx`、`src/app/medicines/page.tsx`：兩個目錄頁面的範本順序與真實資料期間。
- `src/components/PageHeader.tsx`：三個路由共用的桌面頁首和手機底部導覽。
- `src/components/QuickSearch.tsx`：首頁雙類別搜尋，將查詢交給既有目錄 API。
- `src/components/SearchPanel.tsx`：保留搜尋資料流程，讀取首頁帶入的初始 query，調整結果 DOM 讓藥局地圖能依 viewport 重排。
- `src/components/MedicineUsageCatalog.tsx`、`src/components/ResultCard.tsx`、`src/components/PharmacyMap.tsx`：調整卡片資訊階層與狀態，不更動來源/API 契約。
- `src/components/SiteFooter.tsx`：跨頁資料來源、授權與醫療提醒。
- `tests/components/quick-search.test.tsx`、`tests/components/search-panel.test.tsx`、`tests/components/page-header.test.tsx`：快搜路由、query 預填、導航與既有搜尋功能。
- `README.md` 與 Obsidian 網站維運日誌：記錄最終版設計、功能邊界及驗證結果。

## 任務

### Task 1：建立共用導覽和首頁快搜

1. 為 `QuickSearch` 加入元件測試，確認切換藥局/藥品、輸入關鍵字後推送正確路由與編碼 query。
2. 建立 `QuickSearch` client component，藥品模式要求關鍵字，藥局模式允許空關鍵字。
3. 將 `PageHeader` 擴為首頁/藥局/藥品三種 active path，加入桌面首頁/藥局/藥品/資料來源導覽、快搜錨點、主題切換與手機底部三項導覽。
4. 更新導覽測試，驗證 active 狀態及三條目錄連結。

### Task 2：重建首頁與兩個目錄頁

1. 首頁排入主標、藥局/藥品 CTA、快搜區、來源資料卡、授權與健康提醒。
2. 藥局與藥品頁以 Next.js 16 async `searchParams` 讀取 `q`，傳給 `SearchPanel`；藥品頁以範本順序展示查詢與使用量目錄。
3. 更新 `SearchPanel`：初始 query 自動送既有 API；藥局結果 DOM 改為 summary/list/pagination 欄與地圖欄，保留原 API query 和分頁。
4. 更新 `MedicineUsageCatalog` 與結果卡的資料標籤、卡片階層及圖片替代文字；所有值均來自 API。

### Task 3：全量取代舊視覺系統

1. 將 `globals.css` 改為從 token 開始的單一樣式表，涵蓋頁首、首頁、表單、狀態、地圖、藥局卡、藥品卡、分頁、來源資料卡與頁尾。
2. 加入桌面/平板/手機版配置：桌面藥局清單/地圖雙欄，手機地圖在清單前；藥品桌面三欄、手機單欄；固定手機導覽預留底部安全區。
3. 以相同 Warm Mint tokens 重做暗色主題及 reduced-motion 行為，確認焦點/hover/disabled 狀態清楚。

### Task 4：驗證、文件與提交

1. 執行 lint、typecheck、完整測試與 production build，修正所有由重做引入的問題。
2. 啟動 production/dev 預覽，檢查首頁、藥局、藥品於桌面與 390px viewport 的版面和查詢流程。
3. 更新 README 與既有 Obsidian UI 改造筆記的最終架構、功能保留和驗證結果。
4. 執行三輪獨立審查、`git diff --check`、敏感資料/變更檔案檢查；使用 Conventional Commit 提交並推送 `main`。
