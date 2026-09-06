"use client";

import { useEffect, useRef } from "react";
import type { FeatureCollection, MapPoint } from "@/types/domain";

/** Leaflet tiles are visual map fragments, not standalone content images. */
export function markMapTileDecorative(tile: HTMLImageElement) {
  tile.alt = "";
}

export function NigeriaMap({
  points = [],
  polygons,
  height = 520,
  center = [6.25, 5.15],
  zoom = 7,
}: {
  points?: MapPoint[];
  polygons?: FeatureCollection;
  height?: number;
  center?: [number, number];
  zoom?: number;
}) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let map: import("leaflet").Map | undefined;
    let cancelled = false;

    import("leaflet").then((L) => {
      if (cancelled || !container.current) return;

      map = L.map(container.current, {
        zoomControl: true,
        scrollWheelZoom: false,
        attributionControl: true,
      }).setView(center, zoom);

      // Leaflet's product prefix is optional. Esri's imagery attribution is not.
      map.attributionControl.setPrefix(false);
      const tileLayer = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        {
          maxZoom: 18,
          attribution:
            '<a href="https://www.esri.com/" target="_blank" rel="noopener noreferrer">© Esri</a>',
        },
      );
      // Bing can inspect the generated tile <img> elements. Mark each tile
      // explicitly decorative; the map container exposes the meaningful
      // accessible label for the complete visualization.
      tileLayer.on("tileloadstart", ({ tile }) => markMapTileDecorative(tile));
      tileLayer.addTo(map);

      if (polygons) {
        L.geoJSON(polygons as GeoJSON.GeoJsonObject, {
          style: {
            color: "#f4eee4",
            weight: 1.2,
            fillColor: "#d85f25",
            fillOpacity: 0.08,
          },
        }).addTo(map);
      }

      points.forEach((point) => {
        const color = point.kind === "spill" ? "#d85f25" : "#1aa7a0";
        const marker = L.circleMarker([point.lat, point.lng], {
          radius: point.kind === "spill" ? 6 : 5,
          color: "#fff",
          weight: 1.5,
          fillColor: color,
          fillOpacity: 0.95,
        });
        const link = point.href
          ? `<a href="${point.href}">Open record</a>`
          : "";
        marker
          .bindPopup(
            `<strong>${point.title}</strong><br><span>${point.subtitle ?? ""}</span><br>${link}`,
          )
          .addTo(map!);
      });

      if (points.length === 1) {
        map.setView(
          [points[0].lat, points[0].lng],
          Math.max(zoom, 11),
        );
      }
    });

    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [points, polygons, center, zoom]);

  return (
    <div className="map-shell" style={{ height }}>
      <div
        ref={container}
        className="leaflet-host"
        aria-label="Interactive map of Nigeria"
      />
      {points.length > 0 && <div className="map-key">
        {points.some((point) => point.kind === "spill") && <span><i className="spill-dot" />Oil spill</span>}
        {points.some((point) => point.kind === "flare") && <span><i className="flare-dot" />Gas flare</span>}
      </div>}
    </div>
  );
}
