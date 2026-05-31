import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import sharp from 'sharp'
import { db } from '@/lib/db'

// Next.js 15: bigger bodies for image uploads (default ~4 MB).
// 25 MB raw upload limit — server-side optimization shrinks it before storage.
export const runtime = 'nodejs'
export const maxDuration = 60   // Sharp processing can take a few seconds on large images

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']

// Raster formats we always re-encode to WebP via Sharp.
const RASTER_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

// M1: SVG is rasterized through Sharp too, which strips any embedded <script>,
// so a stored SVG can never execute when its blob URL is opened directly. GIF
// is the only passthrough — re-encoding would drop animation, and GIF carries
// no script.
const SHARP_TYPES = new Set([...RASTER_TYPES, 'image/svg+xml'])

// L3: stored extension is derived from content-type, never from the
// attacker-controlled file.name.
const EXT_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'webp', 'image/png': 'webp', 'image/webp': 'webp',
  'image/svg+xml': 'webp', 'image/gif': 'gif',
}

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024   // 25 MB raw upload
const MAX_DIMENSION_PX = 1920                // Resize down so neither side exceeds this
const WEBP_QUALITY     = 85                  // Visually lossless for marketing imagery
const MAX_INPUT_PIXELS = 100_000_000         // L1: reject >100 MP decode (bomb guard)

export async function POST(request: Request) {
  try {
    const { userId, sessionClaims } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }
    const role = (sessionClaims?.metadata as { role?: string } | undefined)?.role
    if (role !== 'client' && role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Unauthorized role' }, { status: 401 })
    }

    const client = await db.client.findUnique({ where: { clerk_user_id: userId } })
    if (!client) {
      return NextResponse.json({ success: false, error: 'Client not found' }, { status: 403 })
    }

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      console.error('[portal/upload] BLOB_READ_WRITE_TOKEN is not set on this environment')
      return NextResponse.json(
        { success: false, error: 'Blob storage is not configured. Contact support.' },
        { status: 500 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('file')

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ success: false, error: 'File is required' }, { status: 400 })
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: `Only image files are allowed (JPEG, PNG, WebP, GIF, SVG). Got ${file.type || 'unknown'}.` },
        { status: 400 }
      )
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { success: false, error: `File size must be 25 MB or less (this file is ${(file.size / 1024 / 1024).toFixed(1)} MB).` },
        { status: 400 }
      )
    }

    // ── Optimization pipeline ───────────────────────────────────────────────
    // Optimizable raster (JPEG, PNG, WebP): auto-rotate by EXIF, resize so
    // neither side exceeds MAX_DIMENSION_PX, re-encode as WebP at quality 85.
    // Strips embedded metadata (smaller files, privacy win).
    // SVG and GIF pass through unchanged.

    let uploadBuffer: Buffer | File = file
    let uploadContentType = file.type
    let uploadExt = EXT_BY_TYPE[file.type] ?? 'bin'
    const willProcess = SHARP_TYPES.has(file.type)

    if (willProcess) {
      try {
        const inputBuffer = Buffer.from(await file.arrayBuffer())
        uploadBuffer = await sharp(inputBuffer, { failOn: 'none', limitInputPixels: MAX_INPUT_PIXELS })
          .rotate()  // auto-orient by EXIF
          .resize(MAX_DIMENSION_PX, MAX_DIMENSION_PX, {
            fit: 'inside',
            withoutEnlargement: true,
          })
          .webp({ quality: WEBP_QUALITY, effort: 4 })
          .toBuffer()
        uploadContentType = 'image/webp'
        uploadExt = 'webp'
      } catch (err) {
        // M2: a file that claims an image type but Sharp can't decode (corrupt,
        // mislabeled, or a pixel bomb over the limit) is rejected — never stored
        // raw under its client-claimed content-type.
        console.error('[portal/upload] sharp failed for', file.type, err)
        return NextResponse.json(
          { success: false, error: 'That image could not be processed. Please try a different file.' },
          { status: 400 },
        )
      }
    }
    // GIF falls through unchanged (animation preserved; no script risk).

    // Scope every upload to the client's folder in Blob storage and
    // addRandomSuffix so two uploads of "hero.jpg" never collide.
    const baseName = (file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80)) || 'image'
    const pathname = `clients/${client.id}/${baseName}.${uploadExt}`

    const blob = await put(pathname, uploadBuffer, {
      access: 'public',
      addRandomSuffix: true,
      contentType: uploadContentType,
    })

    return NextResponse.json({
      success: true,
      data: {
        url: blob.url,
        optimized: willProcess,
        contentType: uploadContentType,
      },
    })
  } catch (error) {
    // L2: log the detail server-side, return a generic message (no internal leak).
    console.error('[portal/upload] error:', error)
    return NextResponse.json({ success: false, error: 'Failed to upload file. Please try again.' }, { status: 500 })
  }
}
