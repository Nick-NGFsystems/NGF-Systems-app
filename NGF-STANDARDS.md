# NGFsystems — Universal Project Standards

**This is the canonical foundation document for every NGF client website.** Fork/copy from `ngf-client-starter`, follow the rules below, and any site you build will plug into the NGF portal editor on day one.

> **No client or project names appear in this file by design.** Standards are universal; concrete examples use neutral placeholders (e.g. `Acme Co`). Real per-project notes belong in that project's own `CLAUDE.md`, never here.

## Contents

- [Single source of truth](#single-source-of-truth) · [How to use this file](#how-to-use-this-file) · [How we work](#how-we-work--cowork-mode)
- [Tech stack](#tech-stack)
- [NGF Portal Editor Integration](#ngf-portal-editor-integration--the-foundation) — the foundation (required files, `lib/ngf.ts`, caching, bridge, annotation patterns, pitfalls)
- [Setup checklist for a new site](#setup-checklist-for-a-new-ngf-client-website)
- [Local development](#local-development--never-deploy-to-test)
- [SEO & analytics](#seo--analytics--required-on-every-ngf-client-site) · [Google Business Profile](#google-business-profile--per-client-local-seo-setup)
- [Database](#database--only-if-the-site-needs-its-own-data) · [Auth](#auth--only-if-the-site-needs-it) · [Security baseline](#security-baseline--required-on-every-ngf-site)
- [Design system](#design-system--universal-rules--per-client-aesthetic) · [Universal interaction patterns](#universal-interaction-patterns)
- [Absolute rules](#absolute-rules--never-break) · [Known issues / quick reference](#known-issues--quick-reference)
- [Roadmap (planned standards)](#roadmap--planned-standards-not-yet-built) · [Reference implementation](#reference-implementation) · [Workflow](#workflow--how-we-build-a-feature) · [Deployment checklist](#deployment-checklist-vercel)

## Single source of truth

**This file lives in exactly one place:**

```
NGF-Systems-app/NGF-STANDARDS.md  (main branch)
```

Served via the raw GitHub URL:
```
https://raw.githubusercontent.com/Nick-NGFsystems/NGF-Systems-app/main/NGF-STANDARDS.md
```

**No client repo carries a local copy.** Every AI session fetches the URL on startup (per the user's global `~/.claude/CLAUDE.md`). Edits happen here only — there's nothing to sync, nothing to drift. If the canonical URL is ever unreachable, that's a fail-loud condition, not a fallback opportunity.

The companion integration files — `NgfEditBridge.tsx` and `lib/ngf.ts` — have a single canonical home in the **`ngf-client-starter`** repo. Always copy the current version from there; never hand-author your own or copy from an arbitrary existing site (they drift). See "Reference implementation" near the end of this file. *(Planned: ship these as a versioned `@ngf/editor-bridge` package so sites install rather than copy — see Roadmap.)*

## How to use this file

At the start of any new NGF client-website session, paste:
> "I'm starting a new NGFsystems client website. Read NGF-STANDARDS.md and follow it exactly. The canonical integration files live in the `ngf-client-starter` repo."

Two scopes are covered here:

1. **Universal client-site standards** — apply to every NGF client website. Most of this file.
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
# Push EVERYTHING that differs from remote (use only when you're certain the
# whole working tree is clean):
python3 github-push.py <repo-name> "<commit message>"

# Push ONLY specific files (the safe default — append an explicit file list):
python3 github-push.py <repo-name> "<commit message>" path/to/file1 path/to/file2
```
The portable version of `github-push.py` resolves the repo dynamically — no hardcoded session paths, works from any Cowork session or your local machine. Credentials live in `github-push-config.json` next to the script.

**Always pass an explicit file list unless you have just verified the working tree is clean.** The no-filter form walks the entire local tree and pushes every file whose bytes differ from the remote blob — which includes (a) phantom CRLF/LF churn on files nobody edited, (b) other people's uncommitted in-progress work sitting in the tree, and (c) any stray non-code files in the repo (a misplaced `.docx`, `.xlsx`, `.env` backup, etc. — the script's ignore list is only `.git`, `node_modules`, `.next`, `.vercel`, `.env`, `.env.local`). Listing the exact files you changed makes the commit reviewable and keeps unrelated noise — and secrets — out of the repo. This isn't hypothetical: a blanket push from a dirty tree has swept in line-ending churn across 20+ files and personal documents before.

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
    // Cache the content fetch and revalidate on a 60s window so we don't hit
    // Neon on every request. On publish, the NGF push handler pings this site's
    // /api/revalidate, which calls revalidatePath('/', 'layout') to bust the
    // cache instantly. NEVER use cache: 'no-store' — see "Content caching & revalidation".
    const res = await fetch(url, { next: { revalidate: 60, tags: ['ngf-content'] } })
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

### Content caching & revalidation — required

**Never ship `cache: 'no-store'` in `getNgfContent()`.** Every uncached SSR render hits the NGF content API, which hits Neon. For content that changes maybe once a week, that burns Neon compute on every single pageview. The standard is time-based ISR plus instant cache-busting on publish — two layers that combine to give both freshness and near-zero database load.

**Layer 1 — tagged, revalidating fetch** (already baked into the canonical `lib/ngf.ts` above):

```typescript
const res = await fetch(url, { next: { revalidate: 60, tags: ['ngf-content'] } })
```

Pages serve from cache and refresh at most once per 60 seconds. Neon sees roughly one request per minute per page instead of one per visitor.

**Layer 2 — `/api/revalidate` endpoint on every client site** — busts the cache the instant a client clicks "Push to Website" so they never wait out the 60s window to see their own change:

```typescript
// app/api/revalidate/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get('secret') !== process.env.WEBSITE_REVALIDATION_SECRET) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }
  // Version-agnostic: revalidatePath('/', 'layout') busts every page under the
  // root layout, so all pages calling getNgfContent() rebuild on next request.
  revalidatePath('/', 'layout')
  return NextResponse.json({ ok: true, revalidated: true })
}
```

> **Why `revalidatePath('/', 'layout')` and not `revalidateTag`?** The tagged fetch in `lib/ngf.ts` still tags content `'ngf-content'`, but `revalidateTag`'s signature has shifted across Next versions (newer Next expects a second argument), so a bare `revalidateTag('ngf-content')` can silently no-op or throw depending on the version a site is on. `revalidatePath('/', 'layout')` is stable across Next 14/15/16 and busts exactly the pages that read NGF content. Use it as the default.

**Shared secret** — set `WEBSITE_REVALIDATION_SECRET` on the client site's Vercel project to the **same value** as `WEBSITE_REVALIDATION_SECRET` on the NGF main app. The NGF push handler (`app/api/portal/website/push/route.ts`) reads its own copy and calls `https://<site_url>/api/revalidate?secret=<secret>` on every publish. Mismatched secrets → the endpoint 401s and the site falls back to the 60s window (still correct, just not instant).

**How the two layers combine:**

| Scenario | What happens |
|---|---|
| Client publishes via portal | Push handler pings `/api/revalidate` → `revalidatePath('/', 'layout')` → next request rebuilds from fresh content. Sub-second. |
| `WEBSITE_REVALIDATION_SECRET` unset or mismatched | No ping (or 401). Content still refreshes within 60s via ISR. |
| Normal visitor traffic | Served from the ISR cache. Neon hit at most once per 60s per page. |

This is the single highest-leverage change for Neon cost: a busy client site drops from one Neon query per pageview to one per minute per page.

**Migrating an existing site off `cache: 'no-store'`:** update its `lib/ngf.ts` fetch to the tagged/revalidating form above, add `app/api/revalidate/route.ts`, set `WEBSITE_REVALIDATION_SECRET` in Vercel, redeploy. No portal-side change needed — the push handler already pings every site that has a `site_url` set.

### `components/NgfEditBridge.tsx` — copy verbatim from the canonical starter

The bridge is a moving target — its postMessage contract changes when the editor adds new features (image fields, repeatable group reorder, etc.). **Always copy the latest from the single canonical source:**
- [`ngf-client-starter/components/NgfEditBridge.tsx`](https://github.com/Nick-NGFsystems/ngf-client-starter)

**Do not write a new bridge from scratch, and do not copy it from an arbitrary existing client site** — copies drift, and a stale bridge silently breaks edit-mode behaviors. When the editor's contract changes, the starter's bridge is the one place that gets updated; every site then re-copies from it. The bridge contract is documented in the NGF main app `CLAUDE.md`. *(Planned: distribute the bridge as a versioned `@ngf/editor-bridge` package so sites pin a version instead of copying — see Roadmap.)*

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
WEBSITE_REVALIDATION_SECRET
                       # Shared secret — set to the SAME value as on the NGF main
                       # app. Lets the portal's "Push to Website" bust this site's
                       # content cache instantly via /api/revalidate. If unset, the
                       # site still refreshes within 60s via ISR (see Content
                       # caching & revalidation).
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

Add `data-ngf-aspect` to lock the editor's upload cropper to a specific ratio — the client's uploaded photo is cropped to match this ratio before it ever reaches the server. Also use the `<field>_alt` convention for editable alt text so clients can describe their images for SEO and accessibility.

```tsx
<img
  src={content['hero.image'] || '/hero-default.jpg'}
  alt={content['hero.image_alt'] || 'Hero background'}
  data-ngf-field="hero.image"
  data-ngf-label="Hero Background Image"
  data-ngf-type="image"
  data-ngf-section="Hero"
  data-ngf-aspect="16:9"
  className="absolute inset-0 h-full w-full object-cover"
/>
```

**What `data-ngf-aspect` does:**

- The schema scraper picks up the aspect on every image field that has it.
- The editor's upload cropper locks to that aspect ratio — the client can pan and zoom but can't break the design by uploading a square photo into a wide hero slot.
- Format is `"W:H"` — common values: `"16:9"` (hero / banner), `"1:1"` (avatar / square card), `"3:2"` (most photos), `"4:5"` (Instagram portrait), `"2:1"` (banner).
- Omit the attribute entirely for free-form cropping (the cropper still appears, but the ratio is unlocked).

**What the `<field>_alt` convention does:**

- The editor's image-field popover always shows an alt-text input alongside the URL/upload controls.
- Whatever the client types is stored as a companion field at the same path with `_alt` appended.
- The client site reads it via `content['hero.image_alt'] || 'fallback alt'`.
- No extra annotation needed — the convention is implicit. Just use `_alt` in your fallback lookup and the editor handles the rest.
- For repeatable items: `content['team.members.0.image_alt']`, `content['team.members.1.image_alt']`, etc.

**Editor UX for image fields:**

In edit mode, the bridge automatically renders overlay controls on every annotated image (>40-60px depending on control). No client action or annotation required — this is built into `NgfEditBridge.tsx`. Three controls in total:

1. **Replace photo button** (top-right, dark, ~all images >40px) — opens the upload popover with cropper + alt text input. Available on every annotated image, not just gallery items.

2. **Delete X button** (top-left, red, only images >60px AND inside a `[data-ngf-group]`) — confirms then sends `removeGroupItem` to the editor, which removes the card. Available only on images that live in a repeatable group, since standalone images (hero, logo) have no concept of "remove."

3. **Drag-to-reorder** (cursor grab on the image itself, only images inside a `[data-ngf-group]`) — desktop drag-and-drop. Dragged image shows dimmed dashed outline, drop targets in the same group show a bold blue ring. Drop on another image in the same group → posts `moveGroupItem` to the editor. Mobile/touch: HTML5 drag doesn't fire — use the sidebar arrows instead.

All three controls reposition on scroll/resize via requestAnimationFrame so they stay glued to their images. Removed automatically when edit mode is disabled or when a card containing the image is removed. Together they solve the "managing 10-30 photos in one place is painful" problem from a client's perspective — they can replace, remove, or reorder every photo directly on the live preview without scrolling the sidebar.

Sites get the new behavior automatically when their bridge is brought up to the canonical version (currently ~40 KB, lives at `ngf-client-starter/components/NgfEditBridge.tsx`).

**Server-side image optimization (automatic):**

Every uploaded raster image (JPEG / PNG / WebP) goes through a Sharp pipeline before storage:

- Auto-rotated by EXIF (fixes sideways phone photos)
- Resized so neither side exceeds 1920px
- Converted to WebP at quality 85
- EXIF metadata stripped (smaller files, privacy)

A client uploads a 12 MB iPhone photo; the live site stores a ~250 KB WebP. SVG and animated GIF pass through unchanged. The 25 MB upload limit is generous because optimization handles the size problem on the server side.

**Recommended aspect ratios by image type:**

| Image type | Recommended aspect |
|---|---|
| Full-bleed hero / banner | `16:9` or `21:9` |
| Avatar / team photo | `1:1` |
| Service card thumbnail | `3:2` or `4:3` |
| Project portfolio item | `3:2` |
| Logo (don't bother — usually doesn't need cropping) | omit attribute |
| Floor plan diagram | `4:3` |

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
  data-ngf-item-fields='[{"key":"image","label":"Photo","type":"image","aspect":"1:1"},{"key":"name","label":"Name","type":"text"},{"key":"price","label":"Price","type":"text"}]'
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

#### Large galleries (10+ photos in one place)

For project portfolios, property listing photo sets, before-and-after collections, or any "lots of photos in one container" pattern, use the same repeatable-group annotation system above with three adjustments.

**Hard requirements — without these, in-preview delete and drag-reorder will silently no-op:**

- **Group path must be exactly two segments deep** (e.g. `gallery.items`, `properties.photos`, `project.gallery`). The editor's removeGroupItem/moveGroupItem functions expect `section.arrayKey` shape — nested-deeper paths like `projects.0.gallery` are not supported and the X / drag controls will fail silently. If you need a per-project gallery, use a flat naming convention like `projectAGallery.items`, `projectBGallery.items`.
- **The container element MUST carry `data-ngf-group="<section>.<array>"`** with that exact 2-segment path. Without the wrapper, the bridge's `getGroupContext()` returns null and individual photos can be edited but NOT deleted or reordered.
- **Each photo's `data-ngf-field` MUST follow the indexed pattern** `<section>.<array>.<i>.<subfield>` — e.g. `gallery.items.0.image`, `gallery.items.1.image`. Anything else and the index parsing fails.

1. **Bump `data-ngf-max-items`** to reflect realistic ceiling (50 or 100 for galleries)
2. **Keep item-fields minimal** — usually just `{key: "image", type: "image", aspect: "..."}` plus optional caption. Don't add unnecessary fields per photo; each extra sub-field doubles the sidebar height per item.
3. **Wrap the rendered grid in `<PhotoProvider>`** from `react-photo-view` (see "Universal interaction patterns") so visitors can click any photo to open a fullscreen swipeable lightbox.

**Annotation pattern:**

```tsx
import { PhotoProvider, PhotoView } from 'react-photo-view'

<section>
  <PhotoProvider>
    <div
      data-ngf-group="project.gallery"
      data-ngf-item-label="Photo"
      data-ngf-min-items="0"
      data-ngf-max-items="50"
      data-ngf-item-fields='[{"key":"image","label":"Photo","type":"image","aspect":"3:2"},{"key":"caption","label":"Caption (optional)","type":"text"}]'
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
    >
      {photos.map((p, i) => (
        <PhotoView
          key={i}
          src={content[`project.gallery.${i}.image`] || p.fallbackSrc}
        >
          <img
            src={content[`project.gallery.${i}.image`] || p.fallbackSrc}
            alt={content[`project.gallery.${i}.image_alt`] || p.alt}
            data-ngf-field={`project.gallery.${i}.image`}
            data-ngf-label="Photo"
            data-ngf-type="image"
            data-ngf-section="Project Gallery"
            data-ngf-aspect="3:2"
            className="w-full h-auto object-cover rounded-lg cursor-zoom-in"
          />
        </PhotoView>
      ))}
    </div>
  </PhotoProvider>
</section>
```

**What the client gets, in plain language:**

- **Visitors** see a tidy grid; click any photo → fullscreen modal with prev/next arrows, swipe on mobile, pinch-zoom, and pan. Captions display below each image if you've set them.
- **Clients editing** see every photo with the permanent "Replace photo" overlay button. Click on any individual photo in the live preview → cropper opens → upload replacement → alt text inline → done. They never have to scroll the sidebar to swap a photo.
- **Adding a new photo:** sidebar "+ Add Photo" button at the bottom of the gallery group adds an empty slot. Then click it in the preview or sidebar to upload.
- **Reordering:** sidebar has ↑↓ arrows on each card.
- **Deleting:** × button on each card in the sidebar.

**What's polished today** (all built into the bridge — no per-site work):

- **Replace any photo** by clicking the dark "Replace photo" button in its top-right corner
- **Delete any photo** in the gallery by clicking the red X in its top-left corner — confirms, then removes the card and re-indexes the rest
- **Reorder photos** by dragging one image onto another within the same gallery — the dragged image dims, the drop target gets a blue ring, drop swaps in the new order

**Remaining UX rough edge at 30+ photos:**

- One photo upload at a time — no bulk drag-and-drop-30-files-at-once (yet)

That's tolerable for "swap a few photos occasionally" workflows. It gets painful for "upload an entire 30-photo gallery from scratch in one session." The first time a client actually hits this wall, build bulk multi-file upload. Until then, set client expectations: "to add many photos at once, expect to do it one at a time — takes maybe a minute per photo."

**Mobile note:** drag-to-reorder uses the HTML5 drag API which doesn't fire on touchscreens. Mobile clients can still replace and delete photos directly, but for reordering they need to use the sidebar's ↑↓ arrows. Future work: add long-press-and-drag handlers for touch.

**Things to avoid in large gallery annotations:**

- **Don't add captions as a required field** unless they're genuinely needed — most clients won't fill them in and the empty captions clutter the design. Mark them optional and only render if non-empty.
- **Don't omit `data-ngf-aspect`** — without it, clients upload portrait phone photos into landscape grid slots and the layout breaks. Lock the aspect to match the design.
- **Don't use `next/image` with `fill`** — same rule as everywhere else; bridge can't read/write through the wrapper. Plain `<img>`.
- **Don't annotate the `<PhotoView>` wrapper** — annotate only the `<img>` inside it. The bridge needs the actual image element for src updates.
- **Don't nest the group path deeper than 2 segments** — `project.gallery` works, `projects.0.gallery` will silently break the delete + drag controls.

**Image sizing in the grid — get this right or the editor experience suffers:**

Galleries that look fine on the public site can become hard to manage in the editor when image sizes are extreme in either direction. The editor renders the gallery at the same size the live site does (it's an iframe of the live site).

- **Too small** (e.g. 5+ columns on desktop, 60×60px thumbnails): the X delete button and Replace photo button get cramped, the drag-target highlight is barely visible, and clients squint to identify which photo is which.
- **Too large** (e.g. 1 column on desktop, full-viewport images): clients have to scroll the iframe constantly to reach later photos, making reorder via drag tedious because the target may be off-screen.

**Recommended sizing:**

```tsx
<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
  {photos.map((p, i) => (
    <div key={i} className="aspect-[3/2]">
      <img
        src={...}
        className="w-full h-full object-cover rounded-lg cursor-zoom-in"
        data-ngf-field={`gallery.items.${i}.image`}
        ...
      />
    </div>
  ))}
</div>
```

Key points: 2 columns on mobile (large enough to manage), 3-4 columns on desktop (enough to see ~12 photos in viewport without scrolling), explicit `aspect-[3/2]` (or whatever the `data-ngf-aspect` is — they MUST match), `object-cover` so images fill their slot uniformly. Tile size lands around 200-300px wide on desktop which is the sweet spot for the X and Replace buttons to fit comfortably.

### Critical content-rendering rules

1. **Always use `||`, never `??` for fallbacks.** Published content can include explicit `''`. `??` only catches `null`/`undefined`, so an empty value would render an empty element instead of falling through to the hardcoded default.
2. **Always provide a hardcoded fallback.** New clients have no published content — the site needs to render correctly from `lib/site-data.ts` (or wherever you keep defaults) before the first publish.
3. **Use plain `<img>` for image fields.** `next/image` with `fill` wraps the real img element so the bridge can't read or write `src`.
4. **Don't omit `data-ngf-label` or `data-ngf-section`.** The scraper silently skips elements missing either, and they won't appear in the editor sidebar.
5. **`data-ngf-section` is the human-readable label.** The grouping key is always derived from the first dot-segment of `data-ngf-field` (e.g. `hero.headline` → section key `hero`, regardless of what `data-ngf-section` says).
6. **One canonical content path per unique piece of data — never duplicate paths.** When the same logical content appears in multiple places (business name in header AND footer, phone number in nav AND contact page, etc.), every instance MUST read from the same `data-ngf-field` path and the same `content['…']` lookup. This is the single most common cause of "I edited it but only some places updated" complaints.

   **Right:**
   ```tsx
   // Top of page.tsx — single source of truth for repeated values
   const businessName = content['brand.businessName'] || 'Acme Co'
   const phone        = content['brand.phone']        || '(555) 555-0123'

   // Header
   <h1 data-ngf-field="brand.businessName" data-ngf-label="Business Name" data-ngf-type="text" data-ngf-section="Brand">
     {businessName}
   </h1>

   // Footer — SAME path, SAME constant
   <p data-ngf-field="brand.businessName" data-ngf-label="Business Name" data-ngf-type="text" data-ngf-section="Brand">
     {businessName}
   </p>
   ```

   **Wrong (creates two separate fields in the editor that don't sync):**
   ```tsx
   // Header
   <h1 data-ngf-field="brand.businessName">{content['brand.businessName'] || 'Acme Co'}</h1>
   // Footer — DIFFERENT path
   <p data-ngf-field="footer.businessName">{content['footer.businessName'] || 'Acme Co'}</p>
   ```

   Three rules of thumb:
   - One canonical path per unique piece of data. Business name is always `brand.businessName`, phone is always `brand.phone`, address is always `brand.address`. Never `footer.phone` or `contact.phone`.
   - Derive a constant once per page (`const businessName = content[...] || 'fallback'`) and reuse it everywhere the data appears.
   - Annotate every instance with the same `data-ngf-field` value. The bridge updates all matching elements in the live preview (via `querySelectorAll`), and the editor's schema scraper dedupes them to one sidebar entry. Edits in one place sync to every instance.

### Annotation pitfalls — patterns that break the editor

These are real bugs we've debugged in production sites. Each one looks plausible at first but breaks something in the editor. Avoid them.

#### One DOM element per field path. No responsive twins.

Don't render the same field as two elements with different responsive visibility, both annotated:

```tsx
// ❌ BREAKS — bridge stacks both in edit mode, el.textContent reads both
<button>
  <span className="md:hidden" data-ngf-field="nav.cta" ...>Connect</span>
  <span className="hidden md:inline" data-ngf-field="nav.cta" ...>Let's connect!</span>
</button>

// ❌ ALSO BREAKS — annotation on wrapper, two text spans inside →
// el.textContent concatenates "ConnectLet's connect!" into the cached default
<a data-ngf-field="nav.cta" ...>
  <span className="md:hidden">Connect</span>
  <span className="hidden md:inline">Let's connect!</span>
</a>

// ✅ CORRECT — one element, one annotation, one label that works at all breakpoints
<a data-ngf-field="nav.cta" ...>{ctaLabel}</a>
```

If a label genuinely needs to differ between breakpoints, render only the longer one and trust CSS truncation. Do not annotate two variants.

#### Don't spread `data-ngf-*` props onto multiple elements

```tsx
// ❌ BREAKS — same field annotated on both <p> elements, bridge reads
// the first one (the truncated mobile version) as the field value
<p className="md:hidden line-clamp-3" {...editorProps}>{shortBio}</p>
<p className="hidden md:block" {...editorProps}>{fullBio}</p>

// ✅ CORRECT — annotate only the canonical (full-text) element
<p className="md:hidden line-clamp-3">{shortBio}</p>
<p className="hidden md:block" {...editorProps}>{fullBio}</p>
```

`{...editorProps}` is convenient but easy to over-spread. Search the codebase for any helper that bundles `data-ngf-*` attributes and verify it's only applied to one DOM node per field path.

#### `data-ngf-group` goes on ONE container, not both responsive layouts

```tsx
// ❌ BREAKS — scraper finds two "process.steps" group declarations →
// editor sidebar shows two duplicate "Process Steps" sections
<div data-ngf-group="process.steps" className="hidden md:grid">...desktop cards...</div>
<div data-ngf-group="process.steps" className="md:hidden">...mobile cards...</div>

// ✅ CORRECT — declare the group ONCE (on the desktop container).
// Individual `data-ngf-field="process.steps.0.title"` annotations on
// mobile card text ARE fine — the bridge dedupes by path and updates
// all matching elements on contentUpdate, keeping mobile + desktop in sync.
<div data-ngf-group="process.steps" data-ngf-item-fields='[...]' className="hidden md:grid">...</div>
<div className="md:hidden">...mobile cards with field annotations only...</div>
```

The leaf scraper dedupes individual field annotations (first occurrence wins). The group scraper does not — every `data-ngf-group` declaration becomes a separate sidebar entry.

#### Annotate the container or one of its descendants — never both

If a wrapper has `data-ngf-field` AND a child also has `data-ngf-field` for the same path, the bridge gets confused about which one to read/write. Annotate at exactly one level.

#### Edit-mode cosmetic differences are normal

The bridge force-reveals containers hidden via `opacity-0`, `pointer-events-none`, `aria-expanded="false"`, etc. when they contain `data-ngf-field` elements — so dropdowns, accordions, and modal panels become editable without site-specific code.

Side effect: anything with state-dependent styling (e.g. a button that squares off when a dropdown below it opens) will look slightly different in the editor preview than on the live site. **This is cosmetic only.** Published content is unaffected. Don't try to fix it on the client site unless you find a way to do it via `[data-ngf-edit="true"]` selectors that gracefully degrade.

#### `el.textContent` reads ALL descendants, including hidden ones

When the bridge caches the default value of an annotated element on mount, it walks the entire subtree. So an annotated `<a>` containing two visually-hidden `<span>` children with text will cache "TextOneTextTwo" as the default. Same applies to image fields — only the annotated `<img>` itself is read for `src`. Keep annotations on leaf-ish nodes; if you must annotate a wrapper, make sure it has only one text-bearing descendant.

---

## Setup checklist for a new NGF client website

1. [ ] **Fork** [`ngf-client-starter`](https://github.com/Nick-NGFsystems/ngf-client-starter) — the canonical source for all integration files
2. [ ] **`lib/ngf.ts`** — copy verbatim from `ngf-client-starter` (also reproduced in this doc)
3. [ ] **`components/NgfEditBridge.tsx`** — copy verbatim from `ngf-client-starter`
4. [ ] **`app/layout.tsx`** — mount `<NgfEditBridge />`, call `getNgfContent()` once, thread `content` through any layout components
5. [ ] **`next.config.{js,ts}`** — add the CSP `frame-ancestors` header
6. [ ] **`app/api/revalidate/route.ts`** — copy from "Content caching & revalidation" so publishes bust the cache instantly
7. [ ] **`vercel.json`** — add the `ignoreCommand` so docs-only commits don't burn build credit (see "Vercel build cost discipline")
8. [ ] **Annotate every page** — wrap each editable element with all four `data-ngf-*` attributes (text, textarea, color, image) and use `data-ngf-group` on every list of cards
9. [ ] **Always `||`, never `??`** for fallbacks
10. [ ] **Vercel env vars** — `NEXT_PUBLIC_SITE_URL` (custom domain or vercel.app), optional `NGF_APP_URL`, `WEBSITE_REVALIDATION_SECRET` (same value as the NGF main app), plus your own (DB, Resend, Clerk if used)
11. [ ] **Deploy to Vercel** — one project per client site
12. [ ] **NGF admin** — set the client's `site_url` in `client_configs` to match `NEXT_PUBLIC_SITE_URL` exactly. The portal editor scrapes the schema on next load.
13. [ ] **Verify in editor** — open the client portal, switch to Manage Sections, confirm all your annotated fields show up in the sidebar with real preview text
14. [ ] **SEO launch gate** — run the full SEO checklist (SEO & analytics § 8). This is a **hard blocker** — do not flip a site live until every box is checked.

---

## Local development — never deploy to test

The default for every change is **run it locally first.** Don't push speculative work to test on Vercel — it costs build credit and is slower than `npm run dev`.

### `npm run dev` — for 90% of changes

```bash
cd <repo>
npm install            # one time
npm run dev            # opens http://localhost:3000
```

Hot reload picks up file saves in 1–2 seconds. Edit, save, alt-tab to the browser, see the result. Zero deploys.

### `.env.local` setup

Each repo needs a `.env.local` (gitignored) that mirrors the relevant Vercel env vars. For client sites the minimum is:

```
NEXT_PUBLIC_SITE_URL=https://yourcustomdomain.com
NGF_APP_URL=https://app.ngfsystems.com
```

`NEXT_PUBLIC_SITE_URL` should match `client_configs.site_url` in the NGF database — that way `getNgfContent()` running locally hits the production NGF portal and your local dev shows live published content. To pull every Vercel env var into `.env.local` in one command:

```bash
npx vercel link        # one time per repo — connects to the Vercel project
npx vercel env pull    # writes .env.local from Vercel
```

### `vercel dev` — when you need parity with production

For sites with serverless functions, edge middleware, or Vercel-specific behavior you can't reproduce with `npm run dev`:

```bash
npx vercel dev         # runs with the full Vercel stack on localhost
```

Slightly slower startup but identical to production runtime.

### Testing the NGF portal editor integration locally

Editor work is the one case where pure localhost gets in the way — the portal at `app.ngfsystems.com` needs to load your site in an iframe, which means the local dev server has to be reachable from the public internet. Two options:

**A. Tunnel localhost (free, recommended).** Cloudflared works without an account:

```bash
# one time:
winget install --id Cloudflare.cloudflared
# every dev session:
npm run dev                                       # one terminal
cloudflared tunnel --url http://localhost:3000    # another terminal
# prints a public URL like https://random-words.trycloudflare.com
```

In NGF admin, temporarily set the client's `site_url` to the tunnel URL, open the editor, do your work. Set `site_url` back when done. Hot reload still works through the tunnel.

**B. Skip the editor for visual changes.** If you're iterating on text, layout, or styling — none of that needs the editor in the loop. Open `http://localhost:3000` directly and verify there. Only spin up a tunnel when the change is to bridge behavior, annotation patterns, or anything iframe-specific.

### Type-checking without a build

```bash
npx tsc --noEmit
```

Catches every TypeScript error a Vercel build would catch, in 5–10 seconds. Run before pushing if you've made changes that touch types — saves a failed Vercel build.

### Batching commits

Lots of small changes don't need lots of small deploys. Iterate locally with `npm run dev` over an hour, then push the whole batch via the standard NGF push script:

```bash
python3 github-push.py <repo-name> "feat: redesign hero + new project cards"
```

The script handles staging, committing, and pushing in one call — uses the GitHub Git Data API with the PAT in `github-push-config.json`. See your global `~/.claude/CLAUDE.md` for the canonical command.

If you want to clean up a series of WIP commits before pushing, the standard `git` flow still works locally:

```bash
git reset --soft HEAD~5      # undoes the last 5 commits, keeps changes staged
# now run the push script with one clean commit message:
python3 github-push.py <repo-name> "feat: real summary"
```

### What never to do

- **Don't `vercel --prod` from the CLI** unless you mean to deploy straight to production. Plain `vercel deploy` creates a preview URL but still uses build credit. Push-via-Git is the standard path.
- **Don't push speculative debug commits to test on Vercel.** Reproduce locally; only push when the change is real.
- **Don't ship a feature without running it locally at least once** — the build can pass and the runtime can still throw. `npm run dev` catches things `npx tsc --noEmit` won't.

### Vercel build cost discipline — every repo gets a `vercel.json` ignoreCommand

Every Vercel build burns build-minute credit. A repo with no ignore rule rebuilds on *every* push — including commits that only touch the README, docs, or other files that can't affect the deployed site. Ship a `vercel.json` with an `ignoreCommand` on day one so Vercel skips builds it doesn't need.

**Minimum — skip docs-only commits.** Create `scripts/vercel-skip-docs.sh`:

```bash
#!/usr/bin/env bash
# Vercel inverts the usual convention: exit 0 = SKIP build, exit 1 = BUILD.
# Build only if something OTHER than markdown/docs changed.
if git diff --quiet HEAD^ HEAD -- . ':(exclude)*.md' ':(exclude)docs/**'; then
  echo "Only docs/markdown changed — skipping build."
  exit 0
fi
echo "Source changed — building."
exit 1
```

Wire it up in `vercel.json`:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "ignoreCommand": "bash scripts/vercel-skip-docs.sh"
}
```

This is exactly what the NGF main app runs — copy it verbatim into every new client repo.

**Inline one-liner alternative** if you'd rather not add a script file:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "ignoreCommand": "git diff --quiet HEAD^ HEAD -- . ':(exclude)*.md'"
}
```

**Notes:**

- The exit-code convention is backwards from intuition: **exit 0 skips the build, exit 1 runs it.** Get this wrong and you either never deploy or never skip.
- On the first deploy there's no `HEAD^`; Vercel builds anyway. The ignore logic only kicks in on later commits.
- `ignoreCommand` is the right tool for *"skip builds that can't matter."* It is NOT the tool for *"this repo should never auto-deploy at all"* — for that, turn off the Git integration's production/preview deploys in the Vercel project settings (Settings → Git → Ignored Build Step / connected branch). Don't try to permanently disable deploys with an always-skip ignoreCommand.

---

## SEO & analytics — required on every NGF client site

Every client site ships with the same baseline: page metadata, a sitemap, a robots file, structured data for the business, and Google Analytics 4. This is the difference between a site that can be found in Google and one that can't, so it's not optional — it's part of the standard build.

The patterns below are universal. Drop them into any new site verbatim and customize per client.

### 1. Page metadata — every page

Next.js App Router uses the `metadata` export for SEO tags. The root `app/layout.tsx` sets defaults; individual pages override per-page.

```typescript
// app/layout.tsx — root defaults
import type { Metadata } from 'next'

export const metadata: Metadata = {
  metadataBase: new URL(`https://${process.env.NEXT_PUBLIC_SITE_URL ?? 'example.com'}`),
  title: {
    default: 'Client Business Name — Tagline',
    template: '%s · Client Business Name',
  },
  description: 'One-sentence description of what the business does and where.',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    siteName: 'Client Business Name',
    images: ['/og-image.jpg'], // 1200x630 in /public
  },
  twitter: { card: 'summary_large_image' },
  robots: { index: true, follow: true },
}
```

```typescript
// app/services/page.tsx — per-page overrides
export const metadata: Metadata = {
  title: 'Services',
  description: 'What we do, in detail. Mention the key service + the location.',
}
```

### 2. Sitemap — `app/sitemap.ts`

Next.js auto-routes this to `/sitemap.xml`. Update the routes array whenever a new page is added.

```typescript
// app/sitemap.ts
import type { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const base = `https://${process.env.NEXT_PUBLIC_SITE_URL ?? 'example.com'}`
  const now = new Date()

  return [
    { url: `${base}/`,         lastModified: now, changeFrequency: 'weekly',  priority: 1.0 },
    { url: `${base}/services`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/about`,    lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/contact`,  lastModified: now, changeFrequency: 'yearly',  priority: 0.5 },
  ]
}
```

### 3. Robots — `app/robots.ts`

```typescript
// app/robots.ts
import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const base = `https://${process.env.NEXT_PUBLIC_SITE_URL ?? 'example.com'}`
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/api/', '/admin/'] },
    sitemap: `${base}/sitemap.xml`,
  }
}
```

### 4. Structured data — JSON-LD `LocalBusiness`

This is the single highest-ROI SEO action for local businesses. Feeds the Google Maps panel and "near me" search results. Drop it in the root layout's `<body>` so every page emits it.

```tsx
// components/StructuredData.tsx
export default function StructuredData() {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',         // or 'HomeAndConstructionBusiness', 'AutoRepair', etc.
    name: 'Client Business Name',
    url: `https://${process.env.NEXT_PUBLIC_SITE_URL ?? 'example.com'}`,
    telephone: '+1-555-555-5555',
    address: {
      '@type': 'PostalAddress',
      streetAddress: '123 Main St',
      addressLocality: 'City',
      addressRegion: 'ST',
      postalCode: '12345',
      addressCountry: 'US',
    },
    openingHoursSpecification: [
      { '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Monday','Tuesday','Wednesday','Thursday','Friday'],
        opens: '08:00', closes: '17:00' },
    ],
    priceRange: '$$',
    image: `https://${process.env.NEXT_PUBLIC_SITE_URL}/og-image.jpg`,
  }
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}
```

Mount in `app/layout.tsx`:
```tsx
<body>
  <StructuredData />
  {/* rest of layout */}
</body>
```

Pick the `@type` that matches the client. Common ones: `LocalBusiness` (generic), `HomeAndConstructionBusiness` (builders), `AutoRepair` (mechanics), `Restaurant`, `Dentist`, `RealEstateAgent`. Full list at schema.org/docs/full.html.

### 4b. Expanding structured data — Service, Review, FAQ

`LocalBusiness` is the floor, not the ceiling. Layer these on when they match what the client actually offers — each one feeds a different rich-result surface in Google.

**`Service`** — one per core service. Helps the site rank for "<service> near <city>" queries:

```tsx
const serviceData = {
  '@context': 'https://schema.org',
  '@type': 'Service',
  serviceType: 'Primary Service Category',
  provider: { '@type': 'LocalBusiness', name: 'Acme Co' },
  areaServed: { '@type': 'City', name: 'City Name' },
  hasOfferCatalog: {
    '@type': 'OfferCatalog',
    name: 'Services',
    itemListElement: [
      { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Service One' } },
      { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Service Two' } },
    ],
  },
}
```

**`AggregateRating` / `Review`** — **only when the client has real, verifiable reviews.** Google penalizes fabricated review markup, and self-serving `Review` on `LocalBusiness` is against their guidelines unless it's genuine third-party review data. When legitimate, it pulls star ratings into the snippet. Nest into the `LocalBusiness` object:

```tsx
aggregateRating: {
  '@type': 'AggregateRating',
  ratingValue: '4.9',
  reviewCount: '127',
},
```

**`FAQPage`** — if the site has an FAQ section, mark it up so Google can show expandable Q&A directly in results. One `FAQPage` per page that has an FAQ.

**Validate before launch.** Paste the live URL into the [Rich Results Test](https://search.google.com/test/rich-results), confirm zero errors and that the expected types are detected. This is part of the SEO launch gate below.

**Auto-generation from `client_configs` (roadmap — not yet built).** Business name, address, phone, hours, service list, and review count already live in the NGF database per client. The high-leverage build is a single `<StructuredData client={config} />` component that reads the client's config and emits the correct `@type` + `Service` + `AggregateRating` JSON-LD automatically — so a new site gets complete, accurate structured data with zero hand-authoring and no NAP drift. Until that ships, hand-author per the patterns above. Tracked under "Roadmap — planned standards."

### 5. Google Analytics 4 — `gtag`

Each client gets their own GA4 property. The measurement ID is exposed as `NEXT_PUBLIC_GA_ID` so the client-side gtag snippet can read it.

```tsx
// components/GoogleAnalytics.tsx
import Script from 'next/script'

export default function GoogleAnalytics() {
  const id = process.env.NEXT_PUBLIC_GA_ID
  if (!id) return null

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${id}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">{`
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', '${id}');
      `}</Script>
    </>
  )
}
```

Mount in `app/layout.tsx`:
```tsx
<body>
  <GoogleAnalytics />
  <StructuredData />
  {/* rest of layout */}
</body>
```

### 6. Required env vars (per client site)

Add to the site's Vercel env vars (Production + Preview both):

```
NEXT_PUBLIC_SITE_URL=client-domain.com
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX
```

`NEXT_PUBLIC_SITE_URL` was already required for the editor integration. `NEXT_PUBLIC_GA_ID` is the GA4 measurement ID (starts with `G-`).

### 7. Per-client GA4 setup — what the NGF operator does once per site

**Inside Google Analytics:**
1. Admin → Create Property (one per client)
2. Add a Web data stream pointing at the client's domain → copy the **measurement ID** (`G-...`) → paste into the client site's `NEXT_PUBLIC_GA_ID` Vercel env var
3. Admin → Property Access Management → grant the NGF service account email **Viewer** role (the email comes from `GOOGLE_SERVICE_ACCOUNT_JSON` in the NGF main app — check the `client_email` field of that JSON)
4. Copy the **numeric property ID** (Admin → Property Settings → Property ID, looks like `533573096`)

**Inside the NGF admin portal (`app.ngfsystems.com/admin/clients/<id>`):**
5. Paste the numeric property ID into the **GA4 Property ID** field under Website Connections → Save Links

That's it. The client now sees their own site analytics in their portal dashboard at `app.ngfsystems.com/portal/portal-dashboard`. They never touch GA4 directly.

### 8. SEO launch gate — hard blocker for every new site

**This checklist is a launch gate, not a nice-to-have.** Do not flip a new client site live — do not tell the client it's launched — until every box is checked. A site that's invisible to Google is a site that doesn't do its job, and retrofitting SEO after launch means lost indexing time. Treat any unchecked box as a release blocker.

- [ ] `app/layout.tsx` has root `metadata` with title template, description, openGraph, twitter
- [ ] At least the homepage, services, about, contact have per-page `metadata.title` + `description`
- [ ] `app/sitemap.ts` exists and lists every public page
- [ ] `app/robots.ts` exists and points to the sitemap
- [ ] `<StructuredData />` is mounted in root layout with the correct `@type` for the business
- [ ] Structured data passes the [Rich Results Test](https://search.google.com/test/rich-results) with zero errors
- [ ] `<GoogleAnalytics />` is mounted in root layout
- [ ] `/public/og-image.jpg` exists (1200×630, brand-consistent)
- [ ] `/public/favicon.ico` + `/public/icon.png` (Next 16 picks these up automatically)
- [ ] `NEXT_PUBLIC_SITE_URL` and `NEXT_PUBLIC_GA_ID` set in Vercel env vars
- [ ] GA4 property ID stored in NGF admin portal (so the client sees metrics in their dashboard)
- [ ] **Google Search Console:** property added + domain verified (DNS TXT record at the registrar, or the HTML-tag method via a `metadata.verification.google` entry in the root layout)
- [ ] **Google Search Console:** sitemap URL submitted once after deploy
- [ ] NAP (name / address / phone) on the site is byte-identical to the client's Google Business Profile (see Google Business Profile section)

---

## Google Business Profile — per-client local SEO setup

Separate from the website but arguably higher-impact for a local business than anything on the site itself. The Google Business Profile (GBP) is what populates the Maps pin, the right-side knowledge panel, and the "near me" / local-pack results. A claimed, complete, active GBP routinely out-pulls on-site SEO for local intent. Treat it as a standard deliverable on every client launch.

**This is a one-time-per-client setup done in the [Google Business Profile dashboard](https://business.google.com) — not code.** But it's part of what NGF delivers, so the standard lives here.

### Setup workflow

1. **Claim or create** the profile. If one already exists (Google auto-generates them for many businesses), **claim it — don't create a duplicate.** Duplicate profiles split signals and hurt ranking.
2. **Verify** — Google sends a postcard, phone, or email code depending on the business type. Postcard verification can take several days, so **start this early in the engagement**, not at launch.
3. **Complete every field** — Google rewards completeness:
   - Exact business name (must match the website + NAP everywhere — see below)
   - Primary category + relevant secondary categories (**category choice is a major ranking factor** — pick the most specific accurate primary)
   - Address, or a defined service area for businesses without a storefront
   - Phone + website URL (point it at the client's live NGF site)
   - Hours, including holiday hours
   - Services / products with descriptions
   - Business description (up to 750 chars — keyword-aware but natural)
4. **Photos** — logo, cover, interior/exterior, team, work samples. Profiles with photos get materially more calls and direction requests. Reuse assets from `_NGF\Clients\<Client>\Assets\`.
5. **NAP consistency** — Name, Address, Phone must be **byte-identical** across the GBP, the website footer/contact page, the `LocalBusiness` JSON-LD, and any directory listing. Inconsistent NAP is one of the most common local-SEO killers. The site's canonical `brand.businessName` / `brand.phone` / `brand.address` fields must match the GBP exactly.
6. **Link the website** — set the GBP website field to the live NGF domain so profile clicks flow into the client's GA4.

### Ongoing (set client expectations up front)

- **Reviews are the single biggest ongoing GBP ranking lever.** Encourage the client to ask happy customers for Google reviews and to respond to every one. Only add `AggregateRating` JSON-LD to the site once those reviews are real and live on the profile.
- **Google Posts** (offers, updates, events) — optional, but active profiles rank better.
- **Keep hours and photos current** — stale profiles decay in the rankings.

### Where it fits in the launch

Because verification can lag the website by days, **kick off GBP at the start of the engagement, not the end.** The website can go live without it; the GBP just needs to be in-flight. Add "GBP claimed + verification started" to the client onboarding checklist.

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

## Security baseline — required on every NGF site

Every NGF site (client marketing site or main app) ships with the same baseline. None of these are optional. The reference implementation is `NGF-Systems-app/next.config.js` — copy from there.

### 1. Security headers in `next.config.{js,ts}`

```js
async headers() {
  return [{
    source: '/(.*)',
    headers: [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-XSS-Protection', value: '1; mode=block' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      {
        key: 'Content-Security-Policy',
        value: [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.clerk.com https://*.clerk.accounts.dev https://js.stripe.com https://www.googletagmanager.com",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: blob: https:",
          "font-src 'self' data:",
          "connect-src 'self' https://*.clerk.com https://*.clerk.accounts.dev https://api.stripe.com https://www.google-analytics.com https://*.googletagmanager.com https://*.vercel-storage.com https://*.public.blob.vercel-storage.com https://app.ngfsystems.com",
          "frame-src 'self' https://*.stripe.com https://challenges.cloudflare.com",
          "object-src 'none'",
          "base-uri 'self'",
          "form-action 'self'",
        ].join('; '),
      },
    ],
  }]
}
```

The `connect-src` entry for `https://app.ngfsystems.com` is what allows client sites to fetch published content from the NGF content API — without it, the editor integration breaks.

`'unsafe-inline'` and `'unsafe-eval'` are required by Clerk and Next.js runtime chunks. Tightening to nonce-based CSP is a future hardening pass.

**Clerk custom Frontend API domain — required carve-out.** When a site uses a production Clerk publishable key (`pk_live_…`), Clerk routes its Frontend API through a custom subdomain on the user's own domain — typically `clerk.<your-app-domain>` (for the NGF main app: `clerk.app.ngfsystems.com`). The publishable key encodes this domain in base64 — decode the part after `pk_live_` to find it. Both `script-src` AND `connect-src` AND `frame-src` MUST include this custom domain or sign-in fails with silent CSP-blocked requests. The `*.clerk.com` and `*.clerk.accounts.dev` allowances DON'T cover the custom domain. Symptoms: sign-in page loads but submission stalls, console fills with `Refused to load the script 'https://clerk.<your-domain>/...'` errors. Each NGF site with its own Clerk instance has a different custom domain — derive it from the site's publishable key and add to CSP at setup time.

### 2. The portal-editor frame-ancestors carve-out

Client sites still need this header (it's on TOP of the global CSP — multiple CSP headers are intersected by the browser):

```js
{
  key: 'Content-Security-Policy',
  value: "frame-ancestors 'self' https://app.ngfsystems.com https://*.vercel.app",
}
```

Without it, the portal editor's live preview iframe is blocked. Already covered in the editor-integration section above.

### 3. Server-side input validation on every state-changing endpoint

API routes that accept POST/PATCH/PUT bodies MUST sanitize the payload before persisting. Three rules:

1. **Validate root shape.** Reject with 400 if the body isn't the expected type (object vs array, etc.).
2. **Strip non-conforming fields.** Don't persist arbitrary keys — accept only the structure the client legitimately sends.
3. **Cap payload size.** A hard upper bound (e.g. 250 KB serialized) prevents DB bloat from abusive payloads.

Reference: the `sanitizeContent` helper in `NGF-Systems-app/app/api/portal/website/route.ts`.

### 4. Prototype-pollution defense

Strip dangerous keys (`__proto__`, `constructor`, `prototype`) at every depth when accepting JSON from clients. One liner:

```ts
const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype'])
// in any object iteration:
if (DANGEROUS_KEYS.has(key)) continue
```

### 5. SSRF guard on any server-side `fetch()` of a user-influenced URL

The schema scraper, image proxies, webhook callbacks, anything that fetches a URL someone else can set — must reject:

- Non-`http(s)` protocols
- `localhost`, `0.0.0.0`, `::1`
- Private IPv4 ranges (`127.`, `10.`, `192.168.`, `169.254.`, `172.16.0.0/12`)
- Private IPv6 (`fc::/7`, `fe80::/10`)

The `169.254.169.254` carve-out matters specifically — that's the AWS/GCP cloud metadata endpoint, the textbook SSRF target. Reference: the `isSafeScrapeUrl` helper in `NGF-Systems-app/app/api/portal/website/route.ts`.

### 6. Identity from session, not from input

Already in the Auth section above, but worth restating: never trust a `client_id` (or `user_id`, `account_id`, etc.) from the request body, query string, or URL params for authorization decisions. Always resolve from the authenticated session token. Even on `/api/*` routes — middleware role checks only protect page paths, not API paths.

### 7. Webhook signature verification

Stripe webhooks: `stripe.webhooks.constructEvent(rawBody, signature, secret)`. Clerk webhooks: `svix` library with `CLERK_WEBHOOK_SECRET`. Never trust webhook bodies without verification — anyone with the URL can POST to them.

### 8. Env vars never in the bundle

`NEXT_PUBLIC_` prefix means the value ships in the JS bundle, accessible to anyone. Use this for genuinely-public values only (Clerk publishable key, GA4 measurement ID, site URL). Secrets — Stripe secret key, Resend API key, service-account JSON, database URLs — must NOT have the `NEXT_PUBLIC_` prefix.

### 9. Periodic third-party audit

Run a security audit (manual or AI-driven) on each site at least once per major feature release. Confirm: CSP is intact, no secrets in bundles, all POSTs validate input, no admin routes are reachable as a client.

---

## Design system — universal rules + per-client aesthetic

Each client site has its own visual identity — colors, typography, density, theme — driven by the brand the client already has. **Do NOT default every new site to a particular look.** Before designing anything, ask the user what direction this client wants, or look at existing client materials (logo, existing site, brand guide) for cues. Two illustrative archetypes (deliberately opposite, to show the range):
- **A builder / professional-services site** — light theme, a single deep brand color, serif headings, soft shadows on white cards
- **A trade / industrial site** — bright accent pair, dark slate panels, technical/condensed typography

Both follow the universal rules below. Neither is "the NGF look" — there is no NGF house style.

### Universal rules — apply to every client site regardless of aesthetic

- **Tailwind utility classes for all styling.** Brand colors and spacing tokens live in `app/globals.css` as CSS custom properties; consume them via Tailwind's arbitrary-value syntax: `text-[var(--text)]`, `bg-[var(--bg)]`, `border-[var(--line)]`. Two narrow exceptions where `style={{ … }}` is acceptable: (a) when the value is genuinely dynamic from a JS expression — e.g. `style={{ backgroundColor: brandColor }}` where `brandColor` is a prop; (b) when targeting a CSS property Tailwind doesn't have a utility for (rare). Never write a separate CSS file for component-level styling.
- **Pick one theme and commit** — light or dark, then use it everywhere. Don't mix dark and light in the same site. We've shipped this regression: homepage light, intake/booking dark — confusing and an obvious tell.
- **Mobile-first responsive** — write the mobile layout, scale up with `md:` and `lg:`. Every page must work at 375 px / 768 px / 1280 px.
- **44 px minimum touch targets** on mobile.
- **Generous whitespace** — most sites we ship err toward dense; tighten if the brief calls for it but the default is breathing room.
- **No "AI-looking" filler** — heavy gradients, purple-everywhere, generic stock photography, neon glow effects. Specific brand directions can override (a gym site might want neon), but never reach for these as defaults.
- **TypeScript interfaces for all component props** — no `any`.
- **Default to server components** — `'use client'` only when strictly necessary (event handlers, hooks, browser APIs).

### When the client hasn't given a direction

Ask first. If you genuinely have to make a call without input, the safest default is light theme + a single brand-matched accent color + soft cards (`shadow-sm rounded-xl border border-gray-100`) + system-ui sans serif. Refined and uncontroversial. But this is a fallback for "we don't have a brief yet," not "the NGF house style." Any real client deserves a real direction.

---

## Universal interaction patterns

Behaviors that should feel identical across every NGF client site so a visitor who learns one site implicitly knows them all. Every NGF site implements these the same way using the same library — no custom variants, no per-site reinventions.

### Image modal — click to zoom, drag to pan, gallery navigation

Whenever an image on an NGF client site is openable — gallery cards, hero slideshows, property photo grids, floor plan diagrams, team photos, before/after sets — it MUST open in a standard NGF image modal with these guaranteed behaviors:

- **Click/tap the image** → opens full-screen modal with dimmed backdrop (~85% black)
- **Image starts fit-to-viewport** with even padding on all sides
- **Click the open image** → zoom toggle (fit ↔ natural / ~2× size). Mouse wheel zooms further on desktop; pinch zooms on mobile.
- **When zoomed, drag to pan** — mouse drag on desktop, finger drag on mobile
- **Close via four methods, all equivalent**: × button (top-right), ESC key, click on backdrop, swipe-down on mobile
- **Body scroll locked** while open, scroll position restored exactly on close
- **Focus trapped** when open, focus returned to the trigger image on close
- **For galleries** (two or more images in one `<PhotoProvider>`): arrow keys / on-screen arrows / mobile swipe navigate prev↔next, loops at the ends, counter shown ("3 / 12")
- **Captions optional per-image** — opt in by passing an `overlay` prop, omit otherwise
- **Smooth ~250 ms transitions** for open, zoom, navigation

**Implementation: `react-photo-view`**

```bash
npm install react-photo-view
```

Import the CSS once globally, then use the component anywhere:

```tsx
// app/layout.tsx
import 'react-photo-view/dist/react-photo-view.css'
```

**Single image** — wrap with one `<PhotoProvider>` and one `<PhotoView>`:

```tsx
import { PhotoProvider, PhotoView } from 'react-photo-view'

<PhotoProvider>
  <PhotoView src="/floorplans/bayside-full.jpg">
    <img
      src="/floorplans/bayside-thumb.jpg"
      alt="The Bayside floor plan"
      className="cursor-zoom-in"
    />
  </PhotoView>
</PhotoProvider>
```

**Gallery** — multiple `<PhotoView>` inside ONE `<PhotoProvider>` makes them browseable as a set:

```tsx
<PhotoProvider>
  {properties.map((p) => (
    <PhotoView key={p.id} src={p.fullImage}>
      <img
        src={p.thumbnail}
        alt={p.name}
        className="cursor-zoom-in"
      />
    </PhotoView>
  ))}
</PhotoProvider>
```

**Caption** — opt in per image via the `overlay` prop:

```tsx
<PhotoView
  src={fp.fullImage}
  overlay={
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-4 py-1.5 text-sm text-white backdrop-blur-sm">
      {fp.name} — {fp.squareFeet} sq ft · {fp.bedrooms}BR · {fp.baths}BA
    </div>
  }
>
  <img src={fp.thumbnail} alt={fp.name} className="cursor-zoom-in" />
</PhotoView>
```

**Required rules:**

1. **One `<PhotoProvider>` per gallery context.** All `<PhotoView>` inside the same provider become a navigable set. Putting them in different providers makes them disconnected single-image lightboxes — usually NOT what you want for gallery grids.
2. **Always add `cursor-zoom-in`** (Tailwind utility) to the trigger `<img>`. Visual affordance that the image is interactive.
3. **Use plain `<img>` for triggers, not `next/image`.** Same rule as for `data-ngf-field` image annotations — the bridge and the modal both need direct DOM access.
4. **Pass a separate high-res `src` to `<PhotoView>` and a smaller `src` to the trigger `<img>`** when image weight matters. The thumbnail loads on page render, the high-res only loads when the modal opens.
5. **Never build a custom lightbox or image modal.** This is the standard for every NGF site, no exceptions. Consistency across sites matters more than per-site customization.

**Per-client styling overrides:**

Default styles look professional out of the box. Per-client tweaks belong in `app/globals.css` and should be limited to color/accent — never restructure the modal layout, scroll behavior, or close affordances, because those are the cross-site standard:

```css
/* Optional — match modal chrome to client brand */
.PhotoView-Slider__ArrowLeft,
.PhotoView-Slider__ArrowRight,
.PhotoView-Slider__Counter { color: var(--accent); }
```

**When to apply this pattern** (case-by-case checklist):

- ✅ Floor plan diagrams, property photo galleries, before/after construction shots
- ✅ Team member photos, especially if there's an "about" page bio worth showing larger
- ✅ Service galleries (auto detailing before/after, completed builds, project portfolios)
- ✅ Any image where a visitor's natural instinct is "I want to see that bigger"
- ❌ Pure decorative background images, icon-sized photos in nav, logos, hero photos that fill the viewport already
- ❌ Anything inside the portal editor (the editor has its own iframe-based preview)

---

## Absolute rules — never break

These apply to **every** project, client site or main app.

1. TypeScript only — never `.js` files
2. Tailwind utility classes for all styling — never write a separate component CSS file. CSS custom properties from `globals.css` are consumed via Tailwind arbitrary-value syntax (`bg-[var(--bg)]`, `text-[var(--text)]`). Inline `style={{ … }}` is permitted only for genuinely dynamic values from JS (e.g. a prop-driven color). See the "Universal rules" in the Design system section for full detail.
3. `any` is forbidden — use proper interfaces
4. Never duplicate components, functions, or layouts — check if it exists first
5. Never hardcode keys, secrets, or connection strings — use env vars
6. Never report a file as updated without verifying the write (`cat` it back)
7. Mobile-first responsive — every page works at 375 / 768 / 1280
8. Never ship a feature without testing the unhappy paths
9. Never push without running `npm run build` or `npx tsc --noEmit` first
10. Never build a custom image modal / lightbox. Use the `react-photo-view` pattern from "Universal interaction patterns." Every NGF site uses the same library — visitors should feel the same interaction across sites.

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
| Bridge version mismatch | The bridge file in this repo is older than the editor expects. Re-copy `NgfEditBridge.tsx` from `ngf-client-starter` (the canonical source) |
| Newly-added card looks like a duplicate of the last card | Bridge clones the last child as a template, then resets text to placeholders + image to a grey "Click to set image" SVG. If your site uses non-standard markup the reset may be incomplete; check the bridge's `addGroupItem` handler |
| Custom domain renders only hardcoded defaults | `NEXT_PUBLIC_SITE_URL` Vercel env var doesn't match `client_configs.site_url` exactly (case, www, trailing slash matter) |
| `<select><option>` editing | Not supported by the bridge — native browser UI. Use `data-ngf-field` for the label only |
| Hydration mismatch with `data-ngf-edit` attribute | The bridge sets `data-ngf-edit` on `<html>` only when the parent is the portal iframe. Don't set it server-side |
| Clerk v7 JWT format broken | Pin `@clerk/nextjs@6` |
| Role not appearing in sessionClaims | Customize Clerk session token (see Auth section) |
| Role change not working | User must sign out and back in |
| Prisma pulling v7 | Use `./node_modules/.bin/prisma`, never `npx prisma` |
| Editor sidebar shows TWO entries for the same section | `data-ngf-group` declared on both desktop and mobile responsive containers. Declare once on the desktop container, leave individual item field annotations on both layouts (those dedupe correctly) |
| Nav button text reads as "ConnectLet's connect!" or similar concatenation | Two responsive twin spans both annotated, OR one annotation on a wrapper that contains hidden-text descendants. `el.textContent` walks the full subtree. Consolidate to one DOM element per field path |
| Editor preview button/dropdown styling looks slightly off | Bridge force-reveals hidden state-dependent containers (`opacity-0`, `aria-expanded="false"`, etc.) so they're editable. State-dependent CSS (e.g. dropdown-open border-radius changes) doesn't fire because no real state change occurred. Cosmetic only — published site is unaffected |
| Image upload button returns "Blob storage is not configured" | Vercel Blob token not provisioned. Vercel → ngf-systems-app → Storage → Create Blob → set access **Public** (not Private — image URLs need to be readable from public client sites) → Connect Project → redeploy |
| Pending change appears after just clicking a field with no edits | Old version of the editor's EditPopover. The Cancel/× handler used to write `preEditValue` back unconditionally; current version tracks a dirty flag and skips the write when nothing changed. Pull latest |
| Phantom modifications in `git status` after AI edit session | CRLF/LF line-ending mismatch from Cowork mount writes. Diff every line as `-`/`+` with identical content. Either commit them as a one-time noise commit or `git checkout -- <files>` to discard |
| Sign-in page stalls after CSP added | Clerk uses a custom subdomain (`clerk.<your-domain>`) for its Frontend API on production keys. CSP must explicitly list it in `script-src`, `connect-src`, AND `frame-src` — `*.clerk.com` does NOT cover it. Decode the publishable key (base64 part after `pk_live_`) to find the domain |
| Image gallery feels custom or inconsistent across NGF sites | Don't build a custom lightbox. Use the `react-photo-view` pattern documented under "Universal interaction patterns" — every NGF site uses the same library and the same wrap-with-PhotoProvider pattern |
| Published content takes up to 60s to appear on the live site | The site is caching correctly (`next: { revalidate: 60 }`) but the instant cache-bust isn't firing. Confirm `app/api/revalidate/route.ts` exists on the client site AND `WEBSITE_REVALIDATION_SECRET` matches the value on the NGF main app. With a matched secret, publishes appear sub-second; without it, you fall back to the 60s window |
| `/api/revalidate` returns 401 when the portal publishes | `WEBSITE_REVALIDATION_SECRET` on the client site doesn't match the NGF main app's value (or isn't set). Set both to the same secret and redeploy the client site |
| Neon CU-hours climbing fast for no obvious reason | A client site is still on `cache: 'no-store'` in `getNgfContent()` — every visitor pageview hits Neon. Migrate it to the tagged/revalidating fetch (see "Content caching & revalidation") |
| Vercel rebuilds on every commit including README/docs edits | Missing or misconfigured `vercel.json` `ignoreCommand`. Add the docs-skip script (see "Vercel build cost discipline"). Remember the inverted convention: exit 0 skips, exit 1 builds |

---

## Roadmap — planned standards (not yet built)

Items here are **agreed direction but not yet implemented.** Don't treat them as current standards — they're captured so that when they're built, they're built consistently across every repo. When an item ships, promote it up into the body of this doc and delete it from here.

### Blog / articles in the portal editor

**Goal:** let clients publish blog posts / articles from the NGF portal the same way they edit page content today — no developer in the loop. Blogging is a strong local-SEO lever (fresh, keyword-rich, internally-linked content) and a natural upsell on the $120/mo plan.

**Intended architecture (consistent with the existing editor model):**

- **Storage:** a new `Article` model in the NGF main-app Prisma schema, keyed by `client_id` — `title`, `slug`, `excerpt`, `body` (rich text / MDX-ish), `cover_image`, `status` (draft/published), `published_at`, `seo_title`, `seo_description`. Version-snapshot on publish like `websiteContentVersion`.
- **Public API:** extend the public content API with `/api/public/articles?domain=…` (list) and `…/articles/<slug>` (single), using the same domain-resolution as `getNgfContent()`.
- **Client-site rendering:** `/blog` index + `/blog/[slug]` detail pages, fetched with the same tagged/revalidating cache (`next: { revalidate: 60, tags: ['ngf-content'] }`) and busted by the same `/api/revalidate` on publish. Each article page emits `Article` + `BreadcrumbList` JSON-LD and its own per-page `metadata`.
- **Editor UX:** a "Blog" surface in the portal — list of posts, create/edit with a rich-text editor, draft vs. publish, cover-image upload through the existing Sharp pipeline. Reuse the publish → push → revalidate flow already in place.
- **Sitemap:** the client `app/sitemap.ts` must pull published article slugs so new posts get indexed.

**Why it's a product build, not just a doc change:** it needs a schema migration, new API routes, a new editor surface, and client-site templates. Scope it as its own project. When shipped, promote this into a "## Blog" section near SEO and add `Article` to the structured-data section.

### Auto-generated structured data from `client_configs`

A `<StructuredData client={config} />` component that emits complete `LocalBusiness` + `Service` + `AggregateRating` JSON-LD from the client's NGF config, replacing hand-authored markup and eliminating NAP drift. Detailed under SEO & analytics § "4b. Expanding structured data."

### Package the editor integration as `@ngf/editor-bridge`

**Goal:** eliminate the copy-verbatim fragility for `NgfEditBridge.tsx` + `lib/ngf.ts`. Today every site hand-copies these from `ngf-client-starter`, so a contract change means re-copying into N repos, and stale copies silently break edit-mode behaviors.

**Intended shape:** publish the bridge, `lib/ngf.ts`, and the CSP/revalidate boilerplate as a versioned package (private npm registry or a git-tagged dependency). Sites `npm install @ngf/editor-bridge@^x` and import — pinning a version instead of copying source. The bridge keeps a `BRIDGE_VERSION` constant the editor can read so the portal can warn when a site is on an incompatible version. Until this ships, `ngf-client-starter` is the single canonical copy-from source.

---

## Reference implementation

There is exactly one canonical reference, kept current as the editor evolves:

- **[`ngf-client-starter`](https://github.com/Nick-NGFsystems/ngf-client-starter)** — the canonical client-site reference. Holds the authoritative `NgfEditBridge.tsx`, `lib/ngf.ts`, CSP/`next.config`, `app/api/revalidate/route.ts`, `vercel.json`, and fully-annotated example sections covering every field type and pattern in this doc. **Copy integration files from here, never from a live client site** (client copies drift). When the editor contract changes, this is the one repo that gets updated first.
- **[`NGF-Systems-app`](https://github.com/Nick-NGFsystems/NGF-Systems-app)** — the admin portal itself. Read its [`CLAUDE.md`](https://github.com/Nick-NGFsystems/NGF-Systems-app/blob/main/CLAUDE.md) when integrating new editor features (full bridge + scraper architecture, security invariants, version history).

Individual client sites are **not** reference material — anything project-specific lives in that project's own `CLAUDE.md`, never in this universal standard.

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
9. **Commit + push** in one call via `python3 github-push.py <repo-name> "<commit message>"` — the script handles staging, commits with the descriptive message you pass (use `feat:` / `fix:` / `docs:` prefixes), and pushes via the GitHub Git Data API. Vercel auto-deploys (or skips, per the `vercel.json` ignore rules)

---

## Deployment checklist (Vercel)

Before deploying any new NGF client site:

- [ ] Framework Preset: **Next.js** (Vercel usually detects)
- [ ] Env vars set: `NEXT_PUBLIC_SITE_URL` matches NGF database, `NEXT_PUBLIC_GA_ID`, `WEBSITE_REVALIDATION_SECRET` (same value as NGF main app), plus whatever else the site needs (DB, Resend, Clerk)
- [ ] `vercel.json` with `ignoreCommand` committed (docs-only commits skip the build)
- [ ] `app/api/revalidate/route.ts` present (publishes bust the content cache instantly)
- [ ] CSP `frame-ancestors` header in `next.config`
- [ ] Custom domain DNS records configured at the registrar
- [ ] After first successful deploy: in NGF admin → Clients → set this client's `site_url` to match
- [ ] Open the client's portal editor — verify all annotated fields appear in the sidebar with real preview text
- [ ] SEO launch gate passed (SEO & analytics § 8) — **hard blocker, do not flip live without it**

For the NGF main app additionally:
- [ ] Clerk production instance has session token customized + domain verified
- [ ] All Clerk + Stripe + Resend + Neon env vars added to Production / Preview / Development
- [ ] Vercel Blob store provisioned and `BLOB_READ_WRITE_TOKEN` available (image uploads from the editor need this)
