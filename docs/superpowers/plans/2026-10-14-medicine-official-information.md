# 藥品官方資訊 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 將 TFDA 藥品用法用量、詳細成分與安全風險溝通資料以精確許可證關聯套用到網站。

**Architecture:** 使用可重跑的 migration 及獨立交易匯入器，保存一對多成分與原始公告；藥證搜尋 API 以許可證字號聚合官方資訊，UI 以展開內容呈現。任何未能精確配對的安全公告維持獨立公告紀錄。

**Tech Stack:** Next.js 16 App Router、TypeScript、PostgreSQL、Node.js、csv-parse、Vitest。

**Spec:** `docs/superpowers/specs/2026-10-14-medicine-official-information-design.md`

## Global Constraints

- CSV 僅在完整欄位白名單與 UTF-8 BOM-aware 解析後匯入。
- 許可證關聯只使用完整許可證字號。
- 不推測或自動生成副作用、禁忌、交互作用或用藥建議。
- 原始 CSV 保持在 repo 外，匯入須完整 rollback。

---

### Task 1: Schema 與 CSV 匯入

**Files:** `db/migrations/005_medicine_information.sql`, `scripts/migrate.mjs`, `scripts/import-medicine-information.mjs`, `scripts/import-csv.mjs`, `package.json`, `tests/lib/import-normalization.test.ts`

- [x] 測試成分多列保存、完整重複去除、公告日期及精確字號抽取（含號字前空白）。
- [x] 新增 usage 欄位、成分表、安全公告與精確關聯表。
- [x] 建立原子 transaction 匯入命令及 source_imports metadata。
- [x] 測試成分參照驗證、公告穩定 ID 與重跑後資料筆數一致。

### Task 2: API 與藥品頁呈現

**Files:** `src/types/catalog.ts`, `src/lib/db/medicines.ts`, `src/components/ResultCard.tsx`, relevant API and component tests.

- [x] 為搜尋 DTO 增加用法、成分及安全公告欄位。
- [x] 用參數化查詢和 JSON aggregation 保留每張證一列。
- [x] 將詳細原文放在可展開區，標示來源及公告日期，對空欄標示來源未提供。
- [x] 測試公告只透過精確許可證關聯顯示，避免卡片重複；排行卡不使用未核實健保藥證對照。

### Task 3: 文件、驗證與發布

**Files:** `docs/data-sources.md`, `docs/database-schema.md`, `docs/operations.md`, Obsidian maintenance log.

- [x] 記錄 TFDA dataset、授權、欄位、hash、筆數、coverage 與精確配對限制。
- [x] 在隔離 Neon branch 執行 migration/import，核對來源 hash、記錄數及參照完整性。
- [x] 在 production 套用 migration/import，唯讀核對資料與參照完整性。
- [x] 執行 `npm test -- --run`、`npm run typecheck`、`npm run lint`、`npm run build`、`git diff --check`。
- [x] 驗證後 commit/push，並依部署設定檢查應用狀態。
