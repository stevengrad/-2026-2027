-- Saint portraits are intentionally uploaded only by authorised tournament
-- administrators. The bucket is public only for delivery of already-approved
-- portrait paths; rights validation is enforced by the saints table.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'saints',
  'saints',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "saint portraits can be uploaded by administrators"
on storage.objects for insert to authenticated
with check (bucket_id = 'saints' and public.is_admin());

create policy "saint portraits can be updated by administrators"
on storage.objects for update to authenticated
using (bucket_id = 'saints' and public.is_admin())
with check (bucket_id = 'saints' and public.is_admin());

create policy "saint portraits can be deleted by administrators"
on storage.objects for delete to authenticated
using (bucket_id = 'saints' and public.is_admin());
