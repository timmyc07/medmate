import { describe, expect, it, vi } from "vitest";
import { createKeepAliveConfig, pingOnce } from "../../scripts/keep-alive.mjs";

type TestEnv = Record<string, string>;

describe("keep-alive 腳本", () => {
  it("接受完整網址並回傳健康檢查結果", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));
    const config = createKeepAliveConfig({ KEEP_ALIVE_URL: "https://example.com/api/health" } satisfies TestEnv);

    await expect(pingOnce(config, fetcher)).resolves.toMatchObject({ status: 200, ok: true });
    expect(fetcher).toHaveBeenCalledWith(config.url, expect.objectContaining({ method: "GET" }));
  });

  it("非 2xx 回應會讓檢查失敗", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("error", { status: 503 }));
    const config = createKeepAliveConfig({ KEEP_ALIVE_URL: "https://example.com/api/health" } satisfies TestEnv);

    await expect(pingOnce(config, fetcher)).rejects.toThrow("HTTP 503");
  });

  it("拒絕相對網址與無效 timeout", () => {
    expect(() => createKeepAliveConfig({ KEEP_ALIVE_URL: "/api/health" } satisfies TestEnv)).toThrow("KEEP_ALIVE_URL");
    expect(() => createKeepAliveConfig({ KEEP_ALIVE_URL: "https://example.com", KEEP_ALIVE_TIMEOUT_MS: "0" } satisfies TestEnv)).toThrow("KEEP_ALIVE_TIMEOUT_MS");
  });
});
