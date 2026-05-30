# NGF Client Site Template

Starting point for all NGF Systems client websites.

> **The canonical spec for everything below is `NGF-STANDARDS.md`** (repo root, also served at
> https://raw.githubusercontent.com/Nick-NGFsystems/NGF-Systems-app/main/NGF-STANDARDS.md).
> This README deliberately does **not** re-document the editor integration, content contract,
> caching rules, or env vars — duplicating them here is exactly how drift happens. When in doubt,
> the standards file wins. The live reference implementations are
> [`NorthCoveBuilders-Mockup`](https://github.com/Nick-NGFsystems/NorthCoveBuilders-Mockup) and
> [`WrenchTime-Cycles`](https://github.com/Nick-NGFsystems/WrenchTime-Cycles).

## Quick start

1. Fork `ngf-client-starter` (or copy the integration files from `NorthCoveBuilders-Mockup` if the starter is stale).
2. Follow the **"Setup checklist for a new NGF client website"** in `NGF-STANDARDS.md` top to bottom.
3. Deploy to Vercel (one project per client) and set the env vars listed in the standards.
4. In the NGF admin panel: set `site_url`, verify it, enable the `page_website` toggle.
5. Client can now edit their site from the portal.

## The current contract — at a glance

These are the load-bearing facts a new build must get right. **Full detail and copy-paste code live in `NGF-STANDARDS.md`** — this is just the map so you know what to look up.

| Concern | Current standard (see NGF-STANDARDS.md) |
|---|---|
| Content fetch | `getNgfContent()` → `GET {NGF_APP_URL}/api/public/content?domain=<site domain>` |
| Content shape | **Flat** dot-notation map: `Record<string, string>` (e.g. `content['hero.headline']`). Use `getItems()` for repeatable groups. |
| Domain resolution | `NEXT_PUBLIC_SITE_URL` **first**, then `VERCEL_PROJECT_PRODUCTION_URL`, then `localhost`. Order matters — the vercel.app URL won't match `client_configs.site_url`. |
| Caching | `fetch(url, { next: { revalidate: 60, tags: ['ngf-content'] } })`. **Never `cache: 'no-store'`** (burns Neon). |
| Instant publish | `app/api/revalidate/route.ts` calls `revalidateTag('ngf-content')`, guarded by `WEBSITE_REVALIDATION_SECRET` (same value as the NGF main app). The portal's push handler pings it. |
| Edit bridge | `components/NgfEditBridge.tsx` — **copy verbatim** from a current reference repo (NorthCove / WrenchTime). Do not hand-write or fork per-site. |
| Editable markup | All four `data-ngf-*` attributes per element (`field`, `label`, `type`, `section`); `data-ngf-group` for card lists. |
| Iframe embedding | CSP `frame-ancestors 'self' https://app.ngfsystems.com https://*.vercel.app` in `next.config`. |
| Fallbacks | Always `||`, never `??` — published content can be an explicit `''`. |

## How editing works (client's perspective)

1. Admin enables the `page_website` toggle and sets `site_url` for the client.
2. Client opens the Website Editor in their portal — their live site loads in an iframe; editable fields glow on hover.
3. Client clicks a field → sidebar edit form opens with the current value.
4. Client edits → preview updates live → **Save** writes to the NGF database.
5. **Push to Website** promotes the draft to published and pings the site's `/api/revalidate` → the live site updates within seconds.

## Static HTML sites (`index.html` template)

The `index.html` in this directory is a standalone static template that fetches from the NGF public API. It passes NGF verification automatically and can be hosted anywhere (GitHub Pages, Netlify, Vercel static). Set `NGF_API` and the client domain at the top of its script to connect it.
