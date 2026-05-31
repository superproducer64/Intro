create table if not exists public.messages (
    id bigint generated always as identity primary key,
    match_id bigint not null references public.matches(id) on delete cascade,
    sender_id uuid not null references public.profiles(id) on delete cascade,
    receiver_id uuid not null references public.profiles(id) on delete cascade,
    body text not null,
    created_at timestamptz not null default now()
);

alter table public.messages enable row level security;

create policy "messages_select_participant"
on public.messages
for select
to authenticated
using (
    (select auth.uid()) = sender_id
    or
    (select auth.uid()) = receiver_id
);

create policy "messages_insert_sender"
on public.messages
for insert
to authenticated
with check ((select auth.uid()) = sender_id);
