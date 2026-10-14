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

/** Search OpenStreetMap places via Photon, ranking results near `near` first. */
export async function searchPlaces(
  query: string,
  near: { lat: number; lng: number },
  signal?: AbortSignal,
): Promise<SearchResult[]> {
  const params = new URLSearchParams({
    q: query,
    lat: String(near.lat),
    lon: String(near.lng),
    limit: "8",
    lang: "en",
  });
  EXCLUDED_TAGS.forEach((tag) => params.append("osm_tag", tag));
  const res = await fetch(`${PHOTON_URL}?${params}`, { signal });
  if (!res.ok) throw new Error(`Search failed (${res.status})`);
  const json: { features: PhotonFeature[] } = await res.json();

  return json.features
    .filter((f) => f.properties.name && OSM_TYPES[f.properties.osm_type])
    .map((f) => {
      const p = f.properties;
      const street = p.street && p.housenumber ? `${p.street} ${p.housenumber}` : p.street;
      return {
        osmType: OSM_TYPES[p.osm_type],
        osmId: p.osm_id,
        name: p.name!,
        category: p.osm_value?.replaceAll("_", " ") ?? null,
        address: [street, p.city, p.country].filter(Boolean).join(", ") || null,
        lat: f.geometry.coordinates[1],
        lng: f.geometry.coordinates[0],
      };
    });
}

export const osmKey = (r: { osmType: string; osmId: number }) => `${r.osmType}/${r.osmId}`;
