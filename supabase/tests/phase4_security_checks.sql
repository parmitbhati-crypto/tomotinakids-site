-- Run after 20260728191912_harden_portal_access.sql.
-- This script is read-only and raises an exception when a control is missing.

do $$
declare
  insecure_table text;
  unexpected_anon_grant text;
begin
  select c.relname into insecure_table
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('r','p')
    and c.relname in (
      'enquiries','profiles','programs','session_programs','session_updates',
      'sessions','student_registrations','students','teacher_attendance',
      'teacher_programs','portal_client_errors'
    )
    and not c.relrowsecurity
  limit 1;

  if insecure_table is not null then
    raise exception 'RLS is disabled on public.%', insecure_table;
  end if;

  select table_name || ':' || privilege_type into unexpected_anon_grant
  from information_schema.role_table_grants
  where table_schema = 'public'
    and grantee = 'anon'
    and not (table_name = 'enquiries' and privilege_type = 'INSERT')
  limit 1;

  if unexpected_anon_grant is not null then
    raise exception 'Unexpected anon privilege: %', unexpected_anon_grant;
  end if;

  if not exists (
    select 1 from storage.buckets
    where id = 'student-photos'
      and public = false
      and file_size_limit = 5242880
  ) then
    raise exception 'student-photos is not private or lacks its size limit';
  end if;

  if has_function_privilege('anon', 'private.current_user_is_admin()', 'EXECUTE') then
    raise exception 'anon can execute private.current_user_is_admin()';
  end if;

  if has_function_privilege('anon', 'public.handle_new_user()', 'EXECUTE') then
    raise exception 'anon can execute public.handle_new_user()';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'students'
      and policyname = 'students_select_assigned_or_admin'
  ) then
    raise exception 'Assigned-student policy is missing';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname = 'audit_students' and not tgisinternal
  ) then
    raise exception 'Student audit trigger is missing';
  end if;
end
$$;

select 'phase4_security_checks_passed' as result;
