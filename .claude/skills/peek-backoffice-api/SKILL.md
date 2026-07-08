---
name: peek-backoffice-api
description: >-
  How to read and write Peek Pro back-office data from this starter kit using the
  PeekAccessService SDK (from @peektravel/app-utilities). Use when calling the Peek API —
  listing products/activities, querying availability/timeslots, reading or searching bookings,
  orders, payments, or customers — and for the rules that govern that data: booking/order ID
  normalization, installDataId data scoping, PII handling, and "never hand-write GraphQL."
  Triggers on "Peek API", "getAllActivities", "getAllProducts", "searchBookings",
  "PeekAccessService", "list bookings", "Peek GraphQL", "activity data", "booking data".
---

# Talking to the Peek back-office API

Authenticated requests in this app get a ready-to-use, install-scoped **`PeekAccessService`**
instance (called `peek` by convention). It wraps Peek's GraphQL safely — **use it; never
hand-write GraphQL.** This skill covers what it can do and the data rules around it.

> **How you get `peek`:** the auth pipeline builds it for you. Inside a route wrapped in
> `withPeekAuthentication`, the second argument *is* the authenticated `PeekAccessService`.
> See `peek-embed-and-auth` for the pipeline; this skill is about *using* the client.

## The SDK is the only sanctioned way to reach Peek

- Peek exposes a **GraphQL API**, but **raw GraphQL against an installed account is risky** —
  misuse can harm the account's underlying infrastructure. **Do not hand-write GraphQL.**
- **Any server-side (Node) interaction with the Peek Pro API goes through
  `@peektravel/app-utilities` (`PeekAccessService`) — never a hand-rolled HTTP or GraphQL
  client.** The SDK is Node-only by design; since every Peek API call in this kit is server-side,
  app-utilities is *the* way you talk to Peek — from authenticated routes, the MCP endpoint,
  webhook handlers, scripts, cron jobs, anywhere. It's already wired: `lib/peek-service.ts`
  constructs it from the verified token's install ID and the app's env (`PEEK_APP_SECRET`,
  `PEEK_APP_ID`, `PEEK_API_URL`, `mode: "v2"`).
- If the SDK seems to lack a method you need, **`ASK THE MCP`** whether one exists before even
  considering raw GraphQL — and flag the risk to the user.

## Using it in a route

```ts
// app/peek-pro/main/api/<thing>/route.ts
import { type NextRequest, NextResponse } from "next/server";
import { type PeekAccessService } from "@peektravel/app-utilities";
import { withPeekAuthentication } from "@/lib/with-peek";

export const GET = withPeekAuthentication(
  async (_request: NextRequest, peek: PeekAccessService) => {
    const products = await peek.getAllActivities();
    return NextResponse.json({ activities: products });
  },
);
```

### Methods confirmed in use by this starter kit

These appear in the shipped example routes (`app/peek-pro/main/api/` and
`app/examples/dashboard/api/`) — safe to rely on:

- `peek.getAllActivities()` → activity products (`{ productId, name, color, … }`).
- `peek.getAllProducts()` → all products; filter out add-ons with the exported
  `ADD_ON_PRODUCT_TYPE` constant (`products.filter(p => p.type !== ADD_ON_PRODUCT_TYPE)`).
- `peek.searchBookingsByTimeRange({ start, end, searchBy })` — `start`/`end` are ISO strings;
  `searchBy` is `"activityDate"` or `"purchaseDate"`. Bookings expose fields like `isCanceled`
  and `valueAmount` (a string — `parseFloat` it for math).

> **For anything beyond these — `ASK THE MCP`** for the current SDK surface (method names,
> arguments, return shapes) and the live GraphQL schema. Don't invent method or field names;
> the surface evolves. If the MCP is unavailable, mark the call `TODO(verify)`.

## Core resources (the domain map)

Field-level specifics are volatile — **`ASK THE MCP` for the current schema; do not invent
field names.** The domain centers on:

- **Products / activities** — the bookable experiences (tours, activities, rentals).
- **Availability / timeslots** — when a product can be booked; capacity per slot.
- **Bookings** — a customer's reserved spot(s) on a timeslot. Central to most apps.
- **Orders** — the commercial wrapper around bookings (line items, totals).
- **Payments** — charges, refunds, status. **Treat as sensitive.**
- **Customers / guests** — **PII-bearing.** Minimize what you store; prefer referencing Peek
  IDs over copying PII.

## Booking & order IDs — normalize on input

Booking/order IDs arrive in **two formats**:

- **Internal / canonical** — lowercase + underscore: `b_123abc` (booking), `o_123abc` (order).
- **Display** — uppercase + dash: `B-123ABC`, `O-123ABC` (for humans only).

**Whenever you receive an ID — from the SDK, a webhook, a URL, user input — normalize it to
the internal form first** (lowercase the string, replace `-` with `_`, e.g.
`B-123ABC` → `b_123abc`). Store, compare, and key caches/lookups on the canonical form; use
display form only for showing humans. These IDs **never change**, so they're your stable keys.
Mixing formats causes duplicate or missed records.

## `installDataId` — scope persisted data (when you add a DB)

Peek passes three identifiers: **user ID** (who's acting), **partner/account ID** (the
account), and **install ID** (unique account+app). The **install ID does NOT rotate** — an
uninstall→reinstall yields the *same* install ID. So keying data on the install ID alone means
a reinstalled app inherits **stale data**.

Phase 0 has no database, so there's nothing to scope yet. **When you add persistence:**

- At each install, mint **`installDataId` = install ID + install timestamp**.
- Store it as **`currentInstallDataId`** on an account object; **scope all records to
  `installDataId`**.
- On reinstall a new `installDataId` is minted → clean slate; a post-uninstall wiper removes
  everything tied to the prior `installDataId`.

Build this in from the start of any persistence work — retrofitting it is painful.
`ASK THE MCP` for the exact install-payload field names for the three IDs.

## Security & PII

Peek data routinely includes sensitive PII (guest names, emails, phones, payment metadata):

- HTTPS in transit; encrypt at rest; restrict who/what can read it.
- Store the **minimum** necessary; prefer referencing Peek IDs over copying PII.
- Keep secrets out of source control and client bundles — use your host's secret store
  (Vercel env vars by default; if using Neon, keep the `DATABASE_URL` server-only).
- **Never log PII or tokens.** Redact.

## Related skills

- **peek-embed-and-auth** — how the authenticated `peek` client gets built per request.
- **peek-webhooks** — the inbound path; reuse the same ID normalization + scoping.
- **peek-app-manifest-and-deploy** — the `peek_backoffice_api@v1` extendable in `app.json` is
  what grants this API access.
