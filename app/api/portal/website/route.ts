import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'

// ─────────────────────────────────────────────────────────────────────────────
// Security helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Keys that can be exploited for prototype pollution. Stripped at every depth. */
const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

/** Per-field character cap. 50 KB is plenty for any single piece of marketing copy. */
const MAX_FIELD_CHARS = 50_000
/** Per-array item cap. */
const MAX_ARRAY_ITEMS = 100
/** Total serialized payload cap. 250 KB is generous for legitimate use. */
const MAX_PAYLOAD_BYTES = 250_000

/**
 * Sanitize a content payload from the editor. The shape we accept is exactly
 * what the editor produces:
 *   { [sectionKey]: { [fieldKey]: string | boolean | Array<{ [k]: string | boolean }> } }
 *
 * Anything that doesn't match this shape — top-level scalars, deeply nested
 * objects, numbers in field values, prototype-polluting keys, single fields
 * exceeding 50 KB — is silently dropped so a single rogue key doesn't reject
 * an otherwise legitimate save. Returns a cleaned object regardless of input
 * structure. The caller is responsible for verifying the input root is an
 * object and for the total-payload-size check.
 */
// Prisma's InputJsonValue type is verbose; ContentJson keeps the call site clean.
type ContentJson = Record<string, unknown>

function sanitizeContent(raw: ContentJson): ContentJson {
  const out: ContentJson = {}

  for (const [sectionKey, sectionValue] of Object.entries(raw)) {
    if (DANGEROUS_KEYS.has(sectionKey)) continue
    if (!sectionValue || typeof sectionValue !== 'object' || Array.isArray(sectionValue)) continue

    const cleanedSection: ContentJson = {}
    for (const [fieldKey, fieldValue] of Object.entries(sectionValue as ContentJson)) {
      if (DANGEROUS_KEYS.has(fieldKey)) continue

      if (typeof fieldValue === 'string') {
        if (fieldValue.length > MAX_FIELD_CHARS) continue
        cleanedSection[fieldKey] = fieldValue
      } else if (typeof fieldValue === 'boolean') {
        cleanedSection[fieldKey] = fieldValue
      } else if (Array.isArray(fieldValue)) {
        const items = fieldValue.slice(0, MAX_ARRAY_ITEMS)
        const cleanedItems: ContentJson[] = []
        for (const item of items) {
          if (!item || typeof item !== 'object' || Array.isArray(item)) continue
          const cleanedItem: ContentJson = {}
          for (const [subKey, subValue] of Object.entries(item as ContentJson)) {
            if (DANGEROUS_KEYS.has(subKey)) continue
            if (typeof subValue === 'string') {
              if (subValue.length > MAX_FIELD_CHARS) continue
              cleanedItem[subKey] = subValue
            } else if (typeof subValue === 'boolean') {
              cleanedItem[subKey] = subValue
            }
            // Other types (numbers, nested objects, null) silently dropped.
          }
          cleanedItems.push(cleanedItem)
        }
        cleanedSection[fieldKey] = cleanedItems
      }
      // Other top-level field types silently dropped.
    }

    out[sectionKey] = cleanedSection
  }

  return out
}

/**
 * SSRF guard for the schema scraper. Only allow http(s) URLs that don't
 * resolve (string-wise) to localhost or RFC 1918 / link-local IPs. Cloud
 * metadata endpoints (169.254.169.254) are blocked. This is a string-level
 * check — DNS rebinding could still defeat it, but the higher mitigation
 * (site_url is admin-only) handles that.
 */
function isSafeScrapeUrl(rawUrl: string): boolean {
  let url: URL
  try {
    const normalized = rawUrl.trim().replace(/\/$/, '')
    const base = normalized.startsWith('http') ? normalized : `https://${normalized}`
    url = new URL(base)
  } catch {
    return false
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false

  const hostname = url.hostname.toLowerCase()
  if (hostname === 'localhost' || hostname === '0.0.0.0' || hostname === '::1') return false

  // Private IPv4 ranges + AWS / cloud metadata
  if (/^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(hostname)) return false

  // Private IPv6 ranges (link-local, ULA)
  if (/^(fc|fd|fe80:)/.test(hostname)) return false

  return true
}

// ─────────────────────────────────────────────────────────────────────────────
// Schema types (inline — no longer imported from lib/templates)
// ─────────────────────────────────────────────────────────────────────────────

export type FieldType = 'text' | 'textarea' | 'image' | 'color' | 'toggle'

export interface LeafField {
  type: FieldType
  label: string
  placeholder?: string
  rows?: number
  default?: string
  /** Aspect ratio for image fields, e.g. "16:9" or "1:1". Scraped from
   *  data-ngf-aspect. When set, the editor locks the upload cropper to
   *  this ratio so the uploaded image matches the design exactly. */
  aspect?: string
}

export interface RepeatableField {
  type: 'repeatable'
  label: string
  itemLabel: string
  minItems?: number
  maxItems?: number
  fields: Record<string, LeafField>
  defaultItem: Record<string, string>
  /** How many items the live site is currently rendering (max index + 1
   *  detected in the scraped HTML). Editor uses this as the initial array
   *  length so the sidebar shows the same rows the client already has. */
  initialItemCount?: number
}

export type FieldDefinition = LeafField | RepeatableField

export interface SectionSchema {
  label: string
  fields: Record<string, FieldDefinition>
}

export interface SiteSchema {
  sections: Record<string, SectionSchema>
}

// ─────────────────────────────────────────────────────────────────────────────
// Site schema scraper
//
// Fetches the client's live site, parses data-ngf-* attributes from the HTML,
// and returns a fully dynamic SiteSchema. No template files needed.
//
// Attribute contract on client sites:
//   data-ngf-field="section.field"        — dot-notation field path
//   data-ngf-label="Human Label"          — display label in the sidebar
//   data-ngf-type="text|textarea|color|image|toggle"
//   data-ngf-section="Section Name"       — groups fields in the sidebar
//
//   data-ngf-group="section.array"        — declares a repeatable array
//   data-ngf-item-label="Item"            — singular label for one item
//   data-ngf-min-items="1"
//   data-ngf-max-items="16"
//   data-ngf-item-fields='[{"key":"name","label":"Name","type":"text"}]'
// ─────────────────────────────────────────────────────────────────────────────

interface ItemFieldDef { key: string; label: string; type: FieldType; aspect?: string }

async function scrapeSiteHtml(siteUrl: string): Promise<string | null> {
  // SSRF guard: refuse to fetch URLs targeting private/local network ranges.
  // site_url is admin-set so this is defense-in-depth, not the primary control.
  if (!isSafeScrapeUrl(siteUrl)) return null
  try {
    const rawUrl = siteUrl.trim().replace(/\/$/, '')
    const base   = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`
    const res    = await fetch(base, {
      signal:  AbortSignal.timeout(8000),
      headers: { 'User-Agent': 'NGF-Portal/1.0 (schema-scraper)' },
    })
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  }
}

async function scrapeSchemaFromSite(siteUrl: string, htmlArg?: string): Promise<SiteSchema | null> {
  try {
    const html = htmlArg ?? (await scrapeSiteHtml(siteUrl))
    if (!html) return null

    // ── Parse leaf fields ──────────────────────────────────────────────────
    // Match: data-ngf-field="..." data-ngf-label="..." data-ngf-type="..." data-ngf-section="..."
    // Attribute order in HTML is not guaranteed, so we extract per tag.

    // Capture entire opening tags that contain data-ngf-field
    const tagRe = /<[a-z][^>]*data-ngf-field="([^"]+)"[^>]*>/gi
    // Attribute extractors
    const attrRe = (name: string) => new RegExp(`data-${name}="([^"]+)"`, 'i')

    // section label → { fieldKey → field def }
    const sectionMap: Record<string, { label: string; fields: Record<string, FieldDefinition> }> = {}
    // Track insertion order for sections
    const sectionOrder: string[] = []

    let tagMatch: RegExpExecArray | null
    while ((tagMatch = tagRe.exec(html)) !== null) {
      const tag       = tagMatch[0]
      const fieldPath = tagMatch[1]           // e.g. "hero.headlinePrefix"

      const labelMatch   = attrRe('ngf-label').exec(tag)
      const typeMatch    = attrRe('ngf-type').exec(tag)
      const sectionMatch = attrRe('ngf-section').exec(tag)
      const aspectMatch  = attrRe('ngf-aspect').exec(tag)

      if (!labelMatch || !sectionMatch) continue

      const fieldLabel   = labelMatch[1]
      const fieldType    = (typeMatch?.[1] as FieldType) ?? 'text'
      const sectionLabel = sectionMatch[1]
      const fieldAspect  = aspectMatch?.[1]

      // Derive a stable section key from the field's dot-notation prefix
      const sectionKey = fieldPath.split('.')[0]

      if (!sectionMap[sectionKey]) {
        sectionMap[sectionKey] = { label: sectionLabel, fields: {} }
        sectionOrder.push(sectionKey)
      }

      // Field key is the remainder after the section prefix
      const parts    = fieldPath.split('.')
      // Skip array item fields (e.g. "services.items.0.name") — handled by repeatable groups
      if (parts.length > 2 && !isNaN(Number(parts[2]))) continue
      const fieldKey = parts.slice(1).join('.')

      // Avoid duplicate fields (e.g. brand.businessName appears in header + footer)
      if (sectionMap[sectionKey].fields[fieldKey]) continue

      const leafField: LeafField = {
        type:  fieldType,
        label: fieldLabel,
        ...(fieldType === 'textarea' ? { rows: 3 } : {}),
        ...(fieldType === 'image' && fieldAspect ? { aspect: fieldAspect } : {}),
        default: '',
      }
      sectionMap[sectionKey].fields[fieldKey] = leafField
    }

    // ── Parse repeatable groups ────────────────────────────────────────────
    // Match tags with data-ngf-group="..."
    const groupRe = /<[a-z][^>]*data-ngf-group="([^"]+)"[^>]*>/gi
    let groupMatch: RegExpExecArray | null
    while ((groupMatch = groupRe.exec(html)) !== null) {
      const tag       = groupMatch[0]
      const groupPath = groupMatch[1]   // e.g. "services.items"

      const itemLabelMatch   = attrRe('ngf-item-label').exec(tag)
      const minItemsMatch    = attrRe('ngf-min-items').exec(tag)
      const maxItemsMatch    = attrRe('ngf-max-items').exec(tag)
      const itemFieldsMatch  = attrRe('ngf-item-fields').exec(tag)

      if (!itemFieldsMatch) continue

      let itemFieldDefs: ItemFieldDef[] = []
      try {
        // HTML entities in JSON: decode &apos; etc
        const raw = itemFieldsMatch[1]
          .replace(/&apos;/g, "'")
          .replace(/&quot;/g, '"')
          .replace(/&amp;/g, '&')
        itemFieldDefs = JSON.parse(raw) as ItemFieldDef[]
      } catch {
        continue
      }

      const sectionKey = groupPath.split('.')[0]   // "services"
      const arrayKey   = groupPath.split('.').slice(1).join('.')  // "items"
      const itemLabel  = itemLabelMatch?.[1] ?? 'Item'

      if (!sectionMap[sectionKey]) {
        // Section not seen yet (e.g. no scalar fields in this section)
        sectionMap[sectionKey] = { label: sectionKey.charAt(0).toUpperCase() + sectionKey.slice(1), fields: {} }
        sectionOrder.push(sectionKey)
      }

      const subFields: Record<string, LeafField> = {}
      const defaultItem: Record<string, string>  = {}
      for (const f of itemFieldDefs) {
        subFields[f.key] = {
          type:  f.type,
          label: f.label,
          ...(f.type === 'textarea' ? { rows: 2 } : {}),
          ...(f.type === 'image' && f.aspect ? { aspect: f.aspect } : {}),
          default: '',
        }
        defaultItem[f.key] = ''
      }

      // Count how many items the SSR is actually rendering by scanning for
      // every `data-ngf-field="<group>.N.*"` and tracking the max N. Used as
      // initialItemCount so the editor's sidebar shows the same rows the
      // live site already has (without this, an empty DB + minItems=0 means
      // the sidebar shows zero slots even though the site renders N cards).
      const itemIdxRe = new RegExp(
        `data-ngf-field="${groupPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.(\\d+)\\.[^"]+"`,
        'gi',
      )
      let maxIdx = -1
      let idxMatch: RegExpExecArray | null
      while ((idxMatch = itemIdxRe.exec(html)) !== null) {
        const n = parseInt(idxMatch[1], 10)
        if (!isNaN(n) && n > maxIdx) maxIdx = n
      }
      const initialItemCount = maxIdx >= 0 ? maxIdx + 1 : undefined

      const repeatableField: RepeatableField = {
        type:        'repeatable',
        label:       itemLabel + 's',
        itemLabel,
        minItems:    minItemsMatch    ? parseInt(minItemsMatch[1])    : 1,
        maxItems:    maxItemsMatch    ? parseInt(maxItemsMatch[1])    : 20,
        fields:      subFields,
        defaultItem,
        ...(initialItemCount !== undefined ? { initialItemCount } : {}),
      }

      sectionMap[sectionKey].fields[arrayKey] = repeatableField
    }

    // ── Assemble final schema in source order ──────────────────────────────
    const sections: Record<string, SectionSchema> = {}
    for (const key of sectionOrder) {
      const s = sectionMap[key]
      if (Object.keys(s.fields).length > 0) {
        sections[key] = { label: s.label, fields: s.fields }
      }
    }

    if (Object.keys(sections).length === 0) return null
    return { sections }
  } catch {
    return null
  }
}

/**
 * Extract the rendered value for every `data-ngf-field` so the editor can
 * show real previews in the sidebar (e.g. the actual review quote, not just
 * "Review 1"). Walks the HTML: for each opening tag carrying data-ngf-field
 * we find the matching closing tag by counting nested same-name tags, then
 * strip inner markup to get clean text. That handles fields with nested
 * `<span>`s, `<strong>`s, etc. For <img> fields we return the `src`.
 */
function decodeEntities(s: string): string {
  return s
    .replace(/&#x27;/gi, "'")
    .replace(/&#39;/g,   "'")
    .replace(/&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi,  '&')
    .replace(/&lt;/gi,   '<')
    .replace(/&gt;/gi,   '>')
    .replace(/&nbsp;/gi, ' ')
}

function scrapeFieldValuesFromHtml(html: string): Record<string, string> {
  const values: Record<string, string> = {}

  // Match every opening tag that carries data-ngf-field and capture:
  //   $1 = tag name       (h1, p, span, div, …)
  //   $2 = full attribute blob   (used only to pull out data-ngf-field + src)
  //   $3 = the >           (start of inner content)
  const openRe = /<([a-z][a-z0-9-]*)\b([^>]*\sdata-ngf-field="[^"]+"[^>]*)(\/?)>/gi
  let m: RegExpExecArray | null
  while ((m = openRe.exec(html)) !== null) {
    const tagName   = m[1].toLowerCase()
    const attrs     = m[2]
    const selfClose = m[3] === '/'
    const pathMatch = /\sdata-ngf-field="([^"]+)"/i.exec(attrs)
    if (!pathMatch) continue
    const path = pathMatch[1]
    if (values[path] !== undefined) continue  // first occurrence wins

    // Image fields — read src attribute, no inner content.
    if (tagName === 'img') {
      const srcMatch = /\ssrc="([^"]+)"/i.exec(attrs)
      if (srcMatch) values[path] = srcMatch[1]
      continue
    }

    // Self-closing element (<br />, <input />, etc.) — no inner text.
    if (selfClose) continue

    // Void elements that never have a closing tag.
    if (/^(area|base|br|col|embed|hr|input|link|meta|param|source|track|wbr)$/.test(tagName)) {
      continue
    }

    // Walk forward counting nested <tagName> opens to find the matching
    // </tagName>. Handles common React output where fields have inline
    // children like <span>highlights</span>.
    const contentStart = openRe.lastIndex
    const scanRe       = new RegExp(`<(/?)${tagName}\\b[^>]*?(/?)>`, 'gi')
    scanRe.lastIndex   = contentStart
    let depth          = 1
    let closeEnd       = -1
    let sm: RegExpExecArray | null
    while ((sm = scanRe.exec(html)) !== null) {
      const isClose = sm[1] === '/'
      const isSelf  = sm[2] === '/'
      if (isClose) {
        depth--
        if (depth === 0) { closeEnd = sm.index; break }
      } else if (!isSelf) {
        depth++
      }
    }
    if (closeEnd === -1) continue

    const innerHtml = html.slice(contentStart, closeEnd)
    // Strip all inner tags, collapse whitespace, decode entities.
    const text = decodeEntities(innerHtml.replace(/<[^>]+>/g, ' '))
      .replace(/\s+/g, ' ')
      .trim()
    if (text) values[path] = text
  }

  return values
}

// ─────────────────────────────────────────────────────────────────────────────
// Fallback minimal schema — used when site is unreachable or has no annotations
// ─────────────────────────────────────────────────────────────────────────────

function fallbackSchema(): SiteSchema {
  return {
    sections: {
      brand: {
        label: 'Brand',
        fields: {
          businessName: { type: 'text',  label: 'Business Name', default: '' },
          tagline:      { type: 'text',  label: 'Tagline',       default: '' },
          primaryColor: { type: 'color', label: 'Primary Color', default: '#3B82F6' },
        },
      },
      hero: {
        label: 'Hero',
        fields: {
          headline:    { type: 'text',     label: 'Headline',    default: '' },
          subheadline: { type: 'textarea', label: 'Subheadline', default: '', rows: 3 },
          ctaText:     { type: 'text',     label: 'Button Text', default: '' },
        },
      },
    },
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/portal/website
// ─────────────────────────────────────────────────────────────────────────────

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const client = await db.client.findUnique({
      where:   { clerk_user_id: userId },
      include: { config: true },
    })
    if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

    const websiteContent = await db.websiteContent.findUnique({
      where: { client_id: client.id },
    })

    const editorContent = websiteContent?.draft_content ?? websiteContent?.content ?? {}
    const siteUrl       = client.config?.site_url ?? null

    // Scrape the live site once — derive BOTH schema and current rendered
    // values from the same HTML. `site_values` feeds the editor's sidebar
    // previews (so each Review row shows the actual quote instead of an
    // empty slot) but is never persisted to the DB.
    let schema: SiteSchema = fallbackSchema()
    let siteValues: Record<string, string> = {}
    if (siteUrl) {
      const html = await scrapeSiteHtml(siteUrl)
      if (html) {
        schema     = (await scrapeSchemaFromSite(siteUrl, html)) ?? fallbackSchema()
        siteValues = scrapeFieldValuesFromHtml(html)
      }
    }

    return NextResponse.json({
      content:           editorContent,
      published_content: websiteContent?.content ?? {},
      has_draft:         !!websiteContent?.draft_content,
      published_at:      websiteContent?.published_at?.toISOString() ?? null,
      site_url:          siteUrl,
      client_id:         client.id,
      schema,
      site_values:       siteValues,
    })
  } catch (err) {
    console.error('[portal/website GET]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/portal/website  — save draft
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const client = await db.client.findUnique({
      where:   { clerk_user_id: userId },
      include: { config: true },
    })
    if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

    const body = (await request.json()) as { content?: unknown }
    const rawContent = body.content

    // Reject only if the root isn't an object — that's a malformed request.
    if (!rawContent || typeof rawContent !== 'object' || Array.isArray(rawContent)) {
      return NextResponse.json({ error: 'Content must be an object' }, { status: 400 })
    }

    // Strip fields with non-string/-boolean values, drop prototype-polluting
    // keys, cap array length and per-field size. Anything malformed inside is
    // silently dropped to keep legitimate edits flowing.
    const cleanedContent = sanitizeContent(rawContent as Record<string, unknown>)

    // Hard cap on serialized size after cleanup.
    if (JSON.stringify(cleanedContent).length > MAX_PAYLOAD_BYTES) {
      return NextResponse.json({ error: 'Content payload exceeds the 250 KB limit' }, { status: 400 })
    }

    // Saves to draft_content only — never touches published content. The cast
    // tells Prisma "trust me, this is JSON-shaped" since Record<string,unknown>
    // doesn't structurally match Prisma.InputJsonValue without it.
    await db.websiteContent.upsert({
      where:  { client_id: client.id },
      update: { draft_content: cleanedContent as object },
      create: {
        client_id:     client.id,
        content:       {},
        draft_content: cleanedContent as object,
      },
    })

    return NextResponse.json({ success: true, has_draft: true })
  } catch (err) {
    console.error('[portal/website POST]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/portal/website  — discard the draft
// Sets draft_content = null so `has_draft` goes false and the editor opens
// back up to "Everything is published." on next load. Never touches the
// published content.
// ─────────────────────────────────────────────────────────────────────────────

export async function DELETE() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const client = await db.client.findUnique({
      where:  { clerk_user_id: userId },
      select: { id: true },
    })
    if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

    // Only update if there's actually a row — no-op if the client has never
    // saved content. Deliberately not an upsert: we don't want to create
    // empty website_content rows from a discard call.
    await db.websiteContent.updateMany({
      where: { client_id: client.id },
      data:  { draft_content: null },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[portal/website DELETE]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
