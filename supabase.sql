-- Slab Row database. Paste into Supabase → SQL Editor → Run. Safe to re-run.

-- Profiles: public display info for every account
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default 'Collector',
  role text not null default 'collector',
  table_name text,
  city text,
  color text,
  updated_at timestamptz default now()
);
alter table public.profiles enable row level security;
drop policy if exists "profiles read" on public.profiles;
create policy "profiles read" on public.profiles for select to authenticated using (true);
drop policy if exists "profiles insert own" on public.profiles;
create policy "profiles insert own" on public.profiles for insert to authenticated with check (id = auth.uid());
drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- New accounts get a profile automatically
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name) values (new.id, coalesce(nullif(new.raw_user_meta_data->>'name',''), split_part(new.email,'@',1)))
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Private app state (binder, ledger, tickets, settings): only the owner can read or write
create table if not exists public.user_state (
  id uuid primary key references auth.users(id) on delete cascade,
  me jsonb not null,
  updated_at timestamptz default now()
);
alter table public.user_state enable row level security;
drop policy if exists "state own" on public.user_state;
create policy "state own" on public.user_state for all to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Listings: the for-sale cards everyone can browse
create table if not exists public.listings (
  owner uuid not null references auth.users(id) on delete cascade,
  card_id text not null,
  card jsonb not null,
  price numeric not null,
  updated_at timestamptz default now(),
  primary key (owner, card_id)
);
alter table public.listings enable row level security;
drop policy if exists "listings read" on public.listings;
create policy "listings read" on public.listings for select to authenticated using (true);
drop policy if exists "listings write own" on public.listings;
create policy "listings write own" on public.listings for all to authenticated using (owner = auth.uid()) with check (owner = auth.uid());

-- Shows: anyone signed in can create one; only the host can change or delete it
create table if not exists public.shows (
  id uuid primary key default gen_random_uuid(),
  host uuid not null default auth.uid() references auth.users(id) on delete cascade,
  host_name text,
  name text not null,
  tagline text,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  early_price numeric not null default 0,
  general_price numeric not null default 0,
  crowd boolean not null default true,
  created_at timestamptz default now()
);
alter table public.shows enable row level security;
drop policy if exists "shows read" on public.shows;
create policy "shows read" on public.shows for select to authenticated using (true);
drop policy if exists "shows insert" on public.shows;
create policy "shows insert" on public.shows for insert to authenticated with check (host = auth.uid());
drop policy if exists "shows host update" on public.shows;
create policy "shows host update" on public.shows for update to authenticated using (host = auth.uid()) with check (host = auth.uid());
drop policy if exists "shows host delete" on public.shows;
create policy "shows host delete" on public.shows for delete to authenticated using (host = auth.uid());

-- Booths: a vendor's table slot in a show (8 slots per hall)
create table if not exists public.booths (
  show_key text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  slot int not null check (slot between 0 and 7),
  created_at timestamptz default now(),
  primary key (show_key, user_id),
  unique (show_key, slot)
);
alter table public.booths enable row level security;
drop policy if exists "booths read" on public.booths;
create policy "booths read" on public.booths for select to authenticated using (true);
drop policy if exists "booths claim own" on public.booths;
create policy "booths claim own" on public.booths for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "booths release own" on public.booths;
create policy "booths release own" on public.booths for delete to authenticated using (user_id = auth.uid());

-- Offers and orders between two people: only the buyer and seller can see or change them
create table if not exists public.offers (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'offer',          -- offer (buyer asks), order (buy now), pitch (seller offers)
  buyer uuid not null references auth.users(id) on delete cascade,
  seller uuid not null references auth.users(id) on delete cascade,
  buyer_name text,
  seller_name text,
  by_user uuid not null default auth.uid(),
  cards jsonb not null,
  amount numeric not null,
  status text not null default 'pending',      -- pending, countered, accepted, declined, completed, cancelled
  note text,
  ship jsonb,
  show_key text,
  received boolean not null default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  check (buyer <> seller)
);
alter table public.offers enable row level security;
drop policy if exists "offers parties read" on public.offers;
create policy "offers parties read" on public.offers for select to authenticated using (auth.uid() = buyer or auth.uid() = seller);
drop policy if exists "offers parties insert" on public.offers;
create policy "offers parties insert" on public.offers for insert to authenticated with check ((auth.uid() = buyer or auth.uid() = seller) and by_user = auth.uid());
drop policy if exists "offers parties update" on public.offers;
create policy "offers parties update" on public.offers for update to authenticated using (auth.uid() = buyer or auth.uid() = seller) with check (auth.uid() = buyer or auth.uid() = seller);

-- Live updates for offers and booths
do $$ begin
  begin alter publication supabase_realtime add table public.offers; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.booths; exception when duplicate_object then null; end;
end $$;

-- Card photos: public to view, each person uploads only into their own folder
insert into storage.buckets (id, name, public) values ('photos', 'photos', true) on conflict (id) do update set public = true;
drop policy if exists "photos upload own" on storage.objects;
create policy "photos upload own" on storage.objects for insert to authenticated with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "photos delete own" on storage.objects;
create policy "photos delete own" on storage.objects for delete to authenticated using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
