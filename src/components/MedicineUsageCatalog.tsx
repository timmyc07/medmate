"use client";

import { useEffect, useState } from "react";
import type { MedicineUsagePage } from "../types/catalog";

const PAGE_SIZE = 50;

export default function MedicineUsageCatalog() {
  const [page, setPage] = useState<MedicineUsagePage | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    fetch(`/api/medicines/usage?page=${pageNumber}&pageSize=${PAGE_SIZE}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok)
          throw new Error(
            body.error?.message ?? "藥品使用量資料暫時無法使用，請稍後再試。",
          );
        setPage(body as MedicineUsagePage);
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === "AbortError")
          return;
        setError(
          cause instanceof Error ? cause.message : "目前無法連線，請稍後再試。",
        );
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [pageNumber]);

  const totalPages = page ? Math.ceil(page.total / PAGE_SIZE) : 0;
  const start = Math.max(1, pageNumber - 2);
  const end = Math.min(totalPages, pageNumber + 2);

  return (
    <section className="usage-catalog" aria-labelledby="usage-catalog-title">
      <div className="section-heading">
        <div>
          <span className="section-index">01</span>
          <h2 id="usage-catalog-title">健保藥品使用量排行</h2>
        </div>
        <span className="section-caption">GOVERNMENT CLAIMS DATA</span>
      </div>
      {page?.feeYear && (
        <p className="usage-source-note">
          統計期間：民國 {page.feeYear} 年 {page.periodStart?.slice(3)}–
          {page.periodEnd?.slice(3)}{" "}
          月｜排序依含包裹支付的醫令量合計，屬彙總申報量，不代表病人數或實際服藥量。
        </p>
      )}
      {loading && (
        <p className="state-message" role="status">
          正在載入政府藥品使用量資料…
        </p>
      )}
      {error && (
        <p className="state-message state-error" role="alert">
          {error}
        </p>
      )}
      {page && (
        <>
          <p className="result-summary">
            共 {page.total.toLocaleString()} 項藥品，第 {page.page} /{" "}
            {totalPages} 頁
          </p>
          {page.items.length === 0 ? (
            <p className="state-message" role="status">
              目前沒有可展示的使用量資料。
            </p>
          ) : (
            <div className="medicine-grid">
              {page.items.map((item) => (
                <article className="medicine-usage-card" key={item.drugCode}>
                  <div className="medicine-usage-image">
                    {item.appearanceImageUrl ? (
                      <img
                        src={item.appearanceImageUrl}
                        alt={`${item.name}藥品外觀`}
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <div
                        className="medicine-image-placeholder"
                        role="img"
                        aria-label="政府資料未提供此藥品外觀圖片"
                      >
                        <span aria-hidden="true">＋</span>
                        <small>外觀圖未提供</small>
                      </div>
                    )}
                    <span className="medicine-rank">
                      RANK {item.rank.toString().padStart(2, "0")}
                    </span>
                  </div>
                  <div className="medicine-usage-copy">
                    <h3>{item.name}</h3>
                    {item.englishName && (
                      <p className="medicine-english-name">
                        {item.englishName}
                      </p>
                    )}
                    <p>健保藥品代碼：{item.drugCode}</p>
                    {item.ingredient && <p>成分：{item.ingredient}</p>}
                    {item.dosageForm && <p>劑型：{item.dosageForm}</p>}
                    {item.licenseNumber && (
                      <p>許可證字號：{item.licenseNumber}</p>
                    )}
                    {item.appearanceShape && (
                      <p>
                        外觀：
                        {[item.appearanceColor, item.appearanceShape]
                          .filter(Boolean)
                          .join("・")}
                      </p>
                    )}
                    <div className="medicine-usage-quantity">
                      <strong>
                        {item.claimQuantity.toLocaleString("zh-TW", {
                          maximumFractionDigits: 1,
                        })}
                      </strong>
                      <span>含包裹支付醫令量</span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
          {totalPages > 1 && (
            <nav
              className="numbered-pagination"
              aria-label="藥品使用量排行頁碼"
            >
              <button
                type="button"
                onClick={() => setPageNumber((value) => Math.max(1, value - 1))}
                disabled={pageNumber <= 1 || loading}
              >
                上一頁
              </button>
              {start > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => setPageNumber(1)}
                    aria-label="第 1 頁"
                  >
                    1
                  </button>
                  {start > 2 && <span aria-hidden="true">…</span>}
                </>
              )}
              {Array.from(
                { length: end - start + 1 },
                (_, index) => start + index,
              ).map((number) => (
                <button
                  type="button"
                  key={number}
                  onClick={() => setPageNumber(number)}
                  aria-label={`第 ${number} 頁`}
                  aria-current={number === pageNumber ? "page" : undefined}
                  disabled={loading}
                >
                  {number}
                </button>
              ))}
              {end < totalPages && (
                <>
                  {end < totalPages - 1 && <span aria-hidden="true">…</span>}
                  <button
                    type="button"
                    onClick={() => setPageNumber(totalPages)}
                    aria-label={`第 ${totalPages} 頁`}
                  >
                    {totalPages}
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() =>
                  setPageNumber((value) => Math.min(totalPages, value + 1))
                }
                disabled={pageNumber >= totalPages || loading}
              >
                下一頁
              </button>
            </nav>
          )}
        </>
      )}
      <p className="usage-attribution">
        資料來源：衛生福利部中央健康保險署健保藥品使用量統計、食品藥物管理署藥品許可證與藥品外觀資料。圖片僅依官方許可證識別碼配對。
      </p>
    </section>
  );
}
