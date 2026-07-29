-- Permit the trusted Auth sign-in trigger to mark a teacher invitation accepted
-- while preserving the teacher self-service restriction to photo_path only.

create or replace function private.guard_teacher_profile_self_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- mark_teacher_invitation_accepted() is SECURITY DEFINER and owned by postgres.
  -- Allow only its exact invited -> accepted transition; do not grant a broad bypass.
  if current_user = 'postgres'
     and old.invitation_status = 'invited'
     and new.invitation_status = 'accepted'
     and new.invitation_accepted_at is not null
     and new.user_id = old.user_id
     and new.email is not distinct from old.email
     and new.mobile is not distinct from old.mobile
     and new.designation is not distinct from old.designation
     and new.address is not distinct from old.address
     and new.employment_type is not distinct from old.employment_type
     and new.joining_date is not distinct from old.joining_date
     and new.photo_path is not distinct from old.photo_path
     and new.aadhaar_last4 is not distinct from old.aadhaar_last4
     and new.aadhaar_verified is not distinct from old.aadhaar_verified
     and new.pan_last4 is not distinct from old.pan_last4
     and new.pan_verified is not distinct from old.pan_verified
     and new.invited_at is not distinct from old.invited_at
     and new.created_by is not distinct from old.created_by
     and new.created_at is not distinct from old.created_at then
    return new;
  end if;

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
