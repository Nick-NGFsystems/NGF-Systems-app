import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { clientId } = await params
  const websiteContent = await db.websiteContent.findUnique({
    where: { client_id: clientId },
    select: {
      client_id: true,
      content: true,
      published_at: true,
    },
  })
  if (!websiteContent) {
    return NextResponse.json({ error: 'Not found' }, { status: 404, headers: CORS })
  }
  return NextResponse.json(websiteContent, { headers: CORS })
}
