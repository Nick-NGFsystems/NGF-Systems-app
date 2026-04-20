export type FieldType = 'text' | 'textarea' | 'image' | 'link' | 'toggle' | 'color' | 'repeatable'

interface BaseField {
  label: string
  placeholder?: string
}

export interface TextField extends BaseField {
  type: 'text'
  default?: string
}

export interface TextareaField extends BaseField {
  type: 'textarea'
  rows?: number
  default?: string
}

export interface ImageField extends BaseField {
  type: 'image'
  default?: string
}

export interface LinkField extends BaseField {
  type: 'link'
  default?: string
}

export interface ToggleField extends BaseField {
  type: 'toggle'
  default?: boolean
}

export interface ColorField extends BaseField {
  type: 'color'
  default?: string
}

export type LeafField = TextField | TextareaField | ImageField | LinkField | ToggleField | ColorField

export interface RepeatableField extends BaseField {
  type: 'repeatable'
  itemLabel: string
  minItems?: number
  maxItems?: number
  fields: Record<string, LeafField>
  defaultItem: Record<string, string>
}

export type FieldDefinition = LeafField | RepeatableField

export interface SectionSchema {
  label: string
  description?: string
  fields: Record<string, FieldDefinition>
}

export interface TemplateSchema {
  id: string
  name: string
  sections: Record<string, SectionSchema>
}
