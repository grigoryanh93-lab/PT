-- Home Health PT Scheduler Supabase schema
create extension if not exists pgcrypto;

create type app_role as enum ('admin', 'therapist');
create type visit_status as enum ('scheduled', 'done', 'missed', 'cancelled', 'rescheduled');

create table agencies (id uuid primary key default gen_random_uuid(), name text not null, phone text, notes text, created_at timestamptz default now());
create table profiles (id uuid primary key references auth.users(id) on delete cascade, full_name text not null, email text unique, role app_role not null default 'therapist', created_at timestamptz default now());
create table therapists (id uuid primary key references profiles(id) on delete cascade, phone text, availability text, service_areas text[] default '{}', active boolean default true, created_at timestamptz default now());
create table patients (id uuid primary key default gen_random_uuid(), name text not null, area text, address text not null, phone text, agency_id uuid references agencies(id), agency text, status text default 'Active', approved_visits int default 0, used_visits int default 0, visits_remaining int default 0, frequency text default '1x/week', preferred_days text[] default '{}', preferred_times text, auth_expiration date, notes text, therapist_id uuid references therapists(id), created_at timestamptz default now());
create table appointments (id uuid primary key default gen_random_uuid(), patient_id uuid not null references patients(id) on delete cascade, therapist_id uuid not null references therapists(id), day text not null, time time, status visit_status default 'scheduled', completed_by uuid references therapists(id), completed_at text, note text, created_at timestamptz default now());
create table visit_logs (id text primary key, patient_id uuid not null references patients(id) on delete cascade, patient_name text not null, therapist_id uuid not null references therapists(id), therapist_name text not null, visit_id uuid, date date not null, scheduled_day text, scheduled_time text, completed_time text, status visit_status not null default 'done', note text, created_at timestamptz default now());
create table authorizations (id uuid primary key default gen_random_uuid(), patient_id uuid not null references patients(id) on delete cascade, approved_visits int not null default 0, used_visits int not null default 0, expires_on date, notes text, created_at timestamptz default now());

create or replace function is_admin() returns boolean language sql security definer set search_path = public as $$ select exists (select 1 from profiles where id = auth.uid() and role = 'admin') $$;
create or replace function is_assigned_therapist(patient_uuid uuid) returns boolean language sql security definer set search_path = public as $$ select exists (select 1 from patients where id = patient_uuid and therapist_id = auth.uid()) $$;

alter table agencies enable row level security; alter table profiles enable row level security; alter table therapists enable row level security; alter table patients enable row level security; alter table appointments enable row level security; alter table visit_logs enable row level security; alter table authorizations enable row level security;

create policy "admins manage agencies" on agencies for all using (is_admin()) with check (is_admin());
create policy "profiles see self or admin" on profiles for select using (id = auth.uid() or is_admin());
create policy "admins manage profiles" on profiles for all using (is_admin()) with check (is_admin());
create policy "therapists see self and admins see all" on therapists for select using (id = auth.uid() or is_admin());
create policy "admins manage therapists" on therapists for all using (is_admin()) with check (is_admin());
create policy "patients admin or assigned therapist read" on patients for select using (is_admin() or therapist_id = auth.uid());
create policy "admins manage patients" on patients for all using (is_admin()) with check (is_admin());
create policy "assigned therapists update own patients" on patients for update using (therapist_id = auth.uid()) with check (therapist_id = auth.uid());
create policy "appointments admin or assigned read" on appointments for select using (is_admin() or therapist_id = auth.uid() or is_assigned_therapist(patient_id));
create policy "admins manage appointments" on appointments for all using (is_admin()) with check (is_admin());
create policy "therapists manage own appointments" on appointments for all using (therapist_id = auth.uid()) with check (therapist_id = auth.uid());
create policy "visit logs admin or assigned read" on visit_logs for select using (is_admin() or therapist_id = auth.uid());
create policy "therapists insert own visit logs" on visit_logs for insert with check (is_admin() or therapist_id = auth.uid());
create policy "admins manage visit logs" on visit_logs for all using (is_admin()) with check (is_admin());
create policy "authorizations admin or assigned read" on authorizations for select using (is_admin() or is_assigned_therapist(patient_id));
create policy "admins manage authorizations" on authorizations for all using (is_admin()) with check (is_admin());
