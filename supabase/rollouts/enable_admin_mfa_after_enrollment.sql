-- Apply manually only after every administrator has enrolled and verified TOTP.
-- This upgrades the existing restrictive portal policy from active-account checks
-- to active-account plus AAL2 checks for administrators.

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
      and (
        profile.role <> 'admin'
        or coalesce((select auth.jwt()->>'aal'), 'aal1') = 'aal2'
      )
  );
$$;

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
      and coalesce((select auth.jwt()->>'aal'), 'aal1') = 'aal2'
  );
$$;

revoke all on function private.current_user_meets_portal_requirements() from public, anon, authenticated;
revoke all on function private.current_user_is_admin() from public, anon, authenticated;
