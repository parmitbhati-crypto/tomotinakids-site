begin;

do $$
begin
  if not exists (
    select 1 from pg_tables
    where schemaname = 'public' and tablename = 'promotions' and rowsecurity
  ) then raise exception 'promotions must exist with RLS enabled'; end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'enquiries' and column_name = 'attribution'
  ) then raise exception 'enquiries.attribution is missing'; end if;
  if (select count(*) from pg_policies where schemaname = 'public' and tablename = 'promotions') <> 5
  then raise exception 'expected five promotions RLS policies'; end if;
end $$;

set local role anon;
select count(*) from public.promotions;
reset role;

rollback;
