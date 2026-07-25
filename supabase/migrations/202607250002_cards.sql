begin;

create table public.cards (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null unique references public.workspaces(id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  full_name text not null check (length(trim(full_name)) between 2 and 100),
  job_title text not null default '',
  company text not null default '',
  bio text not null default '',
  theme_color text not null default '#9FE870' check (theme_color ~ '^#[0-9A-Fa-f]{6}$'),
  profile_image_url text not null default '',
  company_logo_url text not null default '',
  cover_image_url text not null default '',
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.card_methods (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards(id) on delete cascade,
  method_type text not null check (method_type in (
    'email', 'phone', 'website', 'link', 'address', 'x', 'instagram',
    'threads', 'linkedin', 'facebook', 'youtube', 'snapchat', 'tiktok',
    'twitch', 'yelp', 'whatsapp', 'signal', 'discord', 'skype',
    'telegram', 'github', 'calendly', 'paypal', 'venmo', 'cashapp'
  )),
  value text not null check (length(trim(value)) > 0),
  label text not null default '',
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (card_id, method_type)
);

create index card_methods_card_sort_idx on public.card_methods(card_id, sort_order);
alter table public.cards enable row level security;
alter table public.card_methods enable row level security;
grant select on public.cards, public.card_methods to anon;
grant select, insert, update, delete on public.cards, public.card_methods to authenticated;

create policy "cards_public_read_published" on public.cards for select to anon
  using (status = 'published');
create policy "card_methods_public_read_published" on public.card_methods for select to anon
  using (exists (select 1 from public.cards card where card.id = card_methods.card_id and card.status = 'published'));

create policy "cards_member_all" on public.cards for all to authenticated
  using (exists (
    select 1 from public.workspace_memberships membership
    join public.users app_user on app_user.id = membership.user_id
    where membership.workspace_id = cards.workspace_id and membership.status = 'active'
      and app_user.auth_user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.workspace_memberships membership
    join public.users app_user on app_user.id = membership.user_id
    where membership.workspace_id = cards.workspace_id and membership.status = 'active'
      and app_user.auth_user_id = (select auth.uid())
  ));

create policy "card_methods_member_all" on public.card_methods for all to authenticated
  using (exists (
    select 1 from public.cards card
    join public.workspace_memberships membership on membership.workspace_id = card.workspace_id
    join public.users app_user on app_user.id = membership.user_id
    where card.id = card_methods.card_id and membership.status = 'active'
      and app_user.auth_user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.cards card
    join public.workspace_memberships membership on membership.workspace_id = card.workspace_id
    join public.users app_user on app_user.id = membership.user_id
    where card.id = card_methods.card_id and membership.status = 'active'
      and app_user.auth_user_id = (select auth.uid())
  ));

create or replace function public.publish_my_card(
  p_slug text, p_full_name text, p_job_title text, p_company text, p_bio text,
  p_theme_color text, p_profile_image_url text, p_company_logo_url text,
  p_cover_image_url text, p_methods jsonb
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_context record;
  v_card_id uuid;
  v_method jsonb;
  v_correlation_id uuid := gen_random_uuid();
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select * into v_context from public.get_my_app_context();
  if v_context.workspace_id is null then raise exception 'workspace not provisioned'; end if;

  insert into public.cards (
    workspace_id, slug, full_name, job_title, company, bio, theme_color,
    profile_image_url, company_logo_url, cover_image_url, status, published_at
  ) values (
    v_context.workspace_id, lower(trim(p_slug)), trim(p_full_name),
    coalesce(trim(p_job_title), ''), coalesce(trim(p_company), ''),
    coalesce(trim(p_bio), ''), p_theme_color, coalesce(p_profile_image_url, ''),
    coalesce(p_company_logo_url, ''), coalesce(p_cover_image_url, ''), 'published', now()
  )
  on conflict (workspace_id) do update set
    slug = excluded.slug, full_name = excluded.full_name, job_title = excluded.job_title,
    company = excluded.company, bio = excluded.bio, theme_color = excluded.theme_color,
    profile_image_url = excluded.profile_image_url, company_logo_url = excluded.company_logo_url,
    cover_image_url = excluded.cover_image_url, status = 'published',
    published_at = coalesce(public.cards.published_at, now()), updated_at = now()
  returning id into v_card_id;

  delete from public.card_methods where card_id = v_card_id;
  for v_method in select * from jsonb_array_elements(coalesce(p_methods, '[]'::jsonb))
  loop
    insert into public.card_methods(card_id, method_type, value, label, sort_order)
    values (v_card_id, v_method ->> 'type', trim(v_method ->> 'value'),
      coalesce(trim(v_method ->> 'label'), ''), coalesce((v_method ->> 'sortOrder')::integer, 0));
  end loop;

  insert into public.domain_events(
    event_name, actor_type, actor_id, workspace_id, object_type, object_id, correlation_id, payload
  ) values (
    'CardPublished', 'User', v_context.user_id, v_context.workspace_id, 'Card', v_card_id,
    v_correlation_id, jsonb_build_object('slug', lower(trim(p_slug)))
  );
  return v_card_id;
end;
$$;

revoke all on function public.publish_my_card(text, text, text, text, text, text, text, text, text, jsonb) from public, anon;
grant execute on function public.publish_my_card(text, text, text, text, text, text, text, text, text, jsonb) to authenticated;

commit;
