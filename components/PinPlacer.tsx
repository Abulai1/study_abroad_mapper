"use client";

import { useState } from "react";
import type { MapRef } from "react-map-gl/maplibre";
import { addressAt } from "@/lib/photon";
import { createClient } from "@/lib/supabase/client";
import type { MapPlace, NewPlace } from "@/lib/types";

const CATEGORIES = [
  "café",
  "restaurant",
  "bar",
  "food stall",
  "shop",
  "market",
  "park",
  "viewpoint",
  "museum",
  "study spot",
  "nightlife",
  "other",
];

// How far around the pin to look for an existing place with a similar name.
const DUPLICATE_RADIUS_M = 100;

type Props = {
  mapRef: React.RefObject<MapRef | null>;
  /** What was typed in search, used as the starting name. */
  initialName: string;
  onCancel: () => void;
  /** The place turned out to be on the map already. */
  onOpenExisting: (place: { id: string; lat: number; lng: number }) => void;
  /** Open the new pin in the drawer (it's added on the first save, check-in or tip). */
  onPlace: (place: NewPlace) => void;
};

/** Drop a custom pin for a place OpenStreetMap doesn't have: move the map under a fixed pin. */
export default function PinPlacer({ mapRef, initialName, onCancel, onOpenExisting, onPlace }: Props) {
  const [name, setName] = useState(initialName);
  const [category, setCategory] = useState("");
  const [busy, setBusy] = useState(false);
  const [lookalikes, setLookalikes] = useState<MapPlace[] | null>(null);

  async function finish() {
    const center = mapRef.current?.getCenter();
    if (!center) return;
    setBusy(true);
    onPlace({
      osmType: null,
      osmId: null,
      name: name.trim(),
      category: category || null,
      address: await addressAt(center.lat, center.lng),
      lat: center.lat,
      lng: center.lng,
    });
  }

  async function next(e: React.FormEvent) {
    e.preventDefault();
    const center = mapRef.current?.getCenter();
    if (!center) return;
    setBusy(true);

    // Is something with a similar name already pinned close by?
    const dLat = DUPLICATE_RADIUS_M / 111_320;
    const dLng = dLat / Math.cos((center.lat * Math.PI) / 180);
    const { data } = await createClient().rpc("places_in_view", {
      min_lng: center.lng - dLng,
      min_lat: center.lat - dLat,
      max_lng: center.lng + dLng,
      max_lat: center.lat + dLat,
    });
    const matches = ((data ?? []) as MapPlace[]).filter((p) => similarNames(p.name, name));
    if (matches.length) {
      setLookalikes(matches);
      setBusy(false);
    } else {
      await finish();
    }
  }

  return (
    <>
      {/* The pin stays in the middle of the screen; its tip marks the spot. */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-full">
        <svg width="36" height="48" viewBox="0 0 36 48" aria-hidden className="drop-shadow-lg">
          <path
            d="M18 47C18 47 34 29.5 34 18A16 16 0 0 0 2 18C2 29.5 18 47 18 47Z"
            fill="#4f46e5"
            stroke="white"
            strokeWidth="2.5"
          />
          <circle cx="18" cy="18" r="6" fill="white" />
        </svg>
      </div>

      <div className="absolute inset-x-0 bottom-0 z-20 flex justify-center p-3 md:bottom-4">
        <div className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-2xl">
          {lookalikes ? (
            <>
              <h2 className="font-semibold text-slate-900">Is it one of these?</h2>
              <p className="mt-0.5 text-sm text-slate-500">Already on the map nearby.</p>
              <ul className="mt-3 space-y-1">
                {lookalikes.map((p) => (
                  <li key={p.id}>
                    <button
                      onClick={() => onOpenExisting(p)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-left hover:bg-slate-50"
                    >
                      <span className="block font-medium text-slate-900">{p.name}</span>
                      {p.category && <span className="block text-xs text-slate-500">{p.category}</span>}
                    </button>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => setLookalikes(null)}
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Back
                </button>
                <button
                  disabled={busy}
                  onClick={finish}
                  className="flex-1 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
                >
                  No, add mine
                </button>
              </div>
            </>
          ) : (
            <form onSubmit={next}>
              <h2 className="font-semibold text-slate-900">Add a place yourself</h2>
              <p className="mt-0.5 text-sm text-slate-500">Move the map so the pin sits on the spot.</p>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={200}
                placeholder="Name of the place"
                aria-label="Name of the place"
                className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
              />
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                aria-label="Type of place"
                className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
              >
                <option value="">Type of place (optional)</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c[0].toUpperCase() + c.slice(1)}
                  </option>
                ))}
              </select>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={onCancel}
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy || !name.trim()}
                  className="flex-1 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
                >
                  {busy ? "One moment…" : "Pin it here"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </>
  );
}

// "Café Nómada" vs "cafe nomada bcn": compare without accents, case or punctuation, and
// treat them as similar if one contains the other or they share a distinctive word.
function similarNames(a: string, b: string) {
  const words = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean);
  const wa = words(a);
  const wb = words(b);
  const ja = wa.join(" ");
  const jb = wb.join(" ");
  if (!ja || !jb) return false;
  if (ja.includes(jb) || jb.includes(ja)) return true;
  return wa.some((w) => w.length >= 4 && wb.includes(w));
}
