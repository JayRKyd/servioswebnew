-- Phase 2 of docs/ADMIN-PANEL-PLAN.md — disputes, refunds, payout holds
--
-- Client decisions (2026-10-18):
--   * 30-day dispute window after the customer confirms — NOT a payout freeze
--   * Servios absorbs the Stripe fee on full refunds
--   * Partial refunds are admin-set; commission scales with what the provider keeps
--   * Upheld disputes reverse the provider's transfer share
--   * Provider bank payouts clear after 7 days (UK minimum), 14 for new providers
--
-- 1. platform_settings: the policy numbers above, editable by admins.
-- 2. disputes: provider response, money hold bookkeeping, auto dispute_number.
--    Creation now goes through /api/disputes (window + ownership checks), so
--    the direct-insert policy is dropped.
-- 3. dispute_messages: one thread per dispute with per-message visibility
--    (everyone / customer only / provider only / admins only).
-- 4. payments: transfer bookkeeping; provider_profiles: applied payout delay.
-- 5. Private dispute-evidence bucket (own-folder uploads; reads via signed URLs).
-- 6. Notification triggers for disputes and dispute messages.

-- ── 1. Settings ───────────────────────────────────────────────────────────────
create table if not exists public.platform_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
alter table public.platform_settings enable row level security;
drop policy if exists admin_read_all on public.platform_settings;
create policy admin_read_all on public.platform_settings
  for select to authenticated using (public.is_admin());

insert into public.platform_settings (key, value) values
  ('dispute_window_days', '30'::jsonb),
  ('payout_delay_days', '7'::jsonb),
  ('new_provider_payout_delay_days', '14'::jsonb),
  ('new_provider_job_threshold', '5'::jsonb)
on conflict (key) do nothing;

-- ── 2. Disputes ───────────────────────────────────────────────────────────────
alter table public.disputes
  add column if not exists payment_id uuid references public.payments(id),
  add column if not exists provider_response text,
  add column if not exists provider_responded_at timestamptz,
  add column if not exists held_amount numeric not null default 0,
  add column if not exists hold_reversal_id text,
  add column if not exists refund_amount numeric,
  add column if not exists stripe_dispute_id text,
  add column if not exists source text not null default 'customer';

alter table public.disputes drop constraint if exists disputes_status_check;
alter table public.disputes add constraint disputes_status_check
  check (status in ('open', 'under_review', 'awaiting_customer', 'awaiting_provider', 'resolved', 'closed'));

alter table public.disputes drop constraint if exists disputes_source_check;
alter table public.disputes add constraint disputes_source_check
  check (source in ('customer', 'chargeback', 'admin'));

create unique index if not exists disputes_one_open_per_booking
  on public.disputes (booking_id)
  where status in ('open', 'under_review', 'awaiting_customer', 'awaiting_provider') and source <> 'chargeback';

create or replace function public.set_dispute_number()
returns trigger
language plpgsql
as $$
begin
  if new.dispute_number is null or new.dispute_number = '' then
    new.dispute_number := 'DSP-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(md5(random()::text), 1, 6));
  end if;
  return new;
end
$$;
drop trigger if exists disputes_set_number on public.disputes;
create trigger disputes_set_number
  before insert on public.disputes
  for each row execute function public.set_dispute_number();

drop trigger if exists disputes_updated_at on public.disputes;
create trigger disputes_updated_at
  before update on public.disputes
  for each row execute function public.update_updated_at_column();

drop policy if exists "Users insert disputes" on public.disputes;

-- ── 3. Dispute thread ─────────────────────────────────────────────────────────
create table if not exists public.dispute_messages (
  id uuid primary key default gen_random_uuid(),
  dispute_id uuid not null references public.disputes(id) on delete cascade,
  sender_id uuid references public.users(id),
  sender_role text not null check (sender_role in ('customer', 'provider', 'admin', 'system')),
  body text not null,
  attachments jsonb not null default '[]'::jsonb,
  visible_to text not null default 'all' check (visible_to in ('all', 'customer', 'provider', 'admin')),
  created_at timestamptz not null default now()
);
create index if not exists dispute_messages_dispute_idx on public.dispute_messages (dispute_id, created_at);
alter table public.dispute_messages enable row level security;

drop policy if exists admin_read_all on public.dispute_messages;
create policy admin_read_all on public.dispute_messages
  for select to authenticated using (public.is_admin());

drop policy if exists dispute_parties_read on public.dispute_messages;
create policy dispute_parties_read on public.dispute_messages
  for select to authenticated using (
    exists (
      select 1 from public.disputes d
      where d.id = dispute_messages.dispute_id
        and (
          (d.filed_by = auth.uid() and dispute_messages.visible_to in ('all', 'customer'))
          or (d.filed_against = auth.uid() and dispute_messages.visible_to in ('all', 'provider'))
        )
    )
  );

-- ── 4. Payments / providers ───────────────────────────────────────────────────
alter table public.payments
  add column if not exists transferred_amount numeric not null default 0,
  add column if not exists reversed_amount numeric not null default 0;

alter table public.provider_profiles
  add column if not exists payout_delay_days integer;

-- ── 5. Evidence bucket ────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('dispute-evidence', 'dispute-evidence', false)
on conflict (id) do nothing;

drop policy if exists "Users upload own dispute evidence" on storage.objects;
create policy "Users upload own dispute evidence" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'dispute-evidence' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users read own dispute evidence" on storage.objects;
create policy "Users read own dispute evidence" on storage.objects
  for select to authenticated
  using (bucket_id = 'dispute-evidence' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

-- ── 6. Notifications ──────────────────────────────────────────────────────────
drop trigger if exists disputes_notify on public.disputes;
create trigger disputes_notify
  after insert or update of status on public.disputes
  for each row execute function public.notify_app_dispatch();

drop trigger if exists dispute_messages_notify on public.dispute_messages;
create trigger dispute_messages_notify
  after insert on public.dispute_messages
  for each row execute function public.notify_app_dispatch();
