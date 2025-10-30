-- Create table to store Supabase Auth webhook events
create table if not exists public.auth_events (
  id bigint generated always as identity primary key,
  type text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists auth_events_type_idx on public.auth_events(type);
create index if not exists auth_events_created_idx on public.auth_events(created_at);