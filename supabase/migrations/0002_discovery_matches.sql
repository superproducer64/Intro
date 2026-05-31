create table if not exists public.swipes (
    id bigint generated always as identity primary key,
    swiper_id uuid not null references public.profiles(id) on delete cascade,
    target_user_id uuid not null references public.profiles(id) on delete cascade,
    direction text not null check (direction in ('like', 'pass')),
    created_at timestamptz not null default now(),
    unique (swiper_id, target_user_id)
);

create table if not exists public.matches (
    id bigint generated always as identity primary key,
    user_a uuid not null references public.profiles(id) on delete cascade,
    user_b uuid not null references public.profiles(id) on delete cascade,
    created_at timestamptz not null default now(),
    check (user_a <> user_b),
    unique (user_a, user_b)
);

alter table public.swipes enable row level security;
alter table public.matches enable row level security;

create policy "swipes_select_self"
on public.swipes
for select
to authenticated
using ((select auth.uid()) = swiper_id);

create policy "swipes_insert_self"
on public.swipes
for insert
to authenticated
with check ((select auth.uid()) = swiper_id);

create policy "swipes_update_self"
on public.swipes
for update
to authenticated
using ((select auth.uid()) = swiper_id)
with check ((select auth.uid()) = swiper_id);

create policy "swipes_delete_self"
on public.swipes
for delete
to authenticated
using ((select auth.uid()) = swiper_id);

create policy "matches_select_participant"
on public.matches
for select
to authenticated
using (
    (select auth.uid()) = user_a
    or
    (select auth.uid()) = user_b
);

create policy "matches_insert_participant"
on public.matches
for insert
to authenticated
with check (
    (select auth.uid()) = user_a
    or
    (select auth.uid()) = user_b
);
