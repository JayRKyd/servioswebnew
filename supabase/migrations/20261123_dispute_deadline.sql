-- Fix the dispute deadline when the job is confirmed (client retest, 22 Nov).
-- Before this the deadline was worked out from the current "dispute window"
-- setting every time it was read, so changing the setting re-dated every
-- existing job. Now each booking stores its own deadline, stamped when the
-- customer confirms, and later setting changes only affect new confirmations.

alter table public.bookings
  add column if not exists dispute_deadline timestamptz;

-- Existing confirmed jobs get the window that is in force today (30 days).
update public.bookings b
   set dispute_deadline = b.customer_confirmed_at
       + make_interval(days => coalesce(
           (select (s.value #>> '{}')::int from public.platform_settings s where s.key = 'dispute_window_days'),
           30))
 where b.customer_confirmed_at is not null
   and b.dispute_deadline is null;

create or replace function public.stamp_dispute_deadline()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  window_days int;
begin
  -- Un-confirmed (an admin moved the status back): no deadline
  if new.customer_confirmed_at is null then
    new.dispute_deadline := null;
    return new;
  end if;

  -- Newly confirmed: stamp it from the setting as it stands right now
  if tg_op = 'INSERT' or old.customer_confirmed_at is null then
    select (value #>> '{}')::int into window_days from public.platform_settings where key = 'dispute_window_days';
    new.dispute_deadline := new.customer_confirmed_at + make_interval(days => coalesce(window_days, 30));
    return new;
  end if;

  -- Already confirmed: only Servios (service role) may move the deadline
  if not (coalesce(auth.role(), '') = 'service_role' or auth.uid() is null) then
    new.dispute_deadline := old.dispute_deadline;
  end if;
  if new.dispute_deadline is null then
    new.dispute_deadline := old.dispute_deadline;
  end if;
  return new;
end
$$;

create or replace trigger bookings_stamp_dispute_deadline
  before insert or update on public.bookings
  for each row execute function public.stamp_dispute_deadline();
