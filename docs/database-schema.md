# 資料庫大綱（資料表與欄位）

本文件依目前資料庫 migrations 整理，只列資料表、欄位與欄位型別，不含任何資料列。現行 schema 由 Neon PostgreSQL 使用；以下 PostgreSQL 型別是目前定義，不代表可直接匯入 SQL Server Express。若要轉入 SQL Server，需另做型別與 SQL 語法對應。

## 匯入批次紀錄

### `source_imports` — 資料來源匯入紀錄

`dataset_key` text · `source_url` text · `retrieved_at` timestamptz · `source_sha256` text · `row_count` integer · `batch_id` uuid

### `medicine_usage_imports` — 藥品使用量匯入紀錄

`fee_year` smallint · `source_url` text · `retrieved_at` timestamptz · `source_sha256` text · `row_count` integer · `reporting_period_start` text · `reporting_period_end` text · `batch_id` uuid

## 藥局

### `pharmacy_registry_fda` — FDA 藥局登記資料

`institution_name` text · `institution_status` text · `city` text · `district` text · `street_address` text · `phone` text · `is_nhi_contracted` boolean · `source_updated_at` timestamptz

### `pharmacy_contracts` — 健保特約藥局

`institution_code` text · `institution_name` text · `institution_type` text · `phone` text · `address` text · `service_area` text · `contract_type` text · `services` text · `opening_hours` text · `termination_date` date · `contract_start_date` date · `source_updated_at` timestamptz · `latitude` double precision · `longitude` double precision · `geocoded_at` timestamptz · `geocode_provider` text

### `pharmacy_coordinate_candidates` — 藥局候選座標

`institution_code` text · `candidate_index` integer · `response_address` text · `latitude` double precision · `longitude` double precision · `geocoded_at` timestamptz

## 藥品

### `medicines` — FDA 藥品許可證

`license_number` text · `cancellation_status` text · `cancellation_date` date · `cancellation_reason` text · `valid_until` date · `name` text · `english_name` text · `indications` text · `dosage_form` text · `applicant_name` text · `usage_dosage` text · `source_updated_at` timestamptz

### `medicine_ingredients` — FDA 藥品處方成分

`license_number` text · `component_index` integer · `prescription_label` text · `ingredient_name` text · `ingredient_code` text · `content_description` text · `content_value` text · `content_unit` text · `source_updated_at` timestamptz

### `medicine_safety_communications` — FDA 安全風險溝通公告

`message_id` text · `publication_date` date · `ingredient` text · `scope_text` text · `indications` text · `mechanism` text · `reason` text · `safety_analysis` text · `tfda_communication` text · `link_method` text · `source_url` text · `retrieved_at` timestamptz · `source_updated_at` timestamptz

### `medicine_safety_license_links` — 安全公告與許可證精確關聯

`message_id` text · `license_number` text · `link_method` text · `evidence` text

### `nhi_medicine_catalog` — 健保藥品目錄

`drug_code` text · `name` text · `english_name` text · `ingredient` text · `dosage_form` text · `fda_license_id` text · `source_updated_at` timestamptz

### `medicine_usage` — 藥品申報使用量

`fee_year` smallint · `drug_code` text · `reporting_period_start` text · `reporting_period_end` text · `claim_quantity` numeric(16,1) · `package_claim_quantity` numeric(16,1) · `source_updated_at` timestamptz

### `medicine_appearances` — 藥品外觀資料

`license_number` text · `shape` text · `color` text · `imprint` text · `image_url` text · `source_updated_at` timestamptz

### `medicine_symptoms` — 可追溯的症狀搜尋詞

`license_number` text · `symptom` text · `source_kind` text · `source_text` text · `source_url` text · `source_updated_at` timestamptz

### `medicine_prices` — 健保支付價

`drug_code` text · `license_number` text nullable · `drug_name` text · `specification` text · `price` numeric · `currency` text · `price_type` text · `effective_from` date · `effective_until` date nullable · `change_status` text · `source_url` text · `source_sha256` text · `source_updated_at` timestamptz

價格以健保藥品代號為主要識別；只有正式核實的完整 TFDA 許可證對照才填入 `license_number`。查詢只取臺灣當日有效、正值且沒有異動的資料。

## Schema 定義來源

- `db/migrations/001_catalog.sql`
- `db/migrations/002_medicine_usage.sql`
- `db/migrations/003_pharmacy_opening_hours.sql`
- `db/migrations/004_pharmacy_coordinate_candidates.sql`
- `db/migrations/005_medicine_information.sql`
- `db/migrations/006_medicine_public_search.sql`
- `db/migrations/007_medicine_prices.sql`

官方文件：[PostgreSQL 18 — Table Basics](https://www.postgresql.org/docs/current/ddl-basics.html)。
