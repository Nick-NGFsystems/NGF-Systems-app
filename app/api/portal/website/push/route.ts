import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'

export async function POST() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const client = await db.client.findUnique({
      where: { clerk_user_id: userId },
      include: { config: true },
    })

    if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

    // Get current draft
    const websiteContent = await db.websiteContent.findUnique({
      where: { client_id: client.id },
    })

    if (websiteContent?.draft_content === null || websiteContent?.draft_content === undefined) {
      return NextResponse.json({ error: 'No draft to publish' }, { status: 400 })
    }

    // Promote draft → published content and clear the draft
    await db.websiteContent.update({
      where: { client_id: client.id },
      data: {
        content: websiteContent.draft_content,  // Draft becomes the live content
        draft_content: null,                     // Clear draft after publishing
        published_at: new Date(),
      },
    })

    // Optionally ping the website's revalidate endpoint (non-fatal if it fails —
    // the site uses cache: no-store so the new content appears on next page load anyway)
    if (client.config?.site_url) {
      const secret = process.env.WEBSITE_REVALIDATION_SECRET
      if (secret) {
        const rawUrl = client.config.site_url.trim().replace(/\/$/, '')
        const base = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`
        try {
          await fetch(`${base}/api/revalidate?secret=${secret}`, {
            method: 'GET',
            signal: AbortSignal.timeout(8000),
          })
        } catch {
          // Non-fatal — site fetches fresh content on every load anyway
        }
      }
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[portal/website/push]', err)
    return NextResponse.json({ error: 'Failed to publish' }, { status: 500 })
  }
}
