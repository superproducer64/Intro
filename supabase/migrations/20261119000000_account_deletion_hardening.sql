-- DRAFT: not applied. Review before running.
-- Account deletion hardening for App Store 5.1.1(v).
--
-- 1. prompts.created_by had no ON DELETE rule (NO ACTION), so deleting a user who
--    authored a prompt would fail with a foreign-key error. Keep the prompt, drop the author.
-- 2. Version delete_user() in the repo. The function already exists in the remote DB;
--    this is the same body, with the redundant manual deletes kept for clarity. Every other
--    user-linked table cascades from profiles / auth.users.
--
-- NOTE: Storage files (profile-photos, profile-videos) are NOT removed here. Deleting rows
-- from storage.objects in SQL leaves the underlying files orphaned, so the app must call the
-- Storage API before invoking delete_user (see deleteAccount() change in api.js).

begin;

alter table public.prompts alter column created_by drop not null;
alter table public.prompts drop constraint prompts_created_by_fkey;
alter table public.prompts
  add constraint prompts_created_by_fkey
  foreign key (created_by) references auth.users(id) on delete set null;

create or replace function public.delete_user()
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  delete from public.messages where sender_id = uid or receiver_id = uid;
  delete from public.matches where user1_id = uid or user2_id = uid;
  delete from public.swipes where swiper_id = uid or target_id = uid;
  delete from public.profiles where id = uid;
  delete from auth.users where id = uid;
end;
$function$;

commit;
