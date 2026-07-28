-- Allow teachers to maintain only their own photo while all staff details remain admin-managed.

insert into public.teacher_profiles (
  user_id, email, designation, invitation_status, invitation_accepted_at
)
select
  profile.id,
  lower(auth_user.email),
  coalesce(nullif(profile.specialization, ''), 'Teacher'),
  'accepted',
  coalesce(auth_user.last_sign_in_at, now())
from public.profiles as profile
join auth.users as auth_user on auth_user.id = profile.id
where profile.role = 'teacher'
  and auth_user.email is not null
on conflict (user_id) do nothing;

create policy teacher_profiles_teacher_update_photo
on public.teacher_profiles for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create or replace function private.guard_teacher_profile_self_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select private.current_user_is_admin()) then
    return new;
  end if;

  if old.user_id <> (select auth.uid())
     or new.user_id <> old.user_id
     or new.email is distinct from old.email
     or new.mobile is distinct from old.mobile
     or new.designation is distinct from old.designation
     or new.address is distinct from old.address
     or new.employment_type is distinct from old.employment_type
     or new.joining_date is distinct from old.joining_date
     or new.aadhaar_last4 is distinct from old.aadhaar_last4
     or new.aadhaar_verified is distinct from old.aadhaar_verified
     or new.pan_last4 is distinct from old.pan_last4
     or new.pan_verified is distinct from old.pan_verified
     or new.invitation_status is distinct from old.invitation_status
     or new.invited_at is distinct from old.invited_at
     or new.invitation_accepted_at is distinct from old.invitation_accepted_at
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at then
    raise exception 'teachers may update only their own profile photo';
  end if;
  return new;
end;
$$;

revoke all on function private.guard_teacher_profile_self_update() from public, anon, authenticated;

drop trigger if exists guard_teacher_profile_self_update on public.teacher_profiles;
create trigger guard_teacher_profile_self_update
before update on public.teacher_profiles
for each row execute function private.guard_teacher_profile_self_update();

create policy teacher_photos_teacher_insert_own
on storage.objects for insert to authenticated
with check (
  bucket_id = 'teacher-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy teacher_photos_teacher_delete_own
on storage.objects for delete to authenticated
using (
  bucket_id = 'teacher-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
