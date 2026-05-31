create table if not exists public.blocks (
    id bigint generated always as identity primary key,
    blocker_id uuid not null references public.profiles(id) on delete cascade,
    blocked_user_id uuid not null references public.profiles(id) on delete cascade,
    created_at timestamptz not null default now(),
    unique (blocker_id, blocked_user_id)
);

create table if not exists public.reports (
    id bigint generated always as identity primary key,
    reporter_user_id uuid references public.profiles(id) on delete set null,
    reported_user_id uuid references public.profiles(id) on delete set null,
    reason text not null,
    details text,
    status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
    created_at timestamptz not null default now()
);

alter table public.blocks enable row level security;
alter table public.reports enable row level security;

create policy "blocks_select_self"
on public.blocks
for select
to authenticated
using ((select auth.uid()) = blocker_id);

create policy "blocks_insert_self"
on public.blocks
for insert
to authenticated
with check ((select auth.uid()) = blocker_id);

create policy "blocks_delete_self"
on public.blocks
for delete
to authenticated
using ((select auth.uid()) = blocker_id);

create policy "reports_insert_self"
on public.reports
for insert
to authenticated
with check ((select auth.uid()) = reporter_user_id);

create policy "reports_select_moderators"
on public.reports
for select
to authenticated
using (
    exists (
        select 1
        from public.user_roles
        where user_roles.user_id = (select auth.uid())
          and user_roles.role in ('moderator', 'admin')
    )
);
