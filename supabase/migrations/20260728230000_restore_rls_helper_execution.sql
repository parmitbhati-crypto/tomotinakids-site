-- RLS policies call these private helpers while authenticated users query portal
-- tables. Keep them unavailable to anonymous roles, but executable by authenticated
-- sessions so the policies can evaluate.
revoke all on function private.current_user_meets_portal_requirements() from public, anon;
revoke all on function private.current_user_is_admin() from public, anon;

grant execute on function private.current_user_meets_portal_requirements() to authenticated;
grant execute on function private.current_user_is_admin() to authenticated;
