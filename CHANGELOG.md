# Changelog

A summary of the work done in each branch, newest first.

## `7-update-from-example-map-to-real-data` (2026-10-27)

Switched from the Barcelona example map to real data in any city.

- **Sample data removed:** deleted the 26 sample Barcelona places and 10 fake students (with their tips, saves and check-ins) from the shared database. Removed `supabase/seed.sql` and turned seeding off, so it can't come back. The project now holds only real entries from the team and beta users.
- **Map remembers where you left it:** it reopens at the last place and zoom you viewed on that device. A first visit still opens on Barcelona.
- **Clearer error:** "Couldn't load places" now suggests checking your connection instead of asking whether Supabase is running (a leftover from the local Docker setup)
- README: removed sample-data mentions, stronger warning on `db reset --linked`, and a note that heat needs 3+ people per place, so expect mostly pins at first

## `1-create-a-heatmap` (2026-10-14 – 2026-10-27)

Set up the project and built the first feature: a shared map with a popularity heatmap, using Barcelona as the pilot city.

### Update (2026-10-27)

**Shared hosted database**
- Moved Supabase from local Docker to one hosted supabase.com project, used as the team's shared dev/test environment. Everyone sees the same places, tips and accounts, and nobody needs Docker.
- Loaded the tables, security rules and sample Barcelona data into the hosted project
- README now explains how to connect, how to change the database safely as a team, and what to do when the free project pauses

**Fixes**
- The map was blank (no streets, no heatmap) because MapLibre couldn't load its background worker file once bundled. The worker is now copied into `public/` on `npm run dev` / `npm run build`.

### Initial build (2026-10-14)

**Project setup**
- Next.js + TypeScript + Tailwind web app
- Supabase for the database, sign-in, and security rules
- MapLibre with free OpenFreeMap tiles for the map, Photon for place search

**Features**
- **Map:** full-screen map that loads the places currently on screen, with zoom and "find me" controls
- **Heatmap:** glow shows popular places. Score = saves + 2 × check-ins. A place shows no heat until 3 different people have saved or visited it (privacy). The glow fades into clickable pins as you zoom in.
- **Search & add:** search real places by name; places already on the map are marked, and new ones can be added. Each real-world place exists only once (matched by its OpenStreetMap ID). Bus and metro stops are left out of results.
- **Place details:** public tips from students, a Save button with a private note, an "I've been here" check-in (once per day), and the option to delete your own tips or report others'
- **My saves:** a list of your saved places; tapping one flies the map to it
- **Sign-in:** email magic links; browsing works without an account

**Database**
- Tables: profiles, places, tips, saves, check-ins, reports, plus lists (set up for future trip/group maps)
- Security rules: places and tips are public, while saves, notes, and check-ins are private to their owner
- Sample data: 26 real Barcelona places with fake student activity and tips

### Known issues
- The free public Photon search server is currently slow (30–40 seconds per search)
- The map display has been checked in a browser, but the rest of the click-through (sign-in via email link, saving, check-ins, tips, reporting, search) still needs a manual test
