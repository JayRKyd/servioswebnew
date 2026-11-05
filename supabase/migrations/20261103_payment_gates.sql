-- Round 6 blockers (docs/ROUND-6-FINDINGS.md A1/A2, B12)
--
-- 1. Lifecycle guard on bookings, enforced for every client (service role
--    exempt for admin resolutions):
--      * work can't start or be completed on a paid booking until the
--        customer's card is authorised
--      * the customer can only confirm once the provider has marked the job
--        complete, and only when payment is authorised
--      * money columns and payment_status are server-owned — browser clients
--        can't rewrite them
-- 2. "Paid" emails now key off the payments table (payment actually
--    captured), not off customer_confirmed_at.
-- 3. customer_profiles.stripe_customer_id so Stripe customers match Servios
--    accounts.

create or replace function public.guard_booking_lifecycle()
returns trigger
language plpgsql
as $$
declare
  v_paid boolean;
begin
  if coalesce(auth.role(), '') = 'service_role' or auth.uid() is null then
    return new;
  end if;

  -- Server-owned columns
  if new.payment_status is distinct from old.payment_status
     or new.total_amount is distinct from old.total_amount
     or new.base_amount is distinct from old.base_amount
     or new.platform_fee is distinct from old.platform_fee
     or new.commission_rate is distinct from old.commission_rate then
    raise exception 'Payment details can only be changed by Servios';
  end if;

  v_paid := coalesce(new.total_amount, 0) <= 0
            or coalesce(new.payment_status, 'unpaid') in ('authorized', 'paid', 'partially_refunded');

  -- Starting / completing work needs the customer's card authorised
  if new.status in ('in_progress', 'completed')
     and old.status not in ('in_progress', 'completed')
     and not v_paid then
    raise exception 'The customer needs to authorise payment before work can start';
  end if;

  -- Customer confirmation: provider must have completed, payment must exist
  if new.customer_confirmed_at is not null and old.customer_confirmed_at is null then
    if old.status <> 'completed' then
      raise exception 'The provider has to mark the job complete before it can be confirmed';
    end if;
    if not v_paid then
      raise exception 'Payment must be authorised before the job can be confirmed';
    end if;
    new.status := 'completed';
  end if;

  return new;
end
$$;

drop trigger if exists bookings_guard_lifecycle on public.bookings;
create trigger bookings_guard_lifecycle
  before update on public.bookings
  for each row execute function public.guard_booking_lifecycle();

-- Receipts / "you've been paid" fire when the money is actually captured
drop trigger if exists payments_notify_status on public.payments;
create trigger payments_notify_status
  after update of payment_status on public.payments
  for each row execute function public.notify_app_dispatch();

alter table public.customer_profiles
  add column if not exists stripe_customer_id text;
