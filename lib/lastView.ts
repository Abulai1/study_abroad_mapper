// Remembers where the map was left on this device, so it reopens there.
export type MapViewState = { latitude: number; longitude: number; zoom: number };

const STORAGE_KEY = "study-abroad-mapper:last-view";

export function loadLastView(): MapViewState | null {
  try {
    const view = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    const valid =
      view && [view.latitude, view.longitude, view.zoom].every((n) => typeof n === "number" && Number.isFinite(n));
    return valid ? { latitude: view.latitude, longitude: view.longitude, zoom: view.zoom } : null;
  } catch {
    // No storage (server, private window, blocked site data) or bad data.
    return null;
  }
}

export function saveLastView(view: MapViewState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(view));
  } catch {
    // Not being able to remember the view is fine.
  }
}
