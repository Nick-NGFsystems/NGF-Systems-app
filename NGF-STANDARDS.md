# NGFsystems — Universal Project Standards

**This is the canonical foundation document for every NGF client website.** Fork/copy from `ngf-client-starter`, follow the rules below, and any site you build will plug into the NGF portal editor on day one.

## How to use this file

At the start of any new NGF client-website session, paste:
> "I'm starting a new NGFsystems client website. Read NGF-STANDARDS.md and follow it exactly. The reference implementations are NorthCoveBuilders-Mockup and WrenchTime-Cycles."

Two scopes are covered here:

1. **Universal client-site standards** — apply to every NGF client website (NorthCove, WrenchTime, future sites). Most of this file.
2. **NGF main-app standards** — apply only to `NGF-Systems-app` itself (the admin portal at `app.ngfsystems.com`). Marked clearly. Most client sites can ignore them.

For the main app's internal architecture (admin/portal routing, schema scraping pipeline, push API, version history, security invariants) read [`NGF-Systems-app/CLAUDE.md`](https://github.com/Nick-NGFsystems/NGF-Systems-app/blob/main/CLAUDE.md).

---

## How we work — Cowork mode

NGF projects are built in Claude Cowork mode. Claude has direct access to the codebase via mounted workspace folders and a sandboxed Linux shell — it reads, writes, and runs commands directly.

**Workflow rules:**
- Read this file plus the project's own `CLAUDE.md` (if present) at the start of every coding session
- Check if a component, function, or route already exists before creating anything new
- Verify writes by reading the file back
- Run `npm run build` or `npx tsc --noEmit` to confirm no TS errors before pushing
- Flag problems early — never silently skip a step or assume it'll work

**Pushing code:**
```bash
python3 github-push.py <repo-name> "<commit message>"
```
The portable version of `github-push.py` resolves the repo dynamically — no hardcoded session paths, works from any Cowork session or your local machine. Credentials live in `github-push-config.json` next to the script.

---

## Tech stack

### Client websites (all sites except `NGF-Systems-app`)

**Use the latest stable** of these. Client sites are independent Vercel projects and don't share dependencies with the main app.

| Layer | Tool | Notes |
|---|---|---|
| Framework | Next.js App Router | latest (16.x is fine; some sites still on 15.x) |
| Runtime | React | matches Next.js (18 or 19) |
| Language | TypeScript | always, never plain JS |
| Styling | Tailwind CSS | latest (3 or 4) |
| Database | Neon Postgres | only if the site needs its own data |
| ORM | Drizzle (preferred) or Prisma | choice depends on site needs |
| Email | Resend | for contact forms / transactional |
| Animations | Framer Motion | optional |
| Validation | Zod | for any form/API input |
| Deployment | Vercel | one project per client site |

### NGF main app (`NGF-Systems-app` only — pinned)

| Layer | Tool | Version |
|---|---|---|
| Next.js | App Router | **15.3.8 exactly** — never 16+ |
| React | | **18.x** — never 19+ |
| Prisma | | **5.x** — never 6+ |
| Clerk | `@clerk/nextjs` | **v6** — never `@latest` (v7 has breaking JWT changes) |
| Tailwind | | **3.x** |

**Never use Turbopack.** **Never use `npx prisma`** — always `./node_modules/.bin/prisma`. These rules apply to the main app only; client sites with Drizzle don't care.

---

## NGF Portal Editor Integration — the foundation

**This is the part that makes a website an NGF site.** Every client website ships with the integration on day one so the client can edit content from the portal at `app.ngfsystems.com`.

### Architecture in one paragraph

The site renders content with hardcoded fallbacks. At SSR time, every page calls `getNgfContent()` which fetches the client's published content from the NGF portal's public API as a flat dot-notation map. Each editable element renders `content['key'] || hardcoded_fallback` so missing keys gracefully fall through. Every editable element is annotated with `data-ngf-*` attributes so the portal editor can scrape the live HTML, build its sidebar schema dynamically, and route click-to-edit through a small bridge component (`NgfEditBridge`) that sits in `app/layout.tsx`. **There is no schema file to maintain.** The site itself is the schema.

### Required files for any new NGF client site

```
app/
  layout.tsx          ← Mount NgfEditBridge + call getNgfContent() once

lib/
  ngf.ts              ← getNgfContent(), getItems() helpers (copy verbatim — don't modify)

components/
  NgfEditBridge.tsx   ← Bridge to the portal editor (copy verbatim from a current
                        reference implementation; only NGF main-app changes update it)

next.config.{js,ts}   ← MUST add the CSP frame-ancestors header
```

### `lib/ngf.ts` — copy this verbatim

```typescript
export type NgfSiteContent = Record<string, string>

function getDomain() {
  // NEXT_PUBLIC_SITE_URL must come first — it's the custom domain set in Vercel.
  // VERCEL_PROJECT_PRODUCTION_URL is the *.vercel.app URL and won't match the
  // client_configs.site_url in the NGF database.
  return process.env.NEXT_PUBLIC_SITE_URL
      || process.env.VERCEL_PROJECT_PRODUCTION_URL
      || 'localhost:3000'
}

export async function getNgfContent(): Promise<NgfSiteContent> {
  try {
    const domain = getDomain()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/$/, '')
    const url = `${process.env.NGF_APP_URL || 'https://app.ngfsystems.com'}/api/public/content?domain=${encodeURIComponent(domain)}`
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return {}
    const data = (await res.json()) as { content?: NgfSiteContent }
    return data.content ?? {}
  } catch {
    return {}
  }
}

/**
 * Extract a dynamic array from flat dot-notation keys.
 * getItems(content, 'services.items') returns
 * [{ name: '...', price: '...' }, ...] from keys like
 * 'services.items.0.name', 'services.items.1.price', etc.
 */
export function getItems(
  content: NgfSiteContent,
  prefix: string,
): Record<string, string>[] {
  const prefixDot = prefix + '.'
  const keys = Object.keys(content).filter(k => k.startsWith(prefixDot))
  if (keys.length === 0) return []
  const indices = new Set<number>()
  for (const key of keys) {
    const rest = key.slice(prefixDot.length)
    const idx = parseInt(rest.split('.')[0])
    if (!isNaN(idx)) indices.add(idx)
  }
  return Array.from(indices).sort((a, b) => a - b).map(i => {
    const item: Record<string, string> = {}
    for (const key of keys) {
      const rest = key.slice(prefixDot.length)
      const [idxStr, ...subParts] = rest.split('.')
      if (parseInt(idxStr) === i && subParts.length > 0) {
        item[subParts.join('.')] = content[key]
      }
    }
    return item
  })
}
```

### `components/NgfEditBridge.tsx` — copy verbatim from a current reference

The bridge is a moving target — its postMessage contract changes when the editor adds new features (image fields, repeatable group reorder, etc.). **Always copy the latest from a known-current reference implementation:**
- [`NorthCoveBuilders-Mockup/components/NgfEditBridge.tsx`](https://github.com/Nick-NGFsystems/NorthCoveBuilders-Mockup/blob/main/components/NgfEditBridge.tsx)
- [`WrenchTime-Cycles/components/NgfEditBridge.tsx`](https://github.com/Nick-NGFsystems/WrenchTime-Cycles/blob/main/components/NgfEditBridge.tsx)

Both stay in sync after every editor change. **Do not write a new bridge from scratch and do not modify the bridge in a single client repo without propagating to all of them.** The bridge contract is documented in the NGF main app CLAUDE.md.

### `app/layout.tsx` — required pattern

```tsx
import NgfEditBridge from '@/components/NgfEditBridge'
import { getNgfContent } from '@/lib/ngf'

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const content = await getNgfContent()
  return (
    <html lang="en">
      <body>
        {/* pass `content` down through layout components; every page
            also calls getNgfContent() in its own server component */}
        {children}
        <NgfEditBridge />
      </body>
    </html>
  )
}
```

### `next.config.{js,ts}` — required CSP header

The portal editor loads each client site inside an iframe. Without this header the browser blocks embedding:

```typescript
async headers() {
  return [{
    source: '/:path*',
    headers: [{
      key: 'Content-Security-Policy',
      value: "frame-ancestors 'self' https://app.ngfsystems.com https://*.vercel.app",
    }],
  }]
}
```

### Required env vars

```
NEXT_PUBLIC_SITE_URL   # MUST match client_configs.site_url in the NGF database
                       # exactly (after normalizing protocol/www/trailing slash)
NGF_APP_URL            # Optional. Defaults to https://app.ngfsystems.com
```

If `NEXT_PUBLIC_SITE_URL` doesn't match the client_configs row, the portal can't deliver content and the site renders only hardcoded fallbacks.

### Self-describing markup — annotation patterns

Every editable element needs **all four** attributes. The scraper silently drops any element missing `data-ngf-label` or `data-ngf-section`.

#### Scalar text field

```tsx
<h1
  data-ngf-field="hero.headline"
  data-ngf-label="Headline"
  data-ngf-type="text"
  data-ngf-section="Hero"
>
  {content['hero.headline'] || 'Build the home you\'ve always dreamed of.'}
</h1>
```

#### Textarea field

```tsx
<p
  data-ngf-field="hero.description"
  data-ngf-label="Description"
  data-ngf-type="textarea"
  data-ngf-section="Hero"
>
  {content['hero.description'] || 'Long-form fallback paragraph.'}
</p>
```

#### Image field — use plain `<img>`, NEVER `next/image` with `fill`

The bridge swaps `src` directly. `next/image` with `fill` wraps the real img in a span the bridge can't reach.

```tsx
<img
  src={content['hero.image'] || '/hero-default.jpg'}
  alt="Hero background"
  data-ngf-field="hero.image"
  data-ngf-label="Hero Background Image"
  data-ngf-type="image"
  data-ngf-section="Hero"
  className="absolute inset-0 h-full w-full object-cover"
/>
```

#### Color field

Use an `sr-only` anchor span containing the live hex so the editor sidebar shows a real color swatch instead of an empty box.

```tsx
<span
  data-ngf-field="brand.primaryColor"
  data-ngf-label="Primary Color"
  data-ngf-type="color"
  data-ngf-section="Brand"
  aria-hidden="true"
  className="sr-only"
>
  {primaryColor}
</span>
```

#### Hidden / invisible-but-editable fields

Any field that's used as a JS variable (e.g. `const businessName = content['brand.businessName'] || 'Default'`) but doesn't have a visible DOM element — wrap an `sr-only` span around the value so the scraper picks it up:

```tsx
<span
  data-ngf-field="brand.businessName"
  data-ngf-label="Business Name"
  data-ngf-type="text"
  data-ngf-section="Brand"
  aria-hidden="true"
  className="sr-only"
>
  {businessName}
</span>
```

#### Repeatable groups (add/remove/reorder cards)

Put `data-ngf-group` on the container, declare each item's sub-fields in `data-ngf-item-fields`, render with indexed paths:

```tsx
<div
  data-ngf-group="services.items"
  data-ngf-item-label="Service"
  data-ngf-min-items="1"
  data-ngf-max-items="16"
  data-ngf-item-fields='[{"key":"image","label":"Photo","type":"image"},{"key":"name","label":"Name","type":"text"},{"key":"price","label":"Price","type":"text"}]'
>
  {services.map((svc, i) => (
    <article key={i}>
      <img
        src={content[`services.items.${i}.image`] || svc.image}
        alt={svc.name}
        data-ngf-field={`services.items.${i}.image`}
        data-ngf-label="Photo"
        data-ngf-type="image"
        data-ngf-section="Services"
      />
      <h3
        data-ngf-field={`services.items.${i}.name`}
        data-ngf-label="Name"
        data-ngf-type="text"
        data-ngf-section="Services"
      >
        {content[`services.items.${i}.name`] || svc.name}
      </h3>
      <p
        data-ngf-field={`services.items.${i}.price`}
        data-ngf-label="Price"
        data-ngf-type="text"
        data-ngf-section="Services"
      >
        {content[`services.items.${i}.price`] || svc.price}
      </p>
    </article>
  ))}
</div>
```

#### Field type reference

| `data-ngf-type` | Editor input | Bridge writes to |
|---|---|---|
| `text` | single-line `<input>` | `el.textContent` |
| `textarea` | resizable `<textarea>` (auto-grow) | `el.textContent` |
| `color` | color picker + hex text | `el.textContent` |
| `image` | URL field + Upload-from-computer + preview | `el.setAttribute('src', …)` |
| `toggle` | true/false | `el.textContent` |

### Critical content-rendering rules

1. **Always use `||`, never `??` for fallbacks.** Published content can include explicit `''`. `??` only catches `null`/`undefined`, so an empty value would render an empty element instead of falling through to the hardcoded default.
2. **Always provide a hardcoded fallback.** New clients have no published content — the site needs to render correctly from `lib/site-data.ts` (or wherever you keep defaults) before the first publish.
3. **Use plain `<img>` for image fields.** `next/image` with `fill` wraps the real img element so the bridge can't read or write `src`.
4. **Don't omit `data-ngf-label` or `data-ngf-section`.** The scraper silently skips elements missing either, and they won't appear in the editor sidebar.
5. **`data-ngf-section` is the human-readable label.** The grouping key is always derived from the first dot-segment of `data-ngf-field` (e.g. `hero.headline` → section key `hero`, regardless of what `data-ngf-section` says).

---

## Setup checklist for a new NGF client website

1. [ ] **Fork** [`ngf-client-starter`](https://github.com/Nick-NGFsystems/ngf-client-starter) (or copy the integration files from `NorthCoveBuilders-Mockup` if the starter is stale — see Known Issues)
2. [ ] **`lib/ngf.ts`** — copy verbatim from this doc
3. [ ] **`components/NgfEditBridge.tsx`** — copy from a current reference (NorthCove or WrenchTime)
4. [ ] **`app/layout.tsx`** — mount `<NgfEditBridge />`, call `getNgfContent()` once, thread `content` through any layout components
5. [ ] **`next.config.{js,ts}`** — add the CSP `frame-ancestors` header
6. [ ] **Annotate every page** — wrap each editable element with all four `data-ngf-*` attributes (text, textarea, color, image) and use `data-ngf-group` on every list of cards
7. [ ] **Always `||`, never `??`** for fallbacks
8. [ ] **Vercel env vars** — `NEXT_PUBLIC_SITE_URL` (custom domain or vercel.app), optional `NGF_APP_URL`, plus your own (DB, Resend, Clerk if used)
9. [ ] **Deploy to Vercel** — one project per client site
10. [ ] **NGF admin** — set the client's `site_url` in `client_configs` to match `NEXT_PUBLIC_SITE_URL` exactly. The portal editor scrapes the schema on next load.
11. [ ] **Verify in editor** — open the client portal, switch to Manage Sections, confirm all your annotated fields show up in the sidebar with real preview text

---

## Database — only if the site needs its own data

Most marketing sites don't need a database. If your site has a contact form or service requests:

- **Drizzle + Neon** for client sites (lighter, no migration daemon)
- **Prisma 5 + Neon** for the NGF main app only

Single client per app:
```typescript
// db/client.ts (Drizzle)  OR  lib/db.ts (Prisma)
// — only one PrismaClient / Drizzle instance per app
```

Multi-tenant queries always filter by `client_id` at the ORM level, never in JavaScript.

---

## Auth — only if the site needs it

Most NGF marketing sites don't need auth. If your site has a logged-in admin or customer area:

- **Clerk** is the standard. Pin `@clerk/nextjs@6` (v7 has breaking JWT changes).
- Customize the session token at Clerk dashboard → Configure → Sessions → add `{ "metadata": "{{user.public_metadata}}" }` so `sessionClaims.metadata.role` exists.
- Layout components must NEVER do auth checks — middleware handles all auth.
- After setting a role, the user must sign out and back in for it to take effect.
- Public routes (e.g. tokenized booking links sent via email — customers don't have accounts) MUST be in the middleware's `createRouteMatcher` whitelist or they'll be redirected to sign-in.

---

## Design system — Apple-inspired refined minimalism

Default direction unless the client requests something specific:

- **Light theme** — `bg-white`, `bg-gray-50` backgrounds, `text-gray-900` body
- Single accent color, subtle depth via `shadow-sm` + `rounded-xl` + `border border-gray-100`
- Generous whitespace, no heavy gradients, no purple, nothing AI-looking
- Mobile-first responsive: write the mobile layout, scale up with `md:` and `lg:`
- 44 px minimum touch targets on mobile

**Don't mix dark and light themes in the same site** — pick one and use it everywhere. If a client site has a dark hero, the rest of the site should be dark too. (We've shipped a regression where the homepage was light and intake/booking were dark — confusing for users and an obvious tell.)

---

## Absolute rules — never break

These apply to **every** project, client site or main app.

1. TypeScript only — never `.js` files
2. Tailwind only — never inline styles, never custom CSS for components
3. `any` is forbidden — use proper interfaces
4. Never duplicate components, functions, or layouts — check if it exists first
5. Never hardcode keys, secrets, or connection strings — use env vars
6. Never report a file as updated without verifying the write (`cat` it back)
7. Mobile-first responsive — every page works at 375 / 768 / 1280
8. Never ship a feature without testing the unhappy paths
9. Never push without running `npm run build` or `npx tsc --noEmit` first

NGF main app additionally:
- One Prisma instance — always `import { db } from '@/lib/db'`
- `@clerk/nextjs@6` — never `@latest`
- Next.js `15.3.8` — never `16+`
- Never `npx prisma` — always the local binary
- Portal route paths must have `portal-` prefix
- `tsconfig.json` must have `baseUrl` + `paths` or route groups silently 404
- Never put auth checks in layout components — middleware only

---

## Known issues / quick reference

| Issue | Fix |
|---|---|
| Editor sidebar doesn't show a field you annotated | Check both `data-ngf-label` and `data-ngf-section` are present — scraper skips elements missing either |
| Editor sidebar shows an empty input box | Probably an `sr-only` anchor with no inner content — put `{value}` inside the span |
| Image field click does nothing | You used `next/image` with `fill`. Switch to plain `<img>` with `data-ngf-field` directly on it |
| Stored value renders as empty instead of fallback | You used `??` instead of `||`. Empty strings only fall through with `||` |
| Editor preview iframe blocked by browser | Missing `frame-ancestors 'self' https://app.ngfsystems.com https://*.vercel.app` in CSP header |
| Portal editor "site_url not NGF" | Either `NEXT_PUBLIC_SITE_URL` doesn't match `client_configs.site_url`, or your site's HTML doesn't include the `ngf-public-api` meta tag (verify by viewing source) |
| Bridge version mismatch | The bridge file in this repo is older than the editor expects. Copy from NorthCove/WrenchTime current main |
| Newly-added card looks like a duplicate of the last card | Bridge clones the last child as a template, then resets text to placeholders + image to a grey "Click to set image" SVG. If your site uses non-standard markup the reset may be incomplete; check the bridge's `addGroupItem` handler |
| Custom domain renders only hardcoded defaults | `NEXT_PUBLIC_SITE_URL` Vercel env var doesn't match `client_configs.site_url` exactly (case, www, trailing slash matter) |
| `<select><option>` editing | Not supported by the bridge — native browser UI. Use `data-ngf-field` for the label only |
| Hydration mismatch with `data-ngf-edit` attribute | The bridge sets `data-ngf-edit` on `<html>` only when the parent is the portal iframe. Don't set it server-side |
| Clerk v7 JWT format broken | Pin `@clerk/nextjs@6` |
| Role not appearing in sessionClaims | Customize Clerk session token (see Auth section) |
| Role change not working | User must sign out and back in |
| Prisma pulling v7 | Use `./node_modules/.bin/prisma`, never `npx prisma` |

---

## Reference implementations

When in doubt, copy a pattern from one of these:

- **[`NorthCoveBuilders-Mockup`](https://github.com/Nick-NGFsystems/NorthCoveBuilders-Mockup)** — fully annotated marketing site. No auth, no DB beyond contact form. Best reference for pure content-driven NGF integration. Uses Next.js 16 + React 19 + Drizzle.
- **[`WrenchTime-Cycles`](https://github.com/Nick-NGFsystems/WrenchTime-Cycles)** — service-shop site with its own external Neon DB for `ServiceRequest`, Clerk for shop-owner auth, tokenized public booking links. Best reference for sites that need their own data + customer-facing token flows. See [`wrenchtime-cycles/CLAUDE.md`](https://github.com/Nick-NGFsystems/WrenchTime-Cycles/blob/main/wrenchtime-cycles/CLAUDE.md) for project-specific details.
- **[`NGF-Systems-app`](https://github.com/Nick-NGFsystems/NGF-Systems-app)** — the admin portal itself. Read its [`CLAUDE.md`](https://github.com/Nick-NGFsystems/NGF-Systems-app/blob/main/CLAUDE.md) when integrating new editor features (it has the full bridge + scraper architecture, security invariants, version history, etc.).

---

## Workflow — how we build a feature

1. **Read** this file + the project's own `CLAUDE.md` if present
2. **Check** if the feature, component, or route already exists
3. **Schema first** if data is involved — update `prisma/schema.prisma` (main app) or `db/schema.ts` (Drizzle), generate the migration
4. **API route** second
5. **UI component** last
6. **Annotate** every new editable text/image with the four `data-ngf-*` attributes
7. **Verify** every file you wrote with `cat` after editing — never trust silent writes
8. **Build** — `npm run build` or `npx tsc --noEmit` to confirm no TS errors
9. **Commit** — descriptive message: `feat: <description>` / `fix: <description>` / `docs: <description>`
10. **Push** via `python3 github-push.py <repo-name> "<msg>"` — Vercel auto-deploys

---

## Deployment checklist (Vercel)

Before deploying any new NGF client site:

- [ ] Framework Preset: **Next.js** (Vercel usually detects)
- [ ] Env vars set: `NEXT_PUBLIC_SITE_URL` matches NGF database, plus whatever else the site needs (DB, Resend, Clerk)
- [ ] CSP `frame-ancestors` header in `next.config`
- [ ] Custom domain DNS records configured at the registrar
- [ ] After first successful deploy: in NGF admin → Clients → set this client's `site_url` to match
- [ ] Open the client's portal editor — verify all annotated fields appear in the sidebar with real preview text

For the NGF main app additionally:
- [ ] Clerk production instance has session token customized + domain verified
- [ ] All Clerk + Stripe + Resend + Neon env vars added to Production / Preview / Development
- [ ] Vercel Blob store provisioned and `BLOB_READ_WRITE_TOKEN` available (image uploads from the editor need this)
