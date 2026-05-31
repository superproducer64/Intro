create extension if not exists pgcrypto;

create table if not exists public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    email text unique,
    name text not null default '',
    age integer not null default 18 check (age >= 18),
    bio text not null default '',
    avatar_id text,
    photo_path text,
    accepted_terms boolean not null default false,
    profile_setup_completed boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.profile_prompts (
    id bigint generated always as identity primary key,
    user_id uuid not null references public.profiles(id) on delete cascade,
    prompt text not null,
    answer text not null,
    sort_order integer not null default 0,
    created_at timestamptz not null default now(),
    unique (user_id, sort_order)
);

create table if not exists public.user_roles (
    user_id uuid primary key references public.profiles(id) on delete cascade,
    role text not null default 'user' check (role in ('user', 'moderator', 'admin')),
    created_at timestamptz not null default now()
);

create table if not exists public.push_tokens (
    id bigint generated always as identity primary key,
    user_id uuid not null references public.profiles(id) on delete cascade,
    device_token text not null,
    platform text not null default 'ios',
    created_at timestamptz not null default now(),
    unique (user_id, device_token)
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.profiles (
        id,
        email,
        name
    )
    values (
        new.id,
        new.email,
        coalesce(new.raw_user_meta_data ->> 'name', '')
    )
    on conflict (id) do nothing;

    insert into public.user_roles (
        user_id,
        role
    )
    values (
        new.id,
        'user'
    )
    on conflict (user_id) do nothing;

    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.profile_prompts enable row level security;
alter table public.user_roles enable row level security;
alter table public.push_tokens enable row level security;

create policy "profiles_select_self"
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id);

create policy "profiles_update_self"
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy "profile_prompts_select_self"
on public.profile_prompts
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "profile_prompts_insert_self"
on public.profile_prompts
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "profile_prompts_update_self"
on public.profile_prompts
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "profile_prompts_delete_self"
on public.profile_prompts
for delete
to authenticated
using ((select auth.uid()) = user_id);

create policy "push_tokens_select_self"
on public.push_tokens
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "push_tokens_insert_self"
on public.push_tokens
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "push_tokens_delete_self"
on public.push_tokens
for delete
to authenticated
using ((select auth.uid()) = user_id);

create policy "user_roles_select_self"
on public.user_roles
for select
to authenticated
using ((select auth.uid()) = user_id);
