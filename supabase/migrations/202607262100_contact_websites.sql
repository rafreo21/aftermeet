begin;

alter table public.contacts
  add column if not exists company_website text not null default '',
  add column if not exists personal_website text not null default '';

alter table public.contacts drop constraint if exists contacts_source_check;
alter table public.contacts add constraint contacts_source_check
  check (source is null or source in ('csv', 'vcard', 'manual', 'exchange', 'badge', 'linkedin', 'scan', 'extension'));

commit;
