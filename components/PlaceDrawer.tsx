"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useTransition } from "react";
import {
  addTip,
  checkIn,
  deleteTip,
  reportTip,
  savePlace,
  unsavePlace,
} from "@/app/actions";
import { createClient } from "@/lib/supabase/client";
import type { ActionResult, Place, PlaceStats, Tip } from "@/lib/types";

type Props = {
  placeId: string;
  userId: string | null;
  onClose: () => void;
  /** Tell the map something changed (saves/check-ins affect pins and heat). */
  onChanged: () => void;
};

type Details = {
  place: Place;
  stats: PlaceStats | null;
  tips: Tip[];
  save: { note: string | null } | null;
  myCheckins: string[];
};

const today = () => new Date().toISOString().slice(0, 10);

export default function PlaceDrawer({ placeId, userId, onClose, onChanged }: Props) {
  const [details, setDetails] = useState<Details | null>(null);
  const [loadError, setLoadError] = useState("");
  const [message, setMessage] = useState("");
  const [tipText, setTipText] = useState("");
  const [note, setNote] = useState("");
  const [isPending, startTransition] = useTransition();

  const load = useCallback(async () => {
    const supabase = createClient();
    const [place, stats, tips, save, checkins] = await Promise.all([
      supabase.from("places").select("*").eq("id", placeId).single(),
      supabase.rpc("place_stats", { place_ids: [placeId] }),
      supabase
        .from("tips")
        .select("id, user_id, body, created_at, profiles(display_name)")
        .eq("place_id", placeId)
        .order("created_at", { ascending: false })
        .limit(50),
      userId
        ? supabase.from("saves").select("note").eq("place_id", placeId).maybeSingle()
        : Promise.resolve({ data: null }),
      userId
        ? supabase.from("checkins").select("checkin_date").eq("place_id", placeId)
        : Promise.resolve({ data: [] }),
    ]);

    if (place.error) {
      setLoadError("Couldn't load this place.");
      return;
    }
    setDetails({
      place: place.data as Place,
      stats: ((stats.data ?? []) as PlaceStats[])[0] ?? null,
      tips: (tips.data ?? []) as unknown as Tip[],
      save: save.data as { note: string | null } | null,
      myCheckins: ((checkins.data ?? []) as { checkin_date: string }[]).map((c) => c.checkin_date),
    });
    setNote((save.data as { note: string | null } | null)?.note ?? "");
  }, [placeId, userId]);

  useEffect(() => {
    setDetails(null);
    setLoadError("");
    setMessage("");
    setTipText("");
    load();
  }, [load]);

  // Run a server action, show any error, then reload this drawer (and the map if needed).
  function run(action: () => Promise<ActionResult>, opts: { affectsMap?: boolean; success?: string } = {}) {
    setMessage("");
    startTransition(async () => {
      const res = await action();
      if (!res.ok) {
        setMessage(res.error);
        return;
      }
      if (opts.success) setMessage(opts.success);
      await load();
      if (opts.affectsMap) onChanged();
    });
  }

  const p = details?.place;
  const saved = !!details?.save;
  const checkedInToday = details?.myCheckins.includes(today()) ?? false;

  return (
    <aside className="pointer-events-auto fixed inset-x-0 bottom-0 z-20 flex max-h-[70dvh] flex-col rounded-t-2xl bg-white shadow-2xl md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-96 md:rounded-none">
      <div className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-slate-200 md:hidden" />

      <header className="flex items-start justify-between gap-3 px-5 pt-3 pb-2 md:pt-5">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold text-slate-900">{p?.name ?? "Loading…"}</h2>
          {p && (
            <p className="mt-0.5 text-sm text-slate-500">
              {[p.category, p.address].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100"
        >
          ✕
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-5 pb-6">
        {loadError && <p className="text-sm text-red-600">{loadError}</p>}

        {details && (
          <>
            <p className="text-sm text-slate-600">
              {details.stats && details.stats.people > 0 ? (
                <>
                  🔥 <strong>{details.stats.people}</strong> students ·{" "}
                  {details.stats.savers} saves · {details.stats.visitors} have been
                </>
              ) : (
                "Not on the heatmap yet. It appears once 3 students save or visit."
              )}
            </p>

            {userId ? (
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  disabled={isPending}
                  onClick={() =>
                    run(() => (saved ? unsavePlace(placeId) : savePlace(placeId, note)), {
                      affectsMap: true,
                    })
                  }
                  className={`rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-60 ${
                    saved
                      ? "bg-emerald-600 text-white hover:bg-emerald-700"
                      : "border border-slate-300 text-slate-800 hover:bg-slate-50"
                  }`}
                >
                  {saved ? "✓ Saved" : "☆ Save"}
                </button>
                <button
                  disabled={isPending || checkedInToday}
                  onClick={() => run(() => checkIn(placeId), { affectsMap: true })}
                  className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
                >
                  {checkedInToday ? "✓ Checked in today" : "📍 I've been here"}
                </button>
                {details.myCheckins.length > 0 && (
                  <p className="col-span-2 text-xs text-slate-500">
                    You&apos;ve checked in {details.myCheckins.length}{" "}
                    {details.myCheckins.length === 1 ? "time" : "times"}.
                  </p>
                )}
              </div>
            ) : (
              <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                <Link href="/login" className="font-medium text-indigo-600">
                  Sign in
                </Link>{" "}
                to save this place, check in, or leave a tip.
              </p>
            )}

            {saved && (
              <div className="mt-4">
                <label className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Private note (only you can see this)
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={1000}
                  rows={2}
                  placeholder="e.g. go at sunset, bring cash"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500"
                />
                {note !== (details.save?.note ?? "") && (
                  <button
                    disabled={isPending}
                    onClick={() => run(() => savePlace(placeId, note), { success: "Note saved." })}
                    className="mt-1 text-sm font-medium text-indigo-600 disabled:opacity-60"
                  >
                    Save note
                  </button>
                )}
              </div>
            )}

            {message && <p className="mt-3 text-sm text-slate-700">{message}</p>}

            <section className="mt-6">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Tips from students
              </h3>

              {userId && (
                <form
                  className="mt-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const text = tipText;
                    run(async () => {
                      const res = await addTip(placeId, text);
                      if (res.ok) setTipText("");
                      return res;
                    });
                  }}
                >
                  <textarea
                    value={tipText}
                    onChange={(e) => setTipText(e.target.value)}
                    maxLength={1000}
                    rows={2}
                    placeholder="Share a tip: best time to go, what to order, student discounts…"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500"
                  />
                  <button
                    type="submit"
                    disabled={isPending || !tipText.trim()}
                    className="mt-1 rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
                  >
                    Post tip
                  </button>
                </form>
              )}

              {details.tips.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">No tips yet. Be the first!</p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {details.tips.map((t) => (
                    <li key={t.id} className="rounded-lg bg-slate-50 p-3">
                      <p className="whitespace-pre-wrap text-sm text-slate-800">{t.body}</p>
                      <div className="mt-1.5 flex items-center justify-between text-xs text-slate-500">
                        <span>
                          {t.profiles?.display_name ?? "student"} ·{" "}
                          {new Date(t.created_at).toLocaleDateString()}
                        </span>
                        {userId === t.user_id ? (
                          <button
                            disabled={isPending}
                            onClick={() => run(() => deleteTip(t.id))}
                            className="hover:text-red-600"
                          >
                            Delete
                          </button>
                        ) : userId ? (
                          <button
                            disabled={isPending}
                            onClick={() =>
                              run(() => reportTip(t.id), { success: "Thanks, we'll take a look." })
                            }
                            className="hover:text-slate-800"
                          >
                            Report
                          </button>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </aside>
  );
}
