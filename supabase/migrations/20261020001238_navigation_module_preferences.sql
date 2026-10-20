alter table public.profiles
add column navigation_modules jsonb not null default '{"transactions": true, "creditCards": true, "investments": true}'::jsonb
check (jsonb_typeof(navigation_modules) = 'object');
