alter type public.media_type add value if not exists 'pdf';

alter table public.unit_media
  add column if not exists include_in_pdf boolean not null default true;

update public.unit_media
set include_in_pdf = false
where type <> 'image';

alter table public.unit_media
drop constraint if exists unit_media_image_only;

alter table public.unit_media
drop constraint if exists unit_media_no_video;

alter table public.unit_media
add constraint unit_media_no_video check (type <> 'video') not valid;
