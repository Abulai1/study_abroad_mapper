-- Sample data for local development: Barcelona places + fake student activity.
-- Generated from real OpenStreetMap ids so searching these places finds the existing pin.
-- Never run this against production.

-- 10 fake students
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change)
select '00000000-0000-0000-0000-000000000000', ('00000000-0000-0000-0000-0000000000' || lpad(i::text, 2, '0'))::uuid,
  'authenticated', 'authenticated', 'student' || i || '@example.com', '', now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
from generate_series(1, 10) i;

-- Places, with how many of the fake students engage with each (0-10)
create temporary table seed_places (osm_type text, osm_id bigint, name text, category text, lat float8, lng float8, popularity int);
insert into seed_places values
  ('relation', 9194723, 'Sagrada Família', 'place of worship', 41.4035046, 2.1744283, 10),
  ('way', 66713401, 'Park Güell', 'park', 41.4142348, 2.1524576, 10),
  ('relation', 9427554, 'Casa Batlló', 'landmark', 41.3915446, 2.1646961, 9),
  ('relation', 6288735, 'La Boqueria', 'marketplace', 41.381736, 2.1715515, 10),
  ('relation', 7333373, 'Platja de la Barceloneta', 'beach', 41.3793285, 2.192971, 9),
  ('way', 142894789, 'Bunkers del Carmel', 'viewpoint', 41.4193923, 2.1616974, 8),
  ('relation', 271463, 'Parc de la Ciutadella', 'park', 41.388416, 2.1862546, 8),
  ('relation', 8974896, 'La Pedrera - Casa Milà', 'landmark', 41.3953996, 2.1617621, 7),
  ('relation', 3298476, 'Barcelona Cathedral', 'place of worship', 41.3839296, 2.1765539, 6),
  ('way', 537787889, 'Plaça de Catalunya', 'square', 41.3873006, 2.1687832, 6),
  ('way', 31957078, 'Mercat de Santa Caterina', 'marketplace', 41.3861363, 2.1785048, 4),
  ('way', 188938001, 'Museu Picasso', 'museum', 41.3851039, 2.1812015, 6),
  ('way', 377216661, 'Palau de la Música Catalana', 'theatre', 41.3875837, 2.1752316, 4),
  ('relation', 19658818, 'Montjuïc Castle', 'attraction', 41.3633756, 2.1661443, 5),
  ('way', 35816134, 'Magic Fountain of Montjuïc', 'fountain', 41.3711565, 2.1517393, 7),
  ('node', 5337055959, 'Spotify Camp Nou', 'museum', 41.38039, 2.1206365, 6),
  ('way', 54752416, 'Tibidabo', 'station', 41.4214329, 2.1193868, 3),
  ('relation', 7422813, 'Hospital de Sant Pau', 'hospital', 41.4139764, 2.1755472, 3),
  ('way', 36930946, 'MACBA', 'museum', 41.3831012, 2.1667659, 4),
  ('way', 541071062, 'Plaça Reial', 'square', 41.3800985, 2.1752608, 5),
  ('way', 249401797, 'Mercat de Sant Antoni', 'marketplace', 41.3786255, 2.1620493, 3),
  ('way', 227207626, 'Parc del Laberint d''Horta', 'park', 41.4399791, 2.1453938, 1),
  ('way', 893988164, 'Carrer de Blai', 'street', 41.3744231, 2.1625675, 6),
  ('way', 1330931571, 'Plaça del Sol', 'square', 41.4016246, 2.1567108, 4),
  ('relation', 3347844, 'Fundació Joan Miró', 'museum', 41.3686445, 2.1600839, 2),
  ('relation', 2175041, 'Platja del Bogatell', 'beach', 41.3939544, 2.2066734, 3);

insert into public.places (osm_type, osm_id, name, category, lat, lng)
select osm_type, osm_id, name, category, lat, lng from seed_places;

-- The first N students save each place; roughly 60% of those also checked in.
insert into public.saves (user_id, place_id)
select ('00000000-0000-0000-0000-0000000000' || lpad(i::text, 2, '0'))::uuid, p.id
from seed_places s
join public.places p on p.osm_type = s.osm_type and p.osm_id = s.osm_id
cross join generate_series(1, 10) i
where i <= s.popularity;

insert into public.checkins (user_id, place_id, checkin_date)
select ('00000000-0000-0000-0000-0000000000' || lpad(i::text, 2, '0'))::uuid, p.id, current_date - (i % 7)
from seed_places s
join public.places p on p.osm_type = s.osm_type and p.osm_id = s.osm_id
cross join generate_series(1, 10) i
where i <= floor(s.popularity * 0.6);

-- A few tips
insert into public.tips (place_id, user_id, body)
select p.id, ('00000000-0000-0000-0000-0000000000' || lpad((row_number() over () % 10 + 1)::text, 2, '0'))::uuid, t.body
from (values
  ('Bunkers del Carmel', 'Go for sunset and bring snacks + something to sit on. Best free view of the whole city.'),
  ('Bunkers del Carmel', 'Take the V17 or 24 bus most of the way up, the walk from the metro is steep.'),
  ('La Boqueria', 'The stalls at the front are tourist-priced. Walk to the back for cheaper fruit and the bar counters.'),
  ('Sagrada Família', 'Book tickets online days ahead. Under-30 with a student card gets a discount.'),
  ('Park Güell', 'Free if you only walk the outer park; the paid monumental zone needs a timed ticket.'),
  ('Carrer de Blai', 'Pintxos street! €1-2 each, best on a weeknight. Go to a few different bars.'),
  ('Platja del Bogatell', 'Way less crowded than Barceloneta and cleaner. Good for a beach day with friends.'),
  ('Magic Fountain of Montjuïc', 'Shows only run certain evenings, so check the schedule before going up.'),
  ('Mercat de Sant Antoni', 'Sunday morning book & vintage market outside is great.'),
  ('Museu Picasso', 'Free entry Thursday evenings and first Sunday of the month (reserve online).')
) as t(place_name, body)
join public.places p on p.name = t.place_name;
