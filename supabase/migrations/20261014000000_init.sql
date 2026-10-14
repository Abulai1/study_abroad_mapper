-- Study Abroad Mapper: initial schema
-- One shared set of places + public tips, private saves/check-ins,
-- and an aggregated "heat" score that never exposes individual users.

create extension if not exists postgis with schema extensions;

create schema if not exists private;

-- ---------------------------------------------------------------------------
-- Profiles (one per auth user, created automatically on sign-up)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 50),
  school text check (char_length(school) <= 100),
  created_at timestamptz not null default now()
);

create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, split_part(new.email, '@', 1));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------------
-- Places: the single, shared, de-duplicated list of real-world locations
-- ---------------------------------------------------------------------------
create table public.places (
  id uuid primary key default gen_random_uuid(),
  -- OpenStreetMap identity; ids are only unique within a type, so the pair is the key.
  -- Null for custom pins (future feature).
  osm_type text check (osm_type in ('node', 'way', 'relation')),
  osm_id bigint,
  name text not null check (char_length(name) between 1 and 200),
  category text check (char_length(category) <= 50),
  address text check (char_length(address) <= 300),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  location extensions.geography(Point, 4326) generated always as (
    extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography
  ) stored,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (osm_type, osm_id),
  check ((osm_type is null) = (osm_id is null))
);

create index places_location_idx on public.places using gist (location);
create index places_lat_lng_idx on public.places (lat, lng);

-- ---------------------------------------------------------------------------
-- Tips: public notes anyone can read
-- ---------------------------------------------------------------------------
create table public.tips (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index tips_place_idx on public.tips (place_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Saves: private bookmarks with a private note
-- ---------------------------------------------------------------------------
create table public.saves (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  place_id uuid not null references public.places (id) on delete cascade,
  note text check (char_length(note) <= 1000),
  created_at timestamptz not null default now(),
  primary key (user_id, place_id)
);

create index saves_place_idx on public.saves (place_id);

-- ---------------------------------------------------------------------------
-- Check-ins: "I've been here", at most once per user/place/day
-- ---------------------------------------------------------------------------
create table public.checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  place_id uuid not null references public.places (id) on delete cascade,
  checkin_date date not null default current_date,
  created_at timestamptz not null default now(),
  unique (user_id, place_id, checkin_date)
);

create index checkins_place_idx on public.checkins (place_id);

-- ---------------------------------------------------------------------------
-- Lists: private collections now; group/public (trip maps) later
-- ---------------------------------------------------------------------------
create table public.lists (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  visibility text not null default 'private' check (visibility in ('private', 'group', 'public')),
  created_at timestamptz not null default now()
);

create table public.list_places (
  list_id uuid not null references public.lists (id) on delete cascade,
  place_id uuid not null references public.places (id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (list_id, place_id)
);

-- ---------------------------------------------------------------------------
-- Reports: flag a tip or place for review
-- ---------------------------------------------------------------------------
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  place_id uuid references public.places (id) on delete cascade,
  tip_id uuid references public.tips (id) on delete cascade,
  reason text check (char_length(reason) <= 500),
  created_at timestamptz not null default now(),
  check (place_id is not null or tip_id is not null)
);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.places enable row level security;
alter table public.tips enable row level security;
alter table public.saves enable row level security;
alter table public.checkins enable row level security;
alter table public.lists enable row level security;
alter table public.list_places enable row level security;
alter table public.reports enable row level security;

-- Profiles: display names are public (shown on tips); edit only your own.
create policy "profiles are public" on public.profiles for select using (true);
create policy "update own profile" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Places: anyone can read; signed-in users can add; creators can edit/delete.
create policy "places are public" on public.places for select using (true);
create policy "add places" on public.places for insert to authenticated
  with check (created_by = (select auth.uid()));
create policy "update own places" on public.places for update to authenticated
  using (created_by = (select auth.uid())) with check (created_by = (select auth.uid()));
create policy "delete own places" on public.places for delete to authenticated
  using (created_by = (select auth.uid()));

-- Tips: anyone can read; signed-in users can add; authors can delete.
create policy "tips are public" on public.tips for select using (true);
create policy "add tips" on public.tips for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "delete own tips" on public.tips for delete to authenticated
  using (user_id = (select auth.uid()));

-- Saves and check-ins: strictly private to their owner.
create policy "own saves" on public.saves for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own checkins" on public.checkins for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Lists: owner only for now.
create policy "own lists" on public.lists for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "own list places" on public.list_places for all to authenticated
  using (exists (select 1 from public.lists l where l.id = list_id and l.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.lists l where l.id = list_id and l.owner_id = (select auth.uid())));

-- Reports: write-only for users; reviewed by admins in the dashboard.
create policy "file reports" on public.reports for insert to authenticated
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Popularity (the heatmap signal)
-- weight = distinct savers + 2 x distinct check-in users.
-- Places with fewer than 3 distinct people get weight 0 so a single
-- person's activity can never be singled out on the map.
-- ---------------------------------------------------------------------------
create function private.place_popularity(place_ids uuid[] default null)
returns table (place_id uuid, savers int, visitors int, people int, weight int)
language sql
stable
security definer
set search_path = ''
as $$
  with s as (
    select place_id, count(*)::int as n from public.saves
    where place_ids is null or place_id = any (place_ids)
    group by place_id
  ),
  c as (
    select place_id, count(distinct user_id)::int as n from public.checkins
    where place_ids is null or place_id = any (place_ids)
    group by place_id
  ),
  u as (
    select place_id, count(distinct user_id)::int as n
    from (
      select place_id, user_id from public.saves
      union
      select place_id, user_id from public.checkins
    ) x
    where place_ids is null or place_id = any (place_ids)
    group by place_id
  )
  select
    u.place_id,
    case when u.n >= 3 then coalesce(s.n, 0) else 0 end,
    case when u.n >= 3 then coalesce(c.n, 0) else 0 end,
    case when u.n >= 3 then u.n else 0 end,
    case when u.n >= 3 then coalesce(s.n, 0) + 2 * coalesce(c.n, 0) else 0 end
  from u
  left join s on s.place_id = u.place_id
  left join c on c.place_id = u.place_id;
$$;

-- All places inside the visible map area, with their heat weight.
create function public.places_in_view(
  min_lng double precision,
  min_lat double precision,
  max_lng double precision,
  max_lat double precision
)
returns table (id uuid, name text, category text, lat double precision, lng double precision, weight int)
language sql
stable
set search_path = ''
as $$
  select p.id, p.name, p.category, p.lat, p.lng, coalesce(pop.weight, 0)
  from public.places p
  left join private.place_popularity() pop on pop.place_id = p.id
  where p.lat between min_lat and max_lat
    and p.lng between min_lng and max_lng
  order by coalesce(pop.weight, 0) desc
  limit 2000;
$$;

-- Popularity numbers for specific places (place drawer, search results).
create function public.place_stats(place_ids uuid[])
returns table (place_id uuid, savers int, visitors int, people int)
language sql
stable
set search_path = ''
as $$
  select pop.place_id, pop.savers, pop.visitors, pop.people
  from private.place_popularity(place_ids) pop;
$$;

-- Which OSM results from a search already exist here (keys like 'node/123').
create function public.lookup_osm_places(osm_keys text[])
returns table (id uuid, osm_key text, people int)
language sql
stable
set search_path = ''
as $$
  select p.id, p.osm_type || '/' || p.osm_id, coalesce(pop.people, 0)
  from public.places p
  left join private.place_popularity(
    array(select p2.id from public.places p2 where p2.osm_type || '/' || p2.osm_id = any (osm_keys))
  ) pop on pop.place_id = p.id
  where p.osm_type || '/' || p.osm_id = any (osm_keys);
$$;

-- The private schema is not exposed via the API; let the public wrappers call into it.
grant usage on schema private to anon, authenticated;
revoke all on function private.place_popularity(uuid[]) from public;
grant execute on function private.place_popularity(uuid[]) to anon, authenticated;
revoke all on function private.handle_new_user() from public, anon, authenticated;
