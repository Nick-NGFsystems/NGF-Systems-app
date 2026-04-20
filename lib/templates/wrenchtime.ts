import type { TemplateSchema } from './types'

export const wrenchtimeSchema: TemplateSchema = {
  id: 'wrenchtime',
  name: 'WrenchTime Cycles',
  sections: {
    hero: {
      label: 'Hero',
      fields: {
        eyebrow: { type: 'text', label: 'Eyebrow Tag', default: 'Motorcycle Service & Repair' },
        headlinePrefix: { type: 'text', label: 'Headline (first line)', default: 'Your Bike Deserves' },
        headlineAccent: { type: 'text', label: 'Headline (accent)', default: 'Honest Work.' },
        description: { type: 'textarea', label: 'Description', rows: 3, default: 'WrenchTime Cycles handles everything from oil changes to full diagnostics. Every job is reviewed before it\'s booked — no guesswork, no wasted trips.' },
        cta: { type: 'text', label: 'Button Text', default: 'Request a Service' },
      },
    },
    how: {
      label: 'How It Works',
      fields: {
        title: { type: 'text', label: 'Section Title', default: 'How It Works' },
        steps: {
          type: 'repeatable',
          label: 'Steps',
          itemLabel: 'Step',
          minItems: 1,
          maxItems: 8,
          fields: {
            title: { type: 'text', label: 'Step Title' },
            desc: { type: 'textarea', label: 'Description', rows: 2 },
          },
          defaultItem: { title: 'New Step', desc: 'Describe this step.' },
        },
      },
    },
    services: {
      label: 'Services',
      fields: {
        title: { type: 'text', label: 'Section Title', default: 'What We Work On' },
        items: {
          type: 'repeatable',
          label: 'Services',
          itemLabel: 'Service',
          minItems: 1,
          maxItems: 16,
          fields: {
            name: { type: 'text', label: 'Service Name' },
            price: { type: 'text', label: 'Price' },
          },
          defaultItem: { name: 'New Service', price: 'From $50' },
        },
      },
    },
    bottomCta: {
      label: 'Bottom CTA',
      fields: {
        title: { type: 'text', label: 'Headline', default: 'Ready to get started?' },
        description: { type: 'textarea', label: 'Description', rows: 2, default: 'Submit a request and we\'ll take it from there.' },
        button: { type: 'text', label: 'Button Text', default: 'Request a Service' },
      },
    },
    footer: {
      label: 'Footer',
      fields: {
        copyright: { type: 'text', label: 'Copyright Text', default: `© ${new Date().getFullYear()} WrenchTime Cycles. All rights reserved.` },
      },
    },
  },
}
