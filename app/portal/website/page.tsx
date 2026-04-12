'use client'

import { useState, useEffect } from 'react'

interface WebsiteData {
  id: string
  client_id: string
  content: Record<string, unknown>
  published_at: string | null
  site_url: string | null
}

function WebsiteFrame({ siteUrl }: { siteUrl: string }) {
  const [iframeError, setIframeError] = useState(false)

  return (
    <div className="flex flex-col h-full bg-gray-100">
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-200 border-b border-gray-300">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-400" />
          <div className="w-3 h-3 rounded-full bg-yellow-400" />
          <div className="w-3 h-3 rounded-full bg-green-400" />
        </div>
        <div className="flex-1 bg-white rounded px-3 py-1 text-xs text-gray-600 truncate border border-gray-300">
          {siteUrl}
        </div>
        <a
          href={siteUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-600 hover:text-blue-800 whitespace-nowrap"
        >
          Open ↗
        </a>
      </div>
      {iframeError ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
          <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
          <div>
            <p className="text-gray-600 font-medium mb-1">Website can&apos;t be embedded</p>
            <p className="text-gray-500 text-sm mb-3">This site blocks embedding for security reasons.</p>
            <a
              href={siteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
            >
              Open in new tab ↗
            </a>
          </div>
        </div>
      ) : (
        <iframe
          src={siteUrl}
          className="flex-1 w-full border-0"
          onError={() => setIframeError(true)}
          sandbox="allow-scripts allow-same-origin allow-forms"
          title="Client website preview"
        />
      )}
    </div>
  )
}

function NoWebsiteState() {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-gray-50">
      <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
        </svg>
      </div>
      <h2 className="text-gray-700 font-semibold text-xl mb-2">No Website Connected</h2>
      <p className="text-gray-500 text-sm max-w-xs mb-4">
        Your website hasn&apos;t been linked to this editor yet. Contact your NGF Systems administrator to connect your website URL.
      </p>
      <div className="bg-blue-50 border border-blue-200 rounded-lg px-5 py-4 max-w-sm text-left">
        <p className="text-blue-800 text-xs font-medium mb-1">Once connected, you can:</p>
        <ul className="text-blue-700 text-xs space-y-1">
          <li>• View your live website here</li>
          <li>• Manage your website content on the left</li>
          <li>• Publish updates directly from this panel</li>
        </ul>
      </div>
    </div>
  )
}

export default function WebsitePage() {
  const [websiteData, setWebsiteData] = useState<WebsiteData | null>(null)
  const [siteUrl, setSiteUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'hero' | 'about' | 'services' | 'contact' | 'brand' | 'seo'>('hero')
  const [content, setContent] = useState<Record<string, unknown>>({})

  useEffect(() => {
    fetch('/api/portal/website')
      .then(r => r.json())
      .then((data: WebsiteData) => {
        setWebsiteData(data)
        setContent(data.content as Record<string, unknown>)
        setSiteUrl(data.site_url ?? null)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const handleSave = async (publish = false) => {
    setSaving(true)
    try {
      await fetch('/api/portal/website', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, publish }),
      })
    } finally {
      setSaving(false)
    }
  }

  const updateContent = (section: string, field: string, value: string) => {
    setContent(prev => ({
      ...prev,
      [section]: { ...(prev[section] as Record<string, unknown>), [field]: value },
    }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="text-white">Loading...</div>
      </div>
    )
  }

  const hero = (content.hero || {}) as Record<string, string>
  const about = (content.about || {}) as Record<string, string>
  const contact = (content.contact || {}) as Record<string, string>
  const brand = (content.brand || {}) as Record<string, string>
  const seo = (content.seo || {}) as Record<string, string>

  return (
    <div className="flex h-screen bg-gray-900">
      {/* Left panel - editor */}
      <div className="w-96 flex-shrink-0 flex flex-col bg-gray-900 border-r border-gray-700">
        <div className="p-4 border-b border-gray-700">
          <h1 className="text-white font-semibold text-lg">Website Editor</h1>
          {websiteData?.published_at && (
            <p className="text-gray-400 text-xs mt-1">
              Last published: {new Date(websiteData.published_at).toLocaleDateString()}
            </p>
          )}
        </div>

        {/* Tab navigation */}
        <div className="flex flex-wrap gap-1 p-3 border-b border-gray-700">
          {(['hero', 'about', 'services', 'contact', 'brand', 'seo'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1 rounded text-xs font-medium capitalize transition-colors ${
                activeTab === tab
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {activeTab === 'hero' && (
            <>
              <div>
                <label className="block text-gray-400 text-xs mb-1">Headline</label>
                <input
                  value={hero.headline || ''}
                  onChange={e => updateContent('hero', 'headline', e.target.value)}
                  className="w-full bg-gray-800 text-white text-sm rounded px-3 py-2 border border-gray-600 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-gray-400 text-xs mb-1">Subheadline</label>
                <input
                  value={hero.subheadline || ''}
                  onChange={e => updateContent('hero', 'subheadline', e.target.value)}
                  className="w-full bg-gray-800 text-white text-sm rounded px-3 py-2 border border-gray-600 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-gray-400 text-xs mb-1">CTA Button Text</label>
                <input
                  value={hero.ctaText || ''}
                  onChange={e => updateContent('hero', 'ctaText', e.target.value)}
                  className="w-full bg-gray-800 text-white text-sm rounded px-3 py-2 border border-gray-600 focus:border-blue-500 focus:outline-none"
                />
              </div>
            </>
          )}

          {activeTab === 'about' && (
            <>
              <div>
                <label className="block text-gray-400 text-xs mb-1">Section Title</label>
                <input
                  value={about.title || ''}
                  onChange={e => updateContent('about', 'title', e.target.value)}
                  className="w-full bg-gray-800 text-white text-sm rounded px-3 py-2 border border-gray-600 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-gray-400 text-xs mb-1">Body Text</label>
                <textarea
                  value={about.body || ''}
                  onChange={e => updateContent('about', 'body', e.target.value)}
                  rows={6}
                  className="w-full bg-gray-800 text-white text-sm rounded px-3 py-2 border border-gray-600 focus:border-blue-500 focus:outline-none resize-none"
                />
              </div>
            </>
          )}

          {activeTab === 'contact' && (
            <>
              {(['phone', 'email', 'address', 'hours'] as const).map(field => (
                <div key={field}>
                  <label className="block text-gray-400 text-xs mb-1 capitalize">{field}</label>
                  <input
                    value={contact[field] || ''}
                    onChange={e => updateContent('contact', field, e.target.value)}
                    className="w-full bg-gray-800 text-white text-sm rounded px-3 py-2 border border-gray-600 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              ))}
            </>
          )}

          {activeTab === 'brand' && (
            <>
              <div>
                <label className="block text-gray-400 text-xs mb-1">Business Name</label>
                <input
                  value={brand.businessName || ''}
                  onChange={e => updateContent('brand', 'businessName', e.target.value)}
                  className="w-full bg-gray-800 text-white text-sm rounded px-3 py-2 border border-gray-600 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-gray-400 text-xs mb-1">Tagline</label>
                <input
                  value={brand.tagline || ''}
                  onChange={e => updateContent('brand', 'tagline', e.target.value)}
                  className="w-full bg-gray-800 text-white text-sm rounded px-3 py-2 border border-gray-600 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-gray-400 text-xs mb-1">Primary Color</label>
                <div className="flex gap-2 items-center">
                  <input
                    type="color"
                    value={brand.primaryColor || '#3B82F6'}
                    onChange={e => updateContent('brand', 'primaryColor', e.target.value)}
                    className="w-10 h-8 rounded cursor-pointer border-0"
                  />
                  <span className="text-gray-400 text-sm">{brand.primaryColor || '#3B82F6'}</span>
                </div>
              </div>
            </>
          )}

          {activeTab === 'seo' && (
            <>
              <div>
                <label className="block text-gray-400 text-xs mb-1">Meta Title</label>
                <input
                  value={seo.metaTitle || ''}
                  onChange={e => updateContent('seo', 'metaTitle', e.target.value)}
                  className="w-full bg-gray-800 text-white text-sm rounded px-3 py-2 border border-gray-600 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-gray-400 text-xs mb-1">Meta Description</label>
                <textarea
                  value={seo.metaDescription || ''}
                  onChange={e => updateContent('seo', 'metaDescription', e.target.value)}
                  rows={4}
                  className="w-full bg-gray-800 text-white text-sm rounded px-3 py-2 border border-gray-600 focus:border-blue-500 focus:outline-none resize-none"
                />
              </div>
            </>
          )}

          {activeTab === 'services' && (
            <p className="text-gray-400 text-sm">Services editing coming soon.</p>
          )}
        </div>

        {/* Save buttons */}
        <div className="p-4 border-t border-gray-700 flex gap-2">
          <button
            onClick={() => handleSave(false)}
            disabled={saving}
            className="flex-1 bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium py-2 rounded transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Draft'}
          </button>
          <button
            onClick={() => handleSave(true)}
            disabled={saving}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 rounded transition-colors disabled:opacity-50"
          >
            Publish
          </button>
        </div>
      </div>

      {/* Right panel - website view */}
      <div className="flex-1 overflow-hidden">
        {siteUrl ? <WebsiteFrame siteUrl={siteUrl} /> : <NoWebsiteState />}
      </div>
    </div>
  )
}
