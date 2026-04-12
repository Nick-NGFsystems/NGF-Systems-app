'use client'
import { useEffect, useState } from 'react'

type HeroContent = { headline: string; subheadline: string; ctaText: string; ctaLink: string }
type AboutContent = { title: string; body: string }
type ServiceItem = { title: string; description: string }
type ContactContent = { phone: string; email: string; address: string; hours: string }
type BrandContent = { businessName: string; tagline: string; primaryColor: string; secondaryColor: string }
type SeoContent = { metaTitle: string; metaDescription: string }
type WebsiteContent = {
  hero: HeroContent; about: AboutContent; services: ServiceItem[]
  contact: ContactContent; brand: BrandContent; gallery: string[]; seo: SeoContent
}

const defaultContent: WebsiteContent = {
  hero: { headline: 'Welcome to Our Business', subheadline: 'We provide quality services', ctaText: 'Get Started', ctaLink: '#contact' },
  about: { title: 'About Us', body: 'We are a dedicated team committed to excellence.' },
  services: [
    { title: 'Service One', description: 'Professional quality service.' },
    { title: 'Service Two', description: 'Expert solutions tailored for you.' },
    { title: 'Service Three', description: 'Reliable support when you need it.' },
  ],
  contact: { phone: '(555) 000-0000', email: 'hello@business.com', address: '123 Main St, City, ST 00000', hours: 'Mon–Fri 9am–5pm' },
  brand: { businessName: 'Business Name', tagline: 'Your tagline here', primaryColor: '#2563eb', secondaryColor: '#1e40af' },
  gallery: [],
  seo: { metaTitle: '', metaDescription: '' },
}

export default function PreviewPage() {
  const [content, setContent] = useState<WebsiteContent>(defaultContent)
  const [editMode, setEditMode] = useState(false)
  const [initialized, setInitialized] = useState(false)

  // Load initial content from API
  useEffect(() => {
    fetch('/api/portal/website')
      .then(r => r.json())
      .then(data => {
        if (data?.content) setContent({ ...defaultContent, ...data.content })
        setInitialized(true)
      })
      .catch(() => setInitialized(true))
  }, [])

  // Listen for messages from parent editor
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'contentUpdate') {
        setContent(prev => ({ ...prev, ...e.data.content }))
      } else if (e.data?.type === 'scrollTo') {
        document.getElementById(e.data.section)?.scrollIntoView({ behavior: 'smooth' })
      } else if (e.data?.type === 'setEditMode') {
        setEditMode(!!e.data.enabled)
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  // ef = editable field: wraps text with click handler in edit mode
  const ef = (section: string, field: string, value: string, className?: string) => {
    if (!editMode) return <span className={className}>{value}</span>
    return (
      <span
        className={`${className ?? ''} cursor-pointer rounded transition-all outline outline-2 outline-transparent hover:outline-blue-400 hover:bg-blue-50/10 px-0.5`}
        onClick={() => window.parent.postMessage({ type: 'fieldClick', section, field, currentValue: value }, '*')}
      >
        {value}
      </span>
    )
  }

  const primary = content.brand?.primaryColor || '#2563eb'
  const secondary = content.brand?.secondaryColor || '#1e40af'
  const businessName = content.brand?.businessName || 'Business Name'

  if (!initialized) return <div className="flex items-center justify-center h-screen bg-gray-50"><div className="text-gray-400">Loading…</div></div>

  return (
    <div className="min-h-screen bg-white font-sans">
      {/* Nav */}
      <nav className="sticky top-0 z-40 px-6 py-3 flex items-center justify-between shadow-sm" style={{ backgroundColor: primary }}>
        <span className="text-white font-bold text-lg">{ef('brand', 'businessName', businessName)}</span>
        <div className="flex gap-6 text-sm text-white/90">
          {['About', 'Services', 'Contact'].map(s => (
            <a key={s} href={`#${s.toLowerCase()}`} className="hover:text-white transition-colors">{s}</a>
          ))}
        </div>
      </nav>

      {/* Hero */}
      <section id="hero" className="py-24 px-6 text-center text-white" style={{ background: `linear-gradient(135deg, ${primary}, ${secondary})` }}>
        <h1 className="text-4xl md:text-5xl font-bold mb-4">{ef('hero', 'headline', content.hero?.headline || '')}</h1>
        <p className="text-xl opacity-90 mb-8 max-w-2xl mx-auto">{ef('hero', 'subheadline', content.hero?.subheadline || '')}</p>
        <a href={content.hero?.ctaLink || '#contact'} className="inline-block bg-white font-semibold px-8 py-3 rounded-full shadow hover:shadow-md transition-shadow" style={{ color: primary }}>
          {ef('hero', 'ctaText', content.hero?.ctaText || '')}
        </a>
      </section>

      {/* About */}
      <section id="about" className="py-20 px-6 max-w-3xl mx-auto text-center">
        <h2 className="text-3xl font-bold mb-4 text-gray-800">{ef('about', 'title', content.about?.title || '')}</h2>
        <p className="text-gray-600 leading-relaxed text-lg">{ef('about', 'body', content.about?.body || '')}</p>
      </section>

      {/* Services */}
      <section id="services" className="py-20 px-6 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12 text-gray-800">Our Services</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {(content.services || []).map((svc, i) => (
              <div key={i} className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className="w-10 h-10 rounded-full mb-4" style={{ backgroundColor: primary }} />
                <h3 className="font-semibold text-lg mb-2 text-gray-800">{ef('services', `${i}.title`, svc.title || '')}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{ef('services', `${i}.description`, svc.description || '')}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="py-20 px-6 max-w-3xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-10 text-gray-800">Contact Us</h2>
        <div className="grid sm:grid-cols-2 gap-6 text-gray-600">
          <div className="bg-gray-50 rounded-xl p-5">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Phone</div>
            <div>{ef('contact', 'phone', content.contact?.phone || '')}</div>
          </div>
          <div className="bg-gray-50 rounded-xl p-5">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Email</div>
            <div>{ef('contact', 'email', content.contact?.email || '')}</div>
          </div>
          <div className="bg-gray-50 rounded-xl p-5">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Address</div>
            <div>{ef('contact', 'address', content.contact?.address || '')}</div>
          </div>
          <div className="bg-gray-50 rounded-xl p-5">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Hours</div>
            <div>{ef('contact', 'hours', content.contact?.hours || '')}</div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 text-center text-sm text-white" style={{ backgroundColor: secondary }}>
        <p className="font-semibold">{businessName}</p>
        {content.brand?.tagline && <p className="opacity-75 mt-1">{content.brand.tagline}</p>}
        <p className="opacity-50 mt-3 text-xs">&copy; {new Date().getFullYear()} {businessName}. All rights reserved.</p>
      </footer>
    </div>
  )
}
