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

export default function PharmacyMap({ pharmacies, userLocation }: { pharmacies: Pharmacy[]; userLocation: Point | null }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState("正在載入地圖…");

  useEffect(() => {
    let cancelled = false;
    async function render() {
      const missing = pharmacies.filter((item) => (item.latitude === null || item.longitude === null) && item.address).map((item) => item.address as string);
      const geocoded = new Map<string, Point>();
      if (missing.length) {
        try {
          const response = await fetch("/api/geocode", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ addresses: missing }) });
          const body = await response.json() as { items?: Array<{ address: string; latitude: number | null; longitude: number | null }> };
          for (const item of body.items ?? []) if (item.latitude !== null && item.longitude !== null) geocoded.set(item.address, { latitude: item.latitude, longitude: item.longitude });
        } catch { /* 保留既有座標 */ }
      }
      let config: { enabled?: boolean; key?: string };
      try {
        const configResponse = await fetch("/api/maps-config", { cache: "no-store" });
        config = await configResponse.json() as { enabled?: boolean; key?: string };
      } catch {
        setStatus("地圖服務暫時無法載入");
        return;
      }
      if (!config.enabled || !config.key) { setStatus("地圖服務尚未設定"); return; }
      await loadScript(config.key);
      if (cancelled || !containerRef.current || !window.google) return;
      const map = new window.google.maps.Map(containerRef.current, { center: { lat: 23.7, lng: 121 }, zoom: 7, mapTypeControl: false, streetViewControl: false, fullscreenControl: false, clickableIcons: false, gestureHandling: "cooperative" });
      const bounds = new window.google.maps.LatLngBounds();
      const points = pharmacies.flatMap((item) => {
        const point = item.latitude !== null && item.longitude !== null ? { latitude: item.latitude, longitude: item.longitude } : item.address ? geocoded.get(item.address) : undefined;
        return point ? [{ item, point }] : [];
      });
      for (const { item, point } of points) {
        const position = { lat: point.latitude, lng: point.longitude };
        bounds.extend(position);
        const marker = new window.google.maps.Marker({ map, position, title: item.name });
        const info = new window.google.maps.InfoWindow({ content: `<strong>${escapeHtml(item.name)}</strong><br>${escapeHtml(item.address ?? "地址未提供")}` });
        marker.addListener?.("click", () => info.open({ map, anchor: marker }));
      }
      if (userLocation) { const position = { lat: userLocation.latitude, lng: userLocation.longitude }; bounds.extend(position); new window.google.maps.Marker({ map, position, title: "目前位置", label: "你" }); }
      if (!bounds.isEmpty()) map.fitBounds(bounds); else map.setCenter({ lat: 23.7, lng: 121 });
      setStatus(points.length ? `已標示 ${points.length} 家藥局` : "目前沒有可定位的藥局");
    }
    void render();
    return () => { cancelled = true; };
  }, [pharmacies, userLocation]);

  return <div className="map-shell"><div className="pharmacy-map" ref={containerRef} aria-label="藥局分布地圖" role="img" /><p className="map-status" role="status">{status}</p></div>;
}

function loadScript(key: string): Promise<void> {
  if (window.google?.maps) return Promise.resolve();
  const existing = document.querySelector<HTMLScriptElement>("script[data-google-maps]");
  if (existing) return new Promise((resolve, reject) => { existing.addEventListener("load", () => resolve(), { once: true }); existing.addEventListener("error", () => reject(new Error("Google Maps 載入失敗")), { once: true }); });
  return new Promise((resolve, reject) => { const script = document.createElement("script"); script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly`; script.async = true; script.defer = true; script.dataset.googleMaps = "true"; script.onload = () => resolve(); script.onerror = () => reject(new Error("Google Maps 載入失敗")); document.head.appendChild(script); });
}

function escapeHtml(value: string): string { return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character); }
