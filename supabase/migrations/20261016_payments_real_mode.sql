-- Phase 0.3 of docs/ADMIN-PANEL-PLAN.md — real Stripe payments
--
-- 1. bookings.payment_status never existed; every update to it has silently
--    failed. Added with the states the app uses.
-- 2. payments gains payer_id (the code always wrote it to a column that
--    wasn't there), refund/payout bookkeeping, and a GBP default (was BSD).
-- 3. stripe_events: webhook idempotency — Stripe retries, we must not
--    double-apply.
-- 4. Backfill payer_id on bookings from the customer profile (web bookings
--    never set it, so the payment route refused every one of them).

alter table public.bookings
  add column if not exists payment_status text not null default 'unpaid';
alter table public.bookings drop constraint if exists bookings_payment_status_check;
alter table public.bookings
  add constraint bookings_payment_status_check
  check (payment_status in ('unpaid', 'pending', 'authorized', 'paid', 'refunded', 'partially_refunded', 'failed'));

alter table public.payments
  add column if not exists payer_id uuid,
  add column if not exists refund_amount numeric,
  add column if not exists released_at timestamptz,
  add column if not exists released_by uuid,
  add column if not exists payout_method text,
  add column if not exists payout_reference text,
  add column if not exists updated_at timestamptz not null default now();
alter table public.payments alter column currency set default 'GBP';
alter table public.booking_milestones alter column currency set default 'GBP';

create index if not exists payments_intent_idx on public.payments (payment_intent_id);
create index if not exists payments_booking_idx on public.payments (booking_id);

drop trigger if exists payments_updated_at on public.payments;
create trigger payments_updated_at
  before update on public.payments
  for each row execute function public.update_updated_at_column();

create table if not exists public.stripe_events (
  id text primary key,
  type text not null,
  livemode boolean,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error text
);
alter table public.stripe_events enable row level security;
drop policy if exists admin_read_all on public.stripe_events;
create policy admin_read_all on public.stripe_events
  for select to authenticated using (public.is_admin());

update public.bookings b
   set payer_id = cp.user_id,
       payer_type = coalesce(b.payer_type, 'customer')
  from public.customer_profiles cp
 where cp.id = b.customer_id
   and b.payer_id is null;
