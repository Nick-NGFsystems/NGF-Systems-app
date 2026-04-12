'use client'

import { useState, useEffect, useCallback } from 'react'

interface Service {
  id: string
  title: string
  description: string
}

interface WebsiteContentData {
  hero: { headline: string; subheadline: string; ctaText: string; ctaLink: string }
  about: { title: string; body: string }
  services: Service[]
  contact: { phone: string; email: string; address: string; hours: string }
  brand: { businessName: string; tagline: string; primaryColor: string; secondaryColor: string }
  gallery: string[]
  seo: { metaTitle: string; metaDescription: string }
}

const defaultContent: WebsiteContentData = {
  hero: { headline: 'Welcome to Our Business', subheadline: 'We provide excellent services', ctaText: 'Get In Touch', ctaLink: '#contact' },
  about: { title: 'About Us', body: 'Tell your story here...' },
  services: [
    { id: '1', title: 'Service One', description: 'Describe your first service' },
    { id: '2', title: 'Service Two', description: 'Describe your second service' },
    { id: '3', title: 'Service Three', description: 'Describe your third service' },
  ],
  contact: { phone: '', email: '', address: '', hours: 'Mon-Fri 9am-5pm' },
  brand: { businessName: '', tagline: '', primaryColor: '#3B82F6', secondaryColor: '#1E40AF' },
  gallery: [],
  seo: { metaTitle: '', metaDescription: '' },
}

type Tab = 'hero' | 'about' | 'services' | 'contact' | 'brand' | 'seo'

export default function WebsiteEditorPage() {
  const [content, setContent] = useState<WebsiteContentData>(defaultContent)
  const [activeTab, setActiveTab] = useState<Tab>('hero')
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [publishedAt, setPublishedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/portal/website')
      .then(r => r.json())
      .then(data => {
        if (data.content) setContent(data.content as WebsiteContentData)
        if (data.published_at) setPublishedAt(new Date(data.published_at).toLocaleString())
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const save = useCallback(async (publish = false) => {
    if (publish) setPublishing(true)
    else setSaving(true)
    try {
      const res = await fetch('/api/portal/website', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, publish }),
      })
      const data = await res.json()
      setSavedAt(new Date().toLocaleTimeString())
      if (publish && data.published_at) setPublishedAt(new Date(data.published_at).toLocaleString())
    } finally {
      setSaving(false)
      setPublishing(false)
    }
  }, [content])

  const updateHero = (field: keyof typeof content.hero, value: string) =>
    setContent(c => ({ ...c, hero: { ...c.hero, [field]: value } }))
  const updateAbout = (field: keyof typeof content.about, value: string) =>
    setContent(c => ({ ...c, about: { ...c.about, [field]: value } }))
  const updateContact = (field: keyof typeof content.contact, value: string) =>
    setContent(c => ({ ...c, contact: { ...c.contact, [field]: value } }))
  const updateBrand = (field: keyof typeof content.brand, value: string) =>
    setContent(c => ({ ...c, brand: { ...c.brand, [field]: value } }))
  const updateSeo = (field: keyof typeof content.seo, value: string) =>
    setContent(c => ({ ...c, seo: { ...c.seo, [field]: value } }))

  const addService = () =>
    setContent(c => ({
      ...c,
      services: [...c.services, { id: Date.now().toString(), title: 'New Service', description: '' }],
    }))
  const updateService = (id: string, field: keyof Service, value: string) =>
    setContent(c => ({
      ...c,
      services: c.services.map(s => (s.id === id ? { ...s, [field]: value } : s)),
    }))
  const removeService = (id: string) =>
    setContent(c => ({ ...c, services: c.services.filter(s => s.id !== id) }))

  const tabs: { key: Tab; label: string }[] = [
    { key: 'hero', label: 'Hero' },
    { key: 'about', label: 'About' },
    { key: 'services', label: 'Services' },
    { key: 'contact', label: 'Contact' },
    { key: 'brand', label: 'Brand' },
    { key: 'seo', label: 'SEO' },
  ]

  const inputClass = 'w-full bg-gray-800 text-white border border-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-400'
  const labelClass = 'block text-xs text-gray-400 mb-1'
  const fieldClass = 'mb-4'

  return (
    <div className="flex h-screen bg-gray-900 overflow-hidden">
      {/* LEFT: Editor Panel */}
      <div className="w-2/5 flex flex-col bg-gray-900 border-r border-gray-700">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-700 bg-gray-850">
          <h1 className="text-white font-semibold text-base">Website Editor</h1>
          {savedAt && <p className="text-xs text-gray-500 mt-0.5">Saved at {savedAt}</p>}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-700 bg-gray-900 overflow-x-auto">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`px-4 py-2 text-xs font-medium whitespace-nowrap transition-colors ${
                activeTab === t.key
                  ? 'text-blue-400 border-b-2 border-blue-400 bg-gray-800'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Form Area */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="text-gray-500 text-sm">Loading...</div>
          ) : (
            <>
              {activeTab === 'hero' && (
                <div>
                  <div className={fieldClass}>
                    <label className={labelClass}>Main Headline</label>
                    <input className={inputClass} value={content.hero.headline} onChange={e => updateHero('headline', e.target.value)} />
                  </div>
                  <div className={fieldClass}>
                    <label className={labelClass}>Sub-headline</label>
                    <input className={inputClass} value={content.hero.subheadline} onChange={e => updateHero('subheadline', e.target.value)} />
                  </div>
                  <div className={fieldClass}>
                    <label className={labelClass}>Button Text</label>
                    <input className={inputClass} value={content.hero.ctaText} onChange={e => updateHero('ctaText', e.target.value)} />
                  </div>
                  <div className={fieldClass}>
                    <label className={labelClass}>Button Link</label>
                    <input className={inputClass} value={content.hero.ctaLink} onChange={e => updateHero('ctaLink', e.target.value)} />
                  </div>
                </div>
              )}

              {activeTab === 'about' && (
                <div>
                  <div className={fieldClass}>
                    <label className={labelClass}>Section Title</label>
                    <input className={inputClass} value={content.about.title} onChange={e => updateAbout('title', e.target.value)} />
                  </div>
                  <div className={fieldClass}>
                    <label className={labelClass}>About Text</label>
                    <textarea rows={8} className={inputClass} value={content.about.body} onChange={e => updateAbout('body', e.target.value)} />
                  </div>
                </div>
              )}

              {activeTab === 'services' && (
                <div>
                  {content.services.map((svc, i) => (
                    <div key={svc.id} className="mb-5 p-3 bg-gray-800 rounded border border-gray-700">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-gray-400 font-medium">Service {i + 1}</span>
                        <button onClick={() => removeService(svc.id)} className="text-red-400 hover:text-red-300 text-xs">Remove</button>
                      </div>
                      <div className={fieldClass}>
                        <label className={labelClass}>Title</label>
                        <input className={inputClass} value={svc.title} onChange={e => updateService(svc.id, 'title', e.target.value)} />
                      </div>
                      <div>
                        <label className={labelClass}>Description</label>
                        <textarea rows={3} className={inputClass} value={svc.description} onChange={e => updateService(svc.id, 'description', e.target.value)} />
                      </div>
                    </div>
                  ))}
                  <button onClick={addService} className="w-full py-2 text-sm text-blue-400 border border-blue-400 border-dashed rounded hover:bg-blue-400/10 transition-colors">
                    + Add Service
                  </button>
                </div>
              )}

              {activeTab === 'contact' && (
                <div>
                  {(['phone', 'email', 'address', 'hours'] as const).map(field => (
                    <div key={field} className={fieldClass}>
                      <label className={labelClass}>{field.charAt(0).toUpperCase() + field.slice(1)}</label>
                      <input className={inputClass} value={content.contact[field]} onChange={e => updateContact(field, e.target.value)} />
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'brand' && (
                <div>
                  <div className={fieldClass}>
                    <label className={labelClass}>Business Name</label>
                    <input className={inputClass} value={content.brand.businessName} onChange={e => updateBrand('businessName', e.target.value)} />
                  </div>
                  <div className={fieldClass}>
                    <label className={labelClass}>Tagline</label>
                    <input className={inputClass} value={content.brand.tagline} onChange={e => updateBrand('tagline', e.target.value)} />
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label className={labelClass}>Primary Color</label>
                      <div className="flex gap-2 items-center">
                        <input type="color" value={content.brand.primaryColor} onChange={e => updateBrand('primaryColor', e.target.value)} className="w-10 h-10 rounded cursor-pointer bg-transparent border-0" />
                        <input className={`${inputClass} flex-1`} value={content.brand.primaryColor} onChange={e => updateBrand('primaryColor', e.target.value)} />
                      </div>
                    </div>
                    <div className="flex-1">
                      <label className={labelClass}>Secondary Color</label>
                      <div className="flex gap-2 items-center">
                        <input type="color" value={content.brand.secondaryColor} onChange={e => updateBrand('secondaryColor', e.target.value)} className="w-10 h-10 rounded cursor-pointer bg-transparent border-0" />
                        <input className={`${inputClass} flex-1`} value={content.brand.secondaryColor} onChange={e => updateBrand('secondaryColor', e.target.value)} />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'seo' && (
                <div>
                  <div className={fieldClass}>
                    <label className={labelClass}>Meta Title</label>
                    <input className={inputClass} value={content.seo.metaTitle} onChange={e => updateSeo('metaTitle', e.target.value)} />
                  </div>
                  <div className={fieldClass}>
                    <label className={labelClass}>Meta Description</label>
                    <textarea rows={4} className={inputClass} value={content.seo.metaDescription} onChange={e => updateSeo('metaDescription', e.target.value)} />
                  </div>
                  <p className="text-xs text-gray-500">SEO settings help search engines understand your website content.</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Save/Publish Buttons */}
        <div className="p-4 border-t border-gray-700 bg-gray-900 space-y-2">
          {publishedAt && <p className="text-xs text-green-400">Last published: {publishedAt}</p>}
          <div className="flex gap-2">
            <button
              onClick={() => save(false)}
              disabled={saving || loading}
              className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded font-medium disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving...' : 'Save Draft'}
            </button>
            <button
              onClick={() => save(true)}
              disabled={publishing || loading}
              className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded font-medium disabled:opacity-50 transition-colors"
            >
              {publishing ? 'Publishing...' : 'Publish'}
            </button>
          </div>
        </div>
      </div>

      {/* RIGHT: Live Preview */}
      <div className="w-3/5 overflow-y-auto bg-white">
        <LivePreview content={content} />
      </div>
    </div>
  )
}

function LivePreview({ content }: { content: WebsiteContentData }) {
  const { hero, about, services, contact, brand } = content
  const primary = brand.primaryColor || '#3B82F6'
  const secondary = brand.secondaryColor || '#1E40AF'
  const businessName = brand.businessName || 'Your Business'

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', fontSize: 14 }}>
      {/* Nav */}
      <nav style={{ background: primary, padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ color: 'white', fontWeight: 700, fontSize: 18 }}>{businessName}</span>
        <div style={{ display: 'flex', gap: 20 }}>
          {['Home', 'About', 'Services', 'Contact'].map(link => (
            <span key={link} style={{ color: 'rgba(255,255,255,0.85)', cursor: 'pointer', fontSize: 13 }}>{link}</span>
          ))}
        </div>
      </nav>

      {/* Hero */}
      <div style={{ background: `linear-gradient(135deg, ${primary}, ${secondary})`, padding: '64px 40px', textAlign: 'center' }}>
        <h1 style={{ color: 'white', fontSize: 36, fontWeight: 800, margin: '0 0 12px' }}>{hero.headline}</h1>
        <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 18, margin: '0 0 28px' }}>{hero.subheadline}</p>
        <a href={hero.ctaLink} style={{ background: 'white', color: primary, padding: '12px 28px', borderRadius: 6, fontWeight: 600, textDecoration: 'none', fontSize: 15 }}>
          {hero.ctaText}
        </a>
      </div>

      {/* About */}
      <div style={{ padding: '48px 40px', background: '#f9fafb' }}>
        <h2 style={{ color: '#111', fontSize: 26, fontWeight: 700, marginBottom: 16 }}>{about.title}</h2>
        <p style={{ color: '#555', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{about.body}</p>
      </div>

      {/* Services */}
      <div style={{ padding: '48px 40px', background: 'white' }}>
        <h2 style={{ color: '#111', fontSize: 26, fontWeight: 700, marginBottom: 24, textAlign: 'center' }}>Our Services</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 20 }}>
          {services.map(svc => (
            <div key={svc.id} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 20, borderTop: `3px solid ${primary}` }}>
              <h3 style={{ color: '#111', fontSize: 16, fontWeight: 600, marginBottom: 8 }}>{svc.title}</h3>
              <p style={{ color: '#666', fontSize: 13, lineHeight: 1.5 }}>{svc.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Contact */}
      <div style={{ padding: '48px 40px', background: '#f9fafb' }} id="contact">
        <h2 style={{ color: '#111', fontSize: 26, fontWeight: 700, marginBottom: 24 }}>Contact Us</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {contact.phone && <div><span style={{ fontWeight: 600, color: '#444' }}>Phone: </span><span style={{ color: '#555' }}>{contact.phone}</span></div>}
          {contact.email && <div><span style={{ fontWeight: 600, color: '#444' }}>Email: </span><span style={{ color: '#555' }}>{contact.email}</span></div>}
          {contact.address && <div><span style={{ fontWeight: 600, color: '#444' }}>Address: </span><span style={{ color: '#555' }}>{contact.address}</span></div>}
          {contact.hours && <div><span style={{ fontWeight: 600, color: '#444' }}>Hours: </span><span style={{ color: '#555' }}>{contact.hours}</span></div>}
          {!contact.phone && !contact.email && !contact.address && (
            <p style={{ color: '#aaa', fontStyle: 'italic' }}>Add your contact info in the Contact tab</p>
          )}
        </div>
      </div>

      {/* Footer */}
      <div style={{ background: secondary, padding: '24px 40px', textAlign: 'center' }}>
        <p style={{ color: 'rgba(255,255,255,0.7)', margin: 0, fontSize: 13 }}>
          &copy; {new Date().getFullYear()} {businessName}
          {brand.tagline ? ` — ${brand.tagline}` : ''}
        </p>
      </div>
    </div>
  )
}
