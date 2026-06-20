-- ================================================================
-- AI Ambulance Allocation System — Supabase Database Schema
-- Run this SQL in your Supabase SQL Editor
-- ================================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ── Ambulances ───────────────────────────────────────────────────
create table if not exists ambulances (
  id uuid primary key default uuid_generate_v4(),
  driver_id uuid references auth.users(id) on delete set null,
  vehicle_number text not null unique,
  status text not null default 'available' check (status in ('available', 'busy', 'offline')),
  latitude float8 not null default 0,
  longitude float8 not null default 0,
  last_updated timestamptz not null default now()
);

-- ── Hospitals ────────────────────────────────────────────────────
create table if not exists hospitals (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  latitude float8 not null,
  longitude float8 not null,
  contact_number text,
  capacity int default 100
);

-- ── Emergency Requests ───────────────────────────────────────────
create table if not exists emergency_requests (
  id uuid primary key default uuid_generate_v4(),
  patient_id uuid not null references auth.users(id) on delete cascade,
  emergency_type text not null check (
    emergency_type in (
      'cardiac_arrest', 'accident', 'stroke', 'respiratory',
      'trauma', 'fire', 'drowning', 'other'
    )
  ),
  description text not null,
  priority text check (priority in ('low', 'medium', 'high', 'critical')),
  status text not null default 'pending' check (
    status in ('pending', 'assigned', 'accepted', 'en_route', 'picked_up', 'completed', 'cancelled')
  ),
  latitude float8 not null,
  longitude float8 not null,
  created_at timestamptz not null default now()
);

-- ── Assignments ──────────────────────────────────────────────────
create table if not exists assignments (
  id uuid primary key default uuid_generate_v4(),
  request_id uuid not null references emergency_requests(id) on delete cascade,
  ambulance_id uuid not null references ambulances(id),
  eta int not null default 0, -- estimated minutes
  status text not null default 'assigned' check (
    status in ('assigned', 'accepted', 'en_route', 'picked_up', 'completed', 'cancelled')
  ),
  ga_metrics jsonb, -- Genetic Algorithm decision snapshot (why this unit was chosen)
  assigned_at timestamptz not null default now(),
  accepted_at timestamptz,
  completed_at timestamptz
);

-- Idempotent add for existing databases
alter table assignments add column if not exists ga_metrics jsonb;

-- ── Tracking Logs ────────────────────────────────────────────────
create table if not exists tracking_logs (
  id uuid primary key default uuid_generate_v4(),
  assignment_id uuid not null references assignments(id) on delete cascade,
  latitude float8 not null,
  longitude float8 not null,
  timestamp timestamptz not null default now()
);

-- ── Indexes ──────────────────────────────────────────────────────
create index if not exists idx_emergency_requests_patient_id on emergency_requests(patient_id);
create index if not exists idx_emergency_requests_status on emergency_requests(status);
create index if not exists idx_assignments_request_id on assignments(request_id);
create index if not exists idx_assignments_ambulance_id on assignments(ambulance_id);
create index if not exists idx_tracking_logs_assignment_id on tracking_logs(assignment_id);
create index if not exists idx_ambulances_status on ambulances(status);

-- ── Sample Data (optional, for testing) ─────────────────────────
-- Insert some test ambulances
insert into ambulances (vehicle_number, status, latitude, longitude)
values
  ('KA-01-AB-1234', 'available', 12.9716, 77.5946),
  ('KA-02-CD-5678', 'available', 12.9800, 77.6000),
  ('KA-03-EF-9012', 'available', 12.9650, 77.5800),
  ('KA-04-GH-3456', 'offline', 12.9900, 77.6100),
  ('KA-05-IJ-7890', 'available', 12.9600, 77.6200)
on conflict (vehicle_number) do nothing;

-- Insert some test hospitals
insert into hospitals (name, latitude, longitude, contact_number, capacity)
values
  ('Bangalore General Hospital', 12.9730, 77.5970, '+91-80-22222222', 500),
  ('Apollo Hospital Bangalore', 12.9826, 77.6082, '+91-80-26941978', 350),
  ('Manipal Hospital', 12.9718, 77.6006, '+91-80-25023000', 600)
on conflict do nothing;
