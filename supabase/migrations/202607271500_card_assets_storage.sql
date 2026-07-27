begin;

insert into storage.buckets (id, name, public)
values ('card-assets', 'card-assets', true)
on conflict (id) do update set public = excluded.public;

commit;
