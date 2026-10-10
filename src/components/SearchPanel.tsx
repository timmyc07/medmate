"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import type { Medicine, Page, Pharmacy } from "../types/catalog";
import { MedicineResult, PharmacyResult } from "./ResultCard";
import PharmacyMap from "./PharmacyMap";
import PillFeatureFinder from "./PillFeatureFinder";
import {
  TAIWAN_ADMINISTRATIVE_AREAS,
  TAIWAN_CITIES,
} from "../lib/taiwan-administrative-areas";

type Kind = "pharmacies" | "medicines";

export default function SearchPanel({
  kind,
  enabled = true,
  initialQuery = "",
  showPillFeatureFinder = true,
}: {
  kind: Kind;
  enabled?: boolean;
  initialQuery?: string;
  showPillFeatureFinder?: boolean;
}) {
  const [keyword, setKeyword] = useState(initialQuery);
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");
  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<Page<Pharmacy | Medicine> | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const requestIdRef = useRef(0);
  const locationRequestIdRef = useRef(0);
  const initialSearchRef = useRef<string | null>(null);
  const label = kind === "pharmacies" ? "藥局" : "藥品";

  const search = useCallback(async (
    event?: FormEvent<HTMLFormElement>,
    nextPage = 1,
    locationOverride = location,
    keywordOverride = keyword,
    areaOverride = { city, district },
  ): Promise<void> => {
    event?.preventDefault();
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError("");
    setPage(nextPage);
    const query = new URLSearchParams({
      q: keywordOverride.trim(),
      page: String(nextPage),
      pageSize: "20",
    });
    if (kind === "pharmacies" && areaOverride.city.trim()) query.set("city", areaOverride.city.trim());
    if (kind === "pharmacies" && areaOverride.district.trim())
      query.set("district", areaOverride.district.trim());
    if (kind === "pharmacies" && locationOverride) {
      query.set("lat", String(locationOverride.latitude));
      query.set("lng", String(locationOverride.longitude));
    }
    try {
      const response = await fetch(`/api/${kind}?${query.toString()}`, {
        headers: { Accept: "application/json" },
      });
      const body = await response.json();
      if (!response.ok) {
        if (requestId !== requestIdRef.current) return;
        setError(body.error?.message ?? "查詢服務暫時無法使用，請稍後再試。");
        setResult(null);
        return;
      }
      const pageResult = body as Page<Pharmacy | Medicine>;
      if (requestId !== requestIdRef.current) return;
      setResult(pageResult);
      setPage(pageResult.page);
    } catch {
      if (requestId !== requestIdRef.current) return;
      setError("目前無法連線，請確認網路後再試。");
      setResult(null);
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [city, district, kind, keyword, location]);

  useEffect(() => {
    const query = initialQuery.trim();
    if (initialSearchRef.current === query) return;
    initialSearchRef.current = query;
    requestIdRef.current += 1;
    locationRequestIdRef.current += 1;
    setKeyword(query);
    setCity("");
    setDistrict("");
    setLocation(null);
    setResult(null);
    setPage(1);
    setError("");
    if (!enabled || !query) {
      setLoading(false);
      return;
    }
    void search(undefined, 1, null, query, { city: "", district: "" });
  }, [initialQuery, enabled, search]);

  function useMyLocation() {
    const locationRequestId = ++locationRequestIdRef.current;
    requestIdRef.current += 1;
    if (!navigator.geolocation) {
      setLoading(false);
      setError("此瀏覽器不支援定位，請改用縣市與區域查詢。");
      return;
    }
    setLoading(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (locationRequestId !== locationRequestIdRef.current) return;
        const point = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        setLocation(point);
        setCity("");
        setDistrict("");
        void search(undefined, 1, point, keyword, { city: "", district: "" });
      },
      () => {
        if (locationRequestId !== locationRequestIdRef.current) return;
        setLoading(false);
        setError("無法取得位置。你可以允許定位權限，或改用縣市與區域查詢。");
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    );
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    locationRequestIdRef.current += 1;
    void search(event);
  }

  function applyCityFilter(nextCity: string) {
    locationRequestIdRef.current += 1;
    setCity(nextCity);
    setDistrict("");
    setLocation(null);
    void search(undefined, 1, null, keyword, { city: nextCity, district: "" });
  }

  function compareAppearance(marking: string) {
    setKeyword(marking);
    void search(undefined, 1, null, marking, { city: "", district: "" });
  }

  const quickCities = Array.from(new Set([...(city ? [city] : []), ...TAIWAN_CITIES.slice(0, 5)]));

  return (
    <section
      className="lookup-section"
      id={kind}
      aria-labelledby={`${kind}-title`}
    >
      <div className="section-heading">
        <div>
          <span className="section-index">
            {kind === "pharmacies" ? "01" : "02"}
          </span>
          <h2 id={`${kind}-title`}>{label}查詢</h2>
        </div>
        <span className="section-caption">
          {kind === "pharmacies" ? "縣市・區域・附近搜尋" : "藥品名稱・許可證字號"}
        </span>
      </div>
      {kind === "medicines" && showPillFeatureFinder && (
        <PillFeatureFinder onCompare={compareAppearance} />
      )}
      <form className={`search-form search-form--${kind}`} onSubmit={submitSearch}>
        <label className="search-field">
          <span className="input-icon material-symbols-outlined" aria-hidden="true">search</span>
          <span className="sr-only">搜尋{label}名稱或相關文字</span>
          <input
            type="search"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder={
              kind === "pharmacies"
                ? "藥局名稱或地址"
                : "輸入藥品名稱或許可證字號"
            }
            maxLength={100}
            required={kind === "medicines"}
            disabled={!enabled}
          />
        </label>
        {kind === "pharmacies" && (
          <>
            <label className="city-field">
              <span className="sr-only">縣市</span>
              <select
                value={city}
                onChange={(event) => {
                  locationRequestIdRef.current += 1;
                  requestIdRef.current += 1;
                  setLoading(false);
                  setCity(event.target.value);
                  setDistrict("");
                  setLocation(null);
                }}
                disabled={!enabled}
              >
                <option value="">選擇縣市</option>
                {TAIWAN_CITIES.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label className="district-field">
              <span className="sr-only">區域</span>
              <select
                value={district}
                onChange={(event) => {
                  locationRequestIdRef.current += 1;
                  requestIdRef.current += 1;
                  setLoading(false);
                  setDistrict(event.target.value);
                  setLocation(null);
                }}
                disabled={!enabled || !city}
              >
                <option value="">全部區域</option>
                {(TAIWAN_ADMINISTRATIVE_AREAS[city] ?? []).map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
        <button
          className="search-button"
          type="submit"
          disabled={!enabled || loading}
        >
          <span className="material-symbols-outlined action-icon" aria-hidden="true">search</span>
          <span>{!enabled ? "資料尚未開放" : loading ? "查詢中…" : "搜尋"}</span>
        </button>
      </form>
      {kind === "pharmacies" && (
        <button
          className="location-button"
          id="location-search"
          type="button"
          onClick={useMyLocation}
          disabled={!enabled || loading}
        >
          <span className="material-symbols-outlined action-icon" aria-hidden="true">my_location</span>
          使用目前位置找附近藥局
        </button>
      )}
      {kind === "pharmacies" && (
        <fieldset className="search-filters">
          <legend className="search-filters-label">快速縣市篩選</legend>
          <button
            className={`filter-chip ${!city && !location ? "is-active" : ""}`}
            type="button"
            onClick={() => applyCityFilter("")}
            aria-pressed={!city && !location}
            disabled={!enabled || loading}
          >
            全部縣市
          </button>
          {quickCities.map((name) => (
            <button
              className={`filter-chip ${city === name && !location ? "is-active" : ""}`}
              key={name}
              type="button"
              onClick={() => applyCityFilter(name)}
              aria-pressed={city === name && !location}
              disabled={!enabled || loading}
            >
              {name}
            </button>
          ))}
        </fieldset>
      )}
      {!enabled && (
        <p className="state-message" role="status">
          資料查詢目前暫停，請稍後再試。
        </p>
      )}
      {loading && (
        <p className="state-message" role="status">
          正在查詢{label}資料…
        </p>
      )}
      {error && (
        <p className="state-message state-error" role="alert">
          {error}
        </p>
      )}
      {kind === "pharmacies" && result && (
        <div className="pharmacy-results">
          <div className="result-summary" role="status" aria-live="polite">
            找到 {result.total.toLocaleString()} 筆，第 {result.page} 頁
          </div>
          {result.items.length === 0 ? (
            <p className="state-message pharmacy-empty" role="status">
              沒有符合條件的藥局資料。
            </p>
          ) : (
            <>
              <PharmacyMap
                pharmacies={result.items as Pharmacy[]}
                userLocation={location}
              />
              <div className="results-list results-list--pharmacies">
                {(result.items as Pharmacy[]).map((item) => (
                  <PharmacyResult key={item.id} item={item} />
                ))}
              </div>
            </>
          )}
          {result.items.length > 0 && (
            <nav className="pagination" aria-label={`${label}結果分頁`}>
              <button
                type="button"
                onClick={() => void search(undefined, page - 1)}
                disabled={page <= 1 || loading}
              >
                上一頁
              </button>
                <span>第 {result.page} 頁</span>
              <button
                type="button"
                onClick={() => void search(undefined, page + 1)}
                disabled={page * result.pageSize >= result.total || loading}
              >
                下一頁
              </button>
            </nav>
          )}
        </div>
      )}
      {kind === "medicines" && result && result.items.length === 0 && (
        <p className="state-message" role="status">
          沒有符合條件的{label}資料。
        </p>
      )}
      {result && result.items.length > 0 && (
        <>
          {kind === "medicines" && (
            <>
              <div className="result-summary">
                找到 {result.total.toLocaleString()} 筆，第 {result.page} 頁
              </div>
              <div className="results-list results-list--medicines">
                {result.items.map((item) => (
                  <MedicineResult key={item.id} item={item as Medicine} />
                ))}
              </div>
            </>
          )}
          {kind === "medicines" && <nav className="pagination" aria-label={`${label}結果分頁`}>
            <button
              type="button"
              onClick={() => void search(undefined, page - 1)}
              disabled={page <= 1 || loading}
            >
              上一頁
            </button>
            <span>第 {page} 頁</span>
            <button
              type="button"
              onClick={() => void search(undefined, page + 1)}
              disabled={page * result.pageSize >= result.total || loading}
            >
              下一頁
            </button>
          </nav>}
        </>
      )}
    </section>
  );
}
