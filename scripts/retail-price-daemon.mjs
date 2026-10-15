import { spawn } from "node:child_process";

const intervalMs = Number(process.env.RETAIL_CRAWL_INTERVAL_MS ?? 2 * 60 * 60 * 1000);
const batchSize = process.env.CRAWL_MAX_PRODUCTS ?? "100";
let running = false;

async function runBatch() {
  if (running) return;
  running = true;
  const child = spawn(process.execPath, [new URL("./crawl-retail-prices.mjs", import.meta.url)], {
    env: { ...process.env, CRAWL_MAX_PRODUCTS: batchSize },
    stdio: "ignore",
  });
  await new Promise((resolve) => child.once("close", resolve));
  running = false;
}

await runBatch();
setInterval(() => void runBatch(), intervalMs);
