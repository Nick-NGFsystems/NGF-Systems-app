import { BetaAnalyticsDataClient } from '@google-analytics/data'
import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { getClientConfig } from '@/lib/portal'

function getAnalyticsClient() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not set')
  const credentials = JSON.parse(raw)
  return new BetaAnalyticsDataClient({ credentials })
}

export async function GET(request: Request) {
  const { userId, sessionClaims } = await auth()
  if (!userId) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const role = (sessionClaims?.metadata as { role?: string } | undefined)?.role
  if (role !== 'client' && role !== 'admin') {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const client = await getClientConfig(userId)
  if (!client) {
    return NextResponse.json({ success: false, error: 'Client not found' }, { status: 404 })
  }

  const propertyId = client.config?.ga4_property_id
  if (!propertyId) {
    return NextResponse.json({ success: true, configured: false })
  }

  const { searchParams } = new URL(request.url)
  const days = parseInt(searchParams.get('days') ?? '30')

  try {
    const analytics = getAnalyticsClient()

    const [response] = await analytics.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate: `${days}daysAgo`, endDate: 'today' }],
      metrics: [
        { name: 'activeUsers' },
        { name: 'screenPageViews' },
        { name: 'sessions' },
      ],
      dimensions: [{ name: 'date' }],
      orderBys: [{ dimension: { dimensionName: 'date' }, desc: false }],
    })

    const [topPagesResponse] = await analytics.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate: `${days}daysAgo`, endDate: 'today' }],
      metrics: [{ name: 'screenPageViews' }, { name: 'activeUsers' }],
      dimensions: [{ name: 'pagePath' }],
      orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
      limit: 5,
    })

    const dailyData = (response.rows ?? []).map((row) => ({
      date: row.dimensionValues?.[0]?.value ?? '',
      users: parseInt(row.metricValues?.[0]?.value ?? '0'),
      pageViews: parseInt(row.metricValues?.[1]?.value ?? '0'),
      sessions: parseInt(row.metricValues?.[2]?.value ?? '0'),
    }))

    const totals = dailyData.reduce(
      (acc, d) => ({
        users: acc.users + d.users,
        pageViews: acc.pageViews + d.pageViews,
        sessions: acc.sessions + d.sessions,
      }),
      { users: 0, pageViews: 0, sessions: 0 }
    )

    const topPages = (topPagesResponse.rows ?? []).map((row) => ({
      path: row.dimensionValues?.[0]?.value ?? '',
      views: parseInt(row.metricValues?.[0]?.value ?? '0'),
      users: parseInt(row.metricValues?.[1]?.value ?? '0'),
    }))

    return NextResponse.json({
      success: true,
      configured: true,
      totals,
      dailyData,
      topPages,
      days,
      siteUrl: client.config?.site_url ?? null,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch analytics'
    console.error('Portal GA4 analytics error:', err)
    return NextResponse.json(
      { success: false, configured: true, error: message },
      { status: 500 }
    )
  }
}
