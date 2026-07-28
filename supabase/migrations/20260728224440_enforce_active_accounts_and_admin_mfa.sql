-- Require active portal accounts. Administrator AAL2 enforcement is activated
-- separately after enrollment to avoid locking out the first administrator.

create or replace function public.get_portal_access_state()
returns table (portal_role text, account_is_active boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select profile.role, profile.is_active
  from public.profiles as profile
  where profile.id = (select auth.uid())
    and profile.role in ('admin', 'teacher');
$$;

revoke all on function public.get_portal_access_state() from public, anon;
grant execute on function public.get_portal_access_state() to authenticated;

create or replace function private.current_user_meets_portal_requirements()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles as profile
    where profile.id = (select auth.uid())
      and profile.is_active = true
      and profile.role in ('admin', 'teacher')
  );
$$;

revoke all on function private.current_user_meets_portal_requirements() from public, anon, authenticated;

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
      and is_active = true
  );
$$;

revoke all on function private.current_user_is_admin() from public, anon, authenticated;

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'enquiries', 'portal_client_errors', 'profiles', 'programs',
    'session_programs', 'session_updates', 'sessions',
    'student_registrations', 'students', 'teacher_attendance',
    'teacher_profiles', 'teacher_programs'
  ]
  loop
    execute format(
      'drop policy if exists active_portal_accounts_only on public.%I',
      target_table
    );
    execute format(
      'create policy active_portal_accounts_only on public.%I as restrictive for all to authenticated using ((select private.current_user_meets_portal_requirements())) with check ((select private.current_user_meets_portal_requirements()))',
      target_table
    );
  end loop;
end;
$$;

drop policy if exists active_portal_accounts_only on storage.objects;
create policy active_portal_accounts_only
on storage.objects
as restrictive
for all
to authenticated
using (
  bucket_id not in ('student-photos', 'teacher-photos')
  or (select private.current_user_meets_portal_requirements())
)
with check (
  bucket_id not in ('student-photos', 'teacher-photos')
  or (select private.current_user_meets_portal_requirements())
);
