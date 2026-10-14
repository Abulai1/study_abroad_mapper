# Changelog

A summary of the work done in each branch, newest first.

## `1-create-a-heatmap` (2026-10-14)

Set up the project and built the first feature: a shared map with a popularity heatmap, using Barcelona as the pilot city.

**Project setup**
- Next.js + TypeScript + Tailwind web app
- Supabase for the database, sign-in, and security rules (runs locally with Docker)
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

**Known issues**
- The free public Photon search server is currently slow (30–40 seconds per search)
- The full browser click-through (map display, sign-in via email link) still needs a manual test
