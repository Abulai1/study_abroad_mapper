import type { SearchResult } from "./types";

const PHOTON_URL = "https://photon.komoot.io/api/";
const OSM_TYPES = { N: "node", W: "way", R: "relation" } as const;

// Transit stops often share a landmark's name ("Sagrada Família" bus stop) and
// outrank the landmark itself, so leave them out of results.
const EXCLUDED_TAGS = [
  "!public_transport",
  "!highway:bus_stop",
  "!railway:stop",
  "!railway:halt",
  "!railway:tram_stop",
  "!railway:subway_entrance",
];

type PhotonFeature = {
  geometry: { coordinates: [number, number] };
  properties: {
    osm_type: keyof typeof OSM_TYPES;
    osm_id: number;
    osm_value?: string;
    name?: string;
    street?: string;
    housenumber?: string;
    city?: string;
    country?: string;
  };
};

/**
 * Search OpenStreetMap places via Photon, ranking results near `near` first. The map's
 * zoom tells Photon how local to keep it (zoomed in on a city → mostly that city).
 */
export async function searchPlaces(
  query: string,
  near: { lat: number; lng: number; zoom?: number },
  signal?: AbortSignal,
): Promise<SearchResult[]> {
  const params = new URLSearchParams({
    q: query,
    lat: String(near.lat),
    lon: String(near.lng),
    limit: "15",
    lang: "en",
  });
  if (near.zoom !== undefined) params.set("zoom", String(Math.round(near.zoom)));
  EXCLUDED_TAGS.forEach((tag) => params.append("osm_tag", tag));
  const res = await fetch(`${PHOTON_URL}?${params}`, { signal });
  if (!res.ok) throw new Error(`Search failed (${res.status})`);
  const json: { features: PhotonFeature[] } = await res.json();

  // Photon sometimes returns the same OpenStreetMap place twice; keep the first.
  const seen = new Set<string>();
  return json.features
    .filter((f) => f.properties.name && OSM_TYPES[f.properties.osm_type])
    .filter((f) => {
      const key = `${f.properties.osm_type}/${f.properties.osm_id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((f) => {
      const p = f.properties;
      return {
        osmType: OSM_TYPES[p.osm_type],
        osmId: p.osm_id,
        name: p.name!,
        category: p.osm_value?.replaceAll("_", " ") ?? null,
        address: formatAddress(p),
        lat: f.geometry.coordinates[1],
        lng: f.geometry.coordinates[0],
      };
    });
}

/** The street address nearest a spot (for custom pins), or null if Photon has none. */
export async function addressAt(lat: number, lng: number): Promise<string | null> {
  try {
    const params = new URLSearchParams({ lat: String(lat), lon: String(lng), limit: "1", lang: "en" });
    const res = await fetch(`https://photon.komoot.io/reverse?${params}`);
    if (!res.ok) return null;
    const json: { features: PhotonFeature[] } = await res.json();
    return json.features[0] ? formatAddress(json.features[0].properties) : null;
  } catch {
    return null; // The address is a nice-to-have; never block adding a place on it.
  }
}

function formatAddress(p: PhotonFeature["properties"]): string | null {
  const street = p.street && p.housenumber ? `${p.street} ${p.housenumber}` : p.street;
  return [street, p.city, p.country].filter(Boolean).join(", ") || null;
}

export const osmKey = (r: { osmType: string; osmId: number }) => `${r.osmType}/${r.osmId}`;
