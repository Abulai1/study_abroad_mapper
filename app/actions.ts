"use server";

// Server Actions: every write to the database goes through here.
// They run on the server, check who is signed in, and Row Level Security
// in the database double-checks that users only touch what they're allowed to.

import { createClient } from "@/lib/supabase/server";
import type { ActionResult, SearchResult } from "@/lib/types";

async function getUserClient() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

const NOT_SIGNED_IN = { ok: false, error: "Sign in to do that." } as const;

/** Add a place from a search result, or return the existing one if it's already on the map. */
export async function addPlace(result: SearchResult): Promise<ActionResult<{ id: string }>> {
  const { supabase, user } = await getUserClient();
  if (!user) return NOT_SIGNED_IN;

  const { data: inserted, error } = await supabase
    .from("places")
    .upsert(
      {
        osm_type: result.osmType,
        osm_id: result.osmId,
        name: result.name.slice(0, 200),
        category: result.category?.slice(0, 50) ?? null,
        address: result.address?.slice(0, 300) ?? null,
        lat: result.lat,
        lng: result.lng,
        created_by: user.id,
      },
      { onConflict: "osm_type,osm_id", ignoreDuplicates: true },
    )
    .select("id");
  if (error) return { ok: false, error: error.message };
  if (inserted?.length) return { ok: true, data: { id: inserted[0].id } };

  // Already existed: look it up instead of creating a duplicate.
  const { data: existing, error: lookupError } = await supabase
    .from("places")
    .select("id")
    .eq("osm_type", result.osmType)
    .eq("osm_id", result.osmId)
    .single();
  if (lookupError) return { ok: false, error: lookupError.message };
  return { ok: true, data: { id: existing.id } };
}

export async function addTip(placeId: string, body: string): Promise<ActionResult> {
  const { supabase, user } = await getUserClient();
  if (!user) return NOT_SIGNED_IN;
  const text = body.trim();
  if (!text) return { ok: false, error: "Tip can't be empty." };
  if (text.length > 1000) return { ok: false, error: "Tips are limited to 1000 characters." };

  const { error } = await supabase
    .from("tips")
    .insert({ place_id: placeId, user_id: user.id, body: text });
  return error ? { ok: false, error: error.message } : { ok: true, data: undefined };
}

export async function deleteTip(tipId: string): Promise<ActionResult> {
  const { supabase, user } = await getUserClient();
  if (!user) return NOT_SIGNED_IN;
  const { error } = await supabase.from("tips").delete().eq("id", tipId).eq("user_id", user.id);
  return error ? { ok: false, error: error.message } : { ok: true, data: undefined };
}

export async function reportTip(tipId: string): Promise<ActionResult> {
  const { supabase, user } = await getUserClient();
  if (!user) return NOT_SIGNED_IN;
  const { error } = await supabase.from("reports").insert({ tip_id: tipId, user_id: user.id });
  return error ? { ok: false, error: error.message } : { ok: true, data: undefined };
}

/** Save a place (or update the private note on an existing save). */
export async function savePlace(placeId: string, note: string): Promise<ActionResult> {
  const { supabase, user } = await getUserClient();
  if (!user) return NOT_SIGNED_IN;
  const text = note.trim().slice(0, 1000) || null;

  const { error } = await supabase
    .from("saves")
    .upsert({ user_id: user.id, place_id: placeId, note: text }, { onConflict: "user_id,place_id" });
  return error ? { ok: false, error: error.message } : { ok: true, data: undefined };
}

export async function unsavePlace(placeId: string): Promise<ActionResult> {
  const { supabase, user } = await getUserClient();
  if (!user) return NOT_SIGNED_IN;
  const { error } = await supabase
    .from("saves")
    .delete()
    .eq("user_id", user.id)
    .eq("place_id", placeId);
  return error ? { ok: false, error: error.message } : { ok: true, data: undefined };
}

export async function checkIn(placeId: string): Promise<ActionResult> {
  const { supabase, user } = await getUserClient();
  if (!user) return NOT_SIGNED_IN;
  const { error } = await supabase.from("checkins").insert({ user_id: user.id, place_id: placeId });
  if (error?.code === "23505") return { ok: false, error: "You already checked in here today." };
  return error ? { ok: false, error: error.message } : { ok: true, data: undefined };
}
