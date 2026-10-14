"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MapRef } from "react-map-gl/maplibre";
import { PILOT_CITY } from "@/lib/config";
import { createClient } from "@/lib/supabase/client";
import type { MapPlace, SavedPlace } from "@/lib/types";
import type { ViewInfo } from "./MapView";
import PlaceDrawer from "./PlaceDrawer";
import SavedPanel from "./SavedPanel";
import SearchBox from "./SearchBox";

// MapLibre needs the browser, so skip it during server rendering.
const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-slate-200" />,
});

type Props = { userId: string | null; userEmail: string | null };

export default function MapApp({ userId, userEmail }: Props) {
  const router = useRouter();
  const mapRef = useRef<MapRef | null>(null);
  const viewRef = useRef<ViewInfo | null>(null);
  const requestRef = useRef(0);

  const [places, setPlaces] = useState<MapPlace[]>([]);
  const [saves, setSaves] = useState<SavedPlace[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showHeat, setShowHeat] = useState(true);
  const [savedOpen, setSavedOpen] = useState(false);
  const [center, setCenter] = useState({ lat: PILOT_CITY.latitude, lng: PILOT_CITY.longitude });
  const [mapError, setMapError] = useState("");

  const savedIds = useMemo(() => new Set(saves.map((s) => s.place_id)), [saves]);

  // Load the places (and their heat) inside the visible map area.
  const loadPlaces = useCallback(async () => {
    const view = viewRef.current;
    if (!view) return;
    const request = ++requestRef.current;
    const supabase = createClient();
    const { data, error } = await supabase.rpc("places_in_view", {
      min_lng: view.bounds.minLng,
      min_lat: view.bounds.minLat,
      max_lng: view.bounds.maxLng,
      max_lat: view.bounds.maxLat,
    });
    if (request !== requestRef.current) return; // a newer request already started
    if (error) {
      setMapError("Couldn't load places. Is Supabase running?");
      return;
    }
    setMapError("");
    setPlaces((data ?? []) as MapPlace[]);
  }, []);

  const loadSaves = useCallback(async () => {
    if (!userId) return;
    const supabase = createClient();
    const { data } = await supabase
      .from("saves")
      .select("place_id, note, created_at, places(name, category, lat, lng)")
      .order("created_at", { ascending: false });
    setSaves((data ?? []) as unknown as SavedPlace[]);
  }, [userId]);

  useEffect(() => {
    loadSaves();
  }, [loadSaves]);

  function handleViewChange(view: ViewInfo) {
    viewRef.current = view;
    setCenter(view.center);
    loadPlaces();
  }

  function openPlace(place: { id: string; lat: number; lng: number }) {
    setSelectedId(place.id);
    setSavedOpen(false);
    const map = mapRef.current;
    // Flying triggers a "move end", which reloads places so new ones appear.
    map?.flyTo({ center: [place.lng, place.lat], zoom: Math.max(map.getZoom(), 15.5) });
  }

  async function signOut() {
    await createClient().auth.signOut();
    router.refresh();
  }

  return (
    <div className="relative h-dvh w-full overflow-hidden">
      <MapView
        mapRef={mapRef}
        places={places}
        savedIds={savedIds}
        selectedId={selectedId}
        showHeat={showHeat}
        onSelect={(id) => {
          setSelectedId(id);
          if (id) setSavedOpen(false);
        }}
        onViewChange={handleViewChange}
      />

      {/* Top bar: search + account */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start gap-2 p-3 md:p-4">
        <div className="pointer-events-auto w-full max-w-md">
          <SearchBox near={center} signedIn={!!userId} onPick={openPlace} />
        </div>
        <div className="pointer-events-auto ml-auto shrink-0">
          {userId ? (
            <button
              onClick={signOut}
              title={userEmail ?? undefined}
              className="rounded-xl bg-white px-3 py-3 text-sm font-medium text-slate-700 shadow-lg hover:bg-slate-50"
            >
              Sign out
            </button>
          ) : (
            <Link
              href="/login"
              className="block rounded-xl bg-indigo-600 px-3 py-3 text-sm font-medium text-white shadow-lg hover:bg-indigo-700"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>

      {/* Bottom-left controls */}
      <div className="absolute bottom-6 left-3 z-10 flex flex-col gap-2 md:left-4">
        {mapError && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 shadow">{mapError}</p>
        )}
        <div className="flex gap-2">
          <button
            onClick={() => setShowHeat((v) => !v)}
            className={`rounded-full px-4 py-2 text-sm font-medium shadow-lg ${
              showHeat ? "bg-slate-900 text-white" : "bg-white text-slate-700"
            }`}
          >
            🔥 Heatmap {showHeat ? "on" : "off"}
          </button>
          {userId && (
            <button
              onClick={() => {
                setSavedOpen((v) => !v);
                setSelectedId(null);
              }}
              className="rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-lg"
            >
              ☆ My saves ({saves.length})
            </button>
          )}
        </div>
      </div>

      {savedOpen && (
        <SavedPanel saves={saves} onPick={openPlace} onClose={() => setSavedOpen(false)} />
      )}

      {selectedId && (
        <PlaceDrawer
          placeId={selectedId}
          userId={userId}
          onClose={() => setSelectedId(null)}
          onChanged={() => {
            loadPlaces();
            loadSaves();
          }}
        />
      )}
    </div>
  );
}
