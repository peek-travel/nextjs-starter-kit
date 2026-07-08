---
name: peek-app-builder
description: >-
  Entry point and guided workflow for building an app on this Peek Pro starter kit (a Next.js
  app that embeds inside Peek Pro's back-office iframe). Use when the user wants to build a
  Peek Pro app or add a feature to one — waitlist, abandoned-booking recovery, dynamic pricing,
  custom checkout, reseller/channel sync, reporting, webhook handling, or anything Peek Pro
  lacks natively. Owns the discover → mock → plan → sign-off → build → validate flow and
  delegates the specifics to the peek-embed-and-auth, peek-backoffice-api, peek-webhooks,
  odyssey-ui, peek-app-manifest-and-deploy, and testing-peek-apps skills. Triggers on
  "Peek Pro app", "PeekPro", "Peek app", "Peek booking", "Peek integration", "build on the
  starter kit".
---

# Build a Peek Pro app (on this starter kit)

You are helping the user build an **app that extends Peek Pro** — a tours & activities booking
platform — using **this repository**, an opinionated Next.js starter kit that already ships the
hard parts (iframe embed, the auth pipeline, the Peek SDK client, Odyssey UI, tests, CI). Your
job is to **extend what's here**, not rebuild it from scratch.

Peek Pro is **sparsely documented**, so do not rely on model memory for Peek specifics. These
skills carry the canonical knowledge and tell you when to look things up live.

## The core stack is already decided — don't re-litigate it

Unlike a greenfield build, you do **not** choose the language, framework, or SDK. This kit is
**Next.js 16 + React 19 + Tailwind 4 + TypeScript (App Router)**, tests with **Vitest**, and
talks to Peek through the **`@peektravel/app-utilities`** package (`PeekAccessService`,
Node-only — the first-class SDK). Take these as given.

**Host and database are still your choice** (the "moving layer" — see below). The recommended
default is **Vercel** for hosting and **Supabase / Postgres** for data when you need it (with
Supabase Realtime + React client components for live UI) — offer it as a recommendation, not a
mandate. Phase 0 ships **no database** (persistence is deliberately deferred), so most first
apps don't need one yet. See `peek-app-manifest-and-deploy` for the deploy/secrets specifics.

> ⚠️ The repo currently includes **Fly.io / Docker** files (`Dockerfile`, `fly.toml`,
> `fly-deploy.yml`) — these are **placeholder scaffolding scheduled for removal**, not the
> recommended target. Don't steer the user to Fly; recommend Vercel.

> **Read AGENTS.md first.** This Next.js version has breaking changes vs. training data, and
> the iframe/SPA architecture has hard constraints (no cookies, no SSR data fetching,
> library-owned auth). Everything below assumes those rules.

## This skill reconciles three layers of knowledge

Your real job is **synthesis**. Three sources of truth meet at build time:

1. **Fixed layer — the sibling skills.** How Peek apps work: the embed/auth handshake, data
   scoping, webhooks, the SDK, Odyssey, deploy. Stable; trust these skills.
2. **Moving layer — live web search.** Current best practices for Next.js 16 / React 19 / your
   host (Vercel by default) — this ages fast, so research it fresh (and read
   `node_modules/next/dist/docs/` for the framework APIs, per AGENTS.md).
3. **Hybrid layer — the Peek MCP.** Peek's frequently-changing facts: current GraphQL schema,
   webhook/event catalog, install & settings contract, the live SDK surface. Query it for
   anything marked **`ASK THE MCP`** in the sibling skills. If the MCP is unconfigured/
   unreachable, fall back to the baked knowledge and **flag every would-be lookup** as
   "verify before shipping" — never silently fill a gap with a guess.

## How to interact (every step)

- **Always ask when something is unclear — never guess or assume** the goal, scope, a Peek
  detail, or the right approach.
- **Ask one question at a time.** Pose a single question with your recommendation, let the
  user chat it through, and only then move on. Don't batch questions.

## The workflow

**Kickoff:** give the user a short bulleted overview of these steps and ask if they want to do
anything differently (skip, reorder, re-emphasize). Then begin.

| Step | What it covers | Lean on |
| --- | --- | --- |
| 1. **Discover purpose** | What gap in Peek Pro does this fill? Who uses it (account staff / guests / app admin)? What triggers it (a webhook, a schedule, a user action)? What Peek data does it read/change? Tight v1 scope. | `peek-backoffice-api`, `peek-webhooks` for what's possible |
| 2. **Mock the UI** | Build an interactive single-file `index.html` Odyssey mockup, iterate until the user is happy. | `odyssey-ui` |
| 3. **Plan** | Map the **data flow** as rigorously as the UI (source → when → storage → **verified available?**), pick which webhooks vs. SDK calls, note `installDataId` scoping if persistence is added. Write it up using `plan-template.md`. | all platform skills + MCP + web |
| 4. **Sign-off (hard gate)** | Present the plan; get an explicit "yes, build this." Call out anything MCP-unverified. **Do not build before this.** | — |
| 5. **Build** | Implement per the plan: new authenticated routes + client fetches, webhook endpoints, Odyssey UI, tests as you go. | `peek-embed-and-auth`, `peek-backoffice-api`, `peek-webhooks`, `odyssey-ui`, `testing-peek-apps` |
| 6. **Validate & ship** | Run lint/typecheck/tests + coverage; verify the embed loads; confirm secrets/PII handling; register in the Development Hub and deploy. | `testing-peek-apps`, `peek-app-manifest-and-deploy` |

Don't skip discovery/mockup, and **don't build before sign-off (step 4)**.

## Hard rules (do not violate)

- **Never build your own login for the embedded surface.** Identity comes from Peek via the
  peek-auth token. See `peek-embed-and-auth`. (A separate developer/admin surface *may* have
  its own auth.)
- **Prefer the SDK (`PeekAccessService`); never hand-write GraphQL.** See `peek-backoffice-api`.
- **Treat Peek data as sensitive PII.** Security-first storage/logging/transit; no PII or
  tokens in logs.
- **Scope persisted data to an `installDataId`** if/when you add a database (the install ID is
  stable across reinstalls). See `peek-backoffice-api`.
- **Don't invent Peek endpoint/schema/event details.** Volatile → `ASK THE MCP`; if the MCP is
  down, mark `TODO(verify)`.
- **Plan the data flow, not just the UI — and verify each field actually exists** before
  building. An app built on absent data won't work.
- **Ship with tests.** Keep the Vitest suite green and meaningful (see `testing-peek-apps`).
- **When unclear, ask — one question at a time.**

## Artifacts in this folder

- `plan-template.md` — the structure for the step-3 plan. Copy it into the user's project (e.g.
  `PLAN.md`) and fill it in.

## Related skills

`peek-embed-and-auth` · `peek-backoffice-api` · `peek-webhooks` · `odyssey-ui` ·
`peek-app-manifest-and-deploy` · `testing-peek-apps`
