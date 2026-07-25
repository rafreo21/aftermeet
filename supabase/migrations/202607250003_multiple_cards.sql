begin;

alter table public.cards drop constraint if exists cards_workspace_id_key;
alter table public.cards
  add constraint cards_workspace_slug_key unique (workspace_id, slug);

create or replace function public.enforce_workspace_card_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (
    select count(*)
    from public.cards
    where workspace_id = new.workspace_id and status <> 'archived'
  ) >= 5 then
    raise exception 'A workspace can have at most five active cards';
  end if;
  return new;
end;
$$;

create trigger cards_workspace_limit
before insert on public.cards
for each row execute function public.enforce_workspace_card_limit();

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
  on conflict (workspace_id, slug) do update set
    full_name = excluded.full_name,
    job_title = excluded.job_title,
    company = excluded.company,
    bio = excluded.bio,
    theme_color = excluded.theme_color,
    profile_image_url = excluded.profile_image_url,
    company_logo_url = excluded.company_logo_url,
    cover_image_url = excluded.cover_image_url,
    status = 'published',
    published_at = coalesce(public.cards.published_at, now()),
    updated_at = now()
  returning id into v_card_id;

  delete from public.card_methods where card_id = v_card_id;
  for v_method in select * from jsonb_array_elements(coalesce(p_methods, '[]'::jsonb))
  loop
    insert into public.card_methods(card_id, method_type, value, label, sort_order)
    values (
      v_card_id,
      v_method ->> 'type',
      trim(v_method ->> 'value'),
      coalesce(trim(v_method ->> 'label'), ''),
      coalesce((v_method ->> 'sortOrder')::integer, 0)
    );
  end loop;

  insert into public.domain_events(
    event_name, actor_type, actor_id, workspace_id, object_type, object_id,
    correlation_id, payload
  ) values (
    'CardPublished', 'User', v_context.user_id, v_context.workspace_id,
    'Card', v_card_id, v_correlation_id,
    jsonb_build_object('slug', lower(trim(p_slug)))
  );
  return v_card_id;
end;
$$;

commit;
