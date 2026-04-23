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
| `website_content_versions` | Snapshot-per-publish history; powers one-click revert. Capped at 20 per client |
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
- `site_url` — client's live website domain (e.g. `wrenchtime.com`, no protocol). **When this value changes, the config PATCH handler auto-snapshots the current `website_content` into the version history with a labeled note ("Snapshot from X before switching to Y") and then clears `content` / `draft_content` / `schema_json`** so the next editor session starts fresh against the new site's scraped schema — prevents field values from the old site bleeding into the new one. Duplicates are allowed (one client rotating through multiple test domains is a legitimate workflow) but surfaced as an informational red banner on `/admin/portal`. The public content API resolves any duplicates deterministically by `published_at DESC, updated DESC`.
- `site_repo` — GitHub repo slug
- `database_url` — external Neon DB URL for clients who have their own database (service requests)
- `booking_url` — URL template with `[token]` placeholder used when approving service requests
- `template_id` — **deprecated, unused.** Schema is now auto-detected by scraping the live site. Do not set or read this field.

### `website_content` — the editor's data store
- `client_id` — unique per client
- `content` (JSON) — published content; what the live website reads
- `draft_content` (JSON | null) — saved but unpublished; cleared on publish
- `schema_json` (JSON | null) — per-client schema override; null → DEFAULT_SCHEMA is used
- `published_at` — timestamp of last publish
- `versions` — cascade-deleted relation to `website_content_versions`

### `website_content_versions` — revert history
- Written once per successful Publish inside `/api/portal/website/push`
- Kept to a rolling 20 per client; older entries pruned immediately after each new snapshot
- On revert, a fresh snapshot of the current content is written first (note: "Auto-snapshot before revert") so the revert itself is undoable

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
      (UNFILTERED — bridge treats '' as "restore default", so reverts repaint
       without an iframe reload)
  → scheduleSave(content) debounced 800ms → POST /api/portal/website
      (stripEmpty filters out '' entries before persisting so the DB doesn't
       accumulate empty-string noise from applySchemaDefaults)
      → saves to website_content.draft_content (never touches published content)
      → sets hasDraft = true

User clicks "Publish Changes"
  → POST /api/portal/website (force-saves current content as draft)
  → POST /api/portal/website/push
      → promotes draft_content → content, sets published_at, clears draft_content
      → snapshots into website_content_versions, prunes to 20 most recent
      → optionally pings WEBSITE_REVALIDATION_SECRET on client site (non-fatal)
  → editor sets publishedContent = content, hasDraft = false, reloads iframe after 1.2s

User clicks × on a pending change (section, field, or Discard all)
  → flushSaveOrClear(next) — cancels the debounced save, then either:
      - stripEmpty(next) === stripEmpty(baseContent)
          → DELETE /api/portal/website → draft_content = null, has_draft = false
      - otherwise
          → POST /api/portal/website with the remaining draft immediately
  (Route all revert paths through flushSaveOrClear — scheduleSave's
   debounce otherwise loses the revert on refresh.)

User clicks "Revert" on a history entry
  → POST /api/portal/website/versions { versionId }
      → auto-snapshots current content first (undoable)
      → promotes target version to website_content.content
      → clears draft_content
  → editor location.reload()s to resync state

Client website fetches content (no auth, full CORS):
  GET /api/public/content?domain=<domain>   ← matches client by site_url, returns flat dot-notation
```

The public content endpoint returns only published `content` — never `draft_content`. Response shape: `{ content: { 'hero.headline': 'text', 'services.items.0.name': 'text', ... } }`.

### postMessage Protocol (editor ↔ client site iframe)

| Direction | Message type | Payload | Purpose |
|---|---|---|---|
| Site → Editor | `ngfReady` | — | Bridge loaded; editor responds with `setEditMode` |
| Editor → Site | `setEditMode` | `{ enabled: boolean }` | Activates/deactivates edit-mode CSS and click interception |
| Editor → Site | `contentUpdate` | `{ content: ContentBlock }` | Patches DOM elements; bridge walks the nested object. For each `[data-ngf-field]`, **empty string restores the server-rendered default** (cached in `el.dataset.ngfDefault` on load). Text fields write `el.textContent`; image fields (see below) write `el.setAttribute('src', …)` |
| Editor → Site | `scrollToField` | `{ path: 'section.field' }` | Scrolls the target field into view and flashes a blue highlight pulse (`ngf-field-focus` class, 1.6s). Used by the clickable pending-change rows |
| Editor → Site | `addGroupItem` | `{ group: 'section.arrayKey', newIndex: number }` | Clones the group container's last child as a template, re-indexes every descendant `data-ngf-field` to `newIndex`, resets text to placeholder or images to a grey "Click to set image" SVG, and appends. Used by the sidebar's "+ Add" button |
| Editor → Site | `removeGroupItem` | `{ group: 'section.arrayKey', index: number }` | Removes the card whose descendants' fields start with `group.index.` and shifts every later sibling's indices down by one so they stay in sync with the editor's content array |
| Editor → Site | `moveGroupItem` | `{ group: 'section.arrayKey', from: number, to: number }` | Reorders two cards. Swaps DOM positions via `insertBefore`, then rewrites every descendant `data-ngf-field` index on both moved cards AND every card between them so indices stay contiguous and match the editor's content array order |
| Site → Editor | `fieldClick` | `{ section, field, currentValue, elementRect }` | User clicked an editable field; editor opens the edit popover. `currentValue` is the DOM text for text fields, or `el.getAttribute('src')` for image fields |

`elementRect` is `{ top, left, bottom, right, width, height }` in the iframe's viewport coordinates. The editor adds the iframe's own `getBoundingClientRect()` to convert to page-level coordinates for popover positioning.

**Bridge default-value cache** — on mount and whenever `setEditMode` toggles on, the bridge iterates `[data-ngf-field]` elements and stores each original value in `el.dataset.ngfDefault` (once). For `<img>` elements or anything with `data-ngf-type="image"` the stored value is `getAttribute('src')`; for everything else it's `textContent`. This lets the editor send unfiltered content (including `''`) without wiping the server-rendered fallback. Revert operations (Cancel, X on pending row, Discard all, revert to a prior version) all work by flipping the field value back to `''` in the editor's content state — the bridge then restores the original value from the cache. No iframe reload is needed.

**Image-field detection** — `isImageField(el)` returns true when the element is `<img>` or has `data-ngf-type="image"`. These three paths behave differently for image elements:
1. `captureDefaults()` caches `src` instead of `textContent`.
2. The `contentUpdate` walker does `el.setAttribute('src', value)` instead of setting `textContent`. Empty-string still means "restore `dataset.ngfDefault`".
3. `fieldClick` reports `currentValue` as `getAttribute('src')` so the edit popover opens with the live URL.
`addGroupItem` resets a new slot's image to a grey `Click to set image` SVG data-URI (and syncs `dataset.ngfDefault` to match) so the cloned slot doesn't just duplicate the template's photo.

**Hidden-container reveal** — the bridge CSS force-opens any ancestor marked hidden via `opacity-0`, `invisible`, `pointer-events-none`, `[hidden]`, or `[aria-expanded="false"] +` siblings IF it contains a `[data-ngf-field]`. Uses `:has()` (Chrome 105+, Safari 15.4+, Firefox 121+) so dropdown menus, accordions, and collapsed panels become editable without site-specific code. A subtle "expanded for editing" label appears above each force-opened container.

### Edit Popover (`EditPopover` component)

Opens when a `fieldClick` message is received. Input type is determined by `resolveFieldType(schema, section, field)`:
- `text` → single-line `<input>`
- `textarea` → `<textarea>` (resizable, 4 rows desktop / 5 rows mobile sheet)
- `color` → `<input type="color">` + hex text field side by side
- `image` → rendered by the `ImageField` sub-component: URL text input, an **Upload from computer** button wired to `POST /api/portal/upload` (5 MB max, jpg/png/webp/gif/svg, stored in Vercel Blob, returns a public URL), and a live preview thumbnail. Pasting a URL and uploading a file both end up writing the same single `src` value into `content[section][field]`.

`computePopoverPosition(iframeRect, elementRect)` positions the popover below the clicked element (flips above if not enough room below). On mobile (`window.innerWidth < 640`) it always renders as a bottom sheet instead.

Changes are applied to `content` state immediately as the user types (`onChange`). Pressing "Done" or Enter closes the popover; the change is already committed.

**Cancel behavior** — clicking Cancel (or the scrim, or the × in the popover corner) restores the field to its pre-edit value. The editor snapshots the original `content[section][field]` into a ref (`preEditValue`) when the popover opens, and on Cancel calls `updateField` with that snapshot. If the snapshot was `undefined` (field never had a stored value), Cancel sends `''`, which the bridge interprets as "restore server-rendered default".

### Pending Changes Sidebar — Expandable Diff

Each entry in the Pending Changes list is a collapsible row with three controls:

- **Caret + section label + count** → click to toggle the inline diff expansion
- **↗ button** → sends `scrollToField` to the iframe, scrolls and flash-highlights the first changed field in that section
- **× button** → calls `revertSection(sectionKey)` — reverts the whole section

When expanded, the row shows one card per changed field:
- Header: `"<ItemLabel> N · <FieldLabel>"` (e.g. `"Review 2 · Quote"`) with green `added` / red `removed` pills when a whole repeatable item was appended or deleted
- **Text / textarea / color diff**: old value in grey strikethrough above the new value in dark text
- **Image diff**: old thumbnail → arrow → new thumbnail (or `(cleared)` if the new value is empty)
- **✎ button** → opens the edit popover for that specific field (uses `openFieldEditor`, see below)
- **× button** → `revertField(sectionKey, fieldPath)` — reverts just that one field without touching the rest of the section. For scalar fields it writes `baseContent[section][field]` back into the content state; for `arrayKey.idx.subKey` paths it only rewrites that one sub-key on that one item; for whole-item paths (`arrayKey.idx` with no subKey, which means an item was added or removed) it restores the array to its baseline length.

**Key helpers** powering the diff:
- `changedFieldsOfSection(sectionKey)` walks the schema in source order and emits a `PendingFieldDiff[]` with `{ path, label, type, before, after, added?, removed?, itemLabel?, itemIndex? }` for every differing scalar + every differing sub-field of every repeatable item, stringifying booleans and numbers so the diff renderer can treat everything as text.
- `firstChangedFieldOf(sectionKey)` (still used by the ↗ button) returns the first differing path for the scroll-into-view behavior.

**Discard flow and the refresh trap** — `revertSection`, `revertField`, and `revertAll` all route through a single `flushSaveOrClear(next)` helper:

1. Cancel any pending debounced save (`scheduleSave` uses 800 ms debouncing — we don't want it writing the stale draft over our revert).
2. Compare `stripEmpty(next)` against `stripEmpty(baseContent)`.
3. If they match → `DELETE /api/portal/website` so `draft_content` goes `null` on the server and `has_draft` is false on next GET.
4. Otherwise → `POST` the current draft immediately (no waiting for the debounce).

This is critical: before `flushSaveOrClear`, clicking × then refreshing would bring the pending changes back because the debounced save never fired OR fired with an effectively-empty draft_content blob that still set `has_draft = true`. Any new revert logic must route through `flushSaveOrClear(next)` — never call `scheduleSave(next)` directly.

### Repeatable Group Add / Remove / Reorder (cards in the sidebar)

Surfaced via the Sections accordion (see next section). Each repeatable group shows:
- Its label + current count vs `maxItems`
- One card per existing item with:
  - Index label, text preview (from edited value or scraped `site_values`), image thumbnail
  - One button per sub-field (Name / Price / Image / …) → `openFieldEditor` opens the edit popover pre-loaded with that sub-field's current value
  - **↑ ↓** arrows → `moveGroupItem(sectionKey, arrayKey, from, to)` reorders the item (see bridge message above)
  - **×** → `removeGroupItem` (with confirm, respects `minItems`)
  - "Show in preview →" → `scrollToField` to that card in the iframe
- "+ Add <itemLabel>" at the bottom → `addGroupItem` (respects `maxItems`)

**Initial item count** — the editor's sidebar must match what the site is actually rendering, even when the DB has no saved content yet. The scraper counts the SSR-rendered item indices by scanning the HTML for `data-ngf-field="<group>.N.*"` matches, tracks `max(N)` across all matches, and returns `initialItemCount = max + 1` on the repeatable field. `applySchemaDefaults` initializes the array to `Math.max(minItems, initialItemCount, 1)`. So when a site hardcodes 3 featured projects and the DB is empty, the sidebar shows 3 rows (all with `''` values so the site's `||` fallback keeps rendering the hardcoded names until the user edits one).

**site_values** — `/api/portal/website` GET returns `site_values`, a flat dot-notation map of every `data-ngf-field`'s currently-rendered value on the live site (text for text/textarea, `src` for images). Derived by `scrapeFieldValuesFromHtml` on the same HTML the schema scraper uses — a depth-aware walker that finds each field's opening tag, counts matching same-name tags to locate the closing tag, then strips nested markup and decodes entities. This is purely for editor UI previews (sidebar row labels, diff "before" values for untouched fields). Never persisted to the DB.

State flow — add and remove both go through `content[section][arrayKey]` just like scalar edits:
- **Add** appends `{ ...defaultItem }` to the array, schedules a save, and posts `addGroupItem` to the bridge. Bridge clones the group's last child, rewrites every descendant `data-ngf-field` to the new index. Text fields get blank textContent (so the `:empty::before` placeholder shows); image fields get a grey "Click to set image" SVG data-URI as both `src` and `dataset.ngfDefault`, so new slots don't just mirror the template's photo.
- **Remove** splices the item out of the array, schedules save, posts `removeGroupItem`. Bridge finds and removes the card whose descendants' fields start with `group.N.`, then shifts every later sibling's indices down by one.
- **Reorder** splices from/to in the array, posts `moveGroupItem`. Bridge does `insertBefore` then rewrites every descendant data-ngf-field across all siblings so indices stay contiguous.

No iframe reload is needed for any of these — the DOM stays in sync with state. After the next Publish, SSR re-renders the full set naturally from the published content.

Newly-added cards are click-to-edit the same way existing cards are — the bridge doesn't distinguish between server-rendered and cloned-in-edit-mode DOM nodes.

### Sections Accordion (sidebar main panel)

The sidebar's primary panel is a collapsible-per-section accordion. Every scraped section with at least one field that has a rendered value shows up as a row. Clicking the header toggles open/collapsed; default state is collapsed.

Two modes controlled by a toggle at the top of the panel, persisted via `ngfEditorShowAllFields` in `localStorage`:

- **Manage Sections** (default, toggle off) — only sections containing a repeatable group render. Inside each section, only the repeatable group is shown. Sections auto-open. Panel subtitle: *"Click text on the preview to edit it. Use this panel to add, remove, or reorder cards."* This is the intended workflow: scalar text/image edits happen by clicking on the iframe; the sidebar is for managing card lists.
- **Show all fields** (toggle on) — every section plus every scalar field with its own Edit button. For clients who prefer to drive every edit from the sidebar rather than clicking in the iframe. Sections default collapsed.

**`openFieldEditor(sectionKey, fieldPath, currentValue, label, fieldType)`** — the function the sidebar's Edit buttons call. Synthesizes the same `clickField` state a `fieldClick` postMessage from the iframe would create, captures `preEditValue` for Cancel-to-revert, centers the popover on the viewport, and also fires `scrollToField` so the iframe jumps to the same field as confirmation.

**Empty-section / empty-field filtering** — `fieldHasValue(section, fieldKey, field)` returns true when the content state has a non-empty value OR `site_values` has a scraped value. `sectionHasContent` is the OR over all fields. Sections and fields that fail these checks are hidden entirely so the sidebar never shows mystery empty boxes (the Brand section's `sr-only` anchors used to create exactly these boxes — fixed by populating the anchor spans with their live value).

**Resizable sidebar** — the right edge has a 8 px drag handle (six grip dots, blue on hover). Pointer-down sets `iframe.style.pointerEvents = 'none'` for the duration of the drag (otherwise the iframe swallows `pointermove` as soon as the cursor crosses in) and `body.style.userSelect = 'none'` (prevents default text selection). Width is clamped 260–720 px and persisted to `localStorage` under `ngfEditorSidebarWidth` so the preference survives reloads.

### Edit Popover — Sizing

The popover centers on the viewport at **640 px wide** (capped to `calc(100vw - 48px)` on narrow screens), with `maxHeight: calc(100vh - 64px)`. Three-part layout: sticky header (section label + field name + close), scrollable body, sticky footer (Cancel + Done). Mobile still renders as a bottom sheet. Text inputs are 16 px; the textarea starts at 8 rows / 12 rem min-height and **auto-grows** with content up to 60 vh (user can also drag the bottom-right corner for manual resize). Character counter below text and textarea inputs.

### Version History and Revert

Every successful Publish writes a snapshot into `website_content_versions` with the full content blob, timestamped. The table has `(client_id, published_at DESC)` indexed and is capped at **20 most recent entries per client** (older ones pruned inside the push handler).

`/api/portal/website/versions` endpoints:
- `GET` — returns `{ versions: [{ id, published_at, note }] }` for the caller's client (auth via Clerk session → resolves client from `clerk_user_id`, never accepts `client_id` from body)
- `POST { versionId }` — reverts: first auto-snapshots the current `content` (note: "Auto-snapshot before revert"), then promotes the target version into `website_content.content` and clears any in-progress draft. `findFirst` is scoped to the caller's `client_id` to block IDOR.

Portal editor sidebar surfaces a "View history" toggle under "Last Published". Each entry shows date/time + optional note and a "Revert" button that confirms, calls the POST endpoint, and does a `location.reload()` to resync editor state.

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
const headline = content['hero.headline'] || 'Fallback text'   // scalar — MUST use ||
const services = getItems(content, 'services.items')           // repeatable
const display  = services.length > 0 ? services : hardcodedDefaults
```

**Always use `||` (logical OR), never `??` (nullish coalescing), for scalar fallbacks.** Published content may contain explicit empty strings (`''`) for fields that the editor filled and then the user deleted back out. `??` only catches `null`/`undefined` so `content['key'] ?? 'fallback'` would render empty; `||` catches `''` too and falls through to the hardcoded default. This also keeps behavior consistent with the editor bridge, which treats `''` as "restore original default" via its `data-ngf-default` cache.

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
- `setEditMode { enabled }` — sets `data-ngf-edit="true|false"` on `<html>`, re-runs `captureDefaults()`, dismisses nav popup when disabling
- `contentUpdate { content }` — recursively walks the content object. For each `[data-ngf-field="path"]`: empty string restores `dataset.ngfDefault`; non-empty sets `textContent` on regular elements or `setAttribute('src', …)` on image fields (`<img>` or `data-ngf-type="image"`)
- `scrollToField { path }` — `scrollIntoView({ behavior: 'smooth', block: 'center' })` on the match, plus a 1.6s `ngf-field-focus` pulse animation
- `addGroupItem { group, newIndex }` — clones the group container's last child as a template, re-indexes descendants, resets text slots to blank (placeholder shows via `:empty::before`) and image slots to a grey "Click to set image" SVG, appends and scrolls
- `removeGroupItem { group, index }` — removes the card containing fields at `group.index.*` and decrements every later sibling's indices by one

**Click interception (capture phase):**
All clicks are intercepted in capture phase (`document.addEventListener('click', handler, true)`). The handler:
1. If the click is inside the injected nav popup → passes through (popup manages itself)
2. If the click lands on an `aria-haspopup` or `aria-expanded` toggle that is NOT itself a field → returns early without `preventDefault` so the site's own open/close state fires (keeps dropdowns expandable in edit mode without forcing them open)
3. Otherwise calls `e.preventDefault()`, `e.stopPropagation()`, `e.stopImmediatePropagation()`
4. Walks up the DOM from `e.target` looking for `data-ngf-field`:
   - **Found** → posts `fieldClick { section, field, currentValue, elementRect }` to `window.parent` (currentValue is `src` for image fields, `textContent.trim()` otherwise)
5. If no `data-ngf-field`, walks up again looking for `<a>` or `<button>`:
   - **`<a>` with hash href** (e.g. `#services`) → scrolls to that element in-page without a popup
   - **`<a>` with real href** → shows nav popup with "Go to page" and "Edit" buttons (the Edit button fires `fieldClick` for the surrounding editable field, if any)
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

<!-- Image field — use a plain <img> so the bridge can read/write src directly.
     next/image with `fill` renders a wrapper that hides the real <img> node. -->
<img
  src={content['hero.image'] || '/hero-default.jpg'}
  alt="Hero background"
  data-ngf-field="hero.image"
  data-ngf-label="Hero Background Image"
  data-ngf-type="image"
  data-ngf-section="Hero"
/>

<!-- Repeatable array — container element, no data-ngf-field. Including an
     "image" field in data-ngf-item-fields opens the Upload from computer
     flow in the editor popover for that sub-field. -->
<div
  data-ngf-group="services.items"
  data-ngf-item-label="Service"
  data-ngf-min-items="1"
  data-ngf-max-items="16"
  data-ngf-item-fields='[{"key":"image","label":"Photo","type":"image"},{"key":"name","label":"Service Name","type":"text"},{"key":"price","label":"Price","type":"text"}]'
>
  {services.map((svc, i) => (
    <div key={i}>
      <img
        src={content[`services.items.${i}.image`] || svc.image}
        alt={svc.name}
        data-ngf-field={`services.items.${i}.image`}
        data-ngf-label="Photo"
        data-ngf-type="image"
        data-ngf-section="Services"
      />
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

**Image-field requirements:** use a plain `<img>` element (not `next/image` with `fill`, which wraps the real `<img>` in a span). The bridge reads/writes `src` directly. In edit mode the bridge sets `src = dataset.ngfDefault` when the editor sends `''`, so changing or reverting an image never requires an iframe reload.

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

### Security Invariants (per route)

Every portal route MUST satisfy all three:

1. **Identity from session, not input.** Resolve the client via `db.client.findUnique({ where: { clerk_user_id: userId } })`. Never trust a `client_id` from the request body, query, or params for authorization decisions.
2. **Scope all DB reads and writes to the resolved `client.id`.** Even on single-record lookups, include `client_id` in the `where` clause (use `findFirst` with the scope rather than `findUnique` by id alone) to prevent IDOR — a client must never be able to request `?id=<another-client's-record-id>` and get data back.
3. **Middleware role check is NOT enough for `/api/*`.** The middleware matcher runs on API routes, but its `path.startsWith('/portal')` and `path.startsWith('/admin')` role guards only catch PAGE paths. Sensitive admin API routes (`/api/admin/*`) must re-check `role === 'admin'` inside the handler. Sensitive portal routes that must only be reachable by signed-up clients should check `role === 'client' || role === 'admin'` — a `LEAD`-role user who happens to have a client row could otherwise hit the endpoint.

### Admin "Reset Website Content" button

`/admin/portal/[clientId]` surfaces a `ResetWebsiteContentButton` that DELETEs `website_content` for a given client via `/api/admin/clients/[id]/website-content`. Use when content got cross-contaminated between clients (wrong `site_url` matched, duplicated rows, etc.) and you want the live site to fall back to its hardcoded source-of-truth defaults. Confirmation dialog + admin role required.

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
- Do not use `??` for client-site scalar fallbacks (`content['key'] ?? 'fallback'`) — published content may contain `''` which `??` doesn't catch. Always use `||` so empty strings fall through to the hardcoded default. Mirrors what the bridge does with its `data-ngf-default` cache.
- Do not send filtered (empty-stripped) content in the editor's `contentUpdate` or `ngfReady` messages — the bridge needs `''` values to restore original text on revert. `stripEmpty` only belongs in `scheduleSave` so we don't persist `''` to the DB.
- Do not call `scheduleSave(next)` from revert code paths (per-field ×, per-section ×, Discard all). Always route reverts through `flushSaveOrClear(next)` so the save fires immediately and — when the result matches baseline — issues a `DELETE /api/portal/website` that nulls `draft_content`. The 800 ms debounce otherwise loses the revert on refresh, and even if it lands it leaves an effectively-empty draft_content blob that keeps `has_draft = true`.
- Do not return `user-select: none` or `pointer-events: none` from the sidebar resize-handle drag without restoring them on `pointerup`/`pointercancel`. Forgetting the restore freezes the iframe pointer or blocks page text selection permanently.
- Do not write logic that trusts `client_id` from a request body or query param in portal routes — resolve the client from `clerk_user_id` instead (see the three Security Invariants above)
- Do not ship a new portal API route without a `role` check inside the handler — the middleware's role guard only protects page paths, not API paths

