alter table public.notifications
  add column if not exists message_key text,
  add column if not exists message_params jsonb;

alter table public.audit_logs
  add column if not exists message_key text,
  add column if not exists message_params jsonb;
