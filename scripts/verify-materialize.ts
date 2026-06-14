// Verification for the repeatable-group publish-collapse fix (P1).
// Self-contained, network-free. Run with Node's type stripping:
//
//   node --experimental-strip-types scripts/verify-materialize.ts
//
// Exits non-zero on any failed assertion. Exercises the real
// materializeGroups + reindexSiteValuesForGroup from lib/editor-content.ts
// through the full publish pipeline (materialize -> stripEmpty -> flatten ->
// getItems) the live site sees, covering: a one-item edit (the bug), an
// untouched group, a remove, and an edit+reorder.

import { materializeGroups, reindexSiteValuesForGroup, type SchemaLike, type ContentBlock } from '../lib/editor-content.ts'

// ── Fixture: a 3-item "services.items" group, mirroring the editor testbed ──
const SUB = ['title', 'description', 'priceFrom'] as const
const LIVE = [
  { title: 'Full-room design', description: 'End to end.',  priceFrom: 'from $2,400' },
  { title: 'Refresh & restyle', description: 'Work with what you have.', priceFrom: 'from $900' },
  { title: 'Realtor staging',   description: 'Sell faster.', priceFrom: 'from $1,200' },
]
const COUNT = LIVE.length
const siteValues: Record<string, string> = {}
LIVE.forEach((it, i) => SUB.forEach(s => { siteValues[`services.items.${i}.${s}`] = it[s] }))

const schema: SchemaLike = { sections: { services: { fields: { items: {
  type: 'repeatable',
  fields: Object.fromEntries(SUB.map(s => [s, { type: s === 'description' ? 'textarea' : 'text' }])),
} } } } }
const emptyItem = () => Object.fromEntries(SUB.map(s => [s, ''])) as Record<string, string>
const baseArr = () => Array.from({ length: COUNT }, emptyItem)
const baseContent: ContentBlock = { services: { items: baseArr() } }

// Stable helpers (mirror the editor's stripEmpty and the API/site flatten+getItems).
function stripEmpty(c: ContentBlock): ContentBlock {
  const out: ContentBlock = {}
  for (const [sk, sv] of Object.entries(c ?? {})) {
    if (!sv || typeof sv !== 'object') continue
    const section: Record<string, unknown> = {}
    for (const [fk, fv] of Object.entries(sv as Record<string, unknown>)) {
      if (typeof fv === 'string') { if (fv !== '') section[fk] = fv }
      else if (Array.isArray(fv)) {
        const cleaned = fv.map(it => {
          if (!it || typeof it !== 'object') return it
          const row: Record<string, unknown> = {}
          for (const [k, v] of Object.entries(it as Record<string, unknown>)) { if (typeof v === 'string' && v === '') continue; row[k] = v }
          return row
        })
        if (cleaned.length > 0) section[fk] = cleaned
      } else if (fv != null) section[fk] = fv
    }
    if (Object.keys(section).length > 0) out[sk] = section
  }
  return out
}
function flatten(o: unknown, pre = ''): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
    const key = pre ? `${pre}.${k}` : k
    if (Array.isArray(v)) v.forEach((it, i) => Object.assign(out, flatten(it, `${key}.${i}`)))
    else if (v && typeof v === 'object') Object.assign(out, flatten(v, key))
    else if (v != null) out[key] = String(v)
  }
  return out
}
function getItems(flat: Record<string, string>, prefix: string): Record<string, string>[] {
  const idx = new Set<number>()
  for (const k of Object.keys(flat)) if (k.startsWith(prefix + '.')) { const n = parseInt(k.slice(prefix.length + 1).split('.')[0], 10); if (!isNaN(n)) idx.add(n) }
  return [...idx].sort((a, b) => a - b).map(i => {
    const it: Record<string, string> = {}; const p = `${prefix}.${i}.`
    for (const k of Object.keys(flat)) if (k.startsWith(p)) it[k.slice(p.length)] = flat[k]
    return it
  })
}
const publish = (content: ContentBlock, sv: Record<string, string>) =>
  getItems(flatten(stripEmpty(materializeGroups(content, schema, baseContent, sv))), 'services.items')

let pass = 0, fail = 0
const check = (n: string, c: boolean, d = '') => { if (c) { pass++; console.log('  PASS ' + n) } else { fail++; console.log('  FAIL ' + n + ' ' + d) } }

console.log('-- S1: edit ONE item, publish (the P1 bug) --')
{
  const c: ContentBlock = { services: { items: baseArr() } }
  ;(c.services as { items: Record<string, string>[] }).items[0] = { ...emptyItem(), title: 'EDITED' }
  const out = publish(c, siteValues)
  check(`all ${COUNT} items published (not collapsed to 1)`, out.length === COUNT, `got ${out.length}`)
  check('edited item shows new title', out[0].title === 'EDITED')
  check('untouched items keep their live values', out.slice(1).every((it, i) => it.title === LIVE[i + 1].title))
}

console.log('-- S2: untouched group -> publishes nothing (site keeps defaults) --')
check('0 published', publish({ services: { items: baseArr() } }, siteValues).length === 0)

console.log('-- S3: remove item 1 (must NOT resurrect it) --')
{
  const c: ContentBlock = { services: { items: baseArr() } }
  ;(c.services as { items: unknown[] }).items.splice(1, 1)
  const sv = reindexSiteValuesForGroup(siteValues, 'services.items.', { kind: 'remove', index: 1 })
  const out = publish(c, sv)
  check(`${COUNT - 1} items published`, out.length === COUNT - 1, `got ${out.length}`)
  check('index 1 = original item 2 (item 1 not resurrected)', out[1]?.title === LIVE[2].title, `got "${out[1]?.title}"`)
}

console.log('-- S4: edit item 0 then MOVE it to the end --')
{
  const c: ContentBlock = { services: { items: baseArr() } }
  const items = (c.services as { items: Record<string, string>[] }).items
  items[0] = { ...emptyItem(), title: 'MOVED' }
  const [mv] = items.splice(0, 1); items.splice(COUNT - 1, 0, mv)
  const sv = reindexSiteValuesForGroup(siteValues, 'services.items.', { kind: 'move', from: 0, to: COUNT - 1 })
  const out = publish(c, sv)
  check(`all ${COUNT} items published`, out.length === COUNT, `got ${out.length}`)
  check('edited item now at the end', out[COUNT - 1].title === 'MOVED')
  check('index 0 = original item 1 (shifted correctly)', out[0].title === LIVE[1].title, `got "${out[0].title}"`)
}

console.log(`\n${fail === 0 ? 'ALL PASS' : 'FAILURES'}: ${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
