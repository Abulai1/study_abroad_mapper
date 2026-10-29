import type { MapGeoJSONFeature } from "maplibre-gl";
import type { SearchResult } from "./types";

// Base-map layers with tappable places (cafés, shops, parks…). Transit stops are
// left out, as in search (see EXCLUDED_TAGS in lib/photon.ts).
export const BASEMAP_POI_LAYERS = ["poi_r1", "poi_r7", "poi_r20"];

// OpenFreeMap encodes the OpenStreetMap id in each feature's id as
// osmId * 10 + type, where the last digit is 1 = node, 2 = way, 3 = relation.
const OSM_TYPE_BY_DIGIT = { 1: "node", 2: "way", 3: "relation" } as const;

/** Turn a tapped base-map place into the same shape as a search result. */
export function poiToCandidate(feature: MapGeoJSONFeature): SearchResult | null {
  const id = Number(feature.id);
  const osmType = OSM_TYPE_BY_DIGIT[(id % 10) as keyof typeof OSM_TYPE_BY_DIGIT];
  const name = feature.properties?.name;
  if (!osmType || typeof name !== "string" || feature.geometry.type !== "Point") return null;

  const [lng, lat] = feature.geometry.coordinates;
  const subclass = feature.properties?.subclass;
  return {
    osmType,
    osmId: Math.floor(id / 10),
    name,
    category: typeof subclass === "string" ? subclass.replaceAll("_", " ") : null,
    address: null,
    lat,
    lng,
  };
}
