-- Phase 5: staff-managed public promotions and first-touch attribution.

create table if not exists public.promotions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  campaign_type text not null check (campaign_type in ('workshop', 'event', 'consultation', 'seasonal')),
  eyebrow text not null default '',
  title text not null check (char_length(title) between 3 and 120),
  summary text not null check (char_length(summary) between 10 and 300),
  details text not null default '',
  audience text not null default '',
  location text not null default 'Tomotina Kids, Sector 40, Gurugram',
  starts_at timestamptz,
  ends_at timestamptz,
  cta_label text not null default 'Enquire now',
  cta_url text not null default '/contact.html#enquiry',
  image_url text,
  published boolean not null default false,
  featured boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at >= starts_at),
  check (cta_url ~ '^(\/|https:\/\/|tel:|mailto:)'),
  check (image_url is null or image_url ~ '^(\/|https:\/\/)')
);

alter table public.promotions enable row level security;

revoke all on table public.promotions from anon, authenticated;
grant select on table public.promotions to anon, authenticated;
grant insert, update, delete on table public.promotions to authenticated;

create policy "published promotions are public"
on public.promotions for select
to anon, authenticated
using (
  published
  and (starts_at is null or starts_at <= now())
  and (ends_at is null or ends_at >= now())
);

create policy "admins view all promotions"
on public.promotions for select
to authenticated
using ((select private.current_user_is_admin()));

create policy "admins create promotions"
on public.promotions for insert
to authenticated
with check (
  (select private.current_user_is_admin())
  and created_by = (select auth.uid())
  and updated_by = (select auth.uid())
);

create policy "admins update promotions"
on public.promotions for update
to authenticated
using ((select private.current_user_is_admin()))
with check (
  (select private.current_user_is_admin())
  and updated_by = (select auth.uid())
);

create policy "admins delete promotions"
on public.promotions for delete
to authenticated
using ((select private.current_user_is_admin()));

create index if not exists promotions_public_feed_idx
  on public.promotions (featured desc, starts_at desc)
  where published;

alter table public.enquiries
  add column if not exists attribution jsonb not null default '{}'::jsonb;

comment on column public.enquiries.attribution is
  'Privacy-limited first-touch campaign parameters and conversion page; no cookies or fingerprinting.';

create or replace function private.set_promotion_audit_fields()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := (select auth.uid());
  if tg_op = 'INSERT' then
    new.created_by := (select auth.uid());
  else
    new.created_by := old.created_by;
  end if;
  return new;
end;
$$;

revoke all on function private.set_promotion_audit_fields() from public, anon, authenticated;

drop trigger if exists promotions_set_audit_fields on public.promotions;
create trigger promotions_set_audit_fields
before insert or update on public.promotions
for each row execute function private.set_promotion_audit_fields();
