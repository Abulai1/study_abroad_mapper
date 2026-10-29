"use client";

import { useEffect, useState } from "react";
import { osmKey, searchPlaces } from "@/lib/photon";
import { createClient } from "@/lib/supabase/client";
import type { SearchResult } from "@/lib/types";

type Existing = { id: string; people: number };

type Props = {
  near: { lat: number; lng: number };
  /** Lets the "Add a place" button focus the search box. */
  inputRef?: React.Ref<HTMLInputElement>;
  /** Called with the chosen result, plus its id if it's already on our map. */
  onPick: (result: SearchResult, existingId?: string) => void;
};

export default function SearchBox({ near, inputRef, onPick }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [existing, setExisting] = useState<Record<string, Existing>>({});
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Search 300ms after the user stops typing; cancel stale requests.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const found = await searchPlaces(q, near, controller.signal);
        setResults(found);

        // Mark results that are already on our map.
        const supabase = createClient();
        const { data } = await supabase.rpc("lookup_osm_places", { osm_keys: found.map(osmKey) });
        const byKey: Record<string, Existing> = {};
        for (const row of (data ?? []) as { id: string; osm_key: string; people: number }[]) {
          byKey[row.osm_key] = { id: row.id, people: row.people };
        }
        setExisting(byKey);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setError("Search is unavailable right now.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // Only re-search when the text changes, not every time the map moves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  // Open the place in the drawer; it's only added to the map once someone saves it, checks in or tips.
  function choose(r: SearchResult) {
    setOpen(false);
    setQuery("");
    setResults([]);
    onPick(r, existing[osmKey(r)]?.id);
  }

  const showHint = open && query.trim().length < 2;
  const showList = open && !showHint;

  return (
    <div className="relative w-full">
      <input
        ref={inputRef}
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        placeholder="Find a place: café, park, museum…"
        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-lg outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
      />

      {showHint && (
        <p className="absolute mt-2 w-full rounded-xl bg-white px-4 py-3 text-sm text-slate-600 shadow-xl">
          Type a name, or tap any café, shop or park on the map.
        </p>
      )}

      {showList && (
        <div
          // Keep focus in the input so clicking a result doesn't close the list first.
          onMouseDown={(e) => e.preventDefault()}
          className="absolute mt-2 max-h-[60dvh] w-full overflow-auto rounded-xl bg-white shadow-xl"
        >
          {loading && <p className="px-4 py-3 text-sm text-slate-500">Searching…</p>}
          {error && <p className="px-4 py-3 text-sm text-red-600">{error}</p>}
          {!loading && !error && results.length === 0 && (
            <p className="px-4 py-3 text-sm text-slate-500">No places found.</p>
          )}
          <ul>
            {results.map((r) => {
              const known = existing[osmKey(r)];
              return (
                <li key={osmKey(r)} className="border-t border-slate-100 first:border-t-0">
                  <button
                    type="button"
                    onClick={() => choose(r)}
                    className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-slate-900">{r.name}</span>
                      <span className="block truncate text-xs text-slate-500">
                        {[r.category, r.address].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    {known && (
                      <span className="shrink-0 text-xs font-medium text-amber-600">
                        {known.people > 0 ? `★ ${known.people} students` : "On the map"}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
