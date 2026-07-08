---
name: odyssey-ui
description: >-
  Build UI that looks native to Peek Pro using Odyssey, Peek's design system of framework-
  agnostic <ody-*> web components (from @peektravel/app-utilities). Use when adding or styling
  any embedded view, rendering Odyssey components in React, wiring the OdysseyLoader, typing a
  new <ody-*> element, or generating an interactive HTML mockup for design sign-off. Covers the
  npm vs CDN include paths, the attribute/property/event conventions, and pulling the live
  component docs. Triggers on "Odyssey", "ody-button", "ody-*", "Peek UI", "component",
  "style the app", "mockup", "design the view".
---

# Odyssey UI — Peek's design system

Apps that render UI should use **Odyssey** so they look and feel native to Peek Pro. Odyssey
ships **framework-agnostic web components** (`<ody-*>` tags) via `@peektravel/app-utilities`.
They use light DOM, are dependency-free, and work in React (as here), Vue, Angular, Svelte, or
vanilla HTML. This starter kit already wires them into the embedded views.

## Always load the live component docs first

Odyssey evolves — **do not rely on memory for component names/attributes.** Fetch and read the
current docs before building UI:

```
https://cdn.jsdelivr.net/npm/@peektravel/app-utilities/docs/ui.md
```

It lists every component, its tag, attributes, and usage conventions. (Intentionally kept out
of this skill so it can't go stale.)

## How this starter kit includes Odyssey (npm — the default)

The embedded views load Odyssey through the npm package, in two pieces:

1. **CSS, in a layout** (`app/peek-pro/main/view/layout.tsx`):
   ```ts
   import '@peektravel/app-utilities/ui/tokens.css';
   import '@peektravel/app-utilities/ui/odyssey.css';
   ```
2. **Component registration, client-side only** — via `OdysseyLoader`
   (`app/peek-pro/main/OdysseyLoader.tsx`), which dynamically imports the elements in a
   `useEffect` so custom elements upgrade **after** React hydration (avoiding hydration
   mismatches):
   ```ts
   'use client';
   useEffect(() => { import('@peektravel/app-utilities/ui'); }, []);
   ```

**To render Odyssey in a new view:** put `<OdysseyLoader />` in the view's layout and import
the two CSS files there (copy `view/layout.tsx` or the dashboard example's `layout.tsx`). Then
use `<ody-*>` tags in your `"use client"` components.

## Typing `<ody-*>` elements for React/TSX

Custom elements need JSX typings or TS complains. This kit declares them in
`types/odyssey-elements.d.ts` (augmenting `react`'s `JSX.IntrinsicElements`). **When you use an
`<ody-*>` element not yet listed there, add it** — follow the existing entries, e.g.:

```ts
'ody-button': HTMLAttributes<HTMLElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'tertiary' | 'danger';
  size?: 'base' | 'small';
};
```

Consult the live `ui.md` for that component's real attributes.

## Usage conventions (from ui.md)

- **Scalars → attributes:** strings/booleans as HTML attributes
  (`<ody-button variant="primary" left-icon="plus">Add</ody-button>`).
- **Rich data → JS properties:** arrays/objects/functions set on the element object
  (`el.columns = [...]; el.data = [...]`) — not as attributes.
- **Events → `CustomEvent`:** `el.addEventListener(type, e => e.detail)`. In React you can also
  pass handlers like `onClick` for simple cases (see the shipped `view/page.tsx`).
- **Content → light-DOM children:** the component renders your child nodes.
- **Wrap page/settings UI in `<ody-page-container>`** — the standard responsive wrapper
  (~868px narrow / ~1310px wide).

## Theming / tokens

Override design tokens in CSS rather than hardcoding brand colors:
`--color-<name>-<shade>` (e.g. `--color-interaction-300`), typography `--ody-font-family` /
`--ody-font-weight-*`, layout `--layout-top-bar-height`, `--ody-shadow-base`. Some components
accept inline color via attributes (e.g. `bar-color="var(--color-success-300)"`).

## The mockup workflow (step 2 of the build)

Before building the real UI, make the design concrete with an **interactive single-file
`index.html` mockup** the user can click through — iterate until they're happy.

1. Copy `mockup-template.html` (in this folder) into the project as `index.html`. It wires the
   **CDN** Odyssey includes (mockups are standalone, so CDN — not the npm package) and scaffolds
   `<ody-page-container>` + an `<ody-tabs>` variant area.
2. Build the proposed UI in it from what you've learned; tell the user to open it in a browser
   and react.
3. Collect feedback one question at a time; revise. **When unsure about a layout/flow, render
   multiple variants in the *same* file** (wrap each in a tab) so the user compares directly,
   then collapse to the chosen direction.
4. Repeat until satisfied — the agreed mockup feeds the real build.

> If `ui.md` is unreachable, say so and fall back to clean, neutral, accessible HTML — do
> **not** invent `ody-*` attributes; re-skin with Odyssey later.

## Still open / `TODO(verify)`

- Brand assets beyond the component set (logo usage), and any layout conventions specific to
  embedded vs. admin surfaces.
- Accessibility requirements Peek mandates for published apps.

## Related skills

- **peek-embed-and-auth** — the SPA gate the views render inside; where `OdysseyLoader` and the
  layouts live.
- **peek-app-builder** — step 2 (mockup) and step 5 (build the real UI) both drive this skill.

## Artifacts in this folder

- `mockup-template.html` — single-file Odyssey (CDN) starter for the mockup loop.
