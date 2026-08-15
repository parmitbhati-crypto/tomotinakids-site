-- Resolve reviewed portal reliability issues with atomic, least-privilege RPCs.

create or replace function private.guard_teacher_session_completion()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (select private.current_user_is_admin()) then
    return new;
  end if;

  if old.teacher_id is distinct from (select auth.uid())
     or (to_jsonb(new) - 'status') is distinct from (to_jsonb(old) - 'status')
     or old.status is distinct from 'scheduled'
     or new.status is distinct from 'completed' then
    raise exception 'teachers may only complete their own scheduled sessions';
  end if;

  return new;
end;
$$;

revoke all on function private.guard_teacher_session_completion() from public, anon, authenticated;

drop trigger if exists guard_teacher_session_completion on public.sessions;
create trigger guard_teacher_session_completion
before update on public.sessions
for each row execute function private.guard_teacher_session_completion();

drop policy if exists sessions_teacher_complete_assigned on public.sessions;
create policy sessions_teacher_complete_assigned
on public.sessions for update
to authenticated
using (
  teacher_id = (select auth.uid())
  and status = 'scheduled'
)
with check (
  teacher_id = (select auth.uid())
  and status = 'completed'
);

create or replace function public.complete_assigned_session(
  p_session_id uuid,
  p_attendance text,
  p_progress_score integer,
  p_remarks text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  completed_session_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'authentication required';
  end if;

  insert into public.session_updates (
    session_id,
    attendance,
    progress_score,
    remarks,
    updated_by
  ) values (
    p_session_id,
    p_attendance,
    p_progress_score,
    nullif(btrim(p_remarks), ''),
    (select auth.uid())
  )
  on conflict (session_id) do update set
    attendance = excluded.attendance,
    progress_score = excluded.progress_score,
    remarks = excluded.remarks,
    updated_by = excluded.updated_by;

  update public.sessions
  set status = 'completed'
  where id = p_session_id
    and teacher_id = (select auth.uid())
    and status = 'scheduled'
  returning id into completed_session_id;

  if completed_session_id is null then
    raise exception 'session is not assigned or is no longer scheduled';
  end if;

  return completed_session_id;
end;
$$;

revoke all on function public.complete_assigned_session(uuid, text, integer, text)
from public, anon;
grant execute on function public.complete_assigned_session(uuid, text, integer, text)
to authenticated;

create or replace function public.save_registration_details(
  p_student_id uuid,
  p_registration_id uuid,
  p_full_name text,
  p_parent_name text,
  p_parent_phone text,
  p_address text,
  p_age integer,
  p_registration_date date,
  p_is_active boolean,
  p_photo_url text,
  p_form_data jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  affected_rows integer;
  saved_registration_id uuid;
begin
  if not (select private.current_user_is_admin()) then
    raise exception 'administrator access required';
  end if;

  update public.students
  set full_name = p_full_name,
      parent_name = p_parent_name,
      parent_phone = p_parent_phone,
      address = p_address,
      "Age" = p_age,
      registration_date = p_registration_date,
      is_active = p_is_active,
      photo_url = p_photo_url
  where id = p_student_id;

  get diagnostics affected_rows = row_count;
  if affected_rows <> 1 then
    raise exception 'student record not found';
  end if;

  if p_registration_id is null then
    insert into public.student_registrations (
      student_id,
      form_data,
      created_by
    ) values (
      p_student_id,
      p_form_data,
      (select auth.uid())
    )
    returning id into saved_registration_id;
  else
    update public.student_registrations
    set form_data = p_form_data
    where id = p_registration_id
      and student_id = p_student_id
    returning id into saved_registration_id;

    if saved_registration_id is null then
      raise exception 'registration record not found';
    end if;
  end if;

  return saved_registration_id;
end;
$$;

revoke all on function public.save_registration_details(
  uuid, uuid, text, text, text, text, integer, date, boolean, text, jsonb
) from public, anon;
grant execute on function public.save_registration_details(
  uuid, uuid, text, text, text, text, integer, date, boolean, text, jsonb
) to authenticated;
