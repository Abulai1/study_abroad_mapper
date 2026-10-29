# Study Abroad Mapper

A shared map for students abroad: anyone can add places and tips to one central map, and a Strava-style heatmap shows where students actually go (based on saves and "I've been here" check-ins).

## Stack
- **Next.js + TypeScript + Tailwind**: the web app
- **MapLibre GL** (via `react-map-gl`) + **OpenFreeMap** tiles: the map and heatmap
- **Photon**: place search over OpenStreetMap
- **Supabase**: Postgres database (+ PostGIS), auth (email + password), row-level security

## Run it

Requires Node 20+. The database is a shared, hosted Supabase project (our dev/test environment), so there's no Docker to run and everyone on the team sees the same places, tips and accounts.

```bash
npm install
cp .env.example .env.local  # then fill in the two values (see below)
npm run dev                 # http://localhost:3000
```

- **Always start with `npm run dev`** (or `npm run build`), not `next dev` directly. It first copies MapLibre's worker file into `public/`; without it the map stays blank.
- **`.env.local` values:** Supabase dashboard → Project Settings → API → "Project URL" and "anon / public" key. Or ask a teammate. Share them privately; `.env.local` is never committed.
- **Dashboard access:** ask to be invited under Organization settings → Team.
- **Sign-in** is email + password, and no emails are sent. "Confirm email" is turned off for the beta, because Supabase's built-in email service only sends about 2 emails an hour, and only to team members. As a result, nobody checks that people own the email they sign up with, and there's no "Forgot password?" yet. To reset a password, delete the user in the dashboard (Authentication → Users) so they can sign up again. Once we set up a proper email service, turn "Confirm email" back on and add password resets.
- **Where the map opens:** wherever you last left it on that device. On a first visit it opens on Barcelona (`DEFAULT_VIEW` in `lib/config.ts`). Search works in any city.
- **Paused project?** Free projects pause after about a week unused (the map shows no places and sign-in fails). Open the project in the dashboard and click Restore; it takes a few minutes.

### Setting up a new Supabase project (one time)
Already done for our dev project. Repeat these steps for any new one, such as a future production project:

1. Create the project at supabase.com/dashboard.
2. Authentication → URL Configuration: set Site URL to the app's address (`http://localhost:3000` for dev) and add `<that address>/**` under Redirect URLs (needed for any emailed links later).
3. Authentication → Sign In / Providers → Email: turn off "Confirm email" (see the sign-in note above).
4. Organization settings → Team: invite teammates.
5. `npx supabase link --project-ref <ref>`, then `npx supabase db push`.

### Changing the database
The database is shared, so a change applies to everyone at once.

1. Write a new migration in `supabase/migrations/`.
2. Merge it in git first.
3. One person applies it: `npx supabase db push` (first time: `npx supabase login` and `npx supabase link --project-ref <ref>`).

`npx supabase db reset --linked` **permanently erases all real data for everyone** (places, tips, saves, check-ins). There's no sample data to reload. Don't run it unless the whole team agrees.

### Optional: local Docker database
To try a risky database change privately, run Supabase locally (needs Docker Desktop): `npx supabase start`, then point `.env.local` at the "API URL" and "anon key" from `npx supabase status`. Local sign-in emails land at http://127.0.0.1:54324, and Studio is at http://127.0.0.1:54323. Switch `.env.local` back to the hosted values when you're done.

## Using the site
- **Find a place:** search by name with the box at the top (or "+ Add a place"), or tap any café, shop or park on the map.
- **Add it to the map:** the place opens in a side panel. It's added to the shared map the first time someone saves it (☆ Save, with an optional private note), checks in ("I've been here") or posts a tip. Just looking at a place doesn't add it.
- **Pins and heat:** every added place shows as a pin at any zoom (green = saved by you). A place glows on the heatmap once 3 different people have saved it or checked in.
- **Browse without an account:** anyone can look around and read tips. Saving, checking in and tips need an account.

## Project layout
```
app/
  page.tsx               map page (server: reads the signed-in user)
  actions.ts             server actions: add place, tips, save, check in
  login/page.tsx         sign-in page (used by "Sign in" links in the drawer and search)
  auth/callback/route.ts finishes sign in from the email link
components/
  MapApp.tsx             map screen state + overlays
  MapView.tsx            MapLibre map: heatmap, pins, labels
  SearchBox.tsx          Photon search → open or add a place
  PlaceDrawer.tsx        place details, tips, save, check in
  SavedPanel.tsx         "My saves" list
  WelcomeModal.tsx       welcome pop-up for signed-out visitors (once per device)
  SignInForm.tsx         email + password sign in / create account (pop-up + /login)
lib/
  config.ts              pilot city, map style
  photon.ts              place search
  basemap.ts             turns a tapped base-map place into a place we can add
  lastView.ts            remembers where the map was left (per device)
  welcome.ts             remembers the welcome pop-up was closed (per device)
  supabase/              browser + server Supabase clients
public/
  maplibre-gl-worker.mjs generated by `npm run dev`/`build`; not committed
supabase/
  migrations/            database tables, security rules, heatmap functions
```

## How the heatmap works
Each place's weight = number of people who saved it + 2 × number of people who checked in. A place shows no heat until **3 different people** have saved or visited it, so one person's activity can never be picked out on the map. While there are only a few users, expect mostly pins (zoom in past level 13) and little heat. Raw saves and check-ins are private to their owner; the map only ever sees the totals.
