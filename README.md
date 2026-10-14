# Study Abroad Mapper

A shared map for students abroad: anyone can add places and tips to one central map, and a Strava-style heatmap shows where students actually go (based on saves and "I've been here" check-ins).

## Stack
- **Next.js + TypeScript + Tailwind**: the web app
- **MapLibre GL** (via `react-map-gl`) + **OpenFreeMap** tiles: the map and heatmap
- **Photon**: place search over OpenStreetMap
- **Supabase**: Postgres database (+ PostGIS), auth (email magic links), row-level security

## Run it locally

Requires Node 20+ and Docker Desktop (running).

```bash
npm install
npx supabase start          # starts the local database; first run downloads images
cp .env.example .env.local  # then paste the "API URL" and "anon key" from `npx supabase status`
npm run dev                 # http://localhost:3000
```

- **Sign-in emails** don't really get sent locally. Open the local inbox at http://127.0.0.1:54324 and click the link.
- **Database dashboard (Studio):** http://127.0.0.1:54323
- **Reset the database** (re-runs migrations + sample Barcelona data): `npx supabase db reset`

## Project layout
```
app/
  page.tsx               map page (server: reads the signed-in user)
  actions.ts             server actions: add place, tips, save, check in
  login/page.tsx         magic-link sign in
  auth/callback/route.ts finishes sign in from the email link
components/
  MapApp.tsx             map screen state + overlays
  MapView.tsx            MapLibre map: heatmap, pins, labels
  SearchBox.tsx          Photon search → open or add a place
  PlaceDrawer.tsx        place details, tips, save, check in
  SavedPanel.tsx         "My saves" list
lib/
  config.ts              pilot city, map style
  photon.ts              place search
  supabase/              browser + server Supabase clients
supabase/
  migrations/            database tables, security rules, heatmap functions
  seed.sql               sample Barcelona places + fake activity
```

## How the heatmap works
Each place's weight = number of people who saved it + 2 × number of people who checked in. A place shows no heat until **3 different people** have saved or visited it, so one person's activity can never be picked out on the map. Raw saves and check-ins are private to their owner; the map only ever sees the totals.
