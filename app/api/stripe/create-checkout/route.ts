import { NextResponse } from 'next/server'

// Deprecated: self-serve plan checkout was removed. All subscriptions are
// now admin-created from /admin/clients/[id] via the Billing card.
// This route returns 410 Gone so any lingering callers get a clear signal.

export async function POST() {
  return NextResponse.json(
    { error: 'Self-serve checkout is no longer supported. An admin will create your subscription.' },
    { status: 410 },
  )
}
