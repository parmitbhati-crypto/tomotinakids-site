-- Tomotina Phase 4: least-privilege portal access, auditability, and monitoring.
-- Apply together with the matching portal release because student-photos becomes private.

begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

-- Authorization helpers live outside the exposed API schema.
create or replace function private.current_user_is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
  );
$$;

revoke all on function private.current_user_is_admin() from public, anon;
grant execute on function private.current_user_is_admin() to authenticated;

-- New accounts require an administrator to assign a portal role.
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role = any (array['pending'::text, 'teacher'::text, 'admin'::text]));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email, ''),
    'pending'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.touch_updated_at() from public, anon, authenticated;

-- Remove legacy helper overloads after replacing every policy that used them.
drop policy if exists "Admins can view enquiries" on public.enquiries;
drop policy if exists "Public can insert enquiries" on public.enquiries;
drop policy if exists profiles_select_admin_all on public.profiles;
drop policy if exists profiles_select_own on public.profiles;
drop policy if exists programs_admin_all on public.programs;
drop policy if exists programs_select_all on public.programs;
drop policy if exists session_programs_admin_all on public.session_programs;
drop policy if exists session_programs_select_all on public.session_programs;
drop policy if exists session_updates_insert_teacher_or_admin on public.session_updates;
drop policy if exists session_updates_select_teacher_or_admin on public.session_updates;
drop policy if exists session_updates_update_teacher_or_admin on public.session_updates;
drop policy if exists sessions_admin_all on public.sessions;
drop policy if exists sessions_select_teacher_or_admin on public.sessions;
drop policy if exists "Admins can delete student_registrations" on public.student_registrations;
drop policy if exists "Admins can insert student_registrations" on public.student_registrations;
drop policy if exists "Admins can update student_registrations" on public.student_registrations;
drop policy if exists "Admins can view student_registrations" on public.student_registrations;
drop policy if exists student_registrations_admin_all on public.student_registrations;
drop policy if exists "Admins can delete students" on public.students;
drop policy if exists "Admins can insert students" on public.students;
drop policy if exists "Admins can update students" on public.students;
drop policy if exists "Admins can view students" on public.students;
drop policy if exists students_admin_all on public.students;
drop policy if exists students_select_active_authenticated on public.students;
drop policy if exists teacher_attendance_admin_all on public.teacher_attendance;
drop policy if exists teacher_attendance_select_own_or_admin on public.teacher_attendance;
drop policy if exists teacher_programs_admin_all on public.teacher_programs;
drop policy if exists teacher_programs_select_all on public.teacher_programs;

drop function if exists public.is_admin(uuid);
drop function if exists public.is_admin();

-- Start from no browser-facing privileges, then grant only required operations.
revoke all on table
  public.enquiries,
  public.profiles,
  public.programs,
  public.session_programs,
  public.session_updates,
  public.sessions,
  public.student_registrations,
  public.students,
  public.teacher_attendance,
  public.teacher_programs
from anon, authenticated;

grant insert on public.enquiries to anon, authenticated;
grant select, update on public.enquiries to authenticated;
grant select on public.profiles to authenticated;
grant select, insert, update, delete on public.programs to authenticated;
grant select, insert, update, delete on public.session_programs to authenticated;
grant select, insert, update on public.session_updates to authenticated;
grant select, insert, update, delete on public.sessions to authenticated;
grant select, insert, update, delete on public.student_registrations to authenticated;
grant select, insert, update, delete on public.students to authenticated;
grant select, insert, update on public.teacher_attendance to authenticated;
grant select, insert, update, delete on public.teacher_programs to authenticated;

create policy enquiries_public_insert
on public.enquiries for insert
to anon, authenticated
with check (
  status = 'new'
  and admin_note is null
  and source = 'website_home_form'
  and char_length(parent_name) between 1 and 120
  and char_length(phone) between 7 and 30
  and char_length(message) between 1 and 3000
  and (email is null or char_length(email) <= 254)
  and (child_name is null or char_length(child_name) <= 120)
  and (child_age is null or char_length(child_age) <= 40)
);

create policy enquiries_admin_select
on public.enquiries for select
to authenticated
using ((select private.current_user_is_admin()));

create policy enquiries_admin_update
on public.enquiries for update
to authenticated
using ((select private.current_user_is_admin()))
with check ((select private.current_user_is_admin()));

create policy profiles_select_own_or_admin
on public.profiles for select
to authenticated
using (id = (select auth.uid()) or (select private.current_user_is_admin()));

create policy programs_select_staff
on public.programs for select
to authenticated
using (true);

create policy programs_admin_insert
on public.programs for insert
to authenticated
with check ((select private.current_user_is_admin()));
create policy programs_admin_update
on public.programs for update
to authenticated
using ((select private.current_user_is_admin()))
with check ((select private.current_user_is_admin()));
create policy programs_admin_delete
on public.programs for delete
to authenticated
using ((select private.current_user_is_admin()));

create policy sessions_select_assigned_or_admin
on public.sessions for select
to authenticated
using (teacher_id = (select auth.uid()) or (select private.current_user_is_admin()));
create policy sessions_admin_insert
on public.sessions for insert
to authenticated
with check ((select private.current_user_is_admin()));
create policy sessions_admin_update
on public.sessions for update
to authenticated
using ((select private.current_user_is_admin()))
with check ((select private.current_user_is_admin()));
create policy sessions_admin_delete
on public.sessions for delete
to authenticated
using ((select private.current_user_is_admin()));

create policy session_programs_select_assigned_or_admin
on public.session_programs for select
to authenticated
using (
  (select private.current_user_is_admin())
  or exists (
    select 1 from public.sessions
    where sessions.id = session_programs.session_id
      and sessions.teacher_id = (select auth.uid())
  )
);
create policy session_programs_admin_insert
on public.session_programs for insert
to authenticated
with check ((select private.current_user_is_admin()));
create policy session_programs_admin_update
on public.session_programs for update
to authenticated
using ((select private.current_user_is_admin()))
with check ((select private.current_user_is_admin()));
create policy session_programs_admin_delete
on public.session_programs for delete
to authenticated
using ((select private.current_user_is_admin()));

create policy session_updates_select_assigned_or_admin
on public.session_updates for select
to authenticated
using (
  (select private.current_user_is_admin())
  or exists (
    select 1 from public.sessions
    where sessions.id = session_updates.session_id
      and sessions.teacher_id = (select auth.uid())
  )
);
create policy session_updates_insert_assigned_or_admin
on public.session_updates for insert
to authenticated
with check (
  (select private.current_user_is_admin())
  or (
    updated_by = (select auth.uid())
    and exists (
      select 1 from public.sessions
      where sessions.id = session_updates.session_id
        and sessions.teacher_id = (select auth.uid())
    )
  )
);
create policy session_updates_update_assigned_or_admin
on public.session_updates for update
to authenticated
using (
  (select private.current_user_is_admin())
  or exists (
    select 1 from public.sessions
    where sessions.id = session_updates.session_id
      and sessions.teacher_id = (select auth.uid())
  )
)
with check (
  (select private.current_user_is_admin())
  or (
    updated_by = (select auth.uid())
    and exists (
      select 1 from public.sessions
      where sessions.id = session_updates.session_id
        and sessions.teacher_id = (select auth.uid())
    )
  )
);

create policy students_select_assigned_or_admin
on public.students for select
to authenticated
using (
  (select private.current_user_is_admin())
  or exists (
    select 1 from public.sessions
    where sessions.student_id = students.id
      and sessions.teacher_id = (select auth.uid())
  )
);
create policy students_admin_insert
on public.students for insert
to authenticated
with check ((select private.current_user_is_admin()));
create policy students_admin_update
on public.students for update
to authenticated
using ((select private.current_user_is_admin()))
with check ((select private.current_user_is_admin()));
create policy students_admin_delete
on public.students for delete
to authenticated
using ((select private.current_user_is_admin()));

create policy student_registrations_admin_select
on public.student_registrations for select
to authenticated
using ((select private.current_user_is_admin()));
create policy student_registrations_admin_insert
on public.student_registrations for insert
to authenticated
with check (
  (select private.current_user_is_admin())
  and created_by = (select auth.uid())
);
create policy student_registrations_admin_update
on public.student_registrations for update
to authenticated
using ((select private.current_user_is_admin()))
with check ((select private.current_user_is_admin()));
create policy student_registrations_admin_delete
on public.student_registrations for delete
to authenticated
using ((select private.current_user_is_admin()));

create policy teacher_attendance_select_own_or_admin
on public.teacher_attendance for select
to authenticated
using (teacher_id = (select auth.uid()) or (select private.current_user_is_admin()));
create policy teacher_attendance_admin_insert
on public.teacher_attendance for insert
to authenticated
with check ((select private.current_user_is_admin()));
create policy teacher_attendance_admin_update
on public.teacher_attendance for update
to authenticated
using ((select private.current_user_is_admin()))
with check ((select private.current_user_is_admin()));

create policy teacher_programs_select_own_or_admin
on public.teacher_programs for select
to authenticated
using (teacher_id = (select auth.uid()) or (select private.current_user_is_admin()));
create policy teacher_programs_admin_insert
on public.teacher_programs for insert
to authenticated
with check ((select private.current_user_is_admin()));
create policy teacher_programs_admin_update
on public.teacher_programs for update
to authenticated
using ((select private.current_user_is_admin()))
with check ((select private.current_user_is_admin()));
create policy teacher_programs_admin_delete
on public.teacher_programs for delete
to authenticated
using ((select private.current_user_is_admin()));

-- Private student photos. Object names begin with the student UUID.
update storage.buckets
set public = false,
    file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg','image/png','image/webp']
where id = 'student-photos';

drop policy if exists student_photos_admin_select on storage.objects;
drop policy if exists student_photos_admin_insert on storage.objects;
drop policy if exists student_photos_admin_update on storage.objects;
drop policy if exists student_photos_admin_delete on storage.objects;
drop policy if exists student_photos_teacher_select_assigned on storage.objects;

create policy student_photos_admin_select
on storage.objects for select
to authenticated
using (bucket_id = 'student-photos' and (select private.current_user_is_admin()));
create policy student_photos_admin_insert
on storage.objects for insert
to authenticated
with check (bucket_id = 'student-photos' and (select private.current_user_is_admin()));
create policy student_photos_admin_update
on storage.objects for update
to authenticated
using (bucket_id = 'student-photos' and (select private.current_user_is_admin()))
with check (bucket_id = 'student-photos' and (select private.current_user_is_admin()));
create policy student_photos_admin_delete
on storage.objects for delete
to authenticated
using (bucket_id = 'student-photos' and (select private.current_user_is_admin()));
create policy student_photos_teacher_select_assigned
on storage.objects for select
to authenticated
using (
  bucket_id = 'student-photos'
  and exists (
    select 1 from public.sessions
    where sessions.teacher_id = (select auth.uid())
      and sessions.student_id::text = (storage.foldername(name))[1]
  )
);

-- Sanitized client-error monitoring.
create table if not exists public.portal_client_errors (
  id bigint generated always as identity primary key,
  actor_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  page text not null check (char_length(page) between 1 and 200),
  kind text not null check (kind in ('error','unhandledrejection','application')),
  message text not null check (char_length(message) between 1 and 500)
);
alter table public.portal_client_errors enable row level security;
revoke all on public.portal_client_errors from anon, authenticated;
grant insert, select on public.portal_client_errors to authenticated;
grant usage, select on sequence public.portal_client_errors_id_seq to authenticated;

create policy portal_errors_insert_own
on public.portal_client_errors for insert
to authenticated
with check (actor_id = (select auth.uid()));
create policy portal_errors_admin_select
on public.portal_client_errors for select
to authenticated
using ((select private.current_user_is_admin()));

create index if not exists portal_client_errors_created_at_idx
  on public.portal_client_errors (created_at desc);
create index if not exists sessions_student_teacher_idx
  on public.sessions (student_id, teacher_id);
create index if not exists session_programs_program_id_idx
  on public.session_programs (program_id);
create index if not exists teacher_programs_program_id_idx
  on public.teacher_programs (program_id);
create index if not exists session_updates_updated_by_idx
  on public.session_updates (updated_by);

-- Minimal, non-sensitive database audit trail.
create table if not exists private.audit_log (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  actor_id uuid,
  table_name text not null,
  row_id text,
  operation text not null check (operation in ('INSERT','UPDATE','DELETE')),
  changed_fields text[]
);
revoke all on private.audit_log from public, anon, authenticated;
create index if not exists audit_log_occurred_at_idx on private.audit_log (occurred_at desc);
create index if not exists audit_log_actor_id_idx on private.audit_log (actor_id, occurred_at desc);

create or replace function private.record_audit_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_data jsonb;
  new_data jsonb;
  record_id text;
  fields text[];
begin
  old_data := case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else '{}'::jsonb end;
  new_data := case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else '{}'::jsonb end;
  record_id := coalesce(new_data ->> 'id', old_data ->> 'id', new_data ->> 'session_id', old_data ->> 'session_id');

  if tg_op = 'UPDATE' then
    select array_agg(key order by key) into fields
    from (
      select key from jsonb_object_keys(old_data || new_data) key
      where old_data -> key is distinct from new_data -> key
    ) changed;
  end if;

  insert into private.audit_log(actor_id, table_name, row_id, operation, changed_fields)
  values ((select auth.uid()), tg_table_name, record_id, tg_op, fields);
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;
revoke all on function private.record_audit_event() from public, anon, authenticated;

drop trigger if exists audit_enquiries on public.enquiries;
create trigger audit_enquiries after update or delete on public.enquiries
for each row execute function private.record_audit_event();
drop trigger if exists audit_profiles on public.profiles;
create trigger audit_profiles after update or delete on public.profiles
for each row execute function private.record_audit_event();
drop trigger if exists audit_sessions on public.sessions;
create trigger audit_sessions after insert or update or delete on public.sessions
for each row execute function private.record_audit_event();
drop trigger if exists audit_session_updates on public.session_updates;
create trigger audit_session_updates after insert or update or delete on public.session_updates
for each row execute function private.record_audit_event();
drop trigger if exists audit_students on public.students;
create trigger audit_students after insert or update or delete on public.students
for each row execute function private.record_audit_event();
drop trigger if exists audit_student_registrations on public.student_registrations;
create trigger audit_student_registrations after insert or update or delete on public.student_registrations
for each row execute function private.record_audit_event();
drop trigger if exists audit_teacher_attendance on public.teacher_attendance;
create trigger audit_teacher_attendance after insert or update or delete on public.teacher_attendance
for each row execute function private.record_audit_event();

commit;
