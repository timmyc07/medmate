# MediMate 實體關聯圖（ERD）

## Chen 表示法圖檔

依附件範例的 Chen ERD 符號製作：

[開啟 Chen ERD 圖檔](./entity-relationship-diagram-chen.svg)

圖中矩形代表實體、橢圓代表屬性、菱形代表關聯；主鍵以底線標示，正式外鍵以實線表示，程式邏輯 JOIN 以虛線表示。

以下 ERD 依 `db/migrations/001_catalog.sql` 至 `005_medicine_information.sql` 繪製。

- 實線關聯：資料庫 migration 明確定義的外鍵。
- 虛線關聯：目前程式以識別碼進行邏輯 JOIN，但 migration 未宣告外鍵。
- `source_imports` 與 `medicine_usage_imports` 是匯入批次紀錄，沒有直接連到業務資料表的外鍵。

```mermaid
erDiagram
    source_imports {
        string dataset_key PK
        string source_url
        datetime retrieved_at
        string source_sha256
        int row_count
        uuid batch_id
    }

    medicine_usage_imports {
        smallint fee_year PK
        string source_url
        datetime retrieved_at
        string source_sha256
        int row_count
        string reporting_period_start
        string reporting_period_end
        uuid batch_id
    }

    pharmacy_registry_fda {
        string institution_name PK
        string city PK
        string district PK
        string street_address PK
        string institution_status
        string phone
        boolean is_nhi_contracted
        datetime source_updated_at
    }

    pharmacy_contracts {
        string institution_code PK
        string institution_name
        string institution_type
        string phone
        string address
        string service_area
        string contract_type
        string services
        string opening_hours
        date termination_date
        date contract_start_date
        datetime source_updated_at
        float latitude
        float longitude
        datetime geocoded_at
        string geocode_provider
    }

    pharmacy_coordinate_candidates {
        string institution_code PK, FK
        int candidate_index PK
        string response_address
        float latitude
        float longitude
        datetime geocoded_at
    }

    medicines {
        string license_number PK
        string cancellation_status
        date cancellation_date
        string cancellation_reason
        date valid_until
        string name
        string english_name
        string indications
        string dosage_form
        string applicant_name
        string usage_dosage
        datetime source_updated_at
    }

    medicine_ingredients {
        string license_number PK, FK
        int component_index PK
        string prescription_label
        string ingredient_name
        string ingredient_code
        string content_description
        string content_value
        string content_unit
        datetime source_updated_at
    }

    medicine_safety_communications {
        string message_id PK
        date publication_date
        string ingredient
        string scope_text
        string indications
        string mechanism
        string reason
        string safety_analysis
        string tfda_communication
        string link_method
        string source_url
        datetime retrieved_at
        datetime source_updated_at
    }

    medicine_safety_license_links {
        string message_id PK, FK
        string license_number PK, FK
        string link_method
        string evidence
    }

    nhi_medicine_catalog {
        string drug_code PK
        string name
        string english_name
        string ingredient
        string dosage_form
        string fda_license_id
        datetime source_updated_at
    }

    medicine_usage {
        smallint fee_year PK
        string drug_code PK, FK
        string reporting_period_start
        string reporting_period_end
        decimal claim_quantity
        decimal package_claim_quantity
        datetime source_updated_at
    }

    medicine_appearances {
        string license_number PK
        string shape
        string color
        string imprint
        string image_url
        datetime source_updated_at
    }

    pharmacy_contracts ||--o{ pharmacy_coordinate_candidates : "institution_code"
    medicines ||--o{ medicine_ingredients : "license_number"
    medicine_safety_communications ||--o{ medicine_safety_license_links : "message_id"
    medicines ||--o{ medicine_safety_license_links : "license_number"
    nhi_medicine_catalog ||--o{ medicine_usage : "drug_code"

    nhi_medicine_catalog }o..o| medicines : "fda_license_id -> license_number"
    medicines ||..o| medicine_appearances : "license_number"
```

## 關聯說明

| 關聯 | 類型 | 說明 |
|---|---|---|
| `pharmacy_contracts` → `pharmacy_coordinate_candidates` | 一對多，正式 FK | 一間藥局可有多個 TGOS 候選座標。 |
| `medicines` → `medicine_ingredients` | 一對多，正式 FK | 一張藥品許可證可有多筆處方成分。 |
| `medicine_safety_communications` → `medicine_safety_license_links` | 一對多，正式 FK | 一則安全公告可精確關聯多張許可證。 |
| `medicines` → `medicine_safety_license_links` | 一對多，正式 FK | 一張許可證可對應多則安全公告。 |
| `nhi_medicine_catalog` → `medicine_usage` | 一對多，正式 FK | 一個健保藥品代碼可有多個費用年度使用量。 |
| `nhi_medicine_catalog` → `medicines` | 邏輯關聯 | 透過 `fda_license_id = license_number`，目前未宣告 FK。 |
| `medicines` → `medicine_appearances` | 邏輯關聯 | 透過 `license_number` JOIN；目前 migration 未宣告 FK。 |

