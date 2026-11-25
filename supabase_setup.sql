-- Dos Electronics Courier Tracking: run this entire file in Supabase SQL Editor.
-- Uses independent courier_* tables; it does not alter existing office-app tables.
create extension if not exists pgcrypto;

create table if not exists public.courier_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  role text not null default 'employee' check (role in ('admin','employee','courier')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.courier_bookings (
  id uuid primary key default gen_random_uuid(),
  booking_no text unique not null default ('DE-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8))),
  created_by uuid not null references public.courier_profiles(id),
  assigned_to uuid references public.courier_profiles(id),
  sender_name text not null,
  sender_phone text,
  receiver_name text not null,
  receiver_phone text not null,
  receiver_address text not null,
  courier_company text,
  awb_number text,
  tracking_url text,
  parcel_description text,
  notes text,
  status text not null default 'Booked' check (status in ('Booked','Picked Up','In Transit','Out for Delivery','Delivered','Delivery Failed','Returned')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  delivered_at timestamptz
);

create table if not exists public.courier_status_history (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.courier_bookings(id) on delete cascade,
  updated_by uuid not null references public.courier_profiles(id),
  status text not null,
  note text,
  created_at timestamptz not null default now()
);

create or replace function public.courier_new_profile()
returns trigger language plpgsql security definer set search_path=public
as $$
begin
  insert into public.courier_profiles(id,full_name,role)
  values(new.id,coalesce(new.raw_user_meta_data->>'full_name',split_part(new.email,'@',1)),'employee')
  on conflict(id) do nothing;
  return new;
end; $$;
drop trigger if exists courier_auth_user_created on auth.users;
create trigger courier_auth_user_created after insert on auth.users
for each row execute procedure public.courier_new_profile();

create or replace function public.courier_is_admin()
returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.courier_profiles where id=auth.uid() and role='admin' and active=true); $$;

alter table public.courier_profiles enable row level security;
alter table public.courier_bookings enable row level security;
alter table public.courier_status_history enable row level security;

drop policy if exists "courier profile read" on public.courier_profiles;
create policy "courier profile read" on public.courier_profiles for select to authenticated
using (id=auth.uid() or public.courier_is_admin() or exists(
  select 1 from public.courier_bookings b where b.assigned_to=auth.uid() and b.created_by=courier_profiles.id
));
drop policy if exists "courier admin update profiles" on public.courier_profiles;
create policy "courier admin update profiles" on public.courier_profiles for update to authenticated
using (public.courier_is_admin()) with check (public.courier_is_admin());

drop policy if exists "courier booking read" on public.courier_bookings;
create policy "courier booking read" on public.courier_bookings for select to authenticated
using (public.courier_is_admin() or created_by=auth.uid() or assigned_to=auth.uid());
drop policy if exists "courier employee create" on public.courier_bookings;
create policy "courier employee create" on public.courier_bookings for insert to authenticated
with check (created_by=auth.uid() and exists(select 1 from public.courier_profiles p where p.id=auth.uid() and p.active=true and p.role in ('admin','employee')));
drop policy if exists "courier admin update booking" on public.courier_bookings;
create policy "courier admin update booking" on public.courier_bookings for update to authenticated
using (public.courier_is_admin()) with check (public.courier_is_admin());

create or replace function public.courier_update_status(p_booking_id uuid,p_status text,p_note text default null)
returns void language plpgsql security definer set search_path=public
as $$
declare b public.courier_bookings;
begin
  if p_status not in ('Booked','Picked Up','In Transit','Out for Delivery','Delivered','Delivery Failed','Returned') then
    raise exception 'Invalid status';
  end if;
  select * into b from public.courier_bookings where id=p_booking_id;
  if not found then raise exception 'Booking not found'; end if;
  if not (public.courier_is_admin() or b.assigned_to=auth.uid()) then
    raise exception 'You are not assigned to this booking';
  end if;
  update public.courier_bookings set status=p_status,updated_at=now(),
    delivered_at=case when p_status='Delivered' then now() else null end
  where id=p_booking_id;
  insert into public.courier_status_history(booking_id,updated_by,status,note)
  values(p_booking_id,auth.uid(),p_status,p_note);
end; $$;
revoke all on function public.courier_update_status(uuid,text,text) from public;
grant execute on function public.courier_update_status(uuid,text,text) to authenticated;

drop policy if exists "courier history read" on public.courier_status_history;
create policy "courier history read" on public.courier_status_history for select to authenticated
using (exists(select 1 from public.courier_bookings b where b.id=booking_id and
 (public.courier_is_admin() or b.created_by=auth.uid() or b.assigned_to=auth.uid())));

grant usage on schema public to authenticated;
grant select,update on public.courier_profiles to authenticated;
grant select,insert,update on public.courier_bookings to authenticated;
grant select on public.courier_status_history to authenticated;

-- IMPORTANT: After creating your first user in Authentication > Users,
-- promote that user to admin by running this command with their auth user UUID:
-- update public.courier_profiles set role='admin' where id='PASTE-AUTH-USER-UUID-HERE';
