---
name: peek-mcp-endpoint
description: >-
  How to expose an app's key functionality as an MCP endpoint so the Peek Pro App Store's AI
  orchestrator can drive the app without opening its UI. Use when adding or changing the app's
  MCP endpoint, deciding which tools to expose, defining a tool's input schema, or wiring the
  endpoint's auth. Every app built on this kit ships an MCP endpoint by default; it reuses the
  same peek-auth token verification as the UI and returns an MCP definition (a list of tools).
  Triggers on "MCP", "MCP endpoint", "expose tools", "tools/list", "tools/call", "App Store AI",
  "Autopilot", "headless access", "programmatic access", "expose functionality", "what to expose".
---

# The app's MCP endpoint — exposing functionality to the App Store AI

Every app in the Peek Pro App Store exposes its **key functionality through an MCP endpoint**.
An **AI orchestrator** (the App Store's assistant — e.g. Peek Pro Autopilot) connects to the
MCP endpoints of *all* the apps a user has installed, so the user can act across many apps
**by chatting with one AI instead of opening each app's iframe UI**. Your job when building an
app is to make sure the same things a human can do in the UI, the AI can do through the MCP
endpoint — for the operations that make sense to expose.

> **This is a runtime surface the app *serves*, not a build-time tool you *call*.** Build it
> alongside the UI (see "Build it by default" below).

## Two different "MCP"s — do not confuse them

This starter kit's world has **two** things called MCP. They point in opposite directions:

| | **Peek knowledge MCP** (build-time) | **The app's MCP endpoint** (runtime) — *this skill* |
| --- | --- | --- |
| Direction | You → Peek | App Store AI → your app |
| Purpose | Answer `ASK THE MCP` lookups while you build (schema, events, SDK surface) | Let the orchestrator operate the app for the user |
| Where | `PEEK_MCP_URL` / `PEEK_MCP_TOKEN`, build-time only | A route your app serves, declared in `app.json` |
| Auth | The build helper's token | The **same peek-auth token as the UI** |

When the orchestrator skill says `ASK THE MCP`, it means the **knowledge MCP** — not the
endpoint you're building here.

## Same authentication as the UI — reuse the pipeline, don't reinvent it

The MCP endpoint authenticates **exactly like every UI API route**: a short-lived peek-auth
JWT in the `x-peek-auth: Bearer <token>` header, verified library-side, yielding an
**install-scoped `PeekAccessService`**. The only difference from the UI is *who holds the
token*: the browser SPA gets it from the parent frame via `postMessage`; the AI orchestrator
obtains its own peek-auth token for the install and sends it on the same header. **Acquiring
the token is the caller's problem — your endpoint just verifies it**, the same way UI routes do.

So you **reuse `withPeekAuthentication`** (see `peek-embed-and-auth`). Do not build a second
auth scheme, an API key, or a bearer of your own.

```ts
// app/peek-pro/mcp/route.ts
import { type NextRequest, NextResponse } from 'next/server';
import { type PeekAccessService } from '@peektravel/app-utilities';
import { withPeekAuthentication } from '@/lib/with-peek';
import { MCP_TOOLS, callTool } from './tools';

// The endpoint is just another authenticated route — same verification as the UI.
export const POST = withPeekAuthentication(
  async (request: NextRequest, peek: PeekAccessService) => {
    const req = await request.json();

    // Discovery: return the MCP definition — the list of tools this app exposes.
    if (req.method === 'tools/list') {
      return NextResponse.json({
        tools: MCP_TOOLS.map(({ name, description, inputSchema }) => ({
          name,
          description,
          inputSchema,
        })),
      });
    }

    // Invocation: dispatch to a tool, passing the install-scoped client.
    if (req.method === 'tools/call') {
      const result = await callTool(req.params.name, req.params.arguments, peek);
      return NextResponse.json({ result });
    }

    return NextResponse.json({ error: 'unsupported method' }, { status: 400 });
  },
);
```

> **The exact MCP wire protocol / transport is volatile — `ASK THE MCP` (knowledge MCP) or pull
> the live doc for the precise JSON-RPC methods, the initialize handshake, the transport
> (Streamable HTTP vs. SSE), and how the orchestrator discovers and authenticates to your
> endpoint.** The shape above (a `tools/list` that returns the definition + a `tools/call` that
> dispatches) is the stable mental model; pin the concrete contract before shipping and mark any
> unknowns `TODO(verify)`. Return HTML never — JSON only (per AGENTS.md, no `react-dom/server`
> in route handlers).

## A tool is: name + description + input schema + a handler that reuses your existing logic

Each exposed tool has a **clear name**, a **description the AI reads to decide when to use it**,
a **typed input schema** (JSON Schema — this is the contract the orchestrator fills in), and a
**handler**. The handler must call the **same service-layer logic your UI API routes already
use** — don't fork a parallel implementation.

```ts
// app/peek-pro/mcp/tools.ts
import { type PeekAccessService } from '@peektravel/app-utilities';

export const MCP_TOOLS = [
  {
    name: 'list_activities',
    description: 'List the bookable activities/products in this Peek Pro account.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: async (_args: unknown, peek: PeekAccessService) =>
      peek.getAllActivities(), // the SAME call the UI's /api/activities route makes
  },
  // ...one entry per exposed capability
] as const;

export async function callTool(name: string, args: unknown, peek: PeekAccessService) {
  const tool = MCP_TOOLS.find((t) => t.name === name);
  if (!tool) throw new Error(`unknown tool: ${name}`);
  return tool.handler(args, peek);
}
```

**Keep UI and MCP in sync by sharing code, not duplicating it.** If both the UI route and an
MCP tool "search bookings," they should call one shared function. A capability that drifts
between the two surfaces is a bug.

## What to expose — decide *with the user*, don't export everything

Exposing every internal operation is wrong. The MCP surface is a deliberate, curated API for an
AI to act on the user's behalf. **Before building the tools, work through this with the user —
one question at a time (per the orchestrator's interaction rules) — and confirm the list:**

- **Start from the app's key jobs.** What are the handful of things this app *exists* to do?
  Those are your candidate tools (e.g. a waitlist app → "list waitlist", "add guest to
  waitlist", "notify next in line"). Mirror the meaningful UI actions.
- **Reads are the safe default; gate writes explicitly.** Query/list/get tools are low-risk and
  usually worth exposing. For anything that **mutates Peek data or messages guests**, confirm
  the user wants the AI to do it unattended — and describe the effect plainly in the tool
  description so the orchestrator (and the user approving it) understands the blast radius.
- **Never expose destructive or irreversible actions without an explicit "yes."** Cancelling
  bookings, issuing refunds, deleting data — call these out individually; default to *not*
  exposing them unless the user asks.
- **PII discipline carries over.** Tool inputs/outputs can carry guest PII — return the
  **minimum** needed, prefer Peek IDs over copying PII, and never put PII or tokens in logs
  (see `peek-backoffice-api`). The install scope from the verified token is the security
  boundary; a tool must never widen it.
- **Write descriptions for a reader that only has the description.** The AI picks tools from the
  name + description + schema alone — make them unambiguous, state units/formats, and normalize
  IDs on input (`B-123ABC` → `b_123abc`; see `peek-backoffice-api`).

Present the proposed tool list back to the user and get sign-off before implementing — the MCP
surface is part of the plan, not an afterthought.

## Build it by default

When building a new app, the MCP endpoint is **part of the default build**, not opt-in — an app
without one can't be driven from the App Store assistant. Concretely:

1. **In discovery/planning**, decide the tool list with the user (above) and record it in the
   plan alongside the UI and data flow.
2. **In the build**, add the `app/peek-pro/mcp` route + tools module, reusing
   `withPeekAuthentication` and the same service-layer functions as the UI.
3. **Declare the endpoint in `app.json`** so Peek/the orchestrator can find it. The exact
   registry extendable/key for an MCP endpoint URL is volatile — `ASK THE MCP` / pull the live
   registry doc for the correct slug, and update the manifest to match (see
   `peek-app-manifest-and-deploy`). `TODO(verify)` the key if the doc doesn't pin it.
4. **Test it** like any route — auth (401 without a valid token), `tools/list` returns the
   definition, each tool dispatches and stays install-scoped (see `testing-peek-apps`).

Only skip the endpoint if the user explicitly says the app shouldn't be AI-addressable — and
flag that it won't appear to the App Store assistant.

## Hard rules

- **Same auth as the UI — reuse `withPeekAuthentication`.** No second auth scheme, no API keys.
  The endpoint verifies the peek-auth token; the caller (the orchestrator) supplies it.
- **Install-scoped only.** Build tools from the *verified token's* claims (the `peek` client you
  were handed). A tool must never read or act outside its install scope.
- **Share logic with the UI; never fork it.** Tools call the same functions the UI routes call.
- **Curate the surface — expose deliberately.** Default to reads; gate writes; never expose
  destructive actions without an explicit user yes. Confirm the tool list with the user.
- **Treat tool I/O as PII.** Minimum data out, IDs over PII, nothing sensitive in logs.
- **Don't invent the wire protocol / registry key.** `ASK THE MCP` / live doc for the concrete
  MCP contract and the manifest slug; `TODO(verify)` gaps — never guess and ship.
- **JSON responses only.** No `react-dom/server` in the route handler (AGENTS.md).

## Related skills

- **peek-embed-and-auth** — the auth pipeline (`withPeekAuthentication`, `requirePeekAuth`,
  `verifyPeekAuthToken`) the endpoint reuses verbatim.
- **peek-backoffice-api** — what `PeekAccessService` (`peek`) can do inside a tool handler, plus
  ID normalization, `installDataId` scoping, and PII rules that apply to tool I/O.
- **peek-app-manifest-and-deploy** — declaring the MCP endpoint URL in `app.json` / the registry.
- **testing-peek-apps** — testing the endpoint's auth and each tool.
- **peek-app-builder** — the orchestrator; it schedules the MCP endpoint into the build by default.
