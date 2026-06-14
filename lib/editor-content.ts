// Pure helpers for the website editor's publish pipeline. Deliberately free of
// React/Next imports so they can be unit-tested directly (see
// scripts/verify-materialize.ts).

export type ContentBlock = Record<string, unknown>

interface FieldLike {
  type: string
  // Present only on repeatable fields — the sub-field schema.
  fields?: Record<string, { type: string }>
}

export interface SchemaLike {
  sections: Record<string, { fields: Record<string, FieldLike> }>
}

/**
 * Materialize every EDITED repeatable group into its COMPLETE set: each item's
 * empty/missing sub-fields are backfilled from the live scraped values
 * (`siteValues`, keyed `section.array.index.sub`). Untouched groups — identical
 * to `baseContent` — are left alone so the site keeps rendering its hardcoded
 * defaults.
 *
 * Why this exists (P1 fix): the editor only stores values for items the user
 * actually edited; untouched items stay `''` because they render from the
 * site's hardcoded defaults (the "initialItemCount fills empty rows" model).
 * `stripEmpty` then drops those empty items, so editing ONE item would publish a
 * one-item array — and every client site uses `getItems(...).length > 0 ? items
 * : DEFAULTS`, which abandons the hardcoded set wholesale the moment the array
 * is non-empty. The live list collapses to just the edited item. Materializing
 * the whole list before persist keeps the published array authoritative, so
 * `length > 0 ? items : DEFAULTS` is correct because the array is complete.
 *
 * Pure: returns a new object only when something changed; never mutates input.
 */
export function materializeGroups(
  content: ContentBlock,
  schema: SchemaLike,
  baseContent: ContentBlock,
  siteValues: Record<string, string>,
): ContentBlock {
  let out = content
  for (const [sectionKey, section] of Object.entries(schema.sections)) {
    const sec = content[sectionKey] as Record<string, unknown> | undefined
    if (!sec) continue
    const baseSec = baseContent[sectionKey] as Record<string, unknown> | undefined
    for (const [fieldKey, field] of Object.entries(section.fields)) {
      if (field.type !== 'repeatable' || !field.fields) continue
      const arr = sec[fieldKey]
      if (!Array.isArray(arr)) continue
      // Only materialize a group the user actually touched. An untouched group
      // (still identical to the published baseline) must stay empty so the site
      // keeps its full hardcoded set.
      if (JSON.stringify(arr) === JSON.stringify(baseSec?.[fieldKey])) continue

      const subKeys = Object.keys(field.fields)
      const filled = (arr as Record<string, unknown>[]).map((item, i) => {
        const row: Record<string, unknown> = { ...(item ?? {}) }
        for (const sk of subKeys) {
          const cur = row[sk]
          if (cur === undefined || cur === '') {
            const sv = siteValues[`${sectionKey}.${fieldKey}.${i}.${sk}`]
            if (typeof sv === 'string' && sv !== '') row[sk] = sv
          }
        }
        return row
      })

      if (out === content) out = { ...content }
      out[sectionKey] = { ...(out[sectionKey] as Record<string, unknown>), [fieldKey]: filled }
    }
  }
  return out
}

/**
 * Re-key a group's `siteValues` entries to mirror a structural change to the
 * content array, so the positional backfill in `materializeGroups` always reads
 * the value that actually belongs at each index after a remove/reorder.
 *
 * `op.kind === 'remove'`: drop index `op.index`, shift higher indices down 1.
 * `op.kind === 'move'`: move `op.from` to `op.to` (same splice the content does).
 */
export function reindexSiteValuesForGroup(
  siteValues: Record<string, string>,
  groupPrefix: string,                       // e.g. "services.items."
  op: { kind: 'remove'; index: number } | { kind: 'move'; from: number; to: number },
): Record<string, string> {
  // Build old->new index map for this group.
  let maxIdx = -1
  for (const k of Object.keys(siteValues)) {
    if (!k.startsWith(groupPrefix)) continue
    const idx = parseInt(k.slice(groupPrefix.length), 10)
    if (!isNaN(idx) && idx > maxIdx) maxIdx = idx
  }
  const n = maxIdx + 1
  const remap = new Map<number, number>()
  if (op.kind === 'remove') {
    for (let i = 0; i < n; i++) {
      if (i === op.index) continue          // dropped
      remap.set(i, i > op.index ? i - 1 : i)
    }
  } else {
    const order = Array.from({ length: n }, (_, i) => i)
    const [m] = order.splice(op.from, 1)
    order.splice(op.to, 0, m)
    order.forEach((oldIdx, newIdx) => remap.set(oldIdx, newIdx))
  }

  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(siteValues)) {
    if (!k.startsWith(groupPrefix)) { out[k] = v; continue }
    const rest = k.slice(groupPrefix.length)
    const dot = rest.indexOf('.')
    if (dot < 0) { out[k] = v; continue }
    const idx = parseInt(rest.slice(0, dot), 10)
    const sub = rest.slice(dot + 1)
    if (!remap.has(idx)) continue           // removed index — drop its values
    out[`${groupPrefix}${remap.get(idx)}.${sub}`] = v
  }
  return out
}
