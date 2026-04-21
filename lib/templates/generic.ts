import type { TemplateSchema } from './types'

export const genericSchema: TemplateSchema = {
  id: 'generic',
  name: 'Generic Template',
  sections: {
    hero: {
      label: 'Hero',
      fields: {
        headline: { type: 'text', label: 'Headline' },
        subheadline: { type: 'textarea', label: 'Sub-headline', rows: 2 },
        ctaText: { type: 'text', label: 'Button Text' },
        ctaLink: { type: 'text', label: 'Button URL' },
      },
    },
    about: {
      label: 'About',
      fields: {
        title: { type: 'text', label: 'Title' },
        body: { type: 'textarea', label: 'Body', rows: 5 },
      },
    },
    services: {
      label: 'Services',
      fields: {
        title: { type: 'text', label: 'Section Title' },
        items: {
          type: 'repeatable',
          label: 'Services',
          itemLabel: 'Service',
          fields: {
            title: { type: 'text', label: 'Service Name' },
            description: { type: 'textarea', label: 'Description', rows: 2 },
          },
          defaultItem: { title: 'New Service', description: '' },
        },
      },
    },
    gallery: {
      label: 'Gallery',
      fields: {
        title: { type: 'text', label: 'Section Title' },
        photos: {
          type: 'repeatable',
          label: 'Photos',
          itemLabel: 'Photo',
          fields: {
            url: { type: 'image', label: 'Image URL' },
            caption: { type: 'text', label: 'Caption (optional)' },
          },
          defaultItem: { url: '', caption: '' },
        },
      },
    },
    contact: {
      label: 'Contact',
      fields: {
        phone: { type: 'text', label: 'Phone Number' },
        email: { type: 'text', label: 'Email Address' },
        address: { type: 'textarea', label: 'Address', rows: 2 },
        hours: { type: 'textarea', label: 'Business Hours', rows: 3 },
      },
    },
    brand: {
      label: 'Brand & Colors',
      fields: {
        businessName: { type: 'text', label: 'Business Name' },
        tagline: { type: 'text', label: 'Tagline' },
        primaryColor: { type: 'color', label: 'Primary Color', default: '#3B82F6' },
        secondaryColor: { type: 'color', label: 'Secondary Color', default: '#1E40AF' },
      },
    },
  },
}
