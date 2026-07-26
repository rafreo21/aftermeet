begin;

create table public.card_exchanges (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  visitor_name text not null check (length(trim(visitor_name)) between 2 and 100),
  visitor_email text not null default '' check (length(visitor_email) <= 320),
  visitor_company text not null default '' check (length(visitor_company) <= 120),
  visitor_role text not null default '' check (length(visitor_role) <= 120),
  note text not null default '' check (length(note) <= 500),
  consent_given boolean not null default false,
  status text not null default 'new' check (status in ('new', 'imported', 'dismissed')),
  created_at timestamptz not null default now()
);

create index card_exchanges_workspace_created_idx
  on public.card_exchanges (workspace_id, created_at desc);

alter table public.card_exchanges enable row level security;

grant select, update on public.card_exchanges to authenticated;

create policy "card_exchanges_member_read" on public.card_exchanges
  for select to authenticated
  using (exists (
    select 1 from public.workspace_memberships membership
    join public.users app_user on app_user.id = membership.user_id
    where membership.workspace_id = card_exchanges.workspace_id
      and membership.status = 'active'
      and app_user.auth_user_id = (select auth.uid())
  ));

create policy "card_exchanges_member_update" on public.card_exchanges
  for update to authenticated
  using (exists (
    select 1 from public.workspace_memberships membership
    join public.users app_user on app_user.id = membership.user_id
    where membership.workspace_id = card_exchanges.workspace_id
      and membership.status = 'active'
      and app_user.auth_user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.workspace_memberships membership
    join public.users app_user on app_user.id = membership.user_id
    where membership.workspace_id = card_exchanges.workspace_id
      and membership.status = 'active'
      and app_user.auth_user_id = (select auth.uid())
  ));

create or replace function public.submit_card_exchange(
  p_slug text,
  p_visitor_name text,
  p_visitor_email text,
  p_visitor_company text,
  p_visitor_role text,
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
    note,
    consent_given
  ) values (
    v_card.id,
    v_card.workspace_id,
    trim(p_visitor_name),
    lower(trim(coalesce(p_visitor_email, ''))),
    trim(coalesce(p_visitor_company, '')),
    trim(coalesce(p_visitor_role, '')),
    trim(coalesce(p_note, '')),
    true
  )
  returning id into v_exchange_id;

  return v_exchange_id;
end;
$$;

revoke all on function public.submit_card_exchange(text, text, text, text, text, text, boolean) from public;
grant execute on function public.submit_card_exchange(text, text, text, text, text, text, boolean) to anon, authenticated;

commit;
