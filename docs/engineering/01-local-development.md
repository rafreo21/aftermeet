# Local development

## Requirements

- Node.js 22.13 or later
- A Supabase project for Slice 1 verification
- Email OTP enabled in Supabase Auth

## Configure

1. Copy `.env.example` to `.env.local`.
2. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `NEXT_PUBLIC_APP_URL`.
3. Keep `SUPABASE_SERVICE_ROLE_KEY` unset; Slice 1 deliberately does not need it.
4. In Supabase Auth URL Configuration, set the Site URL to `http://localhost:3000` and allow `http://localhost:3000/auth/callback`.
5. Apply `supabase/migrations/202607240001_slice_1_auth_workspace.sql` using the Supabase SQL editor or CLI.
6. Run `supabase/tests/rls_verification.sql` against a disposable/test project.

## Run

```sh
npm install
npm run dev
```

Open `http://localhost:3000/auth`. Missing public environment values produce a visible configuration error instead of a fake authentication flow.

## Verify

Request a link, follow it in the same browser, complete name/time-zone/locale onboarding, confirm `/app` renders, sign out, and confirm `/app` redirects to `/auth?next=%2Fapp`. Reusing the same sign-in link/session must not create additional users, workspaces, memberships, or provisioning events.

The email provider’s delivery, rate limits, and redirect allowlist are Supabase project settings and cannot be proven by the repository build alone.
