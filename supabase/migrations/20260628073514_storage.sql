insert into storage.buckets (id, name, public)
values ('recipe-images', 'recipe-images', true)
on conflict (id) do nothing;

create policy "Anyone can read recipe images"
on storage.objects for select
using ( bucket_id = 'recipe-images' );

create policy "Users upload to own folder"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'recipe-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Users update own files"
on storage.objects for update to authenticated
using (
  bucket_id = 'recipe-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Users delete own files"
on storage.objects for delete to authenticated
using (
  bucket_id = 'recipe-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
