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
  portal/website/               ← schema-driven website editor (new)
  portal/website/preview/       ← isolated iframe preview (embeddable from self only)
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

### Schema Scraper (`app/api/portal/website/route.ts`)

There is **no template system**. The `lib/templates/` folder is dead code — do not import from it or add to it.

Instead, the GET handler calls `scrapeSchemaFromSite(siteUrl)`, which:
1. Fetches the client's live site HTML
2. Regex-parses all elements with `data-ngf-field` attributes (leaf fields)
3. Regex-parses all elements with `data-ngf-group` attributes (repeatable arrays)
4. Groups fields by section (derived from the field path prefix, e.g. `hero.headline` → `hero`)
5. Returns a `SiteSchema` object used directly by the editor

If the site is unreachable, `fallbackSchema()` returns a minimal brand+hero schema so the editor never crashes.

**To add editable fields to a client site:** add `data-ngf-field`, `data-ngf-label`, `data-ngf-type`, and `data-ngf-section` attributes to elements in the client site HTML, then deploy. The editor picks them up automatically on next load — no changes needed in NGF app.

**Repeatable arrays** use a `data-ngf-group` container with `data-ngf-item-fields` JSON declaring sub-fields:
```html
<div
  data-ngf-group="services.items"
  data-ngf-item-label="Service"
  data-ngf-min-items="1"
  data-ngf-max-items="16"
  data-ngf-item-fields='[{"key":"name","label":"Service Name","type":"text"},{"key":"price","label":"Price","type":"text"}]'
>
```

**Hidden anchor pattern** — for fields that have no visible DOM element (e.g. color pickers), use an invisible `sr-only` span:
```html
<span data-ngf-field="brand.primaryColor" data-ngf-label="Primary Color" data-ngf-type="color" data-ngf-section="Brand" aria-hidden="true" className="sr-only" />
```

### Editor Data Flow

```
Client edits in portal/website → "Save Draft" button
  → POST /api/portal/website → saves to website_content.draft_content (NOT live)

Client clicks "Publish"
  → POST /api/portal/website/push → promotes draft → content, clears draft
  → optionally pings WEBSITE_REVALIDATION_SECRET endpoint on client site

Client website fetches content (no auth required):
  GET /api/public/website/by-domain/[domain]   ← domain lookup via site_url match
  GET /api/public/website/[clientId]            ← direct by client ID
```

Both public endpoints return only `content` (published) — never `draft_content`. They have full CORS headers (`*`).

### Editor vs Preview
- `app/portal/website/page.tsx` — the full editor UI (split-pane sidebar + iframe preview)
- `app/portal/website/preview/page.tsx` — isolated preview page, embeddable only from same origin (CSP `frame-ancestors 'self'`)
- Other portal pages have `frame-ancestors 'none'` — they cannot be iframed

---

## Client Website Architecture

Client websites are **separate Next.js projects** deployed independently on Vercel. They are not hosted through the NGF app. Each client site fetches its published content from the NGF content API.

### Content API (used by all client sites)
`GET /api/public/content?domain=<domain>` — returns the client's published `website_content.content` as flat dot-notation key-value pairs (e.g. `{ 'hero.eyebrow': 'Text', 'services.items.0.name': 'Oil Change' }`). Full CORS, no auth required.

### lib/ngf.ts (in each client site)
Each client site has a `lib/ngf.ts` that:
- `getNgfContent()` — fetches from `/api/public/content?domain=<domain>` using the site's own domain, returns `Record<string, string>` 
- `getItems(content, prefix)` — extracts a dynamic array from flat dot-notation (e.g. `getItems(content, 'services.items')` returns `[{name, price}, ...]`)

### NgfEditBridge (in each client site layout)
`components/NgfEditBridge.tsx` — a `'use client'` component in the layout that:
- Signals ready to the portal editor via `window.parent.postMessage({ type: 'ngfReady' }, '*')`
- Listens for `contentUpdate` messages and patches DOM elements with matching `data-ngf-field` attributes
- Enables click-to-edit by sending `fieldClick` messages when the user clicks an annotated element
- Elements are annotated: `<h1 data-ngf-field=\"hero.headline\">{headlineText}</h1>`

### Self-Describing Markup (in client sites)
Client sites define their own editable schema via `data-ngf-*` attributes on HTML elements. No template files, no template_id, no NGF app changes needed when adding a new client site or new fields. When adding a new client site:
1. Scaffold from `ngf-client-starter` repo, set env vars, customize design
2. Add `data-ngf-field`, `data-ngf-label`, `data-ngf-type`, `data-ngf-section` to every editable element
3. Deploy the client site — the portal editor auto-discovers all editable fields on next load
4. Set `site_url` in the client's config in the NGF admin (required for the scraper to find the site)

### Boilerplate
New client sites should be scaffolded from the `ngf-client-starter` repo (in the GitHub org). Fork it, set env vars, and customize design — no template ID needed.

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
