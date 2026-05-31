# Supabase Photo Storage Setup

Purpose: make profile photos uploaded from Intro visible across devices and across users during demo and testing.

## Current Client Expectation

The iPhone app currently does this:

1. uploads a photo into the Supabase Storage bucket configured by `SUPABASE_STORAGE_BUCKET`
2. stores the object path in `profiles.photo_path`
3. resolves a public URL from that stored object path
4. renders that remote URL in Discover, Matches, and Profile

This means:
- your own device may still show a photo because of local fallback
- other devices will only show the photo if Storage access is configured correctly

## Required Bucket

Bucket name:

- `profile-photos`

This should match `SupabaseConfig.storageBucket` unless you intentionally changed the Info.plist value.

## Recommended Demo Setup

For the demo, the simplest working setup is:

- use a public bucket for `profile-photos`
- keep only non-sensitive demo profile photos in that bucket

If you do that, the app's current `getPublicURL(...)` path should work without more client changes.

## What To Verify First

1. The `profile-photos` bucket exists.
2. Uploaded files are actually appearing in the bucket.
3. `profiles.photo_path` contains values like:
   - `user-uuid/profile-photo.jpg`
4. Opening a generated public image URL in a browser loads the image.

If step 4 fails, cross-device photo rendering will fail too.

## Fastest Working Option: Public Bucket

In Supabase dashboard:

1. Go to Storage
2. Open the `profile-photos` bucket
3. Make the bucket public

That is the fastest path for demo stability.

## Safer SQL Policies For Demo/Test

If you prefer explicit policies, use these as a baseline.

Assumption:
- each object path starts with the authenticated user's UUID
- example path: `4c8e.../profile-photo.jpg`

### Allow Authenticated Upload To Own Folder

```sql
create policy "Users can upload their own profile photos"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'profile-photos'
  and split_part(name, '/', 1) = auth.uid()::text
);
```

### Allow Authenticated Update To Own Folder

```sql
create policy "Users can update their own profile photos"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'profile-photos'
  and split_part(name, '/', 1) = auth.uid()::text
)
with check (
  bucket_id = 'profile-photos'
  and split_part(name, '/', 1) = auth.uid()::text
);
```

### Allow Authenticated Delete From Own Folder

```sql
create policy "Users can delete their own profile photos"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'profile-photos'
  and split_part(name, '/', 1) = auth.uid()::text
);
```

### Allow Read Access For Demo Visibility

If the bucket is private, the app's current public URL path will not work.

For the current iPhone client, use one of these:

Option A:
- make the bucket public

Option B:
- keep the bucket private and change the iPhone client later to use signed URLs instead of `getPublicURL(...)`

For now, Option A is the correct demo choice.

## Profiles Table Expectation

Your `profiles` table should contain:

- `id uuid`
- `photo_path text`

Example:

```text
id = 11111111-2222-3333-4444-555555555555
photo_path = 11111111-2222-3333-4444-555555555555/profile-photo.jpg
```

## Manual Check For A Test User

For one uploaded user photo, verify:

1. Upload a photo from the app.
2. In Supabase Storage, confirm the object exists.
3. In `profiles`, confirm `photo_path` was updated.
4. Copy the public URL and open it in Safari.
5. Open Discover or Matches from another account and confirm the image renders.

## If Photos Still Do Not Show

The likely causes are:

1. bucket is private
2. bucket name does not match the app config
3. `photo_path` is null or stale
4. object upload succeeded locally but storage write failed remotely
5. other user payloads are returning no `photo_path`

## Recommended Next Client Step After Demo

After demo stabilization, improve this flow by:

1. deciding whether photos should be public or private
2. if private, replacing public URLs with signed URLs
3. adding a small backend validation checklist for uploaded photo visibility
