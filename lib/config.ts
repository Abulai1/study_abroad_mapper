// Where the map opens on a first visit. After that it reopens where you left it
// (see lib/lastView.ts).
export const DEFAULT_VIEW = {
  latitude: 41.3874,
  longitude: 2.1686,
  zoom: 12.5,
};

// Free vector basemap (OpenStreetMap data) – no API key needed.
export const MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

// Zoom level where the heatmap has faded out and pins take over.
export const PIN_MIN_ZOOM = 13;
