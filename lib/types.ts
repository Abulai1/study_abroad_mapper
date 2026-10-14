// Shapes of the data the app passes around.

/** A place as drawn on the map (from the `places_in_view` function). */
export type MapPlace = {
  id: string;
  name: string;
  category: string | null;
  lat: number;
  lng: number;
  /** Popularity score; 0 until at least 3 different people have saved or checked in. */
  weight: number;
};

/** Full place details (a row of the `places` table). */
export type Place = {
  id: string;
  osm_type: "node" | "way" | "relation" | null;
  osm_id: number | null;
  name: string;
  category: string | null;
  address: string | null;
  lat: number;
  lng: number;
  created_by: string | null;
  created_at: string;
};

export type PlaceStats = {
  savers: number;
  visitors: number;
  people: number;
};

export type Tip = {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
  profiles: { display_name: string | null } | null;
};

export type SavedPlace = {
  place_id: string;
  note: string | null;
  created_at: string;
  places: Pick<Place, "name" | "category" | "lat" | "lng"> | null;
};

/** A search result from Photon, ready to become a Place. */
export type SearchResult = {
  osmType: "node" | "way" | "relation";
  osmId: number;
  name: string;
  category: string | null;
  address: string | null;
  lat: number;
  lng: number;
};

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };
