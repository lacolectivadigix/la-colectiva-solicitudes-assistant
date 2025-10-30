-- Create registration_logs table
create table if not exists public.registration_logs (
  id bigint generated always as identity primary key,
  email text not null,
  ip text,
  user_agent text,
  status text not null, -- success | failure
  message text,
  created_at timestamptz not null default now()
);

create index if not exists registration_logs_email_idx on public.registration_logs(email);