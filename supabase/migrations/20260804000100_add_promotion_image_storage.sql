-- Public promotional images uploaded by authenticated administrators.
-- Images are intentionally public because they appear on the public website.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'promotion-images',
  'promotion-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists promotion_images_admin_select on storage.objects;
drop policy if exists promotion_images_admin_insert on storage.objects;
drop policy if exists promotion_images_admin_update on storage.objects;
drop policy if exists promotion_images_admin_delete on storage.objects;

create policy promotion_images_admin_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'promotion-images'
  and (select private.current_user_is_admin())
);

create policy promotion_images_admin_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'promotion-images'
  and (select private.current_user_is_admin())
);

create policy promotion_images_admin_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'promotion-images'
  and (select private.current_user_is_admin())
)
with check (
  bucket_id = 'promotion-images'
  and (select private.current_user_is_admin())
);

create policy promotion_images_admin_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'promotion-images'
  and (select private.current_user_is_admin())
);
