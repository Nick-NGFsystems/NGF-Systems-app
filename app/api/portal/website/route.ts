import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'

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
}

export interface RepeatableField {
  type: 'repeatable'
  label: string
  itemLabel: string
  minItems?: number
  maxItems?: number
  fields: Record<string, LeafField>
  defaultItem: Record<string, string>
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

interface ItemFieldDef { key: string; label: string; type: FieldType }

async function scrapeSchemaFromSite(siteUrl: string): Promise<SiteSchema | null> {
  try {
    const rawUrl = siteUrl.trim().replace(/\/$/, '')
    const base   = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`
    const res    = await fetch(base, {
      signal:  AbortSignal.timeout(8000),
      headers: { 'User-Agent': 'NGF-Portal/1.0 (schema-scraper)' },
    })
    if (!res.ok) return null
    const html = await res.text()

    // ── Parse leaf fields ──────────────────────────────────────────────────
    // Match: data-ngf-field="..." data-ngf-label="..." data-ngf-type="..." data-ngf-section="..."
    // Attribute order in HTML is not guaranteed, so we extract per tag.

    // Capture entire opening tags that contain data-ngf-field
    const tagRe = /<[a-z][^>]*data-ngf-field="([^"]+)"[^>]*>/gi
    // Attribute extractors
    const attrRe = (name: string) => new RegExp(`data-${name}="([^"]+)"`, 'i')

    // section label → { fieldKey → field def }
    const sectionMap: Record<string, { label: string; fields: Record<string, LeafField> }> = {}
    // Track insertion order for sections
    const sectionOrder: string[] = []

    let tagMatch: RegExpExecArray | null
    while ((tagMatch = tagRe.exec(html)) !== null) {
      const tag       = tagMatch[0]
      const fieldPath = tagMatch[1]           // e.g. "hero.headlinePrefix"

      const labelMatch   = attrRe('ngf-label').exec(tag)
      const typeMatch    = attrRe('ngf-type').exec(tag)
      const sectionMatch = attrRe('ngf-section').exec(tag)

      if (!labelMatch || !sectionMatch) continue

      const fieldLabel   = labelMatch[1]
      const fieldType    = (typeMatch?.[1] as FieldType) ?? 'text'
      const sectionLabel = sectionMatch[1]

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
          default: '',
        }
        defaultItem[f.key] = ''
      }

      const repeatableField: RepeatableField = {
        type:        'repeatable',
        label:       itemLabel + 's',
        itemLabel,
        minItems:    minItemsMatch    ? parseInt(minItemsMatch[1])    : 1,
        maxItems:    maxItemsMatch    ? parseInt(maxItemsMatch[1])    : 20,
        fields:      subFields,
        defaultItem,
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

    // Scrape the schema from the live site. Falls back to a minimal generic
    // schema if the site is unreachable or has no data-ngf-* annotations.
    const schema = siteUrl
      ? (await scrapeSchemaFromSite(siteUrl)) ?? fallbackSchema()
      : fallbackSchema()

    return NextResponse.json({
      content:           editorContent,
      published_content: websiteContent?.content ?? {},
      has_draft:         !!websiteContent?.draft_content,
      site_url:          siteUrl,
      client_id:         client.id,
      schema,
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

    const { content } = await request.json()

    // Saves to draft_content only — never touches published content
    await db.websiteContent.upsert({
      where:  { client_id: client.id },
      update: { draft_content: content },
      create: {
        client_id:     client.id,
        content:       {},
        draft_content: content,
      },
    })

    return NextResponse.json({ success: true, has_draft: true })
  } catch (err) {
    console.error('[portal/website POST]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
