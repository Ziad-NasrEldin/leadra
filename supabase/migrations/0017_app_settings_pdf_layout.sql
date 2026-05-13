alter table public.app_settings
add column if not exists pdf_layout text not null default 'classic'
check (pdf_layout in ('classic', 'compact'));
