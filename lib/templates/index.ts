import type { TemplateSchema } from './types'
import { wrenchtimeSchema } from './wrenchtime'
import { genericSchema } from './generic'

export type { TemplateSchema }
export * from './types'

const registry: Record<string, TemplateSchema> = {
  wrenchtime: wrenchtimeSchema,
  generic: genericSchema,
}

export function getTemplate(id: string | null | undefined): TemplateSchema {
  return registry[id ?? 'generic'] ?? genericSchema
}
