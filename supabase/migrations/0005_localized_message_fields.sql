alter table public.notifications
  add column if not exists message_key text null,
  add column if not exists message_params jsonb null;

alter table public.audit_logs
  add column if not exists message_key text null,
  add column if not exists message_params jsonb null;
