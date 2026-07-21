-- Menu/product image storage required by the Admin and POS apps.
-- Run this file once in the Supabase SQL Editor for the connected project.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'menu-icons',
  'menu-icons',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can view menu images" on storage.objects;
create policy "Public can view menu images"
on storage.objects for select
to public
using (bucket_id = 'menu-icons');

drop policy if exists "App can upload menu images" on storage.objects;
create policy "App can upload menu images"
on storage.objects for insert
to anon, authenticated
with check (
  bucket_id = 'menu-icons'
  and (storage.foldername(name))[1] = 'products'
);

drop policy if exists "App can replace menu images" on storage.objects;
create policy "App can replace menu images"
on storage.objects for update
to anon, authenticated
using (
  bucket_id = 'menu-icons'
  and (storage.foldername(name))[1] = 'products'
)
with check (
  bucket_id = 'menu-icons'
  and (storage.foldername(name))[1] = 'products'
);
