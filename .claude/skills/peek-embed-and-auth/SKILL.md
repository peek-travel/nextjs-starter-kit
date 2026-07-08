---
name: peek-embed-and-auth
description: >-
  How this starter kit embeds inside the Peek Pro iframe and authenticates every request.
  Use when adding or changing an authenticated API route, a client-side data fetch, the
  token handshake, the install/embed entry route, CSP/iframe headers, or when debugging 401s,
  a blank iframe, or "token" / postMessage problems. Explains the POST → redirect → SPA →
  postMessage-token → Bearer-API pipeline and the constraints that force it (no cookies, no
  SSR data fetching, library-owned verification). Triggers on "add an API route", "authenticate
  a request", "peek-auth token", "iframe won't load", "401 in the embed", "postMessage token".
---

# Peek Pro embed & auth pipeline

This starter kit runs as a **client-side SPA embedded in a Peek Pro iframe**. It has no
sessions, no cookies, and no server-rendered data. Every authenticated request rides a
short-lived **peek-auth JWT** that the browser fetches from the parent frame. This skill is
the map of that pipeline and the recipe for extending it.

> Read this before touching anything under `app/peek-pro/`, `lib/with-peek.ts`,
> `lib/api-auth.ts`, `lib/peek-service.ts`, or `app/peek-pro/client/`. The architecture is
> load-bearing — the constraints below are in `AGENTS.md` because getting them wrong produces
> an app that silently fails inside the iframe.

## The one mental model: the token only exists in the browser

Peek Pro hands the acting user's identity to the app as a signed JWT, delivered to the
**parent frame**. The embedded app obtains it via `postMessage` — **there is no server-side
copy**. That single fact explains every constraint:

- **No cookies.** Third-party cookie blocking kills them in iframes. A token can't be
  persisted in a cookie or carried across a redirect. → We use `postMessage` + an in-memory
  token + a `Bearer` header instead.
- **No SSR / Server Component data fetching.** At render time on the server, no token exists,
  so a Server Component has nothing authenticated to fetch. → Embedded views are
  `"use client"` and fetch in `useEffect` after the token arrives. This is **not** the
  "fetch-on-mount instead of RSC" anti-pattern; there is no server alternative here.
- **Verification is library-owned.** Routes never hand-decode the JWT. They delegate to
  `@peektravel/app-utilities` (`PeekAccessService`), constructed from the app's secret.

## The request lifecycle (end to end)

```
1. Peek Pro POSTs the signed JWT to  /peek-pro/main         (app/peek-pro/main/route.ts)
2. That route IGNORES the token and 302-redirects to the GET view
       → the token can't survive a redirect (no cookies); it isn't needed here
3. The SPA boots at /peek-pro/main/view  ("use client")     (view/layout.tsx, view/page.tsx)
4. The SPA asks the parent for a token:  window.parent.postMessage({type:"peek-iframe-token-refresh"})
       → parent replies  {type:"peek-token-response", token}   (app/peek-pro/client/api.ts)
5. Token cached in memory; the view renders only AFTER it arrives (the "ready" gate)
6. Each data call goes to an API route with header  x-peek-auth: Bearer <token>   (apiFetch)
7. The route verifies the token and builds an install-scoped Peek client:
       withPeekAuthentication → requirePeekAuth → verifyPeekAuthToken → createPeekService
8. On 401, apiFetch requests a fresh token via the SAME channel and retries once
```

### Why the POST route throws the token away
`app/peek-pro/main/route.ts` does **not** authenticate. `page.tsx` can't receive POST, so the
route exists only to convert Peek's POST into a redirect to the GET view. Verifying here would
be pointless: the token can't be forwarded (no cookies) and the GET view is openly reachable
anyway. Real auth happens per-API-request in step 7. Don't add verification to this route.

## The files that own each piece

| Concern | File | What it does |
| --- | --- | --- |
| Embed entry (POST→redirect) | `app/peek-pro/main/route.ts` | Converts Peek's POST into a 302 to the view. Ignores the token by design. |
| Token handshake + fetch helper | `app/peek-pro/client/api.ts` | `requestToken()` (the single postMessage channel) and `apiFetch()` (Bearer + 401-refresh-retry). |
| The SPA bootstrap gate | `app/peek-pro/main/view/layout.tsx` + `page.tsx` | Loads Odyssey, calls `requestToken()`, renders children only once `ready`. |
| Server-side auth wrapper | `lib/with-peek.ts` | `withPeekAuthentication(handler)` — wraps a route so it receives a verified `PeekAccessService` + claims. |
| Token verification | `lib/api-auth.ts` | `requirePeekAuth(request)` — pulls `x-peek-auth`, verifies, returns claims or a 401. |
| Peek client construction | `lib/peek-service.ts` | `createPeekService(auth)` (install-scoped) and `verifyPeekAuthToken(token)`. |
| Env contract | `lib/env.ts` | Zod-validated `PEEK_APP_SECRET`, `PEEK_APP_ID`, `PEEK_API_URL`, `PEEK_APP_URL`. |
| CSP / iframe headers | `next.config.ts` | `Content-Security-Policy: frame-ancestors 'self' *` on `/peek-pro/:path*`. |

## Recipe: add a new authenticated API route + client call

This is the most common task. Follow the existing pattern exactly (see
`app/peek-pro/main/api/me/route.ts` and `.../activities/route.ts` for live examples).

**1. Server — the route.** Wrap the handler in `withPeekAuthentication`. It hands you a
verified, install-scoped `PeekAccessService` (`peek`) and the token `auth` claims. Never read
or decode the token yourself.

```ts
// app/peek-pro/main/api/<thing>/route.ts
import { type NextRequest, NextResponse } from "next/server";
import { type PeekAccessService } from "@peektravel/app-utilities";
import { withPeekAuthentication } from "@/lib/with-peek";

export const GET = withPeekAuthentication(
  async (_request: NextRequest, peek: PeekAccessService) => {
    const data = await peek.getAllActivities(); // see the peek-backoffice-api skill for the SDK surface
    return NextResponse.json({ data });
  },
);
```

**2. Client — the fetch.** Call it through `apiFetch` so the `Bearer` header and 401-refresh
are handled for you. Only do this **after** the token gate (inside a `"use client"` component
that lives under a layout which already called `requestToken()`).

```ts
import { apiFetch } from "@/app/peek-pro/client/api";
const { data } = await apiFetch<{ data: Thing[] }>("/peek-pro/main/api/<thing>");
```

**3. If it's a whole new view (its own bootstrap):** give it a layout that calls
`requestToken()` once and gates on `ready` (copy `app/peek-pro/main/view/layout.tsx` or the
dashboard example's `layout.tsx`). **Exactly one requester per mounted subtree** — descendants
read the cached token via `apiFetch`, they don't post their own request.

## Hard rules (violating these breaks the embed silently)

- **Never suggest cookies** for the token, or any redirect-based token carry. They're blocked
  in third-party iframes.
- **Never verify the JWT by hand.** Delegate to `PeekAccessService` via
  `verifyPeekAuthToken` / `withPeekAuthentication`. Build the service from the *verified
  token's* claims (install-scoped), not from static values.
- **Never use `react-dom/server` in route handlers** — Next blocks it at the bundler. Route
  handlers that must return HTML use string templates.
- **Never add SSR/RSC data fetching to an embedded view.** No token exists at server render
  time. Keep embed views `"use client"` and fetch after the gate.
- **One token requester per mount.** Multiple `postMessage` listeners race and double-request
  the parent. Reuse `requestToken()` / `apiFetch`; the 401-refresh path is the same single
  channel, not a second bootstrap.
- **Keep the `/peek-pro/*` CSP header.** Without `frame-ancestors 'self' *` Peek can't embed
  the app (and drop any `X-Frame-Options: DENY` Next might add).

## Related skills

- **peek-backoffice-api** — what `PeekAccessService` (`peek`) can actually do once you're
  authenticated, plus ID normalization and `installDataId` data scoping.
- **peek-webhooks** — the *other* inbound path (Peek → your endpoint); different auth model
  (you verify the delivery signature, not a peek-auth token).
- **odyssey-ui** — the `<ody-*>` components and the `OdysseyLoader` pattern the views render.
- **peek-app-manifest-and-deploy** — where the POST embed URL is declared (`app.json`) and how
  `PEEK_APP_SECRET` / `PEEK_APP_URL` are provisioned.
