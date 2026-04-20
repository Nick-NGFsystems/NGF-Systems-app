# NGF Client Site Template

This template is the starting point for all NGF Systems client websites.

## Quick Start

1. Deploy this template to Vercel (or any static host)
2. Set environment variables in Vercel (see below)
3. In the NGF admin panel: set `site_url`, verify it, enable `page_website` toggle
4. Client can now edit their site from the NGF portal

## For Next.js Sites (Recommended)

If you're building a Next.js site for a client, use the full integration pattern:

### Required files

**`lib/ngf.ts`** — Fetches content from NGF API:
```typescript
const NGF_CLIENT_ID = process.env.NGF_CLIENT_ID || 'CLIENT_ID_HERE'
const NGF_API = 'https://app.ngfsystems.com'

export interface NgfSiteContent {
  [key: string]: Record<string, string> | undefined
}

export async function getNgfContent(): Promise<NgfSiteContent> {
  try {
    const res = await fetch(`${NGF_API}/api/public/website/${NGF_CLIENT_ID}`, {
      next: { tags: ['ngf-content'], revalidate: false }
    })
    if (!res.ok) return {}
    const data = await res.json() as { content?: NgfSiteContent }
    return data.content ?? {}
  } catch { return {} }
}
```

**`components/NgfEditBridge.tsx`** — Enables click-to-edit in the NGF portal editor:
```typescript
'use client'
import { useEffect } from 'react'

export default function NgfEditBridge() {
  useEffect(() => {
    let editMode = false
    const style = document.createElement('style')
    style.textContent = `
      [data-ngf-edit="true"] [data-ngf-field] { cursor: pointer !important; outline: 2px solid transparent; border-radius: 3px; }
      [data-ngf-edit="true"] [data-ngf-field]:hover { outline-color: #3b82f6 !important; background-color: rgba(59,130,246,0.08) !important; }
      [data-ngf-edit="true"] a, [data-ngf-edit="true"] button { pointer-events: none; }
    `
    document.head.appendChild(style)
    window.parent.postMessage({ type: 'ngfReady' }, '*')
    const messageHandler = (e: MessageEvent) => {
      if (e.data?.type === 'setEditMode') {
        editMode = !!e.data.enabled
        document.documentElement.setAttribute('data-ngf-edit', editMode ? 'true' : 'false')
      }
      if (e.data?.type === 'contentUpdate' && e.data.content) {
        const content = e.data.content as Record<string, Record<string, string>>
        Object.entries(content).forEach(([section, fields]) => {
          if (typeof fields !== 'object') return
          Object.entries(fields).forEach(([field, value]) => {
            if (typeof value !== 'string') return
            const el = document.querySelector<HTMLElement>(`[data-ngf-field="${section}.${field}"]`)
            if (el) el.textContent = value
          })
        })
      }
    }
    const clickHandler = (e: MouseEvent) => {
      if (!editMode) return
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation()
      let target = e.target as HTMLElement | null
      while (target && target !== document.documentElement) {
        const attr = target.getAttribute('data-ngf-field')
        if (attr) {
          const dot = attr.indexOf('.')
          if (dot > -1) window.parent.postMessage({ type: 'fieldClick', section: attr.substring(0, dot), field: attr.substring(dot + 1), currentValue: target.textContent?.trim() ?? '' }, '*')
          return
        }
        target = target.parentElement
      }
    }
    window.addEventListener('message', messageHandler)
    document.addEventListener('click', clickHandler, true)
    return () => { window.removeEventListener('message', messageHandler); document.removeEventListener('click', clickHandler, true) }
  }, [])
  return null
}
```

**`app/api/revalidate/route.ts`** — Triggers ISR cache clear when "Push to Website" is clicked:
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get('secret') !== process.env.REVALIDATION_SECRET)
    return NextResponse.json({ ok: false }, { status: 401 })
  revalidateTag('ngf-content')
  return NextResponse.json({ ok: true })
}
```

**`next.config.js`** — Allow iframing from NGF app:
```javascript
const nextConfig = {
  async headers() {
    return [{ source: '/(.*)', headers: [
      { key: 'Content-Security-Policy', value: "frame-ancestors 'self' https://app.ngfsystems.com" }
    ]}]
  }
}
module.exports = nextConfig
```

### Marking text as editable
Add `data-ngf-field="section.fieldname"` to any element you want to be editable:
```tsx
<p data-ngf-field="hero.subheadline">{subheadline}</p>
<span data-ngf-field="cta.buttonText">{ctaText}</span>
<h2 data-ngf-field="features.title">{featuresTitle}</h2>
```

### Using API content with fallbacks
```tsx
// app/page.tsx
export default async function Page() {
  const ngf = await getNgfContent()
  return <Hero ngf={ngf} />
}

// components/Hero.tsx
export default function Hero({ ngf }) {
  const subheadline = ngf?.hero?.subheadline || 'Your default text here'
  return <p data-ngf-field="hero.subheadline">{subheadline}</p>
}
```

## Environment Variables

Set these in Vercel for each client site:

| Variable | Value | Description |
|----------|-------|-------------|
| `NGF_CLIENT_ID` | (client's ID from NGF DB) | Which client this site belongs to |
| `REVALIDATION_SECRET` | (same as `WEBSITE_REVALIDATION_SECRET` on NGF app) | Shared secret for cache revalidation |

## How editing works

1. Admin enables `page_website` toggle and sets `site_url` for the client
2. Client opens "Website Editor" in their portal
3. Their site loads in an iframe — editable fields glow blue on hover
4. Client clicks a field → sidebar edit form opens with current value
5. Client types → preview updates live
6. "Done ✓ Save" → saves to NGF database
7. "🚀 Push to Website" → triggers revalidation → live site updates within seconds

## Static HTML Sites (index.html template)

The `index.html` in this directory is a standalone static template that fetches
from the NGF public API. It passes NGF verification automatically and can be
hosted anywhere (GitHub Pages, Netlify, Vercel static, etc.).

Set `NGF_API` and `CLIENT_ID` at the top of the script to connect it to your client.
