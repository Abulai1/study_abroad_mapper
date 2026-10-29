"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { setWorkerUrl } from "maplibre-gl";
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
import { BASEMAP_POI_LAYERS, poiToCandidate } from "@/lib/basemap";
import { DEFAULT_VIEW, MAP_STYLE_URL, PIN_MIN_ZOOM } from "@/lib/config";
import { loadLastView, saveLastView } from "@/lib/lastView";
import type { MapPlace, SearchResult, Selection } from "@/lib/types";

// MapLibre can't find its worker once the app is bundled, so we serve a copy
// from public/ (see the "copy-map-worker" script in package.json).
setWorkerUrl("/maplibre-gl-worker.mjs");

export type Bounds ={ minLng: number; minLat: number; maxLng: number; maxLat: number };
export type ViewInfo = { bounds: Bounds; center: { lat: number; lng: number } };

type Props = {
  mapRef: React.RefObject<MapRef | null>;
  places: MapPlace[];
  savedIds: Set<string>;
  selection: Selection | null;
  showHeat: boolean;
  onSelect: (id: string | null) => void;
  /** A base-map place (café, shop…) was tapped. */
  onPickCandidate: (candidate: SearchResult) => void;
  onViewChange: (view: ViewInfo) => void;
};

export default function MapView({
  mapRef,
  places,
  savedIds,
  selection,
  showHeat,
  onSelect,
  onPickCandidate,
  onViewChange,
}: Props) {
  const [cursor, setCursor] = useState("");
  // Reopen where the map was last left on this device.
  const [initialView] = useState(() => loadLastView() ?? DEFAULT_VIEW);

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

  const selectedId = selection && "id" in selection ? selection.id : null;
  const candidate = selection && "candidate" in selection ? selection.candidate : null;
  const candidateData = useMemo<FeatureCollection<Point>>(
    () => ({
      type: "FeatureCollection",
      features: candidate
        ? [{ type: "Feature", geometry: { type: "Point", coordinates: [candidate.lng, candidate.lat] }, properties: {} }]
        : [],
    }),
    [candidate],
  );

  function reportView() {
    const map = mapRef.current;
    if (!map) return;
    const b = map.getBounds();
    const c = map.getCenter();
    saveLastView({ latitude: c.lat, longitude: c.lng, zoom: map.getZoom() });
    onViewChange({
      bounds: { minLng: b.getWest(), minLat: b.getSouth(), maxLng: b.getEast(), maxLat: b.getNorth() },
      center: { lat: c.lat, lng: c.lng },
    });
  }

  // Our pins are drawn above the base map, so they come first when both are under the tap.
  function handleClick(e: MapLayerMouseEvent) {
    const feature = e.features?.[0];
    if (feature?.layer.id === "place-pins") {
      onSelect(feature.properties.id);
      return;
    }
    const tapped = feature && poiToCandidate(feature);
    if (tapped) onPickCandidate(tapped);
    else onSelect(null);
  }

  return (
    <Map
      ref={mapRef}
      initialViewState={initialView}
      mapStyle={MAP_STYLE_URL}
      style={{ width: "100%", height: "100%" }}
      interactiveLayerIds={["place-pins", ...BASEMAP_POI_LAYERS]}
      // Map credits behind an ⓘ button so they don't run under the bottom buttons on phones.
      attributionControl={{ compact: true }}
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

        {/* Tappable pins at every zoom: small dots zoomed out, sized by popularity up close. */}
        <Layer
          id="place-pins"
          type="circle"
          paint={{
            "circle-color": ["case", ["get", "saved"], "#059669", "#4f46e5"],
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              4, 3,
              12, 5,
              14, ["interpolate", ["linear"], ["get", "weight"], 0, 6, 25, 10],
            ],
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 4, 1, 12, 2],
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

      {/* Ring around a place that isn't on our map yet (picked from search or the base map). */}
      <Source id="candidate" type="geojson" data={candidateData}>
        <Layer
          id="candidate-selected"
          type="circle"
          paint={{
            "circle-radius": 12,
            "circle-color": "rgba(245,158,11,0.15)",
            "circle-stroke-color": "#f59e0b",
            "circle-stroke-width": 3,
          }}
        />
      </Source>
    </Map>
  );
}
