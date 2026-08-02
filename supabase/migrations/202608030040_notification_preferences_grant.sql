begin;

-- notification_preferences was added without a column-level update grant;
-- self-service PATCH from /api/settings/notifications needs it, matching
-- the existing display_name/avatar_url/locale/time_zone grant pattern.
grant update (notification_preferences) on public.users to authenticated;

commit;
