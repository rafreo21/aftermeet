begin;

alter table public.contacts
  add column if not exists whatsapp_url text not null default '',
  add column if not exists instagram_url text not null default '',
  add column if not exists x_url text not null default '',
  add column if not exists tiktok_url text not null default '';

commit;
