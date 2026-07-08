---
name: peek-app-manifest-and-deploy
description: >-
  How to register, configure, and ship an app built on this starter kit — the app.json
  manifest (extendables, the registry settings URL, App Store listing), the Peek Development
  Hub, environment variables and secrets (PEEK_APP_SECRET / PEEK_APP_ID / PEEK_API_URL /
  PEEK_APP_URL), and deployment (Vercel + Supabase recommended). Use when editing
  app.json, setting up env/secrets, registering the app with Peek, changing the embed/webhook
  URLs, or deploying. Triggers on "app.json", "manifest", "Development Hub", "deploy", "Vercel",
  "Supabase", "env vars", "secrets", "publish the app", "register the app", "extendable".
---

# Manifest, registration & deployment

Getting an app from this starter kit into a Peek Pro account has three parts: the **manifest**
(`app.json`) that declares what the app is and where it lives, **registration** in the Peek
Development Hub, and **deployment** to your host. This skill covers all three.

> **Hosting is your choice — this skill recommends a default, it doesn't mandate one.**
> Language/framework/SDK/test-runner are fixed by the kit; the **host and database are the
> "moving layer"** you pick per project (research current best practice at build time). The
> recommended default is **Vercel** (hosting) + **Supabase / Postgres** (data, when you add
> persistence), with React client components + Supabase Realtime for any live UI — it stands up
> fast, pairs cleanly with Next.js, and has strong security defaults. Swap it for any host you
> prefer.

## 1. The manifest — `app.json`

`app.json` describes the app to Peek. Key fields (templated with `{{APP_SLUG}}` / `{{APP_NAME}}`):

- **`app.id` / `app.name`** — the app slug and display name.
- **`app_version`** — `status`, `display_version`, listing copy (`listing_md`, `description`),
  `icon_url`, `base_url`, `platforms`, `categories`.
- **`platform_extendables.peek`** — the platform capabilities the app requests. This kit ships
  **`peek_backoffice_api@v1`**, which is what grants the app access to the back-office API
  used via `PeekAccessService` (see `peek-backoffice-api`).
- **`registry_extendables`** — how Peek surfaces the app. This kit ships
  **`app_registry_settings_url@v1`** with `url: "/peek-pro/main"` and
  `url_mode: "prepend_base_url"` — i.e. Peek loads `<base_url>/peek-pro/main` (the embed entry
  route) inside the iframe. **This URL is what Peek POSTs to** — it must match the embed route
  (see `peek-embed-and-auth`). If you add a **webhook**, its endpoint URL is declared here too
  (see `peek-webhooks`; pull the live doc for the exact registry keys).

> When you change the embed path or add a webhook endpoint, update `app.json` to match, and
> re-register/re-publish in the Development Hub.

## 2. Registration — the Peek Development Hub

- Get access to the Peek **Development Hub**. `TODO(verify)` Hub URL + onboarding steps.
- Register the app; obtain its **app ID** (`PEEK_APP_ID`) and **shared secret**
  (`PEEK_APP_SECRET` — used to verify the peek-auth JWT; see `peek-embed-and-auth`).
- Confirm the **sandbox** environment and validate there before production. Never test against
  a live account. `ASK THE MCP` for how sandbox vs. production credentials/endpoints differ.
- The app's **runtime** Peek auth is per-install via the token flow — there is **no login the
  developer or user creates**. Registration just provisions the app's identity/keys.

## 3. Environment & secrets

Env is validated by `lib/env.ts` (Zod). Required:

| Var | What | Notes |
| --- | --- | --- |
| `PEEK_APP_SECRET` | Shared secret for verifying the peek-auth JWT | **Secret** — never commit |
| `PEEK_APP_ID` | The app's ID / issuer | From the Development Hub |
| `PEEK_APP_URL` | The app's own public base URL | Used to build the embed redirect target and dev origins |
| `PEEK_API_URL` | Peek back-office API base | Defaults to `https://app-registry.peeklabs.com/installations-api` |

Optional **build-time only** (the Peek MCP, a build helper — not a runtime dependency):
`PEEK_MCP_URL` / `PEEK_MCP_TOKEN`. Leave unset if the MCP backend isn't live; the skills fall
back to baked knowledge.

**Secret hygiene:** secrets live in your **host's secret store** — Vercel **Environment
Variables** by default (Project → Settings → Environment Variables), or the equivalent on
whatever host you choose — never in the repo or the client bundle. If you add Supabase, keep
the **service role key server-only** and expose only the **anon key** to the client. No PII or
tokens in logs. In CI, the build uses **placeholder** env values (see
`.github/workflows/ci.yml`) purely to satisfy env validation — real values live only in the
deployment environment.

## 4. Deployment — Vercel (recommended default)

Next.js deploys to **Vercel** with zero Docker config — Vercel builds it natively. This is the
recommended default; any Node-capable host works.

- **Connect the repo** to a Vercel project (Import Git Repository).
- **Set env vars** in the project settings (the four in §3; Supabase keys if used).
- **Build/output** is detected automatically for Next.js — no `Dockerfile` needed on Vercel.
- **`.github/workflows/ci.yml`** — on every branch: lint → typecheck → test w/ coverage →
  build. Keep it green (see `testing-peek-apps`). This is host-agnostic and stays.

> **Data/persistence (when needed):** Phase 0 ships no database. When you add one, **Supabase
> (Postgres)** is the recommended default — create a project, take the project URL + anon key
> (client) + service role key (server only), and scope rows to `installDataId`
> (see `peek-backoffice-api`). Supabase Realtime + React client components cover live UI.

> **Ignore the Fly.io files.** `Dockerfile`, `fly.toml`, and `fly-deploy.yml` are placeholder
> scaffolding scheduled for removal — don't build a Fly deploy around them.

**First-time deploy checklist:**
- [ ] Development Hub access; app registered → `PEEK_APP_ID` + `PEEK_APP_SECRET`.
- [ ] Vercel project created and connected to the repo.
- [ ] `PEEK_APP_URL` set to the deployed URL; `app.json` `base_url` matches it.
- [ ] Env vars set in the host (`PEEK_APP_SECRET`, `PEEK_APP_ID`, `PEEK_APP_URL`, and
      `PEEK_API_URL` if overriding the default); Supabase keys if used.
- [ ] Register the embed URL (`<base_url>/peek-pro/main`) and any webhook URLs in the Hub /
      `app.json`; validate in **sandbox** first.
- [ ] Confirm the embed loads in the iframe (CSP `frame-ancestors` is set in `next.config.ts`).

## Related skills

- **peek-embed-and-auth** — the embed route the manifest points at; how `PEEK_APP_SECRET` is used.
- **peek-backoffice-api** — the `peek_backoffice_api@v1` extendable grants this API access.
- **peek-webhooks** — webhook endpoint URLs are declared in the manifest/registry too.
- **testing-peek-apps** — the CI gate that runs before deploy.
