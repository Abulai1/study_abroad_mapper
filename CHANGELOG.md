# Changelog

A summary of the work done in each branch, newest first.

## `8-create-a-landing-page` (2026-10-27 – 2026-10-29)

Added a welcome pop-up so new visitors know what the site is and are prompted to create an account, and switched sign-in to email + password.

- **Welcome pop-up:** signed-out visitors see a pop-up over the map that explains the site (a shared map of where students abroad go, with tips) and lists what you can do. You can create an account or sign in right in the pop-up, or choose "Just look around" to browse the map and tips without an account. Saving, check-ins, tips and adding places still need an account.
- **Shown once per device:** after it's closed, or once you've signed in, it stays closed on that device (also after signing out). The "Sign in" button in the corner reopens it.
- **Email + password sign-in:** replaced emailed sign-in links with email + password ("Sign in" / "Create account"), in one form shared by the pop-up and the `/login` page. Supabase's built-in email service (about 2 emails/hour, team members only) was blocking sign-ins, and university link scanners may have been using up links. "Confirm email" is off for the beta, so no emails are sent. Password resets are done in the dashboard for now.
- **Clearer sign-in errors:** wrong password, existing account, too-short password and too many attempts now get plain-English messages. Failed emailed links show the real reason.

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
