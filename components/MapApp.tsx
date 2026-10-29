"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MapRef } from "react-map-gl/maplibre";
import { DEFAULT_VIEW } from "@/lib/config";
import { createClient } from "@/lib/supabase/client";
import type { MapPlace, SavedPlace, SearchResult, Selection } from "@/lib/types";
import { hasSeenWelcome, markWelcomeSeen } from "@/lib/welcome";
import type { ViewInfo } from "./MapView";
import PlaceDrawer from "./PlaceDrawer";
import SavedPanel from "./SavedPanel";
import SearchBox from "./SearchBox";
import WelcomeModal from "./WelcomeModal";

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
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [places, setPlaces] = useState<MapPlace[]>([]);
  const [saves, setSaves] = useState<SavedPlace[]>([]);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [showHeat, setShowHeat] = useState(true);
  const [savedOpen, setSavedOpen] = useState(false);
  const [center, setCenter] = useState({ lat: DEFAULT_VIEW.latitude, lng: DEFAULT_VIEW.longitude });
  const [mapError, setMapError] = useState("");
  const [welcomeOpen, setWelcomeOpen] = useState(false);

  // Welcome signed-out visitors, once per device. Checked after mount because
  // localStorage doesn't exist during server rendering.
  useEffect(() => {
    if (userId) {
      markWelcomeSeen();
      setWelcomeOpen(false);
    } else if (!hasSeenWelcome()) {
      setWelcomeOpen(true);
    }
  }, [userId]);

  const closeWelcome = useCallback(() => {
    markWelcomeSeen();
    setWelcomeOpen(false);
  }, []);

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
      setMapError("Couldn't load places. Check your connection and try again.");
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

  function flyTo(place: { lat: number; lng: number }) {
    const map = mapRef.current;
    // Flying triggers a "move end", which reloads places so new ones appear.
    map?.flyTo({ center: [place.lng, place.lat], zoom: Math.max(map.getZoom(), 15.5) });
  }

  function openPlace(place: { id: string; lat: number; lng: number }) {
    setSelection({ id: place.id });
    setSavedOpen(false);
    flyTo(place);
  }

  // A place picked from search or the base map: open it by id if it's already on our map,
  // otherwise as a candidate that gets added once someone saves it, checks in or tips.
  async function openCandidate(result: SearchResult, existingId?: string) {
    setSavedOpen(false);
    flyTo(result);
    let id = existingId;
    if (!id) {
      const { data } = await createClient().rpc("lookup_osm_places", {
        osm_keys: [`${result.osmType}/${result.osmId}`],
      });
      id = (data as { id: string }[] | null)?.[0]?.id;
    }
    setSelection(id ? { id } : { candidate: result });
  }

  function addAPlace() {
    setSelection(null);
    setSavedOpen(false);
    searchInputRef.current?.focus();
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
        selection={selection}
        showHeat={showHeat}
        onSelect={(id) => {
          setSelection(id ? { id } : null);
          if (id) setSavedOpen(false);
        }}
        onPickCandidate={(c) => openCandidate(c)}
        onViewChange={handleViewChange}
      />

      {/* Top bar: search + account */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start gap-2 p-3 md:p-4">
        <div className="pointer-events-auto w-full max-w-md">
          <SearchBox near={center} inputRef={searchInputRef} onPick={openCandidate} />
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
            <button
              onClick={() => setWelcomeOpen(true)}
              className="block rounded-xl bg-indigo-600 px-3 py-3 text-sm font-medium text-white shadow-lg hover:bg-indigo-700"
            >
              Sign in
            </button>
          )}
        </div>
      </div>

      {/* Bottom-center controls, lifted on phones to clear the full-width map credits line. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-11 z-10 flex flex-col items-center gap-2 px-3 md:bottom-6">
        {mapError && (
          <p className="pointer-events-auto rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 shadow">
            {mapError}
          </p>
        )}
        <div className="pointer-events-auto flex flex-wrap justify-center gap-2">
          <button
            onClick={addAPlace}
            className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-lg hover:bg-indigo-700"
          >
            + Add a place
          </button>
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
                setSelection(null);
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

      {selection && (
        <PlaceDrawer
          placeId={"id" in selection ? selection.id : undefined}
          candidate={"candidate" in selection ? selection.candidate : undefined}
          userId={userId}
          onClose={() => setSelection(null)}
          onChanged={() => {
            loadPlaces();
            loadSaves();
          }}
          onCreated={(id) => setSelection({ id })}
          onSignIn={() => setWelcomeOpen(true)}
        />
      )}

      {welcomeOpen && !userId && <WelcomeModal onClose={closeWelcome} />}
    </div>
  );
}
