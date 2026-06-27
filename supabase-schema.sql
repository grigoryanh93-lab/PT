-- Home Health PT Scheduler Supabase schema
-- Run this entire file once in the Supabase SQL editor for your project.

create extension if not exists pgcrypto;

create type app_role as enum ('admin', 'therapist');
create type visit_status as enum ('scheduled', 'done', 'missed', 'cancelled', 'rescheduled');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text unique,
  role app_role not null default 'therapist',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Convenience public user records for app-owned user metadata.
create table public.users (
  id uuid primary key references public.profiles(id) on delete cascade,
  email text unique,
  full_name text not null default '',
  role app_role not null default 'therapist',
  created_at timestamptz not null default now()
);

create table public.therapists (
  id uuid primary key references public.profiles(id) on delete cascade,
  phone text,
  availability text,
  service_areas text[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.patients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  area text,
  address text not null,
  phone text,
  agency text,
  status text not null default 'Active',
  approved_visits int not null default 0,
  used_visits int not null default 0,
  visits_remaining int not null default 0,
  frequency text not null default '1x/week',
  preferred_days text[] not null default '{}',
  preferred_times text,
  auth_expiration date,
  notes text,
  therapist_id uuid references public.therapists(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  therapist_id uuid references public.therapists(id) on delete set null,
  day text not null,
  time time,
  status visit_status not null default 'scheduled',
  completed_by uuid references public.therapists(id) on delete set null,
  completed_at text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.visits (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid references public.appointments(id) on delete set null,
  patient_id uuid not null references public.patients(id) on delete cascade,
  therapist_id uuid references public.therapists(id) on delete set null,
  visit_date date not null default current_date,
  status visit_status not null default 'scheduled',
  note text,
  created_at timestamptz not null default now()
);

create table public.visit_logs (
  id text primary key,
  patient_id uuid not null references public.patients(id) on delete cascade,
  patient_name text not null,
  therapist_id uuid references public.therapists(id) on delete set null,
  therapist_name text not null,
  visit_id uuid,
  date date not null,
  scheduled_day text,
  scheduled_time text,
  completed_time text,
  status visit_status not null default 'done',
  note text,
  created_at timestamptz not null default now()
);

create table public.visit_history (
  id uuid primary key default gen_random_uuid(),
  visit_log_id text unique references public.visit_logs(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  patient_name text not null,
  therapist_id uuid references public.therapists(id) on delete set null,
  therapist_name text not null,
  visit_id uuid,
  date date not null,
  scheduled_day text,
  scheduled_time text,
  completed_time text,
  status visit_status not null default 'done',
  note text,
  created_at timestamptz not null default now()
);

create table public.uploaded_patient_imports (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  imported_by uuid references public.profiles(id) on delete set null,
  row_count int not null default 0,
  imported_count int not null default 0,
  error_count int not null default 0,
  raw_rows jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger therapists_set_updated_at before update on public.therapists for each row execute function public.set_updated_at();
create trigger patients_set_updated_at before update on public.patients for each row execute function public.set_updated_at();
create trigger appointments_set_updated_at before update on public.appointments for each row execute function public.set_updated_at();

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1), ''), new.email, 'therapist')
  on conflict (id) do nothing;

  insert into public.users (id, full_name, email, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1), ''), new.email, 'therapist')
  on conflict (id) do nothing;

  insert into public.therapists (id, active)
  values (new.id, true)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.is_admin() returns boolean language sql security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
$$;

create or replace function public.is_assigned_therapist(patient_uuid uuid) returns boolean language sql security definer set search_path = public as $$
  select exists (select 1 from public.patients where id = patient_uuid and therapist_id = auth.uid())
$$;

alter table public.profiles enable row level security;
alter table public.users enable row level security;
alter table public.therapists enable row level security;
alter table public.patients enable row level security;
alter table public.appointments enable row level security;
alter table public.visits enable row level security;
alter table public.visit_logs enable row level security;
alter table public.visit_history enable row level security;
alter table public.uploaded_patient_imports enable row level security;

create policy "profiles see self or admin" on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy "admins update profiles" on public.profiles for all using (public.is_admin()) with check (public.is_admin());
create policy "users see self or admin" on public.users for select using (id = auth.uid() or public.is_admin());
create policy "admins manage users" on public.users for all using (public.is_admin()) with check (public.is_admin());

create policy "therapists see self and admins see all" on public.therapists for select using (id = auth.uid() or public.is_admin());
create policy "therapists update self" on public.therapists for update using (id = auth.uid()) with check (id = auth.uid());
create policy "admins manage therapists" on public.therapists for all using (public.is_admin()) with check (public.is_admin());

create policy "patients admin or assigned therapist read" on public.patients for select using (public.is_admin() or therapist_id = auth.uid());
create policy "admins manage patients" on public.patients for all using (public.is_admin()) with check (public.is_admin());
create policy "assigned therapists update own patients" on public.patients for update using (therapist_id = auth.uid()) with check (therapist_id = auth.uid());

create policy "appointments admin or assigned read" on public.appointments for select using (public.is_admin() or therapist_id = auth.uid() or public.is_assigned_therapist(patient_id));
create policy "admins manage appointments" on public.appointments for all using (public.is_admin()) with check (public.is_admin());
create policy "therapists manage own appointments" on public.appointments for all using (therapist_id = auth.uid()) with check (therapist_id = auth.uid());

create policy "visits admin or assigned read" on public.visits for select using (public.is_admin() or therapist_id = auth.uid() or public.is_assigned_therapist(patient_id));
create policy "admins manage visits" on public.visits for all using (public.is_admin()) with check (public.is_admin());
create policy "therapists manage own visits" on public.visits for all using (therapist_id = auth.uid()) with check (therapist_id = auth.uid());

create policy "visit logs admin or assigned read" on public.visit_logs for select using (public.is_admin() or therapist_id = auth.uid());
create policy "therapists insert own visit logs" on public.visit_logs for insert with check (public.is_admin() or therapist_id = auth.uid());
create policy "therapists update own visit logs" on public.visit_logs for update using (therapist_id = auth.uid()) with check (therapist_id = auth.uid());
create policy "admins manage visit logs" on public.visit_logs for all using (public.is_admin()) with check (public.is_admin());

create policy "visit history admin or assigned read" on public.visit_history for select using (public.is_admin() or therapist_id = auth.uid());
create policy "therapists insert own visit history" on public.visit_history for insert with check (public.is_admin() or therapist_id = auth.uid());
create policy "therapists update own visit history" on public.visit_history for update using (therapist_id = auth.uid()) with check (therapist_id = auth.uid());
create policy "admins manage visit history" on public.visit_history for all using (public.is_admin()) with check (public.is_admin());

create policy "admins manage uploaded patient imports" on public.uploaded_patient_imports for all using (public.is_admin()) with check (public.is_admin());
