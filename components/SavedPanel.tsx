"use client";

import type { SavedPlace } from "@/lib/types";

type Props = {
  saves: SavedPlace[];
  onPick: (place: { id: string; lat: number; lng: number }) => void;
  onClose: () => void;
};

export default function SavedPanel({ saves, onPick, onClose }: Props) {
  return (
    <aside className="fixed inset-x-0 bottom-0 z-20 flex max-h-[60dvh] flex-col rounded-t-2xl bg-white shadow-2xl md:inset-y-0 md:right-auto md:left-0 md:max-h-none md:w-80 md:rounded-none">
      <header className="flex items-center justify-between px-5 pt-4 pb-2">
        <h2 className="text-lg font-semibold text-slate-900">My saved places</h2>
        <button
          onClick={onClose}
          aria-label="Close"
          className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100"
        >
          ✕
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-3 pb-4">
        {saves.length === 0 ? (
          <p className="px-2 text-sm text-slate-500">
            Nothing saved yet. Open a place and tap ☆ Save.
          </p>
        ) : (
          <ul>
            {saves.map((s) =>
              s.places ? (
                <li key={s.place_id}>
                  <button
                    onClick={() => onPick({ id: s.place_id, lat: s.places!.lat, lng: s.places!.lng })}
                    className="w-full rounded-lg px-2 py-2.5 text-left hover:bg-slate-50"
                  >
                    <span className="block font-medium text-slate-900">{s.places.name}</span>
                    <span className="block truncate text-xs text-slate-500">
                      {s.note || s.places.category || ""}
                    </span>
                  </button>
                </li>
              ) : null,
            )}
          </ul>
        )}
      </div>
    </aside>
  );
}
