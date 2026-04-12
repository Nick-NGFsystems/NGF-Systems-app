'use client'

import { useState, useEffect, useRef } from 'react'

interface HeroContent { headline: string; subheadline: string; ctaText: string; ctaLink: string }
interface AboutContent { title: string; body: string }
interface ServiceItem { id: string; title: string; description: string }
interface ContactContent { phone: string; email: string; address: string; hours: string }
interface BrandContent { businessName: string; tagline: string; primaryColor: string; secondaryColor: string }
interface SeoContent { metaTitle: string; metaDescription: string }
interface WebsiteContent {
  hero: HeroContent
  about: AboutContent
  services: ServiceItem[]
  contact: ContactContent
  brand: BrandContent
  gallery: string[]
  seo: SeoContent
}

const defaultContent: WebsiteContent = {
  hero: { headline: 'Welcome to Our Business', subheadline: 'We provide excellent services', ctaText: 'Get In Touch', ctaLink: '#contact' },
  about: { title: 'About Us', body: 'Tell your story here...' },
  services: [
    { id: '1', title: 'Service One', description: 'Describe your first service' },
    { id: '2', title: 'Service Two', description: 'Describe your second service' },
    { id: '3', title: 'Service Three', description: 'Describe your third service' },
  ],
  contact: { phone: '', email: '', address: '', hours: 'Mon-Fri 9am-5pm' },
  brand: { businessName: 'Your Business', tagline: '', primaryColor: '#3B82F6', secondaryColor: '#1E40AF' },
  gallery: [],
  seo: { metaTitle: '', metaDescription: '' },
}

function Section({ id, selected, onClick, children, className = '', style }: {
  id: string; selected: boolean; onClick: (id: string) => void; children: React.ReactNode; className?: string; style?: React.CSSProperties
}) {
  return (
    <section
      id={id}
      onClick={() => onClick(id)}
      style={style} className={`relative cursor-pointer transition-all duration-150 ${className} ${
        selected
          ? 'ring-2 ring-inset ring-blue-500'
          : 'hover:ring-2 hover:ring-inset hover:ring-blue-300'
      }`}
    >
      {selected && (
        <span className="absolute top-2 left-2 z-10 bg-blue-500 text-white text-xs px-2 py-0.5 rounded font-medium shadow">
          {id.charAt(0).toUpperCase() + id.slice(1)}
        </span>
      )}
      {children}
    </section>
  )
}

export default function PreviewPage() {
  const [content, setContent] = useState<WebsiteContent>(defaultContent)
  const [selectedSection, setSelectedSection] = useState<string | null>(null)
  const [editMode] = useState(true)
  const initialized = useRef(false)

  // Fetch initial content
  useEffect(() => {
    if (initialized.current) return
    initialized.current = true
    fetch('/api/portal/website')
      .then(r => r.json())
      .then(data => {
        if (data.content) setContent(data.content as WebsiteContent)
      })
      .catch(() => {})
  }, [])

  // Listen for content updates from parent editor
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'contentUpdate' && e.data.content) {
        setContent(e.data.content as WebsiteContent)
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  const handleSectionClick = (sectionId: string) => {
    setSelectedSection(sectionId)
    window.parent.postMessage({ type: 'sectionSelect', section: sectionId }, '*')
  }

  const primary = content.brand?.primaryColor || '#3B82F6'
  const secondary = content.brand?.secondaryColor || '#1E40AF'
  const businessName = content.brand?.businessName || 'Your Business'

  return (
    <div className="min-h-screen bg-white font-sans" onClick={e => {
      if ((e.target as HTMLElement).closest('section') === null) {
        setSelectedSection(null)
        window.parent.postMessage({ type: 'sectionSelect', section: null }, '*')
      }
    }}>
      {/* Nav */}
      <nav className="sticky top-0 z-20 bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shadow-sm">
        <span className="font-bold text-lg" style={{ color: primary }}>{businessName}</span>
        <div className="hidden sm:flex gap-6 text-sm text-gray-600">
          <a href="#about" className="hover:text-gray-900">About</a>
          <a href="#services" className="hover:text-gray-900">Services</a>
          <a href="#contact" className="hover:text-gray-900">Contact</a>
        </div>
        <a
          href={content.hero?.ctaLink || '#contact'}
          className="px-4 py-1.5 rounded-full text-white text-sm font-medium transition-opacity hover:opacity-90"
          style={{ backgroundColor: primary }}
        >
          {content.hero?.ctaText || 'Get In Touch'}
        </a>
      </nav>

      {/* Hero */}
      <Section id="hero" selected={selectedSection === 'hero'} onClick={handleSectionClick}
        className="py-24 px-6 text-center text-white"
        style={{ background: `linear-gradient(135deg, ${primary} 0%, ${secondary} 100%)` } as React.CSSProperties}
      >
        <h1 className="text-4xl sm:text-5xl font-bold mb-4 drop-shadow">
          {content.hero?.headline || 'Welcome'}
        </h1>
        <p className="text-xl opacity-90 mb-8 max-w-xl mx-auto">
          {content.hero?.subheadline || 'We provide excellent services'}
        </p>
        <a
          href={content.hero?.ctaLink || '#contact'}
          className="inline-block bg-white font-semibold px-8 py-3 rounded-full shadow-lg transition-transform hover:scale-105"
          style={{ color: primary }}
        >
          {content.hero?.ctaText || 'Get In Touch'}
        </a>
      </Section>

      {/* About */}
      <Section id="about" selected={selectedSection === 'about'} onClick={handleSectionClick}
        className="py-20 px-6 max-w-3xl mx-auto"
      >
        <h2 className="text-3xl font-bold mb-6" style={{ color: primary }}>
          {content.about?.title || 'About Us'}
        </h2>
        <p className="text-gray-600 leading-relaxed text-lg whitespace-pre-wrap">
          {content.about?.body || 'Tell your story here...'}
        </p>
      </Section>

      {/* Services */}
      <Section id="services" selected={selectedSection === 'services'} onClick={handleSectionClick}
        className="py-20 px-6"
        style={{ backgroundColor: '#F9FAFB' } as React.CSSProperties}
      >
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold mb-10 text-center" style={{ color: primary }}>
            Our Services
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {(content.services || []).map(svc => (
              <div key={svc.id} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                <div className="w-10 h-10 rounded-lg mb-4 flex items-center justify-center" style={{ backgroundColor: `${primary}20` }}>
                  <svg className="w-5 h-5" fill="none" stroke={primary} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{svc.title}</h3>
                <p className="text-gray-500 text-sm">{svc.description}</p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* Contact */}
      <Section id="contact" selected={selectedSection === 'contact'} onClick={handleSectionClick}
        className="py-20 px-6 max-w-3xl mx-auto"
      >
        <h2 className="text-3xl font-bold mb-10" style={{ color: primary }}>Contact Us</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {content.contact?.phone && (
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${primary}15` }}>
                <svg className="w-4 h-4" fill="none" stroke={primary} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </div>
              <div>
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Phone</p>
                <p className="text-gray-700">{content.contact.phone}</p>
              </div>
            </div>
          )}
          {content.contact?.email && (
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${primary}15` }}>
                <svg className="w-4 h-4" fill="none" stroke={primary} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Email</p>
                <p className="text-gray-700">{content.contact.email}</p>
              </div>
            </div>
          )}
          {content.contact?.address && (
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${primary}15` }}>
                <svg className="w-4 h-4" fill="none" stroke={primary} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Address</p>
                <p className="text-gray-700 whitespace-pre-line">{content.contact.address}</p>
              </div>
            </div>
          )}
          {content.contact?.hours && (
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${primary}15` }}>
                <svg className="w-4 h-4" fill="none" stroke={primary} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Hours</p>
                <p className="text-gray-700">{content.contact.hours}</p>
              </div>
            </div>
          )}
        </div>
      </Section>

      {/* Footer */}
      <footer className="py-8 px-6 text-center text-sm text-white" style={{ backgroundColor: secondary }}>
        <p className="font-semibold">{businessName}</p>
        {content.brand?.tagline && <p className="opacity-75 mt-1">{content.brand.tagline}</p>}
        <p className="opacity-50 mt-3 text-xs">© {new Date().getFullYear()} {businessName}. All rights reserved.</p>
      </footer>

      {editMode && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-gray-900/90 backdrop-blur text-white text-xs px-4 py-2 rounded-full shadow-lg pointer-events-none">
          Click any section to edit it
        </div>
      )}
    </div>
  )
}