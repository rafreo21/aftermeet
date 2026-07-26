# AfterMeet product roadmap

Status: Living backlog  
Last updated: 2026-07-26

Single source of truth for **what we’re building**, **why**, and **in what order**. Complements [MVP vertical slice plan](../product/11-mvp-vertical-slice-plan.md) (delivery slices) and [MVP.md](./MVP.md) (scope).

---

## Product promise (one line)

**Capture the moment first; contact details sync when someone adds you; AI writes the context from the transcript; follow-up is one tap to call, meet, email, or share a file** — using whatever account they’ve connected.

---

## Core principle

One continuous loop where **the moment is the source of truth**, and **contact details arrive when someone chooses to connect** — not when you’re mid-conversation trying to remember their email.

---

## User journeys

Both paths should feel like **the same product**, not two separate flows.

### Path A — QR first (typical first meeting)

1. You share your QR.
2. They scan → your card opens.
3. They save you / exchange details (“Add me”).
4. That person lands in **People** (their directory and yours when synced).
5. From People they can open your profile or start a **capture** tied to that person.

### Path B — Conversation first (already talking)

1. You start **Capture** before exchanging cards.
2. Transcript drives the context (AI fills notes, summary, follow-up).
3. Later you share QR or they add you.
4. The encounter and the contact **merge into one record**.

---

## What “simple” means

| Today (shaky) | Target |
|---------------|--------|
| Email field on the context step | **No email during capture** — it comes from card exchange / save contact |
| Manual title, notes, summary | **AI drafts everything** from transcript; user edits, not types from scratch |
| Generic follow-up types | **Action buttons** that open the right app (call, LinkedIn, Meet, Gmail, Drive, etc.) |
| Contacts and encounters are separate | **One person record** that grows: exchange → capture → follow-up |
| Guest links / data local-only | **True sync** — server-backed encounters, cross-device People |
| Painful email login for visitors | **Light account** after scan (OAuth) → People they’ve met |

---

## Capture flow (target)

| Step | Name | What happens |
|------|------|----------------|
| 1 | **Record** | Consent + audio/transcript (core unchanged) |
| 2 | **Context** | Person first; AI pre-fills from transcript; edit only. No email. Pick/link person from directory if already exchanged. |
| 3 | **Connect** | If not linked: share your card / they saved you / link to inbound exchange. Email, phone, LinkedIn arrive **here**, when details sync. |
| 4 | **Follow-up** | One clear next action, action-oriented (see below). Drop “Another action” for now. |
| 5 | **Review** | Approve private vs shared; share guest link when ready. |

### Follow-up actions (target)

| Type | Behaviour |
|------|-----------|
| **Call** | `tel:` when phone on contact |
| **LinkedIn** | Open profile / connect |
| **Schedule meeting** | Google Meet, Zoom, or Microsoft Outlook (connected account) |
| **Send email** | Gmail or Outlook (connected account) |
| **Send draft or file** | Email + attachment; Google Drive or Dropbox by connected provider |

Integrations roll out in phases: deep links first (call, LinkedIn), then calendar (Meet, Zoom, Outlook), then email/files (Gmail, Outlook, Drive, Dropbox).

---

## Auth for the other person (visitor)

- Scan / save contact → optional light account (Google or Microsoft OAuth).
- **People you’ve connected with** — no stressful email magic-link unless they choose it.
- Card exchange is the on-ramp; shared moments link back from People when relevant.

---

## The four loops

| Loop | Next (backlog) | In app today |
|------|----------------|--------------|
| **01 Share identity** | CRM-grade team cards | QR, public link, vCard, email signature, **Wallet passes + NFC programming** |
| **02 Capture people** | CRM-grade imports, server-backed contacts | Reciprocal exchange, imports, manual add, inbound queue; **badge scan + LinkedIn import on web** |
| **03 Remember context** | Seamless capture ↔ contact merge | Consent, 5-step wizard, server AI extraction, action follow-ups |
| **04 Activate data** | Autonomous outbound | **HubSpot sync, CRM export, campaigns + attribution analytics** |

---

## What’s already aligned

- QR / card sharing and public page
- Reciprocal exchange form + inbound captures on Contacts
- 4-step encounter wizard (Record → Context → Follow-up → Review)
- Transcript → suggested draft (client heuristics, not real AI)
- Follow-up inbox from encounter actions
- Google OAuth (owner sign-in)

---

## Gaps to close (master checklist)

### Phase 1 — Unify person + capture (Loop 02 + 03)

- [x] Remove **email field** from capture context step
- [x] Link **encounter ↔ contact ↔ card exchange** by ID
- [x] **Connect** step in wizard (share card / link exchange / pick from People)
- [x] Path A and Path B both land on the same **Person** record
- [x] Contact detail page: encounters, card link, methods (phone, email, LinkedIn)
- [x] Encounters + guest links **read/write on server** (not localStorage-only)

### Phase 2 — Real AI extraction (Loop 03 / Slice 8)

- [x] Server-side AI from transcript / notes (replace `transcriptDraft` heuristics)
- [x] Auto-fill: private notes, shared summary, follow-up text, suggested channel
- [x] AI runs by default after transcript available — not optional “regenerate” only
- [x] Confidence / uncertainty markers; never overwrite raw transcript
- [x] Regeneration + manual fallback; failed AI leaves usable encounter

### Phase 3 — Action-oriented follow-up (Loop 03 / Slice 9)

- [x] Remove **“Another action”** follow-up type
- [x] Call → `tel:` when number present
- [x] LinkedIn → open profile
- [x] Schedule meeting → Meet / Zoom / Outlook integrations (deep links: Google Calendar + Outlook Calendar)
- [x] Send email / file → Gmail / Outlook + Drive / Dropbox by connected account (deep links: Gmail, Outlook, Mail app, Drive)
- [x] Review + Inbox surfaces show **Do it** buttons, not just labels

### Phase 4 — Visitor onboarding (Loop 02)

- [x] Post-scan / post-exchange OAuth (Google, Microsoft)
- [x] **People you’ve met** for visitors without full CRM onboarding
- [x] Low-friction path from public card to signed-in directory

### Phase 5 — Capture people expansion (Loop 02)

- [x] Badge scan flow
- [x] LinkedIn scan / profile URL flow

### Phase 6 — Share identity expansion (Loop 01)

- [x] Apple Wallet pass
- [x] Google Wallet pass
- [x] NFC tap-to-open card

### Phase 7 — Activate data (Loop 04 — later)

- [x] CRM sync (HubSpot private app integration)
- [x] Campaigns, attribution, team analytics
- [x] Autonomous outbound only after review-first habit is proven

### Phase 8 — Production platform (Loops 01 + 02)

Cross-device persistence and connected-account depth. Team features come after personal records are fully server-backed.

- [x] **Server-backed contacts** — Postgres source of truth; migrate localStorage; sync on save; hydrate on load
- [x] **Encounters read sync** — list + hydrate encounters from server (writes already sync)
- [x] **Card library server hydration** — load/edit cards from server, not localStorage-only
- [x] **Connected accounts** — OAuth for Gmail, Outlook, Google Calendar (API send/schedule, not just deep links)
- [x] **Team workspaces + team cards** — shared workspace, org templates, member cards (post-MVP exclusion lift)

---

## Build order

| Order | Focus | Loops |
|-------|--------|-------|
| **1** | Unlink email from capture + encounter ↔ contact ↔ exchange linking + Connect step + server sync | 02, 03 |
| **2** | Real AI extraction (Slice 8) | 03 |
| **3** | Action-oriented follow-up — call & LinkedIn first, then Meet / Gmail / Drive | 03 |
| **4** | Visitor onboarding + “people you’ve met” | 02 |
| **5** | Badge / LinkedIn scan flows | 02 |
| **6** | Wallet passes + NFC | 01 |
| **7** | CRM sync | 04 |
| **8** | Server-backed contacts → encounter/card hydrate → connected accounts → team | 01, 02 |

---

## Current sprint focus (recommended next)

**Phase 8 complete.** Next recommended focus: wallet passes + NFC (Phase 6) or real AI extraction hardening (Phase 2/Slice 8), depending on pilot priorities.

---

## References

- [11-mvp-vertical-slice-plan.md](../product/11-mvp-vertical-slice-plan.md) — Slice 7 Capture, Slice 8 AI Review, Slice 9 Inbox
- [07-end-to-end-product-flow.md](../product/07-end-to-end-product-flow.md) — canonical flows
- [MVP.md](./MVP.md) — MVP scope and exclusions
- [TECHNICAL-PLAN.md](./TECHNICAL-PLAN.md) — stack, AI workflow, expansion path
