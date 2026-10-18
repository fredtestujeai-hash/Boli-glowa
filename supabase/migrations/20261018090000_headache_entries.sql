-- Dziennik bólu głowy: jeden wpis na użytkownika na dzień.
-- Tabela żyje w tym samym projekcie co Klata, ale jest od niej całkowicie oddzielna.

create table if not exists public.headache_entries (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  entry_date     date not null,

  -- epizod bólu
  had_headache   boolean not null default false,
  intensity      smallint check (intensity between 0 and 10),
  start_time     time,
  duration_h     numeric(4,1) check (duration_h >= 0 and duration_h <= 168),
  locations      text[] not null default '{}',
  qualities      text[] not null default '{}',
  symptoms       text[] not null default '{}',
  disability     smallint check (disability between 0 and 2),
  medications    jsonb not null default '[]'::jsonb check (jsonb_typeof(medications) = 'array'),

  -- styl życia / możliwe czynniki wyzwalające
  sleep_h        numeric(3,1) check (sleep_h between 0 and 24),
  sleep_quality  smallint check (sleep_quality between 1 and 3),
  screen_h       numeric(3,1) check (screen_h between 0 and 24),
  coffee         smallint check (coffee between 0 and 30),
  energy_drinks  smallint check (energy_drinks between 0 and 30),
  water_glasses  smallint check (water_glasses between 0 and 40),
  stress         smallint check (stress between 1 and 5),
  alcohol        smallint check (alcohol between 0 and 40),
  exercise_min   smallint check (exercise_min between 0 and 1440),
  triggers       text[] not null default '{}',
  notes          text check (char_length(notes) <= 4000),

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint headache_entries_user_day unique (user_id, entry_date)
);

create or replace function public.headache_entries_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace trigger headache_entries_touch
  before update on public.headache_entries
  for each row execute function public.headache_entries_touch();

alter table public.headache_entries enable row level security;

-- Tylko zalogowany właściciel widzi i zmienia swoje wpisy. Rola anon nie ma żadnej polityki,
-- więc RLS nie pokazuje jej ani jednego wiersza.
grant select, insert, update, delete on public.headache_entries to authenticated;

create policy "headache_select_own" on public.headache_entries
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "headache_insert_own" on public.headache_entries
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "headache_update_own" on public.headache_entries
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "headache_delete_own" on public.headache_entries
  for delete to authenticated using ((select auth.uid()) = user_id);
