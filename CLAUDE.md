# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Stack — Always Use These Exact Versions

| Layer | Tool | Version |
|---|---|---|
| Framework | Next.js (App Router) | 15.3.8 |
| Runtime | React | 18.x |
| Language | TypeScript | always |
| Styling | Tailwind CSS | 3.x |
| Database | Neon (PostgreSQL) | — |
| ORM | Prisma | 5.x |
| Auth | Clerk | @clerk/nextjs v6 |
| Payments | Stripe | latest |
| Email | Resend | latest |
| File Storage | Vercel Blob | latest |
| Analytics | Google Analytics 4 | @google-analytics/data |
| Deployment | Vercel | — |

### Critical Version Rules
- **Never install Next.js 16+** — always pin to 15.3.8
- **Never install React 19+** — incompatible with Next.js 15
- **Never install Prisma 6+** — breaking changes in schema syntax
- **Never install `@clerk/nextjs@latest`** — installs v7 which has breaking JWT changes. Always pin with `@clerk/nextjs@6`
- **Never enable Turbopack** — never use `--turbopack`, never add it to any script or config
- **Always run Prisma via local binary** — `./node_modules/.bin/prisma` not `npx prisma` (npx downloads Prisma 7 globally)

---

## Commands

```bash
# Development
npm run dev                                              # Start dev server
npm run build                                            # prisma generate + next build
npm run lint                                             # ESLint

# Database — always use local binary, never npx
./node_modules/.bin/prisma migrate dev --name <desc>    # Create + apply migration
./node_modules/.bin/prisma generate                     # Regenerate Prisma client after schema change
./node_modules/.bin/prisma studio                       # Visual DB browser

# Type-check only (no emit)
npx tsc --noEmit
```

The production Vercel build script is `prisma migrate deploy && prisma generate && next build`. Never add `--turbopack` to any script.

---

## Architecture — One App, Two Sides

NGFsystems is a single Next.js app on Vercel with one Neon Postgres database. Two completely separate experiences are gated by Clerk roles.

**Admin side** (`/admin/*`) — accessible only to `role: "admin"` (Nick):
- Dashboard with GA4 analytics, open change requests, revenue stats
- Clients: full CRUD, configure per-client portal settings
- Leads: self-signup review
- Projects + tasks, time tracking, finances, contracts

**Client/Portal side** (`/portal/*`) — accessible only to `role: "client"`:
- Only renders pages and features admin has toggled on in `client_configs`
- Zero visibility into admin data or other clients
- Website editor connected to the client's live site via `website_content` table

### Route Structure

The app uses flat routes (not Next.js route groups for admin/portal):
```
app/
  (auth)/sign-in/[[...rest]]/   ← route group, shared login/signup
  (auth)/sign-up/[[...rest]]/
  admin/dashboard/              ← flat admin routes
  admin/clients/
  admin/clients/[id]/           ← client detail + portal config
  admin/portal/                 ← portal management list
  admin/portal/[clientId]/      ← manage specific client portal
  admin/portal/[clientId]/service-requests/
  admin/finances/
  admin/projects/
  admin/leads/
  admin/time/
  portal/portal-dashboard/      ← portal routes — prefixed with portal- to avoid conflicts
  portal/portal-content/
  portal/portal-invoices/
  portal/portal-request/
  portal/website/               ← schema-driven website editor
  portal/website/preview/       ← DEAD CODE — orphaned, never used by the editor
  portal/portal-website/        ← legacy website page (keep for compatibility)
  api/admin/                    ← admin API routes (role check required)
  api/portal/                   ← portal API routes (role check required)
  api/public/                   ← public CORS endpoints (no auth)
  api/webhooks/                 ← Clerk + Stripe webhook handlers
  api/leads/                    ← lead ingestion from ngfsystems.com
```

### Role-Based Access
- Every admin route checks `role === "admin"` — redirects to `/unauthorized` if not
- Every portal route checks `role === "client"` — redirects to `/unauthorized` if not
- Roles stored in Clerk `publicMetadata.role` — never in the app database
- Clerk session token must be customized to include `{{user.public_metadata}}` (see Clerk Setup)
- Role changes only take effect after the user signs out and back in

---

## Middleware — `middleware.ts` (project root)

The middleware does two things beyond basic Clerk auth:

**1. Role-based routing** — after confirming a session exists, checks `sessionClaims.metadata.role` and redirects to `/unauthorized` on mismatch.

**2. Public route passthrough** — these bypass auth entirely: `/`, `/sign-in(.*)`, `/sign-up(.*)`, `/unauthorized(.*)`, `/redirect`, `/preview(.*)`, `/api/public/(.*)`.

The matcher excludes `_next`, `static`, `favicon.ico`, `api/webhooks`, `api/leads`, and `_clerk`.

`NEXT_PUBLIC_APP_DOMAIN` env var must be set so the middleware knows which hostname is the app itself.

---

## Database Schema — Key Tables

All tables in `/prisma/schema.prisma`. Never edit the database directly.

| Table | Purpose |
|---|---|
| `clients` | All clients — admin-created and self-signup |
| `client_configs` | Per-client portal toggles and settings |
| `website_content` | Published + draft JSON content for the website editor |
| `site_content` | Legacy per-field content rows (still used by PortalManager) |
| `change_requests` | Change requests submitted by clients |
| `project_requests` | Website request form submissions |
| `projects` / `tasks` | Project tracking |
| `time_entries` | Billable hours |
| `subscriptions` | Stripe subscription records |
| `recurring_income` / `recurring_expenses` | Finance tracking |
| `one_time_transactions` / `work_mileage` | Finance tracking |
| `budget_allocations` | Budget category tracking |
| `contracts` | Contract records |
| `site_analytics` | Manual per-client analytics entries |

### `client_configs` — key fields
- `page_request`, `page_website`, `page_content`, `page_invoices` — portal page visibility toggles
- `feature_blog`, `feature_products`, `feature_booking`, `feature_gallery` — feature toggles within pages
- `site_url` — client's live website domain (e.g. `wrenchtime.com`, no protocol)
- `site_repo` — GitHub repo slug
- `database_url` — external Neon DB URL for clients who have their own database (service requests)
- `booking_url` — URL template with `[token]` placeholder used when approving service requests
- `template_id` — **deprecated, unused.** Schema is now auto-detected by scraping the live site. Do not set or read this field.

### `website_content` — the editor's data store
- `client_id` — unique per client
- `content` (JSON) — published content; what the live website reads
- `draft_content` (JSON | null) — saved but unpublished; cleared on publish
- `published_at` — timestamp of last publish

---

## Website Editor Architecture

The portal website editor (`app/portal/website/page.tsx`) is a fully client-side schema-driven editor. The server never needs to know which fields exist — the schema is discovered automatically by scraping the live client site.

There is **no template system**. The `lib/templates/` folder is dead code — do not import from it or add to it. `client_configs.template_id` is deprecated and ignored.

### Schema Scraper (`app/api/portal/website/route.ts`)

The GET handler calls `scrapeSchemaFromSite(siteUrl)`, which:
1. Fetches the client's live site HTML (8-second timeout, `User-Agent: NGF-Portal/1.0`)
2. Regex-parses all opening tags containing `data-ngf-field` — these become **leaf fields**
3. Regex-parses all opening tags containing `data-ngf-group` — these become **repeatable arrays**
4. Derives the section key from the field path prefix (`hero.headline` → section key `hero`)
5. Preserves section order as they appear in the HTML source
6. Returns a `SiteSchema` object used directly by the editor

**Leaf field attribute requirements** — all four required, field is silently skipped if either `data-ngf-label` or `data-ngf-section` is missing:
- `data-ngf-field="section.fieldKey"` — dot-notation path, first segment = section key
- `data-ngf-label="Human Label"` — **required** — display label in edit popover
- `data-ngf-type="text|textarea|color|image|toggle"` — defaults to `text` if absent
- `data-ngf-section="Section Name"` — **required** — display label for the section group

Array item fields like `services.items.0.name` are **skipped** by the leaf parser — they are handled by the group parser instead.

Fields with the same path that appear multiple times in the HTML (e.g. `brand.businessName` in both header and footer) are deduplicated — only the first occurrence is used.

**Repeatable group attributes** — `data-ngf-item-fields` is required; group is skipped if absent:
```html
<div
  data-ngf-group="services.items"
  data-ngf-item-label="Service"
  data-ngf-min-items="1"
  data-ngf-max-items="16"
  data-ngf-item-fields='[{"key":"name","label":"Service Name","type":"text"},{"key":"price","label":"Price","type":"text"}]'
>
```

**Hidden anchor pattern** — for fields with no visible DOM element (e.g. color pickers), use an `sr-only` span. The editor still discovers these because the scraper reads raw HTML, not the rendered DOM:
```html
<span
  data-ngf-field="brand.primaryColor"
  data-ngf-label="Primary Color"
  data-ngf-type="color"
  data-ngf-section="Brand"
  aria-hidden="true"
  className="sr-only"
/>
```

If the site is unreachable or has no `data-ngf-*` annotations, `fallbackSchema()` returns a minimal Brand + Hero schema so the editor never crashes.

### Editor State Model (`app/portal/website/page.tsx`)

The editor manages four pieces of state:

| State | Type | Purpose |
|---|---|---|
| `content` | `ContentBlock` | The live working copy — all edits go here |
| `publishedContent` | `ContentBlock` | The last-published snapshot from the API |
| `schema` | `TemplateSchema \| null` | Scraped schema from live site |
| `baseContent` | `ContentBlock` (memo) | `applySchemaDefaults(publishedContent, schema)` |

**`baseContent`** is critical — it is the `useMemo` of `applySchemaDefaults(publishedContent, schema)`. This normalizes the published snapshot through the same schema-default-fill logic that `content` goes through on load, so schema-initialized empty strings don't count as pending changes when nothing has actually been edited.

**`applySchemaDefaults(content, schema)`** — merges stored content with schema defaults. For each field in the schema, uses the stored value if present, otherwise falls back to `field.default ?? ''`. For repeatable fields, uses stored array if non-empty, otherwise creates `minItems` default items. Used both at load time and to compute `baseContent`.

### Change Detection and Revert

**`getChangedSections(content, baseContent, schema)`** — diffs `content` against `baseContent` (NOT raw `publishedContent`) section by section using `JSON.stringify`. Returns an array of `{ sectionKey, label, fieldCount }`. Always pass `baseContent` as the second argument — passing `publishedContent` will cause phantom changes from schema-initialized defaults.

**`revertSection(sectionKey)`** — sets `content[sectionKey]` back to `baseContent[sectionKey]`, pushes to preview, schedules save. Uses `baseContent`, not `publishedContent`.

**`revertAll()`** — replaces all of `content` with `{ ...baseContent }`, pushes to preview, schedules save.

### Auto-Save and Publish Flow

```
User edits a field in the editor
  → updateField(section, fieldPath, value) updates content state immediately
  → pushToPreview(content) debounced 120ms → postMessage contentUpdate to iframe
  → scheduleSave(content) debounced 800ms → POST /api/portal/website
      → saves to website_content.draft_content (never touches published content)
      → sets hasDraft = true

User clicks "Publish Changes"
  → POST /api/portal/website (force-saves current content as draft)
  → POST /api/portal/website/push
      → promotes draft_content → content, sets published_at, clears draft_content
      → optionally pings WEBSITE_REVALIDATION_SECRET on client site (non-fatal)
  → editor sets publishedContent = content, hasDraft = false, reloads iframe after 1.2s

Client website fetches content (no auth, full CORS):
  GET /api/public/content?domain=<domain>   ← matches client by site_url, returns flat dot-notation
```

The public content endpoint returns only published `content` — never `draft_content`. Response shape: `{ content: { 'hero.headline': 'text', 'services.items.0.name': 'text', ... } }`.

### postMessage Protocol (editor ↔ client site iframe)

| Direction | Message type | Payload | Purpose |
|---|---|---|---|
| Site → Editor | `ngfReady` | — | Bridge loaded; editor responds with `setEditMode` |
| Editor → Site | `setEditMode` | `{ enabled: boolean }` | Activates/deactivates edit-mode CSS and click interception |
| Editor → Site | `contentUpdate` | `{ content: ContentBlock }` | Patches DOM elements; bridge walks the nested object and calls `el.textContent = value` for each matching `[data-ngf-field]` |
| Site → Editor | `fieldClick` | `{ section, field, currentValue, elementRect }` | User clicked an editable field; editor opens the edit popover |

`elementRect` is `{ top, left, bottom, right, width, height }` in the iframe's viewport coordinates. The editor adds the iframe's own `getBoundingClientRect()` to convert to page-level coordinates for popover positioning.

### Edit Popover (`EditPopover` component)

Opens when a `fieldClick` message is received. Input type is determined by `resolveFieldType(schema, section, field)`:
- `text` → single-line `<input>`
- `textarea` → `<textarea>` (resizable, 4 rows desktop / 5 rows mobile sheet)
- `color` → `<input type="color">` + hex text field side by side
- `image` → URL text field + live preview thumbnail

`computePopoverPosition(iframeRect, elementRect)` positions the popover below the clicked element (flips above if not enough room below). On mobile (`window.innerWidth < 640`) it always renders as a bottom sheet instead.

Changes are applied to `content` state immediately as the user types (`onChange`). Pressing "Done" or Enter closes the popover; the change is already committed.

**Known limitation:** The "Cancel" button currently closes the popover without reverting the already-committed change. The value remains in `content` state.

### `portal/website/preview/page.tsx` — Dead Code

This file is orphaned and never used. The editor loads the actual live client site in an iframe — it does not use this preview page. Do not reference or route to it.

---

## Client Website Architecture

Client websites are **separate Next.js projects** deployed independently on Vercel. They are not hosted through the NGF app. Each client site fetches its published content from the NGF content API.

### Content API (used by all client sites)

`GET /api/public/content?domain=<domain>` — returns the client's published `website_content.content` as flat dot-notation key-value pairs. Full CORS (`*`), no auth required.

Example response:
```json
{
  "content": {
    "hero.eyebrow": "Motorcycle Service & Repair",
    "hero.headlinePrefix": "Your Bike Deserves",
    "services.items.0.name": "Oil & Filter Service",
    "services.items.0.price": "$55 labor"
  },
  "client_id": "abc123"
}
```

Domain matching normalizes `https://`, `www.`, and trailing slashes. Returns `{ content: {} }` (not 404) when no content exists, so client sites fall through to their hardcoded defaults.

### lib/ngf.ts (in each client site)

Each client site has `lib/ngf.ts` with two exports:

**`getNgfContent(): Promise<Record<string, string>>`** — server-side fetch, called at the top of every page component. Resolves the domain from env vars in priority order: `NEXT_PUBLIC_SITE_URL` → `VERCEL_PROJECT_PRODUCTION_URL` → `localhost:3000`. The API base defaults to `https://app.ngfsystems.com` but can be overridden with `NGF_APP_URL`. Always uses `cache: 'no-store'` so pages always get the latest published content. Returns `{}` on any error — never throws.

**`getItems(content, prefix): Record<string, string>[]`** — extracts a dynamic array from flat dot-notation keys. `getItems(content, 'services.items')` scans all keys starting with `services.items.`, extracts unique integer indices, and returns an array of objects like `[{ name: '...', price: '...' }]`. Used to render repeatable sections.

**Usage pattern in page components:**
```typescript
const content = await getNgfContent()
const headline = content['hero.headline'] ?? 'Fallback text'   // scalar field
const services = getItems(content, 'services.items')           // repeatable
const display  = services.length > 0 ? services : hardcodedDefaults
```

Always provide hardcoded fallback defaults with `??` for every field — the editor may not have published content for a new client yet.

### Required env vars for client sites

```
NEXT_PUBLIC_SITE_URL       ← custom domain, e.g. wrenchtime.com (no protocol)
NGF_APP_URL                ← optional; defaults to https://app.ngfsystems.com
```

`NEXT_PUBLIC_SITE_URL` is critical — it must match exactly what is stored in `client_configs.site_url` in the NGF database. Without it, the content API domain lookup fails and the site renders only hardcoded defaults.

### CSP — required in client site next.config.ts

Client sites must allow `app.ngfsystems.com` (and optionally `*.vercel.app`) to iframe them. Without this, the portal editor's live preview is blocked by the browser:

```typescript
// next.config.ts
{
  key: 'Content-Security-Policy',
  value: "frame-ancestors 'self' https://app.ngfsystems.com https://*.vercel.app"
}
```

### NgfEditBridge (in each client site layout)

`components/NgfEditBridge.tsx` — a `'use client'` component mounted in `app/layout.tsx`. Handles all communication with the NGF portal editor when the site is loaded inside the editor's iframe.

**On mount:**
1. Injects a `<style id="ngf-edit-styles">` tag with all edit-mode CSS
2. Posts `{ type: 'ngfReady' }` to `window.parent` — editor responds with `setEditMode`

**Messages received:**
- `setEditMode { enabled }` — sets `data-ngf-edit="true|false"` on `<html>`, dismisses nav popup when disabling
- `contentUpdate { content }` — recursively walks the content object and sets `el.textContent = value` for every `[data-ngf-field="path"]` element found in the DOM

**Click interception (capture phase):**
All clicks are intercepted in capture phase (`document.addEventListener('click', handler, true)`). The handler:
1. If the click is inside the injected nav popup → passes through (popup manages itself)
2. Otherwise: calls `e.preventDefault()`, `e.stopPropagation()`, `e.stopImmediatePropagation()`
3. Walks up the DOM from `e.target` looking for `data-ngf-field`:
   - **Found** → posts `fieldClick { section, field, currentValue, elementRect }` to `window.parent`
4. If no `data-ngf-field`, walks up again looking for `<a>` or `<button>`:
   - **`<a>` with hash href** (e.g. `#services`) → scrolls to that element in-page without a popup
   - **`<a>` with real href** → shows nav popup with "→ Go to page" and "Stay on page" buttons
   - **`<button>`** → silently blocked (e.g. mobile menu toggle — opening it mid-edit doesn't make sense)

**Nav popup:** a small `<div id="ngf-nav-popup">` injected into `document.body`. Positioned near the click, clamped to viewport. "Go to page" navigates via `window.location.href`. Dismissed when clicking anywhere outside it, or when edit mode is disabled.

**Edit-mode CSS summary:**
- `[data-ngf-field]` → dashed blue outline, pointer cursor
- `[data-ngf-field]:hover` → solid blue outline, light blue tint background
- `[data-ngf-field]:empty` → `min-height: 1.2em; min-width: 60px; display: inline-block` so empty fields stay clickable
- `[data-ngf-field]:empty::before` → shows `attr(data-ngf-label)` as grey italic placeholder text
- No `pointer-events: none` on `<a>` or `<button>` — the capture-phase handler intercepts navigation instead

**`fieldClick` message payload:**
```typescript
{
  type: 'fieldClick',
  section: 'hero',           // first segment of data-ngf-field path
  field: 'headlinePrefix',   // remainder of path (may include dots for array items: "items.0.name")
  currentValue: string,      // el.textContent.trim()
  elementRect: {
    top: number, left: number, bottom: number, right: number,
    width: number, height: number
  }
}
```

`elementRect` is in the iframe's viewport coordinates. The portal editor adds its own `iframeRef.getBoundingClientRect()` offset to position the edit popover.

### Self-Describing Markup — complete attribute reference

```html
<!-- Scalar editable field — all four attributes required -->
<h1
  data-ngf-field="hero.headline"
  data-ngf-label="Headline"
  data-ngf-type="text"
  data-ngf-section="Hero"
>
  {headlineText}
</h1>

<!-- Textarea example -->
<p
  data-ngf-field="hero.description"
  data-ngf-label="Description"
  data-ngf-type="textarea"
  data-ngf-section="Hero"
>
  {description}
</p>

<!-- Repeatable array — container element, no data-ngf-field -->
<div
  data-ngf-group="services.items"
  data-ngf-item-label="Service"
  data-ngf-min-items="1"
  data-ngf-max-items="16"
  data-ngf-item-fields='[{"key":"name","label":"Service Name","type":"text"},{"key":"price","label":"Price","type":"text"}]'
>
  {services.map((svc, i) => (
    <div key={i}>
      <!-- Array item fields use numeric index in path -->
      <span data-ngf-field={`services.items.${i}.name`} data-ngf-label="Service Name" data-ngf-type="text" data-ngf-section="Services">
        {svc.name}
      </span>
    </div>
  ))}
</div>

<!-- Hidden anchor for fields with no visible element (e.g. colors) -->
<span
  data-ngf-field="brand.primaryColor"
  data-ngf-label="Primary Color"
  data-ngf-type="color"
  data-ngf-section="Brand"
  aria-hidden="true"
  className="sr-only"
/>
```

**Field type values:** `text` | `textarea` | `color` | `image` | `toggle`

**Section key rule:** always equals the first dot-segment of `data-ngf-field`. The `data-ngf-section` attribute is only used as the human-readable label in the editor sidebar — the grouping key is derived from the path.

### Adding a new client site

1. Fork `ngf-client-starter` repo, set env vars (`NEXT_PUBLIC_SITE_URL`, Clerk, Stripe as needed), customize design
2. Add `data-ngf-field`, `data-ngf-label`, `data-ngf-type`, `data-ngf-section` to every editable element
3. Add `NgfEditBridge` to `app/layout.tsx`
4. Add CSP `frame-ancestors` header in `next.config.ts`
5. Deploy to Vercel
6. In NGF admin, set `site_url` in the client's config — this is what the scraper uses to find the site
7. The portal editor auto-discovers all editable fields on next load — no NGF app changes needed

---

## Service Requests — External Database Pattern

Some clients (e.g. WrenchTime) have their own Neon databases with a `serviceRequests` table. The admin can view and update these via:
- `GET /api/admin/portal/[clientId]/service-requests` — fetches from client's external DB
- `PATCH /api/admin/portal/[clientId]/service-requests` — updates status, generates booking token, sends approval email via Resend

**`lib/client-db.ts`** — the only place in the codebase (other than `lib/db.ts`) where `PrismaClient` is instantiated. It maintains a cache of Prisma clients keyed by `database_url`. Use `getClientDb(config.database_url)` to get a client.

When a service request is approved, a `bookingToken` (32-byte hex) is generated with a 48-hour TTL, inserted into the client's DB, and the `booking_url` template (`[token]` replaced) is emailed via Resend to the requester.

---

## GA4 Analytics (`/api/admin/analytics`)

The admin dashboard includes an analytics widget powered by the Google Analytics Data API.

Required env vars:
- `GOOGLE_SERVICE_ACCOUNT_JSON` — full JSON of a GCP service account with GA4 read access
- `GA4_PROPERTY_ID` — GA4 property ID (defaults to `533573096`)

The route calls `BetaAnalyticsDataClient` from `@google-analytics/data` and returns daily metrics + top pages for a configurable day range. The widget in `components/admin/SiteAnalyticsWidget.tsx` renders the data.

---

## Key `lib/` Helpers

- **`lib/db.ts`** — single Prisma client, always import `{ db }` from here
- **`lib/portal.ts`** — `getClientConfig(clerkUserId)` — React-cached helper for portal server components; looks up client by Clerk user ID, falls back to email lookup and auto-links
- **`lib/client-last-login.ts`** — `getClientLastLoginMap(clerkUserIds[])` — batches Clerk API calls to get last sign-in timestamps for a list of users; used on the admin client detail page
- **`lib/client-db.ts`** — `getClientDb(databaseUrl)` — get/create cached Prisma client for a client's external database
- **`lib/auth.ts`** — Clerk auth helpers
- **`lib/stripe.ts`** — single Stripe client instance

---

## API Route Patterns

All API routes follow these conventions:

```typescript
// Auth check at the top — always first
const { sessionClaims } = await auth()
const role = (sessionClaims?.metadata as { role?: string })?.role
if (role !== 'admin') return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

// Consistent response shape
return NextResponse.json({ success: true, data: result })
return NextResponse.json({ success: false, error: 'Descriptive message' }, { status: 400 })
```

Public routes (under `/api/public/`) include full CORS headers and an `OPTIONS` handler. No auth required.

Portal routes use `auth()` to get `userId` and look up the client via `clerk_user_id` — never accept a client ID from the request body/params for identifying the caller.

---

## Clerk Setup

### Session Token Customization (required)
Go to **dashboard.clerk.com → Configure → Sessions → Customize session token**, add:
```json
{ "metadata": "{{user.public_metadata}}" }
```
Without this, `sessionClaims.metadata` is always `{}` and all role checks fail.

### Webhook (`/api/webhooks/clerk`)
Handles `user.created` and `user.deleted` events:
- `user.created`: sets `role: "client"` in Clerk metadata (unless role already set), then either links the Clerk user to an existing client row (matched by email) or creates a new `LEAD` client with `page_request: true` only
- `user.deleted`: unlinks `clerk_user_id` from the client row (preserves financial history)

Requires `CLERK_WEBHOOK_SECRET` env var. Verified using `svix`.

### Required `.env.local` variables
```
DATABASE_URL
DIRECT_URL
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
CLERK_SECRET_KEY
CLERK_WEBHOOK_SECRET
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/portal/portal-dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/portal/portal-request
STRIPE_SECRET_KEY
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
STRIPE_WEBHOOK_SECRET
RESEND_API_KEY
NEXT_PUBLIC_APP_DOMAIN              ← e.g. app.ngfsystems.com (used by middleware)
GOOGLE_SERVICE_ACCOUNT_JSON         ← GA4 service account credentials JSON
GA4_PROPERTY_ID                     ← GA4 numeric property ID
WEBSITE_REVALIDATION_SECRET         ← optional; pinged on client site after publish
```

---

## Absolute Rules

1. **TypeScript only.** Never `.js` files. Every file is `.ts` or `.tsx`.
2. **One Prisma instance.** Always `import { db } from '@/lib/db'`. Exception: `lib/client-db.ts` which deliberately manages additional Prisma clients for client external databases.
3. **One Stripe instance.** Always `import from '@/lib/stripe'`.
4. **Auth through Clerk only.** Never custom auth.
5. **Database calls in API routes or server components only.** Never from client components.
6. **Portal queries always filter by `client_id` at Prisma level.** Never fetch all and filter in JS.
7. **Never install new libraries** without being asked. Flag it first.
8. **Never duplicate functions.** Check if it exists before writing.
9. **Layout components must not do auth checks.** Middleware handles all auth. Layouts just wrap content.
10. **Every new Prisma schema change needs a migration.** Run `./node_modules/.bin/prisma migrate dev --name <desc>`.
11. **Portal route names must be prefixed with `portal-`** — prevents conflicts with admin route names (Next.js 15 treats same-named pages as conflicts).
12. **`no any` types** — use typed interfaces. The one exception is `lib/client-db.ts` where dynamic Prisma models require it.

---

## `next.config.js` — Current State

The config sets security headers for all routes and iframe restrictions:
- `/portal/website/preview` — embeddable from same origin only (`frame-ancestors 'self'`)
- `/portal/**` (except preview) — not embeddable at all (`frame-ancestors 'none'`)
- All routes get `X-Content-Type-Options`, `X-XSS-Protection`, `Referrer-Policy`, `Permissions-Policy`

No `experimental` or `serverActions` blocks — this was removed. The config only sets security headers and iframe restrictions.

---

## What Not To Do

- Do not use `npx prisma` — always `./node_modules/.bin/prisma`
- Do not use `@clerk/nextjs@latest` — always `@clerk/nextjs@6`
- Do not install Next.js 16+ or React 19+ or Prisma 6+
- Do not enable Turbopack under any circumstances
- Do not add auth checks in layout components — middleware handles it
- Do not call Prisma from client components
- Do not fetch all records and filter in JS — always filter at the Prisma level
- Do not name portal routes the same as admin routes — prefix portal routes with `portal-`
- Do not forget `baseUrl` and `paths` in `tsconfig.json` — without them, route group pages silently 404
- Do not expect a role change to take effect while the user is still signed in — they must re-authenticate
- Do not write inline styles — Tailwind only
- Do not create new layout components — use `AdminLayout`, `PortalLayout`, or `PublicLayout` in `/components/layout/`
- Do not hardcode field names in the website editor — the schema is derived by scraping `data-ngf-*` attributes from the live client site
- Do not host client websites through the NGF app (`/w/` routes have been removed) — every client site is a separate Vercel project
- Do not write to `website_content.content` directly from the portal — only the `/push` route promotes draft to published
- Do not add new templates to `lib/templates/` — the folder is dead code. All schema changes go in the client site HTML via `data-ngf-*` attributes
- Do not set or read `client_configs.template_id` — it is deprecated and ignored
- Do not route to `portal/website/preview/` — it is dead code. The editor loads the live site in an iframe directly
- Do not pass raw `publishedContent` to `getChangedSections` — always pass `baseContent` (the `useMemo` of `applySchemaDefaults(publishedContent, schema)`). Passing raw `publishedContent` causes phantom changes from schema defaults
- Do not add `pointer-events: none` to `<a>` or `<button>` in NgfEditBridge CSS — navigation is handled by the capture-phase click handler and the nav popup. CSS blocking causes links to appear non-interactive
- Do not omit `data-ngf-label` or `data-ngf-section` from client site elements — the scraper silently skips fields missing either attribute, so they will not appear in the editor
- Do not omit `NEXT_PUBLIC_SITE_URL` from a client site's Vercel env vars — without it the content API domain lookup fails and the site renders only hardcoded defaults
- Do not omit the CSP `frame-ancestors` header from a client site — the portal editor's live preview will be blocked by the browser

