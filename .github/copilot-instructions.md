# NGFsystems — AI Rules & Project Standards

This file defines the rules, stack, and conventions for all NGFsystems projects.
All AI tools (Claude, GitHub Copilot) must follow these rules exactly.
Do not deviate from this stack. Do not install unlisted libraries without explicit approval.
When in doubt, refer back to this file before writing any code.

---

## Stack — Always Use These Exact Versions, Nothing Else

| Layer | Tool | Version |
|---|---|---|
| Framework | Next.js (App Router) | 15.x |
| Runtime | React | 18.x |
| Language | TypeScript | always, never plain JS |
| Styling | Tailwind CSS | 3.x |
| Database | Neon (PostgreSQL) | latest |
| ORM | Prisma | 5.x |
| Auth | Clerk | @clerk/nextjs latest |
| Payments | Stripe | latest |
| Deployment | Vercel | — |
| Version Control | GitHub | — |

### Critical Version Rules
- **Never install Next.js 16+** — Turbopack in Next.js 16 has a known bug with route groups that breaks the app
- **Never install React 19+** — incompatible with Next.js 15
- **Never install Prisma 6+** — breaking changes in schema syntax
- **Always use Next.js 15 with React 18** — this is the stable production combination
- **Always use Prisma 5** — stable, widely supported, uses standard schema syntax
- **Turbopack must always be disabled** — never use `--turbopack` flag or enable it in config
- **Always run Prisma via local binary** — use `./node_modules/.bin/prisma` never `npx prisma` — npx downloads Prisma 7 globally which breaks migrations

---

## Folder Structure — Every Project Follows This

```
/app
  /layout.tsx               → Root layout with ClerkProvider
  /(auth)                   → Login, signup pages (shared by admin and clients)
    /layout.tsx             → Required for route group to work
    /sign-in/page.tsx
    /sign-up/page.tsx
  /(admin)                  → Admin-only routes. Blocked if Clerk role !== "admin"
    /layout.tsx             → Required for route group to work
    /dashboard/page.tsx     → Business overview
    /clients/page.tsx       → Client list, create, manage
    /clients/[id]/page.tsx  → Individual client detail and portal config
    /leads/page.tsx         → Self-signup requests from ngfsystems.com
    /projects/page.tsx      → Project tracking
    /finances/page.tsx      → Revenue, expenses, invoices
    /contracts/page.tsx     → Contract tracking
    /time/page.tsx          → Time tracking
  /(portal)                 → Client-only routes. Blocked if Clerk role !== "client"
    /layout.tsx             → Required for route group to work
    /dashboard/page.tsx     → Client portal home
    /website/page.tsx       → Their website overview, change requests, analytics
    /content/page.tsx       → Edit website content fields (if toggled on)
    /invoices/page.tsx      → View invoices (if toggled on)
    /request/page.tsx       → Website request form (on by default for new signups)
  /unauthorized/page.tsx    → Shown when a user tries to access a route they can't
  /api
    /admin                  → Admin API routes
    /portal                 → Client portal API routes
    /webhooks               → Stripe and Clerk webhook handlers

/components
  /ui                       → Generic reusable elements (buttons, inputs, cards, modals)
  /layout                   → AdminLayout, PortalLayout, PublicLayout, all navbars, footer
  /admin                    → Admin-specific components
  /portal                   → Client portal-specific components

/lib
  /db.ts                    → Prisma client — single instance, import from here everywhere
  /auth.ts                  → Clerk auth helpers (isAdmin, isClient functions)
  /stripe.ts                → Stripe client — single instance, import from here everywhere
  /utils.ts                 → General utility functions

/prisma
  /schema.prisma            → Database schema — single source of truth for all tables

/types
  /index.ts                 → All TypeScript type definitions and interfaces

/public                     → Static assets
```

---

## Absolute Rules — Never Break These

1. **TypeScript only.** Never write `.js` files. Every file is `.ts` or `.tsx`.
2. **One Prisma instance.** Always import `{ db }` from `@/lib/db`. Never create a new PrismaClient anywhere else.
3. **One Stripe instance.** Always import from `@/lib/stripe`. Never instantiate Stripe elsewhere.
4. **Auth through Clerk only.** Never write custom authentication logic. Never store passwords manually.
5. **Never duplicate functions.** Before writing any new function, check if it already exists in the codebase.
6. **Never install new libraries** without being explicitly asked to. If a new library seems needed, flag it and ask first.
7. **Never delete or overwrite existing functions** when adding new features. Extend, don't replace.
8. **Always check existing components** before creating new ones. Reuse from `/components/ui` first.
9. **Environment variables only in `.env.local`.** Never hardcode keys, secrets, or connection strings.
10. **Database calls in API routes or server components only.** Never call Prisma from client components.
11. **Every route group folder must have a layout.tsx file.** This is required for Next.js 15 route groups to work correctly.
12. **Never enable Turbopack.** Never use `--turbopack` flag. Never set turbo options in next.config.js.

---

## Naming Conventions

| Thing | Convention | Example |
|---|---|---|
| Components | PascalCase | `ClientCard.tsx` |
| Functions | camelCase | `getClientById()` |
| Files (non-component) | kebab-case | `client-helpers.ts` |
| Database tables | snake_case | `client_configs` |
| Environment variables | SCREAMING_SNAKE_CASE | `DATABASE_URL` |
| API routes | kebab-case folders | `/api/portal/change-requests/route.ts` |
| Clerk roles | lowercase string | `"admin"`, `"client"` |

---

## Tailwind CSS — Required Setup

Every project must have these three files or Tailwind will not work:

**`tailwind.config.ts`:**
```typescript
import type { Config } from 'tailwindcss'
const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: { extend: {} },
  plugins: [],
}
export default config
```

**`postcss.config.js`:**
```javascript
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

**`app/globals.css`:**
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

**`app/layout.tsx` must import globals.css at the top:**
```typescript
import './globals.css'
```

Without all four of these in place, Tailwind classes will not render and the app will show unstyled text only.

---

## Verifying Files Were Actually Updated

After asking AI to update any file, always verify it was actually changed:
```bash
cat app/(auth)/sign-in/page.tsx
```
AI tools sometimes report success without making changes. If a file still shows placeholder content after an update, write the content directly using the terminal:
```bash
cat > app/\(auth\)/sign-in/page.tsx << 'EOF'
[file contents]
EOF
```
Use this pattern for any file that AI fails to update correctly.

---



```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  }
}
```

Never add `--turbopack` to any script. Never add environment variable prefixes to scripts.

---

## next.config.js — Always Use This Exactly

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {}

module.exports = nextConfig
```

Never add turbo configuration. Never add experimental flags unless explicitly instructed.

---

## System Architecture — Never Deviate From This

### One App, Two Sides
NGFsystems is a single Next.js application deployed on Vercel with one Neon database.
There are two completely separate experiences inside it, separated by Clerk roles.

**Admin side** (`/admin`) — accessible only to the NGFsystems owner (role: `"admin"`):
- Dashboard: business overview snapshot
- Clients: create and manage client accounts, configure their portals
- Leads: review self-signup requests from ngfsystems.com
- Projects: status and task tracking
- Finances: revenue, expenses, invoices (manual entry, no external integrations)
- Contracts: contract tracking per client
- Time Tracking: log billable hours per client and project
- Communication Log: simple notes per client

**Client side** (`/portal`) — accessible only to clients (role: `"client"`):
- Only renders pages and features the admin has toggled on in `client_configs`
- Has zero visibility into admin data or any other client's data
- Connected to that client's live website via a shared Neon database

### Role-Based Access — Always Enforced
- Every `/admin` layout and route checks `role === "admin"` first. If not admin → redirect to `/unauthorized`
- Every `/portal` layout and route checks `role === "client"` first. If not client → redirect to `/unauthorized`
- Roles are set in Clerk publicMetadata as `{ role: "admin" }` or `{ role: "client" }`
- Roles are never stored or modified in the app database
- Admin creates client accounts through the admin panel
- Clients can also self-register through ngfsystems.com

### Client Account Creation — Two Paths

**Path 1: Admin creates the account (existing or onboarded clients)**
- Admin goes to `/admin/clients/new`
- Admin sets client email, name, and creates their Clerk account
- Admin configures portal pages and features via toggle switches
- Client receives login credentials and accesses a pre-configured portal

**Path 2: Client self-signup through ngfsystems.com (inbound leads)**
- Client fills out name, email, password on the public signup page
- Clerk creates their account instantly with role `"client"`
- A `client_config` record is auto-created with only `page_request: true`
- Client is redirected to `/portal/request` — the website request form
- All other portal pages remain toggled OFF until admin enables them
- Submission appears in `/admin/leads` for admin to review and convert to active
- Admin updates client status from `LEAD` to `ACTIVE` and toggles on their portal pages

### Client Portal Configuration
Every client has a `client_config` record that controls their portal experience.
The portal reads this on every page load and renders only what is enabled.
Never hardcode what a client can or cannot see — always read from `client_configs`.

**Page toggles** (each maps to a route in `/portal`):
- `page_request` — Website request form (default: true for new signups)
- `page_website` — Website overview, change requests, analytics
- `page_content` — Edit website content fields
- `page_invoices` — View invoices

**Feature toggles** (controls features within pages):
- `feature_blog` — Blog management
- `feature_products` — Products/menu management
- `feature_booking` — Booking management
- `feature_gallery` — Gallery management

### Client Website ↔ Portal Connection
Each client's website and their portal share one Neon database.
The website reads from the database to display content to visitors.
The portal writes to the database when the client saves changes.

```
Client Portal → writes → Neon DB → read by → Client Website
```

All editable website content lives in the `site_content` table.
The admin defines which fields exist per client by adding rows to this table.
The portal renders edit controls for those fields only — nothing else.
The website fetches and displays those field values to visitors.

### Multi-Tenant Data Isolation — Critical
- Every database query on the portal side must filter by `client_id`
- Never fetch all records and filter in JavaScript — always filter at the Prisma query level
- A client must never be able to read or write another client's data
- Admin routes may access all client data — portal routes never do

---

## Database — Table Reference

All tables are defined in `/prisma/schema.prisma`. Never create tables any other way.

| Table | Purpose |
|---|---|
| `clients` | All client accounts — both admin-created and self-signup |
| `client_configs` | Portal page and feature toggles per client |
| `project_requests` | Website request form submissions from self-signup clients |
| `projects` | Project tracking per client |
| `tasks` | Tasks within a project |
| `time_entries` | Billable hours logged per client/project |
| `invoices` | Invoice tracking — fixed, hourly, or retainer |
| `expenses` | Business expense tracking (admin only, no client_id) |
| `contracts` | Contract records per client |
| `site_content` | Editable content fields for each client's live website |
| `change_requests` | Change requests submitted by clients in their portal |
| `site_analytics` | Manual analytics entries per client per reporting period |

### Key Field Reference

**`site_content` — how client websites are editable:**
- `field_key` — identifier e.g. `"hero_heading"`, `"about_text"`, `"logo_image"`
- `field_type` — `"text"`, `"richtext"`, `"image"`, `"url"`
- `field_label` — human readable label shown in the portal
- `field_value` — the actual content the client sets
- `page_section` — which section it belongs to e.g. `"homepage"`, `"about"`
- Unique constraint on `[client_id, field_key]` — one value per field per client

**`change_requests` — how clients request website changes:**
- `title` + `description` — what they want changed
- `page_section` — which page/section they're referring to
- `priority` — `LOW`, `MEDIUM`, `URGENT`
- `status` — `PENDING`, `IN_PROGRESS`, `COMPLETED`, `REJECTED`
- `image_urls` — screenshots the client uploads
- `admin_comment` — admin's response visible to the client

**`site_analytics` — manual stats admin enters per client:**
- `period_start` / `period_end` — the reporting window
- `visitors`, `page_views`, `clicks` — manually entered numbers
- `top_page` — most visited page that period
- `notes` — any additional context

**`client_configs` — portal toggle fields:**
- `page_request`, `page_website`, `page_content`, `page_invoices` — page visibility
- `feature_blog`, `feature_products`, `feature_booking`, `feature_gallery` — feature visibility
- `site_url` — the client's live website URL
- `site_repo` — their GitHub repo

### Database Rules
- All database access goes through Prisma only
- Always use the single client instance from `/lib/db.ts`
- Schema changes go in `/prisma/schema.prisma` only — never edit the database directly
- Always run Prisma using the local binary: `./node_modules/.bin/prisma migrate dev`
- Never use `npx prisma` — npx will download Prisma 7 globally and break migrations
- Always define relationships explicitly in the schema
- Always filter portal queries by `client_id` at the Prisma level

---

## Layout & Navigation Rules — Critical

### There Is One Layout Per Side — Never Create New Ones
- Admin pages use `/components/layout/AdminLayout.tsx` — includes admin navbar and sidebar
- Portal pages use `/components/layout/PortalLayout.tsx` — includes client navbar
- Public pages use `/components/layout/PublicLayout.tsx` — includes public navbar and footer
- Never manually add a navbar or footer to an individual page — the layout handles it
- Never create a new layout component — always use the existing one for that side

### Navbar Rules
- Admin navbar: `/components/layout/AdminNavbar.tsx` — one file, never recreated
- Portal navbar: `/components/layout/PortalNavbar.tsx` — one file, never recreated
- Public navbar: `/components/layout/PublicNavbar.tsx` — one file, never recreated
- To change a navbar, edit its file — the change applies everywhere automatically
- Never copy-paste navbar code into a page file

---

## Responsive Design Rules — Non-Negotiable

Mobile and desktop are equally important. Every component and page must work on all screen sizes.

- **Always mobile-first.** Write the mobile layout first, then scale up with `md:` and `lg:`
- **Never build desktop-only.** If it only works on desktop, it is not finished
- **Every component must work at:** 375px (mobile), 768px (tablet), 1280px (desktop)
- Use Tailwind responsive prefixes: `sm:` `md:` `lg:` `xl:`
- Navbars: mobile gets a hamburger/slide-out menu, desktop gets full horizontal nav
- Grids: default single column, expand on larger screens (`grid-cols-1 md:grid-cols-2 lg:grid-cols-3`)
- Touch targets (buttons, links) must be at least 44px tall on mobile
- Never use fixed pixel widths on containers — use `max-w-` with `w-full`
- Font sizes, padding, and spacing must be readable and comfortable on mobile

---

## Component Rules

- Every component must have typed props using a TypeScript interface defined at the top of the file
- No `any` types — ever
- Keep components focused — if a component does more than one thing, split it
- Use `"use client"` only when strictly necessary (event handlers, hooks, browser APIs)
- Default to server components

---

## API Route Rules

- All API routes live in `/app/api/`
- Admin API routes go in `/app/api/admin/` — check `role === "admin"` at the top
- Portal API routes go in `/app/api/portal/` — check `role === "client"` at the top
- Always validate all incoming request data before processing
- Always wrap handlers in try/catch
- Always return consistent JSON:

```typescript
// Success
return NextResponse.json({ success: true, data: result })

// Error
return NextResponse.json({ success: false, error: "Descriptive message" }, { status: 400 })
```

---

## Security Rules

- Never expose secret keys or environment variables to the client side
- All protected routes must check Clerk auth before doing anything else
- Never trust client-sent data — always validate server-side
- Use Prisma parameterized queries only — never raw SQL string concatenation
- Portal queries must always filter by the authenticated client's `client_id`
- Never return data belonging to a different client than the one authenticated

---

## Middleware — Always Use This Pattern

```typescript
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

const isPublicRoute = createRouteMatcher(['/', '/sign-in(.*)', '/sign-up(.*)', '/unauthorized'])
const isAdminRoute = createRouteMatcher(['/admin(.*)'])
const isPortalRoute = createRouteMatcher(['/portal(.*)'])

export default clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) return

  const { sessionClaims } = await auth()
  const role = (sessionClaims?.metadata as { role?: string })?.role

  if (isAdminRoute(req) && role !== 'admin') {
    return NextResponse.redirect(new URL('/unauthorized', req.url))
  }

  if (isPortalRoute(req) && role !== 'client') {
    return NextResponse.redirect(new URL('/unauthorized', req.url))
  }
})

export const config = {
  matcher: ['/((?!_next|static|favicon.ico).*)']
}
```

The middleware file must be named `middleware.ts` and live in the project root.

---

## /lib/db.ts — Always Use This Exactly

```typescript
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const db = globalForPrisma.prisma || new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
```

Always import as `import { db } from '@/lib/db'` — never use a default export.

---

## Common Commands

```bash
# Development
npm run dev                                          # Start dev server
npm run build                                        # Build for production
npm run lint                                         # Check for errors

# Database — always use local binary, never npx
./node_modules/.bin/prisma migrate dev --name [desc] # Apply schema changes
./node_modules/.bin/prisma generate                  # Regenerate Prisma client
./node_modules/.bin/prisma studio                    # Visual database browser

# Git
git checkout -b feature/[name]   # Create feature branch
git add .                         # Stage changes
git commit -m 'description'       # Commit
git push origin [branch]          # Push to GitHub
```

Always work on a feature branch. Never commit directly to main.

---

1. Check if any part of this feature already exists in the codebase
2. Check if any existing component or utility can be reused
3. Update `/prisma/schema.prisma` first if new data is needed
4. Run `npx prisma migrate dev` to apply schema changes
5. Build the API route second
6. Build the UI component last
7. Do not add new dependencies without flagging it first

---

## What To Never Do

- Do not rewrite existing working code when adding something new
- Do not create duplicate components, functions, or layouts
- Do not create a new navbar or layout — always use the existing ones in `/components/layout/`
- Do not build a page without wrapping it in the correct layout component for that side
- Do not build desktop-only — every screen size must work
- Do not use `any` in TypeScript
- Do not write inline styles — use Tailwind classes only
- Do not put business logic in UI components — keep it in `/lib` or API routes
- Do not make database calls from client components
- Do not handle authentication manually — always use Clerk
- Do not hardcode any keys, secrets, or connection strings
- Do not install new libraries without being asked to
- Do not use `npx prisma` — always use `./node_modules/.bin/prisma`
- Do not report a file as updated without actually writing the new content to it
- Do not assume Tailwind is working — always ensure tailwind.config.ts, postcss.config.js, globals.css, and the globals.css import in layout.tsx all exist
- Do not use Prisma 6+
- Do not enable Turbopack under any circumstances
- Do not add `--turbopack` to any npm script

---

*This file is the single source of truth for all NGFsystems development.*