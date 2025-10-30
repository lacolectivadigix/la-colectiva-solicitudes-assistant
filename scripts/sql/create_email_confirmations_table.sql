-- Create email_confirmations table
create table if not exists public.email_confirmations (
  id bigint generated always as identity primary key,
  user_id bigint not null references public.users(id) on delete cascade,
  token uuid not null unique,
  expires_at timestamptz not null,
  sent_attempts integer not null default 0,
  last_attempt_at timestamptz,
  status text not null default 'pending', -- pending | confirmed | expired | failed
  error_message text,
  created_at timestamptz not null default now()
);

-- Indexes
create index if not exists email_confirmations_token_idx on public.email_confirmations(token);
create index if not exists email_confirmations_user_idx on public.email_confirmations(user_id);