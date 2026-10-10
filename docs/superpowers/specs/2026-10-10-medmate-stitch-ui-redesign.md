# MediMate Stitch UI 全站重設計規格

**目標：** 將 MediMate 首頁、藥局查詢與藥品目錄重新編排，依 `stitch_medmate_design_system` 六張畫面與 Warm Mint Health token 建立完整一致的桌面及手機介面，同時保留既有 API、資料庫查詢、定位、地圖、營業時間和分頁行為。

## 視覺規格

- 畫布使用 Rice Milk `#f9faf7`，白色內容面，森林綠 `#006c4b` 作主要操作與導覽選取色，亮薄荷 `#34d399` 作狀態/選取點，暖黃只用於資料限制提醒。
- 標題與控制標籤使用 Plus Jakarta Sans；內文使用 Nunito Sans，繁體中文以系統中文字型 fallback 顯示。
- 以 8px 間距節奏、最大 1280px 內容寬度、膠囊形控制項、24–32px 卡片圓角、低對比邊界與柔和綠灰陰影建立層級。
- 桌面使用品牌、主要導覽、快搜入口與主題切換的橫向頁首；手機使用緊湊頁首與固定底部三項導覽，並保留安全區空間。
- 所有主要觸控控制至少 48px 高，內容以 CSS Grid/Flex 彈性排列，不以固定 viewport 尺寸限制內容。

## 路由版面

- 首頁：中央品牌主標與雙 CTA、真實可用的藥局/藥品快搜、分組公開資料來源卡、授權與健康提醒、多欄頁尾。手機時控制項改為垂直排列、資料來源改為單欄。
- `/pharmacies`：資料來源狀態列、標題、關鍵字/縣市/區域/定位表單、查詢狀態、藥局卡片和 Google 地圖。桌面結果採左清單右地圖；手機先顯示地圖再顯示清單。
- `/medicines`：藥品目錄標題與真實資料期間、藥品名稱/許可證查詢、政府使用量目錄卡片與頁碼、來源與使用限制。桌面目錄使用三欄卡片；手機使用單欄卡片。

## 行為與內容限制

- 保留既有 `/api/pharmacies`、`/api/medicines`、`/api/medicines/usage`、`/api/geocode`、`/api/maps-config` 與既有資料查詢和錯誤/空結果狀態。
- 首頁快搜使用既有藥局或藥品查詢 API，透過路由 query 傳遞使用者輸入，由對應搜尋面板送出查詢。
- 範本中的藥局/藥品數量、同步率、評分評論、即時營業、熱門店家、外觀篩選、帳號、收藏、通知、預約和健康手冊都是示意，不可當成產品資料或新增未接資料的控制項。
- 暗色主題切換、無障礙標籤、鍵盤焦點樣式、資料來源與醫療免責說明仍須保留。

## 驗收條件

- 首頁、藥局、藥品路由皆使用同一套暖白/森林綠 UI 元件與導覽。
- 桌面與 390px 手機版的首頁、藥局和藥品頁均無水平溢位、文字遮擋或導覽覆蓋主要內容。
- 快搜、縣市/區域選擇、定位、地圖狀態、藥品與藥局搜尋、空/錯誤/loading 狀態、營業時間表與分頁均保持可用。
- `npm run lint`、`npm run typecheck`、`npm test -- --run`、`npm run build` 及 `git diff --check` 通過。

## 設計來源

- `/Users/reikous/Downloads/stitch_medmate_design_system/warm_mint_health/DESIGN.md`
- `/Users/reikous/Downloads/stitch_medmate_design_system/medmate_1/screen.png` 至 `medmate_6/screen.png`
- Next.js 16.4.0 本機官方文件：`node_modules/next/dist/docs/01-app/01-getting-started/11-css.md`、`13-fonts.md`、`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md`
