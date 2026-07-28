begin;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles'
      and column_name = 'is_active'
  ) then raise exception 'profiles.is_active is missing'; end if;

  if not exists (
    select 1 from pg_tables
    where schemaname = 'public' and tablename = 'teacher_profiles'
      and rowsecurity
  ) then raise exception 'teacher_profiles must exist with RLS enabled'; end if;

  if not exists (
    select 1 from storage.buckets
    where id = 'teacher-photos' and public = false
      and file_size_limit = 5242880
  ) then raise exception 'teacher-photos must be private with a 5 MB limit'; end if;

  if exists (
    select 1 from information_schema.role_table_grants
    where table_schema = 'public' and table_name = 'teacher_profiles'
      and grantee = 'anon'
  ) then raise exception 'anon must not have teacher profile grants'; end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'teacher_profiles'
      and policyname = 'teacher_profiles_select_own_or_admin'
  ) then raise exception 'teacher_profiles select policy is missing'; end if;
end $$;

rollback;
