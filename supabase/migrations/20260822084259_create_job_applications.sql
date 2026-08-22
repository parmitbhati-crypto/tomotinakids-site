create table public.job_applications (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  full_name text not null check (char_length(full_name) between 2 and 120),
  email text not null check (char_length(email) between 5 and 254),
  phone text,
  role_interest text not null check (char_length(role_interest) between 2 and 120),
  experience text check (experience is null or char_length(experience) <= 3000),
  resume_url text check (
    resume_url is null
    or (char_length(resume_url) <= 1000 and resume_url ~* '^https://')
  ),
  consent boolean not null check (consent = true),
  status text not null default 'new' check (status in ('new','reviewing','shortlisted','interview','closed')),
  admin_note text check (admin_note is null or char_length(admin_note) <= 2000),
  attribution jsonb not null default '{}'::jsonb
);

alter table public.job_applications enable row level security;

revoke all on table public.job_applications from anon, authenticated;
grant insert (full_name, email, phone, role_interest, experience, resume_url, consent, attribution)
on table public.job_applications to anon, authenticated;
grant select on table public.job_applications to authenticated;
grant update (status, admin_note) on table public.job_applications to authenticated;

create policy job_applications_public_insert
on public.job_applications for insert
to anon, authenticated
with check (
  consent = true
  and status = 'new'
  and admin_note is null
  and char_length(full_name) between 2 and 120
  and char_length(email) between 5 and 254
  and char_length(role_interest) between 2 and 120
);

create policy job_applications_admin_select
on public.job_applications for select
to authenticated
using ((select private.current_user_is_admin()));

create policy job_applications_admin_update
on public.job_applications for update
to authenticated
using ((select private.current_user_is_admin()))
with check ((select private.current_user_is_admin()));

create policy active_portal_accounts_only
on public.job_applications
as restrictive
for all
to authenticated
using ((select private.current_user_meets_portal_requirements()))
with check ((select private.current_user_meets_portal_requirements()));

comment on table public.job_applications is 'Public website career applications reviewed by active administrators.';
