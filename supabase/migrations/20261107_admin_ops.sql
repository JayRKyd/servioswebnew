-- Phases 4–7 of docs/ADMIN-PANEL-PLAN.md: review moderation, user management
--
-- 1. reviews: hide/unhide + flag bookkeeping. Hidden reviews vanish from
--    public reads and from the provider's rating. Providers can flag a
--    review about them (one column write, guarded).
-- 2. users: suspension / closure bookkeeping + admin notes.
-- 3. Admin alert when a review is flagged.

alter table public.reviews
  add column if not exists hidden_at timestamptz,
  add column if not exists hidden_by uuid,
  add column if not exists hidden_reason text,
  add column if not exists flagged_at timestamptz,
  add column if not exists flagged_by uuid;

-- Public/anon reads skip hidden reviews; the author and admins still see them
drop policy if exists "Reviews are publicly readable" on public.reviews;
create policy "Reviews are publicly readable" on public.reviews
  for select to authenticated
  using (hidden_at is null or reviewer_id = auth.uid() or public.is_admin());
drop policy if exists anon_read_reviews on public.reviews;
create policy anon_read_reviews on public.reviews
  for select to anon using (hidden_at is null);

-- Rating aggregates ignore hidden reviews
create or replace function public.update_provider_rating_aggregates()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  target_user uuid;
begin
  target_user := coalesce(new.reviewee_id, old.reviewee_id);
  update provider_profiles pp set
    rating_average = coalesce((select round(avg(r.rating)::numeric, 2) from reviews r where r.reviewee_id = target_user and r.hidden_at is null), 0),
    total_reviews  = (select count(*) from reviews r where r.reviewee_id = target_user and r.hidden_at is null)
  where pp.user_id = target_user;
  return coalesce(new, old);
end;
$$;

-- The provider a review is about may flag it (and nothing else); the author
-- may edit their own text/rating but never the moderation columns
create or replace function public.guard_review_fields()
returns trigger
language plpgsql
as $$
begin
  if coalesce(auth.role(), '') = 'service_role' or auth.uid() is null then
    return new;
  end if;
  if new.hidden_at is distinct from old.hidden_at
     or new.hidden_by is distinct from old.hidden_by
     or new.hidden_reason is distinct from old.hidden_reason then
    raise exception 'Only Servios staff can hide or unhide a review';
  end if;
  if auth.uid() = old.reviewee_id and auth.uid() <> old.reviewer_id then
    -- provider: only the flag may change
    if new.rating is distinct from old.rating or new.review_text is distinct from old.review_text
       or new.reviewer_id is distinct from old.reviewer_id or new.reviewee_id is distinct from old.reviewee_id then
      raise exception 'You can report a review but not change it';
    end if;
    if new.is_flagged and not coalesce(old.is_flagged, false) then
      new.flagged_at := now();
      new.flagged_by := auth.uid();
    end if;
  end if;
  return new;
end
$$;
drop trigger if exists reviews_guard on public.reviews;
create trigger reviews_guard before update on public.reviews
  for each row execute function public.guard_review_fields();

drop policy if exists "Reviewee can flag review" on public.reviews;
create policy "Reviewee can flag review" on public.reviews
  for update to authenticated
  using (reviewee_id = auth.uid())
  with check (reviewee_id = auth.uid());

drop trigger if exists reviews_notify_flag on public.reviews;
create trigger reviews_notify_flag
  after update of is_flagged on public.reviews
  for each row execute function public.notify_app_dispatch();

-- ── 2. Users ────────────────────────────────────────────────────────────────
alter table public.users
  add column if not exists suspended_at timestamptz,
  add column if not exists suspension_reason text,
  add column if not exists closed_at timestamptz,
  add column if not exists admin_notes text;
