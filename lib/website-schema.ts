// ─────────────────────────────────────────────────────────────────────────────
// Website schema — the single source of truth for the editor.
//
// Per-client overrides live in `website_content.schema_json`. When that is
// NULL, DEFAULT_SCHEMA is used. Admin can customize the schema per-client
// via a future UI or directly in Prisma Studio.
//
// The schema is consumed by both:
//   - the editor (renders the sidebar form)
//   - the public content API (advertises the shape for client sites)
// ─────────────────────────────────────────────────────────────────────────────

export type FieldType =
  | 'text'
  | 'textarea'
  | 'color'
  | 'image'
  | 'url'
  | 'email'
  | 'phone'

export interface LeafField {
  type:         FieldType
  label:        string
  placeholder?: string
  help?:        string   // optional hint shown under the field
  default?:     string
}

export interface RepeatableField {
  type:        'repeatable'
  label:       string
  itemLabel:   string           // e.g. "Service" (singular)
  minItems?:   number
  maxItems?:   number
  fields:      Record<string, LeafField>
  defaultItem: Record<string, string>
}

export type FieldDefinition = LeafField | RepeatableField

export interface SectionSchema {
  label:       string
  description?: string          // optional prose shown in editor sidebar
  fields:      Record<string, FieldDefinition>
}

export interface SiteSchema {
  sections: Record<string, SectionSchema>
}

// ─────────────────────────────────────────────────────────────────────────────
// Default schema — sensible starter for a small-business website
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_SCHEMA: SiteSchema = {
  sections: {
    brand: {
      label:       'Brand',
      description: 'Business identity — name, tagline, colors, logo.',
      fields: {
        businessName:  { type: 'text',  label: 'Business Name',  default: '' },
        tagline:       { type: 'text',  label: 'Tagline',        default: '' },
        logoUrl:       { type: 'image', label: 'Logo',           default: '' },
        primaryColor:  { type: 'color', label: 'Primary Color',  default: '#2563EB' },
        accentColor:   { type: 'color', label: 'Accent Color',   default: '#F59E0B' },
      },
    },

    hero: {
      label:       'Hero',
      description: 'The first thing visitors see at the top of your homepage.',
      fields: {
        eyebrow:     { type: 'text',     label: 'Eyebrow',    default: '', placeholder: 'Small text above the headline' },
        headline:    { type: 'text',     label: 'Headline',   default: '' },
        subheadline: { type: 'textarea', label: 'Subheadline',default: '' },
        ctaText:     { type: 'text',     label: 'Button Text',default: 'Get Started' },
        ctaUrl:      { type: 'url',      label: 'Button Link',default: '#contact' },
        imageUrl:    { type: 'image',    label: 'Hero Image', default: '' },
      },
    },

    about: {
      label: 'About',
      fields: {
        heading:  { type: 'text',     label: 'Heading',  default: 'About Us' },
        body:     { type: 'textarea', label: 'Body',     default: '' },
        imageUrl: { type: 'image',    label: 'Image',    default: '' },
      },
    },

    services: {
      label:       'Services',
      description: 'Services you offer. Add, remove, and reorder as needed.',
      fields: {
        heading: { type: 'text',     label: 'Section Heading', default: 'What We Do' },
        intro:   { type: 'textarea', label: 'Intro Text',      default: '' },
        items: {
          type:      'repeatable',
          label:     'Services',
          itemLabel: 'Service',
          minItems:  1,
          maxItems:  12,
          fields: {
            name:        { type: 'text',     label: 'Name',        default: '' },
            description: { type: 'textarea', label: 'Description', default: '' },
            price:       { type: 'text',     label: 'Price',       default: '', placeholder: 'e.g. $55 or Contact for quote' },
            imageUrl:    { type: 'image',    label: 'Image',       default: '' },
          },
          defaultItem: { name: '', description: '', price: '', imageUrl: '' },
        },
      },
    },

    gallery: {
      label:       'Gallery',
      description: 'Photos of your work. Leave empty to hide the gallery section.',
      fields: {
        heading: { type: 'text', label: 'Section Heading', default: 'Our Work' },
        items: {
          type:      'repeatable',
          label:     'Photos',
          itemLabel: 'Photo',
          minItems:  0,
          maxItems:  24,
          fields: {
            imageUrl: { type: 'image', label: 'Image', default: '' },
            caption:  { type: 'text',  label: 'Caption', default: '' },
          },
          defaultItem: { imageUrl: '', caption: '' },
        },
      },
    },

    contact: {
      label: 'Contact',
      fields: {
        heading:  { type: 'text',     label: 'Heading',    default: 'Get In Touch' },
        intro:    { type: 'textarea', label: 'Intro Text', default: '' },
        email:    { type: 'email',    label: 'Email',      default: '' },
        phone:    { type: 'phone',    label: 'Phone',      default: '' },
        address:  { type: 'textarea', label: 'Address',    default: '' },
        hours:    { type: 'textarea', label: 'Hours',      default: '' },
      },
    },

    footer: {
      label: 'Footer',
      fields: {
        copyright: { type: 'text', label: 'Copyright Text', default: '' },
      },
    },
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// Content helpers
// ─────────────────────────────────────────────────────────────────────────────

export type ContentValue = string | Array<Record<string, string>> | Record<string, string>
export type SectionContent = Record<string, ContentValue>
export type SiteContent = Record<string, SectionContent>

/**
 * Merge stored content with schema defaults. Used at editor load time so the
 * form has sensible starting values for any field the client hasn't touched.
 *
 * Stored values always win — defaults only fill gaps.
 */
export function applySchemaDefaults(content: SiteContent, schema: SiteSchema): SiteContent {
  const result: SiteContent = {}

  for (const [sectionKey, section] of Object.entries(schema.sections)) {
    const stored = content[sectionKey] ?? {}
    const filled: SectionContent = {}

    for (const [fieldKey, field] of Object.entries(section.fields)) {
      if (field.type === 'repeatable') {
        const rawStored = stored[fieldKey]
        const arr = Array.isArray(rawStored) ? rawStored : []

        const needed = Math.max(field.minItems ?? 0, arr.length)
        const filledArr: Array<Record<string, string>> = []
        for (let i = 0; i < needed; i++) {
          const existing = (arr[i] ?? {}) as Record<string, string>
          filledArr.push({ ...field.defaultItem, ...existing })
        }
        filled[fieldKey] = filledArr
      } else {
        const raw = stored[fieldKey]
        filled[fieldKey] = typeof raw === 'string' ? raw : (field.default ?? '')
      }
    }

    result[sectionKey] = filled
  }

  return result
}

/**
 * Flatten nested content to dot-notation (e.g. 'hero.headline', 'services.items.0.name').
 * Used by the public content API so client sites can look up fields with a single key.
 */
export function flattenContent(content: SiteContent): Record<string, string> {
  const out: Record<string, string> = {}

  for (const [sectionKey, section] of Object.entries(content)) {
    for (const [fieldKey, value] of Object.entries(section)) {
      if (typeof value === 'string') {
        out[`${sectionKey}.${fieldKey}`] = value
      } else if (Array.isArray(value)) {
        value.forEach((item, i) => {
          if (item && typeof item === 'object') {
            for (const [subKey, subValue] of Object.entries(item)) {
              if (typeof subValue === 'string') {
                out[`${sectionKey}.${fieldKey}.${i}.${subKey}`] = subValue
              }
            }
          }
        })
      } else if (value && typeof value === 'object') {
        for (const [subKey, subValue] of Object.entries(value)) {
          if (typeof subValue === 'string') {
            out[`${sectionKey}.${fieldKey}.${subKey}`] = subValue
          }
        }
      }
    }
  }

  return out
}
