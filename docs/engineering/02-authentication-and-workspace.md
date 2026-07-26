# Authentication and personal workspace

## Boundary

Supabase Auth owns identity and cookie sessions. Public Postgres tables own application profile, personal workspace, membership, and canonical events. Local storage is not consulted for access; the legacy `aftermeet-prototype-session` key is left untouched only to avoid deleting unrelated prototype data.

## Request lifecycle

1. `/auth` calls `signInWithOtp` through the official Supabase browser client.
2. `/auth/callback` exchanges the PKCE code for an HTTP-only cookie session.
3. The callback invokes `provision_personal_workspace()`.
4. The database serialises provisioning per `auth.uid()` and creates at most one user, personal workspace, owner membership, and provisioning event.
5. `proxy.ts` refreshes/validates the cookie before `/app/**` or `/onboarding` renders.
6. Incomplete users go to `/onboarding`; completed users go only to a sanitised internal `/app` destination.
7. Onboarding calls one transactional RPC that updates the profile, marks completion, and appends `UserOnboardingCompleted`.

## Security decisions

- OAuth buttons are shown, but `/auth` reads live provider availability from Supabase (`GET /auth/v1/settings`) and disables providers that are not enabled in the project. Disabled buttons are labelled **Soon**; email OTP remains available.
- Failed OAuth attempts clear the loading state and surface a recoverable inline error instead of leaving the UI stuck.
- No service-role key is used in the browser or required by Slice 1.
- RLS is enabled on every Slice 1 public table.
- Browser roles cannot insert, update, or delete memberships or domain events.
- Direct profile updates are column-limited; status and onboarding state are function-owned.
- Workspace reads require an active membership.
- Security-definer functions use an empty `search_path`, derive the caller from `auth.uid()`, and take no user/workspace identifier.
- Auth and callback responses use private/no-store semantics.
- Intended redirects accept only `/app` and `/app/**`, including after decoding.

## Canonical events

`UserSignedUp` is appended when the application user is first created. `PersonalWorkspaceProvisioned` represents the atomic workspace boundary. `UserOnboardingCompleted` represents the first successful onboarding transition. Authentication and sign-out audit events remain deferred until there is a trusted append-only server event ingestion path.

## Operational note

Repository tests verify pure redirect/config logic and statically verify the migration contract. The SQL verification script checks catalog privileges and security-definer configuration. Production readiness additionally requires applying the migration and executing the real email-link path and negative RLS matrix against the target Supabase project.

## Social login (OAuth) setup

Google, LinkedIn, and X are **not enabled yet** in the Supabase project. Email magic-link sign-in works today.

Follow the step-by-step runbook in [`03-oauth-provider-setup.md`](./03-oauth-provider-setup.md), or run `node scripts/configure-oauth-providers.mjs` after exporting provider credentials and a Supabase personal access token.

Provider callback URL for every vendor app:

`https://tgpzxgrvdmmwnodxrooh.supabase.co/auth/v1/callback`

After enabling a provider, confirm `/auth` shows the button as active (label changes from **Soon** to **Account** or **Profile**) and complete a test sign-in through `/auth/callback`.
