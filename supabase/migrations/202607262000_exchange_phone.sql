begin;

alter table public.card_exchanges
  add column if not exists visitor_phone text not null default '' check (length(visitor_phone) <= 40);

create or replace function public.submit_card_exchange(
  p_slug text,
  p_visitor_name text,
  p_visitor_email text,
  p_visitor_company text,
  p_visitor_role text,
  p_visitor_phone text,
  p_note text,
  p_consent_given boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_card record;
  v_exchange_id uuid;
begin
  if coalesce(p_consent_given, false) is not true then
    raise exception 'consent required';
  end if;

  select card.id, card.workspace_id
  into v_card
  from public.cards card
  where card.slug = lower(trim(p_slug))
    and card.status = 'published';

  if v_card.id is null then
    raise exception 'card not found';
  end if;

  insert into public.card_exchanges (
    card_id,
    workspace_id,
    visitor_name,
    visitor_email,
    visitor_company,
    visitor_role,
    visitor_phone,
    note,
    consent_given
  ) values (
    v_card.id,
    v_card.workspace_id,
    trim(p_visitor_name),
    lower(trim(coalesce(p_visitor_email, ''))),
    trim(coalesce(p_visitor_company, '')),
    trim(coalesce(p_visitor_role, '')),
    trim(coalesce(p_visitor_phone, '')),
    trim(coalesce(p_note, '')),
    true
  )
  returning id into v_exchange_id;

  return v_exchange_id;
end;
$$;

revoke all on function public.submit_card_exchange(text, text, text, text, text, text, text, boolean) from public;
grant execute on function public.submit_card_exchange(text, text, text, text, text, text, text, boolean) to anon, authenticated;

commit;
