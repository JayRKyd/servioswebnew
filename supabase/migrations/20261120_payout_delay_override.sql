-- Per-provider clearing-delay override (Round 6 retest, Part 11 #8).
-- An admin can set a provider's bank clearing delay by hand; when set it wins
-- over the automatic 14-day (new provider) / 7-day (standard) rule.
-- Stripe's UK minimum is 7 days.

alter table public.provider_profiles
  add column if not exists payout_delay_override integer,
  add column if not exists payout_delay_override_reason text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'provider_profiles_payout_delay_override_range') then
    alter table public.provider_profiles
      add constraint provider_profiles_payout_delay_override_range
      check (payout_delay_override is null or payout_delay_override between 7 and 31);
  end if;
end
$$;

-- Providers can edit their own profile row; the clearing delay is not theirs to set.
create or replace function public.guard_provider_payout_delay()
returns trigger
language plpgsql
as $$
begin
  if coalesce(auth.role(), '') = 'service_role' or auth.uid() is null then
    return new;
  end if;
  new.payout_delay_days := old.payout_delay_days;
  new.payout_delay_override := old.payout_delay_override;
  new.payout_delay_override_reason := old.payout_delay_override_reason;
  return new;
end
$$;

create or replace trigger provider_profiles_guard_payout_delay
  before update on public.provider_profiles
  for each row execute function public.guard_provider_payout_delay();
