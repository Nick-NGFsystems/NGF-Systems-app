import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'

const defaultContent = {
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
  const client = await db.client.findUnique({ where: { clerk_user_id: userId } })
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  let websiteContent = await db.websiteContent.findUnique({ where: { client_id: client.id } })
  if (!websiteContent) {
    websiteContent = await db.websiteContent.create({ data: { client_id: client.id, content: defaultContent } })
  }
  return NextResponse.json(websiteContent)
}

export async function PUT(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const client = await db.client.findUnique({ where: { clerk_user_id: userId } })
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  const body = await request.json()
  const { content, publish } = body
  const updated = await db.websiteContent.upsert({
    where: { client_id: client.id },
    update: { content, ...(publish ? { published_at: new Date() } : {}) },
    create: { client_id: client.id, content, ...(publish ? { published_at: new Date() } : {}) },
  })
  return NextResponse.json(updated)
}
