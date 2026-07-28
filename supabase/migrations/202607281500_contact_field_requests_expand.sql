alter table public.contact_field_requests
  drop constraint if exists contact_field_requests_field_type_check;

alter table public.contact_field_requests
  add constraint contact_field_requests_field_type_check
  check (char_length(field_type) <= 40 and field_type ~ '^[a-z_]+$');
