import process from "node:process";
import { pathToFileURL } from "node:url";

const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_INTERVAL_MS = 10 * 60 * 1_000;

/** @param {Record<string, string | undefined>} [env] */
export function createKeepAliveConfig(env = process.env) {
  const rawUrl = env.KEEP_ALIVE_URL?.trim();
  if (!rawUrl) throw new Error("缺少 KEEP_ALIVE_URL");
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("KEEP_ALIVE_URL 必須是完整的 HTTP(S) 網址");
  }
  if (!/^https?:$/.test(url.protocol)) throw new Error("KEEP_ALIVE_URL 必須是完整的 HTTP(S) 網址");

  const timeoutMs = parsePositiveInteger(env.KEEP_ALIVE_TIMEOUT_MS, DEFAULT_TIMEOUT_MS, "KEEP_ALIVE_TIMEOUT_MS");
  const intervalMs = parsePositiveInteger(env.KEEP_ALIVE_INTERVAL_MS, DEFAULT_INTERVAL_MS, "KEEP_ALIVE_INTERVAL_MS");
  return { url: url.toString(), timeoutMs, intervalMs };
}

export async function pingOnce(config, fetcher = fetch) {
  const startedAt = performance.now();
  const response = await fetcher(config.url, {
    method: "GET",
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(config.timeoutMs),
  });
  const durationMs = Math.round(performance.now() - startedAt);
  if (!response.ok) throw new Error(`HTTP ${response.status}（${durationMs} ms）`);
  return { status: response.status, ok: true, durationMs };
}

async function runLoop(config) {
  console.log(`keep-alive 已啟動：${config.url}，間隔 ${config.intervalMs} ms`);
  while (true) {
    try {
      const result = await pingOnce(config);
      console.log(`[${new Date().toISOString()}] 健康檢查成功：HTTP ${result.status}（${result.durationMs} ms）`);
    } catch (error) {
      console.error(`[${new Date().toISOString()}] 健康檢查失敗：${error instanceof Error ? error.message : String(error)}`);
    }
    await new Promise((resolve) => setTimeout(resolve, config.intervalMs));
  }
}

function parsePositiveInteger(value, fallback, name) {
  if (value == null || value.trim() === "") return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${name} 必須是正整數`);
  return parsed;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const config = createKeepAliveConfig();
    if (process.argv.includes("--once")) {
      const result = await pingOnce(config);
      console.log(`健康檢查成功：HTTP ${result.status}（${result.durationMs} ms）`);
    } else {
      await runLoop(config);
    }
  } catch (error) {
    console.error(`健康檢查失敗：${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
