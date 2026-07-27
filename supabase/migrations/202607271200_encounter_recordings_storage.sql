begin;

insert into storage.buckets (id, name, public)
values ('encounter-recordings', 'encounter-recordings', false)
on conflict (id) do nothing;

commit;
