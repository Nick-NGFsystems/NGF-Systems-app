import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'

const baseDefaultContent = {
  hero: { headline: 'Welcome to Our Business', subheadline: 'We provide excellent services', ctaText: 'Get In Touch', ctaLink: '#contact' },
  about: { title: 'About Us', body: 'Tell your story here...' },
  services: [
    { id: '1', title: 'Service One', description: 'Describe your first service' },
    { id: '2', title: 'Service Two', description: 'Describe your second service' },
    { id: '3', title: 'Service Three', description: 'Describe your third service' },
  ],
  contact: { phone: '', email: '', address: '', hours: 'Mon-Fri 9am-5pm' },
  brand: { businessName: '', tagline: '', primaryColor: '#3B82F6', secondaryColor: '#1E40AF' },
  gallery: [] as string[],
  seo: { metaTitle: '', metaDescription: '' },
}

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
  const client = await db.client.findUnique({
    where: { clerk_user_id: userId },
    include: { config: true },
  })
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  let websiteContent = await db.websiteContent.findUnique({ where: { client_id: client.id } })
  if (!websiteContent) {
    // Seed business name from client config or client name
    const seededContent = {
      ...baseDefaultContent,
      brand: {
        ...baseDefaultContent.brand,
        businessName: client.business || client.name || '',
        primaryColor: '#3B82F6',
        secondaryColor: '#1E40AF',
      },
      contact: {
        ...baseDefaultContent.contact,
        phone: client.phone || '',
        email: client.email || '',
      },
    }
    websiteContent = await db.websiteContent.create({ data: { client_id: client.id, content: seededContent } })
  }
  return NextResponse.json({
    ...websiteContent,
    site_url: client.config?.site_url ?? null,
    client_id: client.id,
  })
  } catch (err) {
    console.error('[portal/website GET]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
  const client = await db.client.findUnique({
    where: { clerk_user_id: userId },
    include: { config: true },
  })
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  const { content } = await request.json()
  const websiteContent = await db.websiteContent.upsert({
    where: { client_id: client.id },
    update: { content },
    create: { client_id: client.id, content },
  })
  return NextResponse.json(websiteContent)
  } catch (err) {
    console.error('[portal/website POST]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }    
}
