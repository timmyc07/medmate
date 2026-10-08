# 已由新設計取代：MediMate 首版實作計劃

> 本文件為歷史提案，僅供參考；其中 Vanilla JavaScript、FastAPI、字串改寫、使用者帳號、個人藥箱及查詢歷史等內容不屬於目前核准的首版範圍，也不得據此實作。現行範圍與架構請見[設計文件](superpowers/specs/2026-10-08-medmate-public-web-design.md)及[實作計劃](superpowers/plans/2026-10-08-medmate-public-web.md)。

---

以下保留原始提案內容供歷史參考。

## 原始提案（已取代）

## 1. 專案概述
本專案旨在開發一款無需依賴外部 LLM，純粹利用「資料庫關聯查詢」與「字串樣板替換」技術，來實現「附近藥局查詢」與「醫學術語白話文翻譯」的網頁應用程式。

*   **目標受眾**：需要尋找營業藥局及查詢藥品白話說明的民眾。
*   **技術棧 (Tech Stack)**：
    *   **前端**：HTML5, Vanilla JavaScript, CSS3 (可選用 Bootstrap 或 Tailwind CSS 快速排版)
    *   **後端**：Python 3.9+ (使用 FastAPI 框架)
    *   **資料庫**：MS SQL Server Express (使用 `pyodbc` 或 `SQLAlchemy` 進行連線)[cite: 8]
    *   **資料來源**：政府開放資料庫 (CSV/JSON 匯入)

## 2. 資料庫設計 (Database Schema)
資料庫需建立於 MS SQL Server Express 環境下，包含以下五張資料表[cite: 8]：

### 2.1 Pharmacies (藥局主檔)
| 欄位名稱 | 型別 | 屬性 | 說明 |
| :--- | :--- | :--- | :--- |
| `pharmacy_id` | VARCHAR(20) | PK | 醫事機構代碼 |
| `name` | NVARCHAR(50) | | 藥局名稱 |
| `address` | NVARCHAR(100) | | 實體地址 |
| `phone` | VARCHAR(20) | | 聯絡電話 |
| `open_hours` | NVARCHAR(200) | | 營業時段說明 |

### 2.2 Medicines (藥品主檔)
| 欄位名稱 | 型別 | 屬性 | 說明 |
| :--- | :--- | :--- | :--- |
| `med_id` | VARCHAR(20) | PK | 藥品許可證字號 |
| `med_name` | NVARCHAR(100) | | 藥品名稱 |
| `indications` | NVARCHAR(MAX) | | 官方適應症 (如：緩解發炎反應) |
| `side_effects`| NVARCHAR(MAX) | | 官方副作用與警語 |

### 2.3 JargonDictionary (醫學術語白話文字典表)
| 欄位名稱 | 型別 | 屬性 | 說明 |
| :--- | :--- | :--- | :--- |
| `keyword_id` | INT | PK, IDENTITY | 字典流水號 (自動遞增) |
| `medical_term`| NVARCHAR(50) | | 官方醫學術語 (如：發炎反應) |
| `layman_term` | NVARCHAR(50) | | 白話文 (如：發炎) |

### 2.4 Users (使用者表)
| 欄位名稱 | 型別 | 屬性 | 說明 |
| :--- | :--- | :--- | :--- |
| `user_id` | INT | PK, IDENTITY | 系統流水號 |
| `username` | NVARCHAR(50) | | 使用者名稱/帳號 |

### 2.5 UserMedRecords (個人查詢紀錄表)
| 欄位名稱 | 型別 | 屬性 | 說明 |
| :--- | :--- | :--- | :--- |
| `record_id` | INT | PK, IDENTITY | 紀錄流水號 |
| `user_id` | INT | FK | 關聯至 Users 表 |
| `med_name` | NVARCHAR(100) | | 查詢的藥品名稱 |
| `created_at` | DATETIME | DEFAULT GETDATE() | 查詢時間 |

## 3. 系統後端 API 端點規劃 (FastAPI Routes)

請實作以下 RESTful API：

1.  **`GET /api/pharmacies`**
    *   **功能**：回傳所有藥局清單（可加入 `limit` 或 `keyword` 參數實作簡單搜尋）。
    *   **對應 DB**：`SELECT * FROM Pharmacies`
2.  **`GET /api/medicines/{keyword}`**
    *   **功能**：查詢特定藥物，並**在後端執行字典替換邏輯**，回傳白話文版本的結果。
    *   **處理邏輯**：
        1. 針對 `Medicines` 表進行 `LIKE '%keyword%'` 查詢取得 `indications` 與 `side_effects`。
        2. 撈取 `JargonDictionary` 所有紀錄。
        3. 透過 Python 的字串 `.replace()`，將官方說明的 `medical_term` 替換為 `layman_term`。
        4. 回傳處理後的 JSON。
3.  **`POST /api/records`**
    *   **功能**：新增一筆查詢紀錄。
    *   **Request Body**：`{"user_id": 1, "med_name": "普拿疼"}`
    *   **對應 DB**：`INSERT INTO UserMedRecords`
4.  **`GET /api/records/{user_id}`**
    *   **功能**：獲取特定使用者的歷史查詢紀錄。

## 4. 前端 UI 實作需求
*   **首頁**：提供兩個主要入口「尋找附近藥局」與「藥品白話文翻譯」。
*   **藥局查詢頁**：
    *   設計一個搜尋框。
    *   利用卡片 (Card) 列表呈現 API 回傳的藥局資訊。
    *   在卡片上實作「撥打電話」(`<a href="tel:...">`) 功能。
*   **藥品查詢與紀錄頁**：
    *   輸入藥品名稱後呼叫 API，顯示轉換後的「白話文用途與注意事項」。
    *   提供按鈕「加入我的藥箱」，點擊後呼叫 POST API 寫入資料庫。
    *   在下方列表顯示該使用者的歷史查詢紀錄。

## 5. 給 AI (Codex) 的開發執行步驟

請依照以下順序協助我撰寫程式碼：
1.  **Step 1 (資料庫設定)**：生成建立上述五張 MS SQL 資料表的 SQL 腳本 (`schema.sql`)，包含 PK/FK 關聯。
2.  **Step 2 (後端框架設定)**：建立 `main.py`，配置 FastAPI 基礎環境，並設定 CORS 以允許前端呼叫。
3.  **Step 3 (資料庫連線)**：撰寫連接 MS SQL Server Express 的 Python 程式碼，推薦使用 SQLAlchemy 來建立 ORM 模型。
4.  **Step 4 (API 實作)**：逐一實作「API 端點規劃」段落中的 4 支 API。
5.  **Step 5 (前端實作)**：生成一個單頁應用 `index.html` (包含 CSS 與 JS)，使用 fetch API 串接後端端點並渲染畫面。
