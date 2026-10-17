import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { firefox, webkit } from "playwright";

const args = process.argv.slice(2).filter((argument) => argument !== "--headed");
const baseUrl = args[0] || "http://127.0.0.1:3000";
const screenshotDirectory = args[1];
const headed = process.argv.includes("--headed");
const pharmacyPath = "/pharmacies";
if (screenshotDirectory) await mkdir(screenshotDirectory, { recursive: true });

async function checkLayout(page) {
  const metrics = await page.evaluate(() => {
    const root = document.documentElement;
    const submit = document.querySelector(".search-button")?.getBoundingClientRect();
    const input = document.querySelector(".search-field input")?.getBoundingClientRect();
    const nav = document.querySelector(".site-nav")?.getBoundingClientRect();
    return {
      width: root.clientWidth, scrollWidth: root.scrollWidth,
      searchFits: !submit || (submit.width >= 44 && input.width >= 100 && (input.right <= submit.left || submit.top >= input.bottom) && submit.right <= root.clientWidth),
      mobileNavFits: root.clientWidth > 767 || (nav.bottom <= innerHeight + 1 && nav.top >= innerHeight - 110),
    };
  });
  assert(metrics.scrollWidth <= metrics.width + 1, `橫向溢出：${JSON.stringify(metrics)}`);
  assert(metrics.searchFits, `搜尋欄寬失常：${JSON.stringify(metrics)}`);
  assert(metrics.mobileNavFits, "手機底部導覽偏離視窗");
}

async function search(page, keyword) {
  await page.locator(".search-field input").fill(keyword);
  const response = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname === "/api/medicines" && url.searchParams.get("q") === keyword;
  });
  await page.getByRole("button", { name: "搜尋", exact: true }).click();
  const result = await response;
  assert.equal(result.status(), 200);
  assert((await result.json()).total > 0, `${keyword} 無搜尋結果`);
  await page.waitForFunction(() => document.querySelector(".search-button")?.disabled === false);
  await page.locator(".result-row--medicine").first().waitFor();
}

async function findPharmacies(page) {
  await page.getByRole("combobox", { name: "縣市", exact: true }).selectOption("臺北市");
  await page.getByRole("combobox", { name: "區域", exact: true }).selectOption("中正區");
  const [response] = await Promise.all([
    page.waitForResponse((response) => new URL(response.url()).pathname === "/api/pharmacies/map"),
    page.getByRole("button", { name: "搜尋", exact: true }).click(),
  ]);
  assert.equal(response.status(), 200);
  const body = await response.json();
  assert(body.items.length > 0, "區域地圖無藥局");
  await page.locator(".map-status").filter({ hasText: `已標示 ${body.items.length} 家藥局` }).waitFor({ timeout: 45000 });
}

for (const engine of [firefox, webkit]) {
  const browser = await engine.launch({ headless: !headed });
  try {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 }, reducedMotion: "reduce",
      geolocation: { latitude: 25.04, longitude: 121.52 }, permissions: ["geolocation"],
    });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.name));
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      for (const path of ["/", `/medicines?q=${encodeURIComponent("頭痛")}`, pharmacyPath]) {
        await page.goto(new URL(path, baseUrl).href);
        await page.getByRole("heading", { level: 1 }).waitFor();
        if (path.startsWith("/medicines")) await page.locator(".result-row--medicine").first().waitFor();
        if (path.startsWith("/pharmacies")) {
          await findPharmacies(page);
          await page.locator(".pharmacy-map .gm-style").first().waitFor();
          const mapSize = await page.locator(".pharmacy-map").boundingBox();
          assert(mapSize.width > 200 && mapSize.height >= 160, "地圖尺寸不足");
          const list = page.getByRole("region", { name: "藥局資訊清單" });
          await list.evaluate((element) => { element.scrollTop = 120; });
          assert(await list.evaluate((element) => element.scrollTop > 0), "藥局列表無法垂直捲動");
          const table = page.locator(".pharmacy-calendar-scroll").first();
          if (width === 320 && await table.count()) {
            await table.evaluate((element) => { element.scrollLeft = 80; });
            assert(await table.evaluate((element) => element.scrollLeft > 0), "看診時段表無法水平捲動");
          }
        }
        await checkLayout(page);
        const themeButton = page.getByRole("button", { name: "切換至夜間模式" });
        await themeButton.click();
        assert.equal(await page.locator("html").getAttribute("data-theme"), "dark");
        await checkLayout(page);
        await page.getByRole("button", { name: "切換至白天模式" }).click();
        console.log(`${engine.name()} ${width}px ${path.split("?")[0]}：版面、日夜模式通過`);
      }
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(new URL("/medicines", baseUrl).href);
    await search(page, "頭痛");
    await page.getByRole("button", { name: "依藥品搜尋" }).click();
    await search(page, "普拿疼");
    assert.match(await page.locator(".result-row--medicine h3").first().innerText(), /普拿疼/);
    await page.getByRole("button", { name: "查看官方用藥與安全資料" }).first().click();
    await page.getByRole("heading", { name: "官方用法用量" }).first().waitFor();
    await page.getByText("為什麼有些藥品沒有價格？", { exact: true }).click();
    assert(await page.getByText(/自費價格只採已核對 TFDA/).isVisible());
    await page.getByRole("button", { name: "依症狀搜尋" }).click();
    await search(page, "頭痛");
    const pagination = page.getByRole("navigation", { name: "藥品結果分頁" });
    for (const number of [2, 1]) {
      const [response] = await Promise.all([
        page.waitForResponse((response) => {
          const url = new URL(response.url());
          return url.pathname === "/api/medicines" && url.searchParams.get("page") === String(number);
        }),
        pagination.getByRole("button", { name: number === 2 ? "下一頁" : "上一頁" }).click(),
      ]);
      assert.equal(response.status(), 200);
      await page.waitForFunction(() => document.querySelector(".search-button")?.disabled === false);
      await pagination.getByText(`第 ${number} 頁`, { exact: true }).waitFor();
    }
    await search(page, "衛署成製字第015702號");
    const quotes = page.getByRole("region", { name: "已核實的自費價格" });
    await quotes.waitFor();
    assert.match(await quotes.innerText(), /NT\$\d/);
    assert.match(await quotes.innerText(), /19g\/罐/);
    assert.match(await quotes.innerText(), /虎標.*白色軟膏/);
    assert.match(await quotes.innerText(), /價格更新時間：\d{4}\/\d{2}\/\d{2}/);
    const sourceLink = quotes.getByRole("link", { name: /查看價格來源/ }).first();
    assert.match(await sourceLink.getAttribute("href"), /^https:\/\/www\.medfirst\.com\.tw\/SalePage\/Index\/\d+$/);
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await checkLayout(page);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await search(page, "衛部成製字第016842號");
    assert.match(await page.getByRole("region", { name: "已核實的自費價格" }).innerText(), /250mL[\s\S]*赫爾藥局/);
    await search(page, "衛署成製字第013214號");
    const alcoholPrices = await page.getByRole("region", { name: "已核實的自費價格" }).innerText();
    assert.match(alcoholPrices, /500mL/);
    assert.match(alcoholPrices, /4000mL/);
    assert.match(alcoholPrices, /漁人生醫/);
    if (screenshotDirectory) {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: join(screenshotDirectory, `${engine.name()}-medicines.png`) });
    }
    await page.goto(new URL(pharmacyPath, baseUrl).href);
    await findPharmacies(page);
    const list = page.getByRole("region", { name: "藥局資訊清單" });
    const colors = [];
    for (const theme of ["light", "dark"]) {
      const scrollbar = await list.evaluate((element) => {
        const style = getComputedStyle(element);
        return CSS.supports("scrollbar-color", "red blue")
          ? { color: style.scrollbarColor, width: style.scrollbarWidth }
          : { color: getComputedStyle(element, "::-webkit-scrollbar-thumb").backgroundColor, width: getComputedStyle(element, "::-webkit-scrollbar").width };
      });
      assert(typeof scrollbar.color === "string" && !["auto", "transparent", "rgba(0, 0, 0, 0)"].includes(scrollbar.color), "滾動欄未套用主題色");
      // shortcut: Firefox 無頭模式隱藏原生滾動欄；寬度與高對比請用 --headed 驗證。
      if (engine !== firefox || headed) assert(["thin", "10px"].includes(scrollbar.width), "滾動欄寬度未套用");
      colors.push(scrollbar.color);
      await page.getByRole("button", { name: theme === "light" ? "切換至夜間模式" : "切換至白天模式" }).click();
    }
    assert.notEqual(colors[0], colors[1], "滾動欄未隨日夜模式換色");
    if (engine === firefox) {
      await page.emulateMedia({ forcedColors: "active" });
      if (headed) assert.equal(await list.evaluate((element) => getComputedStyle(element).scrollbarWidth), "auto");
      assert.equal(await list.evaluate((element) => getComputedStyle(element).scrollbarColor), "auto");
      await page.emulateMedia({ forcedColors: "none" });
    }
    if (screenshotDirectory) await page.locator(".pharmacy-results").screenshot({ path: join(screenshotDirectory, `${engine.name()}-pharmacies.png`) });
    const nearbyResponse = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return url.pathname === "/api/pharmacies" && url.searchParams.has("lat");
    });
    await page.getByRole("button", { name: "使用目前位置找附近藥局" }).click();
    assert((await (await nearbyResponse).json()).total > 0, "定位搜尋無結果");
    await page.locator(".map-status").filter({ hasText: /^已標示 \d+ 家藥局$/ }).waitFor();
    assert.deepEqual(errors, [], "瀏覽器未捕捉的 JavaScript 錯誤");
    console.log(`${engine.name()} ${browser.version()}：症狀／藥名搜尋、自費價格／規格／來源／更新時間、詳細資料、分頁、地圖、定位、雙向捲動及主題滾動欄通過`);
    if (engine === firefox && !headed) console.log("Firefox 無頭模式：未檢查原生滾動欄寬度，請加 --headed 重跑。");
  } finally {
    await browser.close();
  }
}
