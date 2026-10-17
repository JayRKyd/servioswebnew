-- Phase 1 of docs/ADMIN-PANEL-PLAN.md — document verification
--
-- 1. provider_documents gains the credential number the provider typed
--    (credential_number / issuer) and the number the admin confirmed
--    (verified_number). Statuses normalised to pending/approved/rejected/expired.
-- 2. recompute_provider_verification(): approved documents drive the
--    per-credential flags on provider_profiles and flip verification_status
--    (required = ID + insurance; licence/certification add badges). A manual
--    verification_override keeps admin decisions from being undone.
-- 3. Guards: providers can't approve their own documents or set their own
--    verification_status (both were possible under the existing policies).
-- 4. Expiry sweep function (called by the admin queue; no pg_cron here).
-- 5. Email/in-app triggers on document status and verification changes.
-- 6. Backfill flags; legacy verified providers without the required docs are
--    marked as overrides so they don't silently drop out of search.

alter table public.provider_documents
  add column if not exists credential_number text,
  add column if not exists issuer text,
  add column if not exists verified_number text,
  add column if not exists review_notes text;

alter table public.provider_profiles
  add column if not exists verification_override boolean not null default false,
  add column if not exists verification_notes text,
  add column if not exists verified_at timestamptz;

update public.provider_documents set status = 'approved' where status = 'verified';

alter table public.provider_documents drop constraint if exists provider_documents_status_check;
alter table public.provider_documents
  add constraint provider_documents_status_check
  check (status in ('pending', 'approved', 'rejected', 'expired'));

-- ── 2. Derive provider verification from approved documents ────────────────
create or replace function public.recompute_provider_verification(p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_current text;
  v_override boolean;
  v_id boolean; v_ins boolean; v_lic boolean;
  v_ins_exp date; v_lic_exp date; v_id_at timestamptz;
  v_any_doc boolean;
  v_new text;
begin
  select verification_status, verification_override
    into v_current, v_override
  from provider_profiles where id = p_profile_id;
  if not found then return; end if;

  select
    coalesce(bool_or(document_type = 'id' and status = 'approved'), false),
    coalesce(bool_or(document_type = 'insurance' and status = 'approved'
                     and (expiry_date is null or expiry_date >= current_date)), false),
    coalesce(bool_or(document_type in ('license', 'certification') and status = 'approved'
                     and (expiry_date is null or expiry_date >= current_date)), false),
    max(expiry_date) filter (where document_type = 'insurance' and status = 'approved'),
    max(expiry_date) filter (where document_type in ('license', 'certification') and status = 'approved'),
    max(verified_at) filter (where document_type = 'id' and status = 'approved'),
    count(*) > 0
  into v_id, v_ins, v_lic, v_ins_exp, v_lic_exp, v_id_at, v_any_doc
  from provider_documents where provider_id = p_profile_id;

  update provider_profiles set
    identity_verified = v_id,
    identity_verified_at = case when v_id then coalesce(identity_verified_at, v_id_at, now()) else null end,
    insurance_verified = v_ins,
    insurance_expiry_date = v_ins_exp,
    business_license_verified = v_lic,
    business_license_expiry_date = v_lic_exp
  where id = p_profile_id;

  -- Admin decisions (override / rejection) are never undone by document churn
  if v_override or v_current = 'rejected' then return; end if;

  if v_id and v_ins then
    v_new := 'verified';
  elsif v_any_doc then
    v_new := 'pending';
  else
    v_new := 'unverified';
  end if;

  if v_new is distinct from v_current then
    update provider_profiles
      set verification_status = v_new,
          verified_at = case when v_new = 'verified' then now() else verified_at end
    where id = p_profile_id;
  end if;
end
$$;

create or replace function public.provider_documents_recompute()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if tg_op = 'DELETE' then
    perform recompute_provider_verification(old.provider_id);
    return old;
  end if;
  perform recompute_provider_verification(new.provider_id);
  if tg_op = 'UPDATE' and new.provider_id is distinct from old.provider_id then
    perform recompute_provider_verification(old.provider_id);
  end if;
  return new;
end
$$;

drop trigger if exists provider_documents_recompute on public.provider_documents;
create trigger provider_documents_recompute
  after insert or update or delete on public.provider_documents
  for each row execute function public.provider_documents_recompute();

-- ── 3. Guards against self-approval ─────────────────────────────────────────
create or replace function public.guard_provider_document_fields()
returns trigger
language plpgsql
as $$
begin
  if coalesce(auth.role(), '') = 'service_role' or auth.uid() is null then
    return new;
  end if;
  -- Providers (and anyone else with a JWT) can only ever submit a pending doc
  if tg_op = 'INSERT' then
    new.status := 'pending';
    new.verified_at := null;
    new.verified_by := null;
    new.verified_number := null;
    new.rejection_reason := null;
    new.review_notes := null;
    new.reviewed_at := null;
    return new;
  end if;
  if new.status is distinct from old.status
     or new.verified_number is distinct from old.verified_number
     or new.verified_at is distinct from old.verified_at
     or new.verified_by is distinct from old.verified_by
     or new.review_notes is distinct from old.review_notes then
    raise exception 'Document review fields can only be changed by Servios staff';
  end if;
  return new;
end
$$;

drop trigger if exists provider_documents_guard on public.provider_documents;
create trigger provider_documents_guard
  before insert or update on public.provider_documents
  for each row execute function public.guard_provider_document_fields();

create or replace function public.guard_provider_verification_fields()
returns trigger
language plpgsql
as $$
begin
  if coalesce(auth.role(), '') = 'service_role' or auth.uid() is null then
    return new;
  end if;
  -- The only self-service transition is "submit for review"
  if new.verification_status is distinct from old.verification_status
     and not (new.verification_status = 'pending' and old.verification_status in ('unverified', 'pending')) then
    raise exception 'Verification status can only be changed by Servios staff';
  end if;
  new.identity_verified := old.identity_verified;
  new.identity_verified_at := old.identity_verified_at;
  new.insurance_verified := old.insurance_verified;
  new.insurance_expiry_date := old.insurance_expiry_date;
  new.business_license_verified := old.business_license_verified;
  new.business_license_expiry_date := old.business_license_expiry_date;
  new.verification_override := old.verification_override;
  new.verification_notes := old.verification_notes;
  new.verified_at := old.verified_at;
  return new;
end
$$;

drop trigger if exists provider_profiles_guard_verification on public.provider_profiles;
create trigger provider_profiles_guard_verification
  before update on public.provider_profiles
  for each row execute function public.guard_provider_verification_fields();

-- ── 4. Expiry sweep ─────────────────────────────────────────────────────────
create or replace function public.expire_provider_documents()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare n integer;
begin
  update provider_documents
     set status = 'expired', updated_at = now()
   where status = 'approved' and expiry_date is not null and expiry_date < current_date;
  get diagnostics n = row_count;
  return n;
end
$$;

-- ── 5. Notifications (handled by /api/notifications/dispatch) ──────────────
drop trigger if exists provider_documents_notify_status on public.provider_documents;
create trigger provider_documents_notify_status
  after update of status on public.provider_documents
  for each row execute function public.notify_app_dispatch();

drop trigger if exists provider_profiles_notify_verification on public.provider_profiles;
create trigger provider_profiles_notify_verification
  after update of verification_status on public.provider_profiles
  for each row execute function public.notify_app_dispatch();

-- ── 6. Backfill ─────────────────────────────────────────────────────────────
update public.provider_profiles pp
   set verification_override = true,
       verification_notes = coalesce(verification_notes, 'Verified before document checks were enforced (legacy)')
 where verification_status = 'verified'
   and not (
     exists (select 1 from provider_documents d where d.provider_id = pp.id and d.document_type = 'id' and d.status = 'approved')
     and exists (select 1 from provider_documents d where d.provider_id = pp.id and d.document_type = 'insurance' and d.status = 'approved')
   );

do $$
declare r record;
begin
  for r in select id from public.provider_profiles loop
    perform public.recompute_provider_verification(r.id);
  end loop;
end $$;
