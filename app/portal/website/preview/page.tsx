'use client'

import { useState, useEffect, useRef } from 'react'

// Loosely typed — content shape varies by template
type ContentBlock = Record<string, unknown>

function str(obj: ContentBlock, key: string, fallback = ''): string {
  return typeof obj[key] === 'string' ? (obj[key] as string) : fallback
}

function arr(obj: ContentBlock, key: string): ContentBlock[] {
  return Array.isArray(obj[key]) ? (obj[key] as ContentBlock[]) : []
}

function block(obj: ContentBlock, key: string): ContentBlock {
  return (obj[key] && typeof obj[key] === 'object' && !Array.isArray(obj[key]))
    ? (obj[key] as ContentBlock)
    : {}
}

// ── Section wrapper ──────────────────────────────────────────────────────────

function Section({
  id, selected, onSelect, children, className = '', style,
}: {
  id: string
  selected: boolean
  onSelect: (id: string) => void
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <section
      id={id}
      onClick={(e) => { e.stopPropagation(); onSelect(id) }}
      className={`relative cursor-pointer transition-all duration-150 ${className} ${
        selected
          ? 'ring-2 ring-inset ring-blue-500'
          : 'hover:ring-2 hover:ring-inset hover:ring-blue-200'
      }`}
      style={style}
    >
      {selected && (
        <span className="absolute top-2 left-2 z-10 bg-blue-500 text-white text-xs px-2 py-0.5 rounded font-medium shadow pointer-events-none select-none">
          {id.charAt(0).toUpperCase() + id.slice(1)}
        </span>
      )}
      {children}
    </section>
  )
}

// ── Main preview ─────────────────────────────────────────────────────────────

export default function PreviewPage() {
  const [content, setContent] = useState<ContentBlock>({})
  const [selected, setSelected] = useState<string | null>(null)
  const initialized = useRef(false)

  // Load current draft on mount, then signal the parent editor that we're ready.
  // The editor responds with a 'contentUpdate' containing schema-defaults-applied content,
  // which gives a richer initial preview than the raw stored content.
  useEffect(() => {
    if (initialized.current) return
    initialized.current = true
    fetch('/api/portal/website')
      .then(r => r.json())
      .then(data => {
        if (data?.content) setContent(data.content as ContentBlock)
        // Tell parent editor we're ready — it will respond with contentUpdate
        window.parent.postMessage({ type: 'ngfReady' }, '*')
      })
      .catch(() => {
        // Even on error, signal ready so editor can push content
        window.parent.postMessage({ type: 'ngfReady' }, '*')
      })
  }, [])

  // Listen for editor postMessages
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'contentUpdate' && e.data.content) {
        setContent(e.data.content as ContentBlock)
      }
      if (e.data?.type === 'scrollTo' && e.data.section) {
        document.getElementById(e.data.section as string)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  const selectSection = (id: string) => {
    setSelected(id)
    window.parent.postMessage({ type: 'sectionSelect', section: id }, '*')
  }

  const deselect = () => {
    setSelected(null)
    window.parent.postMessage({ type: 'sectionSelect', section: null }, '*')
  }

  // ── Extract sections ───────────────────────────────────────────────────────
  const brand    = block(content, 'brand')
  const hero     = block(content, 'hero')
  const about    = block(content, 'about')
  const services = block(content, 'services')
  const gallery  = block(content, 'gallery')
  const contact  = block(content, 'contact')
  const how      = block(content, 'how')
  const bottomCta = block(content, 'bottomCta')
  const footer   = block(content, 'footer')

  const primary      = str(brand, 'primaryColor', '#3B82F6')
  const secondary    = str(brand, 'secondaryColor', '#1E40AF')
  const businessName = str(brand, 'businessName', 'Your Business')

  const serviceItems  = arr(services, 'items')
  const galleryPhotos = arr(gallery, 'photos')
  const howSteps      = arr(how, 'steps')

  // Covers both generic (headline/subheadline) and wrenchtime (headlinePrefix/eyebrow) templates
  const hasHero    = !!(str(hero, 'headline') || str(hero, 'subheadline') || str(hero, 'headlinePrefix') || str(hero, 'eyebrow'))
  const hasAbout   = !!str(about, 'title')
  const hasContact = !!(str(contact, 'phone') || str(contact, 'email') || str(contact, 'address') || str(contact, 'hours'))
  const hasBottomCta = !!str(bottomCta, 'title')

  return (
    <div
      className="min-h-screen bg-white font-sans text-gray-900"
      onClick={deselect}
    >
      {/* Nav */}
      <nav
        className="sticky top-0 z-20 px-6 py-3 flex items-center justify-between shadow-sm"
        style={{ backgroundColor: primary }}
      >
        <span className="font-bold text-white text-lg">{businessName}</span>
        <div className="flex gap-5 text-sm text-white/80">
          {hasAbout        && <span>About</span>}
          {serviceItems.length > 0 && <span>Services</span>}
          {galleryPhotos.length > 0 && <span>Gallery</span>}
          {hasContact      && <span>Contact</span>}
        </div>
      </nav>

      {/* Hero */}
      {hasHero && (
        <Section
          id="hero"
          selected={selected === 'hero'}
          onSelect={selectSection}
          className="py-20 px-6 text-center text-white"
          style={{ background: `linear-gradient(135deg, ${primary} 0%, ${secondary} 100%)` }}
        >
          {/* Generic template headline */}
          {str(hero, 'headline') && (
            <h1 className="text-4xl sm:text-5xl font-bold mb-4 drop-shadow">
              {str(hero, 'headline')}
            </h1>
          )}
          {str(hero, 'subheadline') && (
            <p className="text-xl opacity-90 mb-8 max-w-xl mx-auto">
              {str(hero, 'subheadline')}
            </p>
          )}
          {/* WrenchTime split headline + eyebrow */}
          {str(hero, 'eyebrow') && (
            <p className="text-sm font-semibold uppercase tracking-widest opacity-80 mb-4">
              {str(hero, 'eyebrow')}
            </p>
          )}
          {str(hero, 'headlinePrefix') && (
            <h1 className="text-4xl sm:text-5xl font-bold mb-4 drop-shadow">
              {str(hero, 'headlinePrefix')}
              <span className="block opacity-90">{str(hero, 'headlineAccent')}</span>
            </h1>
          )}
          {str(hero, 'description') && (
            <p className="text-lg opacity-90 mb-8 max-w-xl mx-auto">
              {str(hero, 'description')}
            </p>
          )}
          {(str(hero, 'ctaText') || str(hero, 'cta')) && (
            <span
              className="inline-block bg-white font-semibold px-8 py-3 rounded-full shadow-lg cursor-default select-none"
              style={{ color: primary }}
            >
              {str(hero, 'ctaText') || str(hero, 'cta')}
            </span>
          )}
        </Section>
      )}

      {/* How It Works (WrenchTime) */}
      {howSteps.length > 0 && (
        <Section
          id="how"
          selected={selected === 'how'}
          onSelect={selectSection}
          className="py-16 px-6 bg-gray-50"
        >
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-10" style={{ color: primary }}>
              {str(how, 'title', 'How It Works')}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {howSteps.map((step, i) => (
                <div key={i} className="bg-white rounded-xl p-5 shadow-sm">
                  <p className="text-2xl font-bold mb-3" style={{ color: primary }}>
                    {String(i + 1).padStart(2, '0')}
                  </p>
                  <h3 className="font-semibold text-gray-900 mb-2">{str(step, 'title')}</h3>
                  <p className="text-gray-500 text-sm">{str(step, 'desc')}</p>
                </div>
              ))}
            </div>
          </div>
        </Section>
      )}

      {/* About */}
      {hasAbout && (
        <Section
          id="about"
          selected={selected === 'about'}
          onSelect={selectSection}
          className="py-16 px-6"
        >
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold mb-6" style={{ color: primary }}>
              {str(about, 'title')}
            </h2>
            <p className="text-gray-600 leading-relaxed text-lg whitespace-pre-wrap">
              {str(about, 'body')}
            </p>
          </div>
        </Section>
      )}

      {/* Services */}
      {serviceItems.length > 0 && (
        <Section
          id="services"
          selected={selected === 'services'}
          onSelect={selectSection}
          className="py-16 px-6 bg-gray-50"
        >
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl font-bold mb-10 text-center" style={{ color: primary }}>
              {str(services, 'title', 'Services')}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {serviceItems.map((svc, i) => {
                // Generic: title + description  |  WrenchTime: name + price
                const heading = str(svc, 'title') || str(svc, 'name')
                const sub     = str(svc, 'description') || str(svc, 'price')
                return (
                  <div key={i} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                    <h3 className="font-semibold text-gray-900 mb-2" style={{ color: primary }}>
                      {heading}
                    </h3>
                    {sub && <p className="text-gray-500 text-sm">{sub}</p>}
                  </div>
                )
              })}
            </div>
          </div>
        </Section>
      )}

      {/* Gallery */}
      {galleryPhotos.length > 0 && (
        <Section
          id="gallery"
          selected={selected === 'gallery'}
          onSelect={selectSection}
          className="py-16 px-6"
        >
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl font-bold mb-10 text-center" style={{ color: primary }}>
              {str(gallery, 'title', 'Gallery')}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {galleryPhotos.map((photo, i) => (
                <div key={i} className="aspect-square rounded-xl overflow-hidden bg-gray-100">
                  {str(photo, 'url') && (
                    <img
                      src={str(photo, 'url')}
                      alt={str(photo, 'caption', `Photo ${i + 1}`)}
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        </Section>
      )}

      {/* Contact */}
      {hasContact && (
        <Section
          id="contact"
          selected={selected === 'contact'}
          onSelect={selectSection}
          className="py-16 px-6"
        >
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold mb-10" style={{ color: primary }}>Contact</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { label: 'Phone',   value: str(contact, 'phone') },
                { label: 'Email',   value: str(contact, 'email') },
                { label: 'Address', value: str(contact, 'address') },
                { label: 'Hours',   value: str(contact, 'hours') },
              ]
                .filter(f => f.value)
                .map(f => (
                  <div key={f.label} className="rounded-xl border border-gray-200 bg-white p-5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">
                      {f.label}
                    </p>
                    <p className="text-gray-900 whitespace-pre-line">{f.value}</p>
                  </div>
                ))}
            </div>
          </div>
        </Section>
      )}

      {/* Bottom CTA (WrenchTime) */}
      {hasBottomCta && (
        <Section
          id="bottomCta"
          selected={selected === 'bottomCta'}
          onSelect={selectSection}
          className="py-16 px-6 text-center"
          style={{ backgroundColor: `${primary}10` }}
        >
          <h2 className="text-3xl font-bold mb-4" style={{ color: primary }}>
            {str(bottomCta, 'title')}
          </h2>
          <p className="text-gray-600 mb-6 max-w-xl mx-auto">
            {str(bottomCta, 'description')}
          </p>
          {str(bottomCta, 'button') && (
            <span
              className="inline-block px-8 py-3 text-white rounded-xl font-semibold cursor-default"
              style={{ backgroundColor: primary }}
            >
              {str(bottomCta, 'button')}
            </span>
          )}
        </Section>
      )}

      {/* Footer */}
      <footer className="py-8 px-6 text-center text-sm text-white" style={{ backgroundColor: secondary }}>
        <p className="font-semibold">{businessName}</p>
        {str(brand, 'tagline') && (
          <p className="opacity-75 mt-1">{str(brand, 'tagline')}</p>
        )}
        <p className="opacity-50 mt-3 text-xs">
          {str(footer, 'copyright') || `© ${new Date().getFullYear()} ${businessName}. All rights reserved.`}
        </p>
      </footer>

      {/* Hint */}
      {selected && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-gray-900/80 backdrop-blur-sm text-white text-xs px-4 py-2 rounded-full shadow-lg pointer-events-none select-none">
          Sidebar jumped to <strong>{selected}</strong> fields
        </div>
      )}
    </div>
  )
}
