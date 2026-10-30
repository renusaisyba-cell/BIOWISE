-- Bio Wise schema for Supabase PostgreSQL
create extension if not exists pgcrypto;

create table if not exists public.biogas_estimates (
  id uuid primary key default gen_random_uuid(),
  waste_type text not null check (char_length(trim(waste_type)) between 1 and 100),
  waste_kg numeric(12,3) not null check (waste_kg > 0),
  estimated_m3 numeric(12,3) not null check (estimated_m3 >= 0),
  assumptions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.observations (
  id uuid primary key default gen_random_uuid(),
  observed_at timestamptz not null default now(),
  gas_production_m3 numeric(12,3) check (gas_production_m3 between 0 and 100000),
  temperature_c numeric(6,2) check (temperature_c between -10 and 100),
  ph numeric(4,2) check (ph between 0 and 14),
  methane_percent numeric(5,2) check (methane_percent between 0 and 100),
  predicted_m3 numeric(12,3) check (predicted_m3 between 0 and 100000),
  actual_m3 numeric(12,3) check (actual_m3 between 0 and 100000),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.energy_calculations (
  id uuid primary key default gen_random_uuid(),
  biogas_m3 numeric(12,3) not null check (biogas_m3 >= 0),
  cooking_energy_kwh numeric(14,3) not null check (cooking_energy_kwh >= 0),
  lpg_displaced_kg numeric(14,3) not null check (lpg_displaced_kg >= 0),
  estimated_savings_inr numeric(14,2) not null check (estimated_savings_inr >= 0),
  assumptions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.digestate_entries (
  id uuid primary key default gen_random_uuid(),
  waste_input_kg numeric(12,3) check (waste_input_kg between 0 and 100000),
  digestate_kg numeric(12,3) not null check (digestate_kg between 0 and 100000),
  is_estimated boolean not null default true,
  recorded_at timestamptz not null default now(),
  status text not null default 'Not assessed',
  notes text,
  assumptions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_biogas_estimates_created_at on public.biogas_estimates(created_at desc);
create index if not exists idx_observations_observed_at on public.observations(observed_at asc);
create index if not exists idx_energy_calculations_created_at on public.energy_calculations(created_at desc);
create index if not exists idx_digestate_entries_recorded_at on public.digestate_entries(recorded_at desc);

-- This starter uses the Supabase service-role key only on the Express server.
-- Keep it private and never put it in frontend files or GitHub. Do not enable public access policies.
-- If you later add Supabase Auth, design RLS policies for authenticated users and change backend access accordingly.
