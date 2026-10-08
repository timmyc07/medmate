# 資料來源、匯入與發布規則

查證與匯入日期：2026-10-08。正式來源為政府發布的三份 CSV；不是從 Parallels SQL Server 直接 dump。Mac 端目前無法連到 VM 的 SQL Server listener，因此網站資料採已核對的 CSV 來源。使用者下載資料夾中的三個支援檔案 hash 與先前測試 branch 匯入版本相同，已載入 production。

## 官方來源與驗證

三份附件當天均與官方直接下載資源逐位元組比對一致，正式匯入時亦重新從官方 URL 下載並核對 SHA-256。來源頁標示政府資料開放授權條款第 1 版；展示時保留資料來源和查詢日期。來源更新頻率依官方頁列示。

| 來源 | 發布機關 / 更新頻率 | 欄位與發布條件 | 匯入筆數 | SHA-256 |
|---|---|---|---:|---|
| [藥局基本資料](https://data.gov.tw/dataset/6134) · [CSV](https://data.fda.gov.tw/data/opendata/export/35/csv) | 食品藥物管理署 / 不定期 | 保留機構狀態、名稱、縣市、行政區、地址、電話、健保特約旗標；排除負責人姓名與性別。此來源只作來源副本，不和健保來源做模糊比對合併。 | 9,155 | `888ea2cbcac55f064ae68232f52025326c9d2cffbccc65fbb115c03acf65f9d0` |
| [全部藥品許可證資料集](https://data.gov.tw/dataset/9122) · [CSV ZIP](https://data.fda.gov.tw/data/opendata/export/36/csv) | 食品藥物管理署 / 每 7 日 | 保留許可證字號、註銷狀態/日期/理由、有效日期、中英文品名、適應症、劑型、申請商名稱、異動日；查詢只顯示註銷狀態空白且有效日期不早於臺灣當日的資料。來源沒有副作用欄位。 | 72,074 原始列、66,510 個唯一許可證字號 | `18543b08faa9286ab82c23b38951887151f979007adf07644f0bf7a3fc7decf9` |
| [健保特約醫事機構－藥局](https://data.gov.tw/dataset/39284) · [CSV](https://info.nhi.gov.tw/api/iode0000s01/Dataset?rId=A21030000I-D21005-001) | 中央健康保險署 / 每日 | 保留機構代碼、名稱、機構種類、電話、地址、業務組、特約類別、服務項目、終止/歇業日期及合約起日。查詢只顯示終止/歇業日空白或不早於臺灣當日的紀錄。 | 10,187 | `b0e68d8ea6df6223b27fabeb9a02819159f05cf4c94cbe1165a243729e59346d` |

SHA-256 對應下載日期 2026-10-08 的官方檔案。FDA 藥品 CSV 是 ZIP 封裝；上述 hash 是 ZIP 解出的 CSV hash。FDA 藥局資料有兩組重複機構欄位，匯入器以名稱和地址組合鍵去重，故實際保存 9,153 列；藥品同一許可證號的重複列以許可證號去重，逐筆檢查重複項的公開欄位相同，保存 66,510 列。CSV 原始列數與 hash 均存入 `source_imports`。匯入器不讀入 FDA 藥局負責人欄位，也不建立對應資料庫欄位。

## 更新與回復

執行 `npm run db:migrate` 套用 `db/migrations/001_catalog.sql`；執行匯入前，將三份官方下載 CSV 解壓/命名為 `35_2.csv`、`36_2.csv`、`A21030000I-D21005-001.csv` 放在同一個本機資料夾，再以 `DATABASE_URL_UNPOOLED=<direct Neon URL> npm run db:import -- <資料夾>` 執行。direct URL 只供人工觸發的 migration/import 使用，不設於 Render。匯入器以單一交易整批刪除並重建三張目錄表；既有藥局座標會按醫事機構代碼暫存並在匯入後恢復。任何來源驗證或資料庫錯誤都會 rollback，批次 metadata 只在交易提交時更新。匯入前須確認三個來源檔齊全並完成來源 hash/schema 檢查；不要把 CSV 放進 repo、Render 檔案系統或瀏覽器。

2026-10-08 更新使用 `/Users/reikous/Downloads/藥品資料庫` 中的 `35_2.csv`、`36_2.csv`、`A21030000I-D21005-001.csv` 完成匯入。該目錄的 `37_2.csv`、`42_2.csv`、`A21030000I-E41001-001.csv` 及健保藥品 B5/TXT 檔屬於其他資料集，尚未對應目前的資料庫 schema/API；新增前須各自查核官方欄位、使用條款與識別碼，設計獨立資料表及搜尋介面，不能混入藥品許可證資料表。

資料表採公開欄位白名單及 `ON CONFLICT` 去重。上線前先使用 Neon 測試 branch；正式 branch 若需回復，從 Neon branch/restore 保留點復原，並重新部署相符的網站版本。不要直接刪除 production schema。

## 使用限制

- 查詢是一般公開資訊，不提供診斷或治療建議；用藥疑問請諮詢藥師或醫療人員。
- 目前搜尋使用健保特約藥局來源；FDA 藥局 registry 獨立保留，不做模糊比對合併。
- 網站呈現資料擷取批次日期，官方資料集更動後應重新下載、比對 schema/hash、匯入並驗證筆數。
- 目前藥局來源只有地址文字，沒有可直接繪圖的座標欄位；座標欄位在 schema 中保留為 nullable。不得以 Nominatim 公共服務對全量地址做系統化批次查詢，需改用經核准的政府或商用座標來源。
- 開放授權來源：[政府資料開放授權條款第 1 版](https://data.gov.tw/license)。
