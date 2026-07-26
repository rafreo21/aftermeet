begin;

alter table public.cards
  add column if not exists label text not null default '';

commit;
