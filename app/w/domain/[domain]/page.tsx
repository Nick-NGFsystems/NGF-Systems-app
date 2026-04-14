import { db } from '@/lib/db'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

interface WebsiteContent {
  hero: { headline: string; subheadline: string; ctaText: string; ctaLink: string }
  about: { title: string; body: string }
  services: { id: string; title: string; description: string }[]
  contact: { phone: string; email: string; address: string; hours: string }
  brand: { businessName: string; tagline: string; primaryColor: string; secondaryColor: string }
  gallery: string[]
  seo: { metaTitle: string; metaDescription: string }
}

async function resolveByDomain(domain: string) {
  const decoded = decodeURIComponent(domain).replace(/^www\./, '')
  const clients = await db.client.findMany({
    where: { config: { isNot: null } },
    include: { config: true },
  })
  return (
    clients.find((c) => {
      if (!c.config?.site_url) return false
      const normalized = c.config.site_url
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '')
        .replace(/\/$/, '')
      return normalized === decoded || normalized === `www.${decoded}`
    }) ?? null
  )
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ domain: string }>
}): Promise<Metadata> {
  const ngfMeta = { other: { 'ngf-public-api': 'https://app.ngfsystems.com/api/public/website' } }
  const { domain } = await params
  const client = await resolveByDomain(domain)
  if (!client) return ngfMeta
  const wc = await db.websiteContent.findUnique({ where: { client_id: client.id } })
  if (!wc) return ngfMeta
  const c = wc.content as unknown as WebsiteContent
  return {
    title: c.seo?.metaTitle || c.brand?.businessName || 'Welcome',
    description: c.seo?.metaDescription || '',
    other: { 'ngf-public-api': 'https://app.ngfsystems.com/api/public/website' },
  }
}

export default async function DomainPage({
  params,
}: {
  params: Promise<{ domain: string }>
}) {
  const { domain } = await params
  const client = await resolveByDomain(domain)
  if (!client) return notFound()
  const websiteContent = await db.websiteContent.findUnique({
    where: { client_id: client.id },
  })
  if (!websiteContent) return notFound()
  const c = websiteContent.content as unknown as WebsiteContent
  const primary = c.brand?.primaryColor || '#3B82F6'
  const secondary = c.brand?.secondaryColor || '#1E40AF'
  const businessName = c.brand?.businessName || 'Our Business'
  return (
    <div className="min-h-screen font-sans" style={{ color: '#1f2937' }}>
      <nav className="px-6 py-4 flex items-center justify-between shadow-sm" style={{ backgroundColor: primary }}>
        <span className="text-white font-bold text-xl">{businessName}</span>
        <div className="flex gap-6 text-white text-sm">
          <a href="#about" className="hover:opacity-75">About</a>
          <a href="#services" className="hover:opacity-75">Services</a>
          <a href="#contact" className="hover:opacity-75">Contact</a>
        </div>
      </nav>
      <section className="py-20 px-6 text-center" style={{ background: `linear-gradient(135deg, ${primary}22, ${secondary}22)` }}>
        <h1 className="text-4xl font-bold mb-4">{c.hero?.headline}</h1>
        <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">{c.hero?.subheadline}</p>
        {c.hero?.ctaText && (
          <a
            href={c.hero.ctaLink || '#contact'}
            className="inline-block px-8 py-3 text-white rounded-lg font-semibold hover:opacity-90 transition"
            style={{ backgroundColor: primary }}
          >
            {c.hero.ctaText}
          </a>
        )}
      </section>
      <section id="about" className="py-16 px-6 max-w-4xl mx-auto">
        <h2 className="text-3xl font-bold mb-6">{c.about?.title}</h2>
        <p className="text-gray-600 leading-relaxed">{c.about?.body}</p>
      </section>
      {c.services && c.services.length > 0 && (
        <section id="services" className="py-16 px-6" style={{ backgroundColor: '#f9fafb' }}>
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl font-bold mb-10 text-center">Our Services</h2>
            <div className="grid md:grid-cols-3 gap-6">
              {c.services.map((svc) => (
                <div key={svc.id} className="bg-white rounded-xl p-6 shadow-sm">
                  <h3 className="font-semibold text-lg mb-2" style={{ color: primary }}>{svc.title}</h3>
                  <p className="text-gray-500 text-sm">{svc.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
      <section id="contact" className="py-16 px-6 max-w-4xl mx-auto">
        <h2 className="text-3xl font-bold mb-8">Contact Us</h2>
        <div className="grid md:grid-cols-2 gap-6 text-gray-600">
          {c.contact?.phone && <p><span className="font-medium">Phone:</span> {c.contact.phone}</p>}
          {c.contact?.email && <p><span className="font-medium">Email:</span> {c.contact.email}</p>}
          {c.contact?.address && <p><span className="font-medium">Address:</span> {c.contact.address}</p>}
          {c.contact?.hours && <p><span className="font-medium">Hours:</span> {c.contact.hours}</p>}
        </div>
      </section>
      <footer className="py-8 px-6 text-center text-sm text-white" style={{ backgroundColor: secondary }}>
        <p className="font-semibold">{businessName}</p>
        {c.brand?.tagline && <p className="opacity-75 mt-1">{c.brand.tagline}</p>}
        <p className="opacity-50 mt-3 text-xs">&copy; {new Date().getFullYear()} {businessName}. All rights reserved.</p>
      </footer>
    </div>
  )
}
