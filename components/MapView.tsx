"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useMemo, useState } from "react";
import Map, {
  GeolocateControl,
  Layer,
  NavigationControl,
  Source,
  type MapLayerMouseEvent,
  type MapRef,
} from "react-map-gl/maplibre";
import type { FeatureCollection, Point } from "geojson";
import { MAP_STYLE_URL, PILOT_CITY, PIN_MIN_ZOOM } from "@/lib/config";
import type { MapPlace } from "@/lib/types";

export type Bounds = { minLng: number; minLat: number; maxLng: number; maxLat: number };
export type ViewInfo = { bounds: Bounds; center: { lat: number; lng: number } };

type Props = {
  mapRef: React.RefObject<MapRef | null>;
  places: MapPlace[];
  savedIds: Set<string>;
  selectedId: string | null;
  showHeat: boolean;
  onSelect: (id: string | null) => void;
  onViewChange: (view: ViewInfo) => void;
};

export default function MapView({
  mapRef,
  places,
  savedIds,
  selectedId,
  showHeat,
  onSelect,
  onViewChange,
}: Props) {
  const [cursor, setCursor] = useState("");

  // Turn our places into GeoJSON, the format MapLibre sources expect.
  const data = useMemo<FeatureCollection<Point>>(
    () => ({
      type: "FeatureCollection",
      features: places.map((p) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [p.lng, p.lat] },
        properties: { id: p.id, name: p.name, weight: p.weight, saved: savedIds.has(p.id) },
      })),
    }),
    [places, savedIds],
  );

  function reportView() {
    const map = mapRef.current;
    if (!map) return;
    const b = map.getBounds();
    const c = map.getCenter();
    onViewChange({
      bounds: { minLng: b.getWest(), minLat: b.getSouth(), maxLng: b.getEast(), maxLat: b.getNorth() },
      center: { lat: c.lat, lng: c.lng },
    });
  }

  function handleClick(e: MapLayerMouseEvent) {
    const id = e.features?.[0]?.properties?.id;
    onSelect(typeof id === "string" ? id : null);
  }

  return (
    <Map
      ref={mapRef}
      initialViewState={{
        latitude: PILOT_CITY.latitude,
        longitude: PILOT_CITY.longitude,
        zoom: PILOT_CITY.zoom,
      }}
      mapStyle={MAP_STYLE_URL}
      style={{ width: "100%", height: "100%" }}
      interactiveLayerIds={["place-pins"]}
      cursor={cursor}
      onLoad={reportView}
      onMoveEnd={reportView}
      onClick={handleClick}
      onMouseEnter={() => setCursor("pointer")}
      onMouseLeave={() => setCursor("")}
    >
      <NavigationControl position="bottom-right" showCompass={false} />
      <GeolocateControl position="bottom-right" />

      <Source id="places" type="geojson" data={data}>
        {/* Popularity glow: strongest when zoomed out, fades as pins appear. */}
        <Layer
          id="place-heat"
          type="heatmap"
          filter={[">", ["get", "weight"], 0]}
          layout={{ visibility: showHeat ? "visible" : "none" }}
          paint={{
            "heatmap-weight": ["interpolate", ["linear"], ["get", "weight"], 0, 0, 25, 1],
            "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 10, 1, 16, 3],
            "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 10, 18, 16, 50],
            "heatmap-color": [
              "interpolate",
              ["linear"],
              ["heatmap-density"],
              0, "rgba(0,0,0,0)",
              0.15, "rgba(76,29,149,0.45)",
              0.35, "#7c3aed",
              0.55, "#db2777",
              0.75, "#f97316",
              1, "#fde047",
            ],
            "heatmap-opacity": ["interpolate", ["linear"], ["zoom"], PIN_MIN_ZOOM, 0.85, 16, 0.15],
          }}
        />

        {/* Tappable pins once you're zoomed in to street level. */}
        <Layer
          id="place-pins"
          type="circle"
          minzoom={PIN_MIN_ZOOM}
          paint={{
            "circle-color": ["case", ["get", "saved"], "#059669", "#4f46e5"],
            "circle-radius": ["interpolate", ["linear"], ["get", "weight"], 0, 6, 25, 10],
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 2,
            "circle-opacity": ["interpolate", ["linear"], ["zoom"], PIN_MIN_ZOOM, 0.3, PIN_MIN_ZOOM + 1, 1],
            "circle-stroke-opacity": ["interpolate", ["linear"], ["zoom"], PIN_MIN_ZOOM, 0.3, PIN_MIN_ZOOM + 1, 1],
          }}
        />

        <Layer
          id="place-labels"
          type="symbol"
          minzoom={15}
          layout={{
            "text-field": ["get", "name"],
            "text-font": ["Noto Sans Regular"],
            "text-size": 12,
            "text-offset": [0, 1.3],
            "text-anchor": "top",
            "text-optional": true,
          }}
          paint={{ "text-color": "#1e293b", "text-halo-color": "#ffffff", "text-halo-width": 1.5 }}
        />

        {/* Ring around the place that's open in the drawer. */}
        <Layer
          id="place-selected"
          type="circle"
          filter={["==", ["get", "id"], selectedId ?? ""]}
          paint={{
            "circle-radius": 15,
            "circle-color": "rgba(0,0,0,0)",
            "circle-stroke-color": "#f59e0b",
            "circle-stroke-width": 3,
          }}
        />
      </Source>
    </Map>
  );
}
