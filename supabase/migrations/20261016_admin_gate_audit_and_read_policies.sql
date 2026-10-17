-- Phase 0.1 / 0.2 of docs/ADMIN-PANEL-PLAN.md
--
-- 1. Admin identity moves to the JWT's app_metadata.roles (service-role
--    writable only). user_metadata is editable by the user themselves, so it
--    must never decide admin access.
-- 2. Closes the self-promotion hole: "Users update own record" has no column
--    restriction, so anyone could add 'admin' to their own users.roles.
-- 3. Signup can no longer start a user as admin via the role metadata.
-- 4. admin_actions audit table (every admin write records before/after).
-- 5. Admin SELECT policies on everything the panel shows. No admin write
--    policies on purpose — writes go through the audited /api/admin routes.
-- 6. Replaces the two users.roles-based admin policies.
-- 7. Bootstraps testadmin@servios.com into app_metadata.

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select coalesce((auth.jwt() -> 'app_metadata' -> 'roles') ? 'admin', false)
$$;

create or replace function public.guard_admin_role()
returns trigger
language plpgsql
as $$
begin
  if coalesce(auth.role(), '') = 'service_role' or auth.uid() is null then
    return new;
  end if;
  if 'admin' = any(new.roles) and (tg_op = 'INSERT' or not ('admin' = any(old.roles))) then
    raise exception 'The admin role can only be granted by the platform';
  end if;
  if new.active_role = 'admin' and not ('admin' = any(new.roles)) then
    raise exception 'active_role admin requires the admin role';
  end if;
  return new;
end
$$;

drop trigger if exists users_guard_admin_role on public.users;
create trigger users_guard_admin_role
  before insert or update on public.users
  for each row execute function public.guard_admin_role();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_role text;
begin
  v_role := coalesce(new.raw_user_meta_data->>'role', 'customer');
  if v_role not in ('customer', 'provider', 'landlord', 'tenant') then
    v_role := 'customer';
  end if;

  insert into public.users (id, email, phone, roles, active_role, primary_role)
  values (new.id, new.email, null, array[v_role]::text[], v_role, v_role)
  on conflict (id) do nothing;

  if v_role = 'provider' then
    insert into provider_profiles (user_id, business_name, first_name, last_name, onboarding_complete, onboarding_step, verification_status)
    values (new.id, '', coalesce(new.raw_user_meta_data->>'first_name', ''), coalesce(new.raw_user_meta_data->>'last_name', ''), false, 'trade', 'unverified')
    on conflict (user_id) do nothing;
  elsif v_role = 'landlord' then
    insert into landlord_profiles (user_id, first_name, last_name)
    values (new.id, coalesce(new.raw_user_meta_data->>'first_name', ''), coalesce(new.raw_user_meta_data->>'last_name', ''))
    on conflict (user_id) do nothing;
  elsif v_role = 'tenant' then
    insert into tenant_profiles (user_id, first_name, last_name)
    values (new.id, coalesce(new.raw_user_meta_data->>'first_name', ''), coalesce(new.raw_user_meta_data->>'last_name', ''))
    on conflict (user_id) do nothing;
  else
    insert into customer_profiles (user_id, first_name, last_name)
    values (new.id, coalesce(new.raw_user_meta_data->>'first_name', ''), coalesce(new.raw_user_meta_data->>'last_name', ''))
    on conflict (user_id) do nothing;
  end if;

  return new;
end;
$$;

create table if not exists public.admin_actions (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null,
  action text not null,
  target_table text,
  target_id text,
  before jsonb,
  after jsonb,
  reason text,
  created_at timestamptz not null default now()
);
create index if not exists admin_actions_target_idx on public.admin_actions (target_table, target_id);
create index if not exists admin_actions_created_idx on public.admin_actions (created_at desc);
alter table public.admin_actions enable row level security;
drop policy if exists admin_read_actions on public.admin_actions;
create policy admin_read_actions on public.admin_actions
  for select to authenticated using (public.is_admin());

do $$
declare t text;
begin
  foreach t in array array[
    'users','customer_profiles','provider_profiles','landlord_profiles','tenant_profiles',
    'bookings','booking_photos','booking_milestones','payments',
    'disputes','claims','workmanship_claims','reviews','provider_documents','notifications',
    'conversations','messages','conversation_reads',
    'properties','property_compliance','maintenance_requests','provider_invitations',
    'quote_requests','quote_request_providers','quote_responses','job_offers','job_offer_milestones',
    'provider_earnings','provider_services','provider_availability','provider_portfolio_photos',
    'preferred_providers','landlord_provider_relationships','push_tokens','services','service_categories'
  ] loop
    execute format('drop policy if exists admin_read_all on public.%I', t);
    execute format('create policy admin_read_all on public.%I for select to authenticated using (public.is_admin())', t);
  end loop;
end $$;

drop policy if exists "Admins view all documents" on public.provider_documents;
drop policy if exists "Admins read provider documents" on storage.objects;
create policy "Admins read provider documents" on storage.objects
  for select to authenticated
  using (bucket_id = 'provider-documents' and public.is_admin());

update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('roles', jsonb_build_array('admin'))
where email = 'testadmin@servios.com';
