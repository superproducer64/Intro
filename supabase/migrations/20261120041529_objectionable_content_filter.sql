-- Basic objectionable-content filter (Apple Guideline 1.2) for the
-- user-generated text surfaces that currently have none: Café messages,
-- prompt answers, host-authored prompt questions, session titles, and
-- circle name/description. A blocklist substring match is enforced at the
-- database level (BEFORE INSERT/UPDATE triggers) so it can't be bypassed by
-- any client, mirroring how block-aware reads are already enforced via RLS
-- rather than client-side filtering alone.
--
-- This is intentionally a basic, maintainable word filter (as flagged in
-- the review notes) — not a substitute for the monitored report queue,
-- which remains the backstop for anything the list misses or that's
-- objectionable without using a blocked term.

create or replace function public.contains_blocked_content(input text)
returns boolean
language sql
immutable
as $$
  select input is not null and exists (
    select 1
    from unnest(array[
      -- slurs / hate speech (representative, not exhaustive)
      'nigger', 'nigga', 'faggot', 'retard', 'spic', 'chink', 'kike', 'tranny',
      -- sexual / explicit
      'porn', 'blowjob', 'handjob', 'cumshot', 'xxx sex', 'nude pics', 'sext me',
      -- harassment / self-harm facilitation
      'kill yourself', 'kys',
      -- common profanity (lower bar than the above, but still screened out
      -- of prompts/sessions/circle metadata which read as semi-official)
      'fuck', 'shit', 'cunt', 'asshole', 'bitch'
    ]) as term
    where lower(input) like '%' || term || '%'
  );
$$;

create or replace function public.enforce_content_filter_cafe_messages()
returns trigger
language plpgsql
as $$
begin
  if public.contains_blocked_content(new.content) then
    raise exception 'blocked_content_filter: message contains disallowed content';
  end if;
  return new;
end;
$$;

create or replace function public.enforce_content_filter_prompt_responses()
returns trigger
language plpgsql
as $$
begin
  if public.contains_blocked_content(new.body) then
    raise exception 'blocked_content_filter: answer contains disallowed content';
  end if;
  return new;
end;
$$;

create or replace function public.enforce_content_filter_prompts()
returns trigger
language plpgsql
as $$
begin
  if public.contains_blocked_content(new.body) then
    raise exception 'blocked_content_filter: prompt contains disallowed content';
  end if;
  return new;
end;
$$;

create or replace function public.enforce_content_filter_sessions()
returns trigger
language plpgsql
as $$
begin
  if public.contains_blocked_content(new.title) then
    raise exception 'blocked_content_filter: session title contains disallowed content';
  end if;
  return new;
end;
$$;

create or replace function public.enforce_content_filter_circles()
returns trigger
language plpgsql
as $$
begin
  if public.contains_blocked_content(new.name) or public.contains_blocked_content(new.description) then
    raise exception 'blocked_content_filter: circle name/description contains disallowed content';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_content_filter on public.cafe_messages;
create trigger trg_content_filter
  before insert or update on public.cafe_messages
  for each row execute function public.enforce_content_filter_cafe_messages();

drop trigger if exists trg_content_filter on public.prompt_responses;
create trigger trg_content_filter
  before insert or update on public.prompt_responses
  for each row execute function public.enforce_content_filter_prompt_responses();

drop trigger if exists trg_content_filter on public.prompts;
create trigger trg_content_filter
  before insert or update on public.prompts
  for each row execute function public.enforce_content_filter_prompts();

drop trigger if exists trg_content_filter on public.sessions;
create trigger trg_content_filter
  before insert or update on public.sessions
  for each row execute function public.enforce_content_filter_sessions();

drop trigger if exists trg_content_filter on public.circles;
create trigger trg_content_filter
  before insert or update on public.circles
  for each row execute function public.enforce_content_filter_circles();
