-- Secure teacher onboarding and lifecycle management.

alter table public.profiles
  add column if not exists is_active boolean not null default true;

create index if not exists profiles_active_teachers_idx
  on public.profiles (full_name)
  where role = 'teacher' and is_active = true;

create table if not exists public.teacher_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  email text not null,
  mobile text,
  designation text not null,
  address text,
  employment_type text not null default 'full_time'
    check (employment_type in ('full_time', 'part_time', 'consultant', 'intern')),
  joining_date date,
  photo_path text,
  aadhaar_last4 text check (aadhaar_last4 is null or aadhaar_last4 ~ '^[0-9]{4}$'),
  aadhaar_verified boolean not null default false,
  pan_last4 text check (pan_last4 is null or pan_last4 ~ '^[A-Z0-9]{4}$'),
  pan_verified boolean not null default false,
  invitation_status text not null default 'invited'
    check (invitation_status in ('invited', 'accepted')),
  invited_at timestamptz not null default now(),
  invitation_accepted_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint teacher_profiles_email_normalized check (email = lower(btrim(email)))
);

create unique index if not exists teacher_profiles_email_unique
  on public.teacher_profiles (lower(email));

alter table public.teacher_profiles enable row level security;
revoke all on public.teacher_profiles from anon, authenticated;
grant select, insert, update on public.teacher_profiles to authenticated;

grant update on public.profiles to authenticated;
create policy profiles_admin_update
on public.profiles for update to authenticated
using ((select private.current_user_is_admin()))
with check (
  (select private.current_user_is_admin())
  and role in ('pending', 'teacher', 'admin')
);

create policy teacher_profiles_select_own_or_admin
on public.teacher_profiles for select to authenticated
using (
  user_id = (select auth.uid())
  or (select private.current_user_is_admin())
);

create policy teacher_profiles_admin_insert
on public.teacher_profiles for insert to authenticated
with check ((select private.current_user_is_admin()));

create policy teacher_profiles_admin_update
on public.teacher_profiles for update to authenticated
using ((select private.current_user_is_admin()))
with check ((select private.current_user_is_admin()));

create or replace function public.replace_teacher_programs(
  target_teacher_id uuid,
  selected_program_ids uuid[]
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not (select private.current_user_is_admin()) then
    raise exception 'administrator access required';
  end if;
  if not exists (
    select 1 from public.profiles
    where id = target_teacher_id and role = 'teacher'
  ) then
    raise exception 'teacher not found';
  end if;
  delete from public.teacher_programs where teacher_id = target_teacher_id;
  insert into public.teacher_programs (teacher_id, program_id)
  select target_teacher_id, selected.program_id
  from unnest(coalesce(selected_program_ids, array[]::uuid[])) as selected(program_id)
  join public.programs as program on program.id = selected.program_id;
end;
$$;
revoke all on function public.replace_teacher_programs(uuid, uuid[]) from public, anon;
grant execute on function public.replace_teacher_programs(uuid, uuid[]) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'teacher-photos',
  'teacher-photos',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists teacher_photos_admin_select on storage.objects;
drop policy if exists teacher_photos_admin_insert on storage.objects;
drop policy if exists teacher_photos_admin_update on storage.objects;
drop policy if exists teacher_photos_admin_delete on storage.objects;
drop policy if exists teacher_photos_teacher_select_own on storage.objects;

create policy teacher_photos_admin_select
on storage.objects for select to authenticated
using (bucket_id = 'teacher-photos' and (select private.current_user_is_admin()));

create policy teacher_photos_admin_insert
on storage.objects for insert to authenticated
with check (bucket_id = 'teacher-photos' and (select private.current_user_is_admin()));

create policy teacher_photos_admin_update
on storage.objects for update to authenticated
using (bucket_id = 'teacher-photos' and (select private.current_user_is_admin()))
with check (bucket_id = 'teacher-photos' and (select private.current_user_is_admin()));

create policy teacher_photos_admin_delete
on storage.objects for delete to authenticated
using (bucket_id = 'teacher-photos' and (select private.current_user_is_admin()));

create policy teacher_photos_teacher_select_own
on storage.objects for select to authenticated
using (
  bucket_id = 'teacher-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create or replace function private.mark_teacher_invitation_accepted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.last_sign_in_at is not null
     and (old.last_sign_in_at is null or new.last_sign_in_at <> old.last_sign_in_at) then
    update public.teacher_profiles
       set invitation_status = 'accepted',
           invitation_accepted_at = coalesce(invitation_accepted_at, now()),
           updated_at = now()
     where user_id = new.id
       and invitation_status = 'invited';
  end if;
  return new;
end;
$$;

revoke all on function private.mark_teacher_invitation_accepted() from public, anon, authenticated;

drop trigger if exists mark_teacher_invitation_accepted on auth.users;
create trigger mark_teacher_invitation_accepted
after update of last_sign_in_at on auth.users
for each row execute function private.mark_teacher_invitation_accepted();

create or replace function private.touch_teacher_profile()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  new.updated_by = auth.uid();
  return new;
end;
$$;

revoke all on function private.touch_teacher_profile() from public, anon, authenticated;

drop trigger if exists touch_teacher_profile on public.teacher_profiles;
create trigger touch_teacher_profile
before update on public.teacher_profiles
for each row execute function private.touch_teacher_profile();

drop trigger if exists audit_teacher_profiles on public.teacher_profiles;
create trigger audit_teacher_profiles
after insert or update or delete on public.teacher_profiles
for each row execute function private.record_audit_event();
