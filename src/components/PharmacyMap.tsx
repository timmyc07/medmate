"use client";

import { useEffect, useRef, useState } from "react";
import type { Pharmacy } from "../types/catalog";

type Point = { latitude: number; longitude: number };
type GooglePoint = { lat: number; lng: number };
type GoogleBounds = { extend: (point: GooglePoint) => void; isEmpty: () => boolean };
type GoogleMap = { fitBounds: (bounds: GoogleBounds) => void; setCenter: (point: GooglePoint) => void };
type GoogleMarker = { addListener?: (event: string, handler: () => void) => void };
type GoogleApi = { maps: { Map: new (element: HTMLElement, options: Record<string, unknown>) => GoogleMap; LatLngBounds: new () => GoogleBounds; Marker: new (options: Record<string, unknown>) => GoogleMarker; InfoWindow: new (options: { content: string }) => { open: (options: { map: GoogleMap; anchor: GoogleMarker }) => void } } };

declare global { interface Window { google?: GoogleApi; } }

let mapsScriptPromise: Promise<void> | null = null;

export default function PharmacyMap({ pharmacies, userLocation }: { pharmacies: Pharmacy[]; userLocation: Point | null }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState("正在載入地圖…");

  useEffect(() => {
    let cancelled = false;
    async function render() {
      let config: { enabled?: boolean; key?: string };
      try {
        const configResponse = await fetch("/api/maps-config", { cache: "no-store" });
        config = await configResponse.json() as { enabled?: boolean; key?: string };
      } catch {
        if (!cancelled) setStatus("地圖服務暫時無法載入");
        return;
      }
      if (!config.enabled || !config.key) { if (!cancelled) setStatus("地圖服務尚未設定"); return; }
      const missing = [...new Set(pharmacies
        .filter((item) => item.address && !item.coordinateCandidates?.length && (item.latitude === null || item.longitude === null))
        .map((item) => item.address as string))];
      const geocoded = new Map<string, Point>();
      const geocodePromise = geocodeAddresses(missing, geocoded).catch((error: unknown) => ({
        error: error instanceof Error ? error.message : "地址定位服務暫時無法使用",
      }));
      try {
        await loadScript(config.key);
        if (cancelled || !containerRef.current || !window.google) return;
        const maps = window.google.maps;
        const map = new maps.Map(containerRef.current, { center: { lat: 23.7, lng: 121 }, zoom: 7, mapTypeControl: false, streetViewControl: false, fullscreenControl: false, clickableIcons: false, gestureHandling: "cooperative" });
        const bounds = new maps.LatLngBounds();
        const plotted = new Set<string>();
        const addMarker = (item: Pharmacy, point: Point) => {
          const position = { lat: point.latitude, lng: point.longitude };
          bounds.extend(position);
          const marker = new maps.Marker({ map, position, title: item.name });
          const info = new maps.InfoWindow({ content: `<strong>${escapeHtml(item.name)}</strong><br>${escapeHtml(item.address ?? "地址未提供")}` });
          marker.addListener?.("click", () => info.open({ map, anchor: marker }));
          plotted.add(item.id);
        };
        for (const item of pharmacies) {
          const point = item.latitude !== null && item.longitude !== null ? { latitude: item.latitude, longitude: item.longitude } : undefined;
          if (item.coordinateCandidates?.length) {
            for (const candidate of item.coordinateCandidates) addMarker({ ...item, address: candidate.address || item.address }, candidate);
          } else if (point) addMarker(item, point);
        }
        if (userLocation) { const position = { lat: userLocation.latitude, lng: userLocation.longitude }; bounds.extend(position); new maps.Marker({ map, position, title: "目前位置", label: "你" }); }
        if (!bounds.isEmpty()) map.fitBounds(bounds);
        if (!cancelled) setStatus(missing.length ? "地圖已載入，正在定位藥局…" : plotted.size ? `已標示 ${plotted.size} 家藥局` : "目前沒有可定位的藥局");

        const geocodeResult = await geocodePromise;
        if (cancelled) return;
        const geocodeError = "error" in geocodeResult ? geocodeResult.error : null;
        for (const item of pharmacies) {
          if (plotted.has(item.id) || !item.address) continue;
          const point = geocoded.get(item.address);
          if (point) addMarker(item, point);
        }
        if (!bounds.isEmpty()) map.fitBounds(bounds);
        if (!cancelled) {
          if (geocodeError) setStatus(`${geocodeError}；已顯示 ${plotted.size} 家可用座標，藥局清單仍可使用。`);
          else setStatus(plotted.size ? `已標示 ${plotted.size} 家藥局` : "目前沒有可定位的藥局");
        }
      } catch {
        if (!cancelled) setStatus("地圖服務暫時無法載入；仍可使用藥局清單與導航。");
      }
    }
    void render();
    return () => { cancelled = true; };
  }, [pharmacies, userLocation]);

  return <div className="map-shell"><section className="pharmacy-map" ref={containerRef} role="img" aria-label="藥局分布地圖" aria-roledescription="互動式地圖" /><p className="map-status" role="status">{status}</p></div>;
}

async function geocodeAddresses(addresses: string[], output: Map<string, Point>): Promise<{ done: true } | { error: string }> {
  for (let index = 0; index < addresses.length; index += 20) {
    const response = await fetch("/api/geocode", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ addresses: addresses.slice(index, index + 20) }) });
    if (!response.ok) {
      const body = await response.json() as { error?: { code?: string } };
      return { error: body.error?.code === "GEOCODER_NOT_CONFIGURED" ? "地址定位服務尚未設定" : "地址定位服務暫時無法使用" };
    }
    const body = await response.json() as { items?: Array<{ address: string; latitude: number | null; longitude: number | null }> };
    for (const item of body.items ?? []) if (item.latitude !== null && item.longitude !== null) output.set(item.address, { latitude: item.latitude, longitude: item.longitude });
  }
  return { done: true };
}

function loadScript(key: string): Promise<void> {
  if (window.google?.maps) return Promise.resolve();
  if (mapsScriptPromise) return mapsScriptPromise;
  const existing = document.querySelector<HTMLScriptElement>("script[data-google-maps]");
  const promise = new Promise<void>((resolve, reject) => {
    const script = existing ?? document.createElement("script");
    const handleLoad = () => resolve();
    const handleError = () => {
      if (!existing) script.remove();
      reject(new Error("Google Maps 載入失敗"));
    };
    script.addEventListener("load", handleLoad, { once: true });
    script.addEventListener("error", handleError, { once: true });
    if (!existing) {
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly`;
      script.async = true;
      script.defer = true;
      script.dataset.googleMaps = "true";
      document.head.appendChild(script);
    }
  }).catch((error: unknown) => {
    mapsScriptPromise = null;
    throw error;
  });
  mapsScriptPromise = promise;
  return promise;
}

function escapeHtml(value: string): string { return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character); }
