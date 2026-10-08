"use client";

import { useEffect, useRef } from "react";
import type { Pharmacy } from "../types/catalog";

type Point = { latitude: number; longitude: number };

export default function PharmacyMap({ pharmacies, userLocation }: { pharmacies: Pharmacy[]; userLocation: Point | null }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let map: import("leaflet").Map | undefined;
    let cancelled = false;

    async function renderMap() {
      const L = await import("leaflet");
      if (cancelled || !containerRef.current) return;
      map = L.map(containerRef.current, { scrollWheelZoom: false });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(map);

      const points = pharmacies.filter((item): item is Pharmacy & Point => item.latitude !== null && item.longitude !== null);
      const bounds = L.latLngBounds([]);
      for (const item of points) {
        L.circleMarker([item.latitude, item.longitude], { radius: 7, color: "#147766", fillColor: "#147766", fillOpacity: 0.85 })
          .bindPopup(`<strong>${escapeHtml(item.name)}</strong><br>${escapeHtml(item.address ?? "地址未提供")}`)
          .addTo(map);
        bounds.extend([item.latitude, item.longitude]);
      }
      if (userLocation) {
        L.circleMarker([userLocation.latitude, userLocation.longitude], { radius: 8, color: "#b66d28", fillColor: "#d39c55", fillOpacity: 0.9 })
          .bindPopup("你的目前位置").addTo(map);
        bounds.extend([userLocation.latitude, userLocation.longitude]);
      }
      map.fitBounds(bounds.isValid() ? bounds.pad(0.2) : L.latLngBounds([[23.4, 120], [25.4, 122.1]]));
    }

    void renderMap();
    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [pharmacies, userLocation]);

  return <div className="pharmacy-map" ref={containerRef} aria-label="藥局分布地圖" role="img" />;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);
}
