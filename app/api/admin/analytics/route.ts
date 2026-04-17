import { BetaAnalyticsDataClient } from '@google-analytics/data'
import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

const PROPERTY_ID = process.env.GA4_PROPERTY_ID ?? '533573096'

function getAnalyticsClient() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not set')
  const credentials = JSON.parse(raw)
  return new BetaAnalyticsDataClient({ credentials })
}

export async function GET(request: Request) {
  const { sessionClaims } = await auth()
  const role = (sessionClaims?.metadata as any)?.role
  if (role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const days = parseInt(searchParams.get('days') ?? '30')

  try {
    const client = getAnalyticsClient()

    const [response] = await client.runReport({
      property: `properties/${PROPERTY_ID}`,
      dateRanges: [{ startDate: `${days}daysAgo`, endDate: 'today' }],
      metrics: [
        { name: 'activeUsers' },
        { name: 'screenPageViews' },
        { name: 'sessions' },
        { name: 'bounceRate' },
        { name: 'averageSessionDuration' },
      ],
      dimensions: [{ name: 'date' }],
      orderBys: [{ dimension: { dimensionName: 'date' }, desc: false }],
    })

    const [topPagesResponse] = await client.runReport({
      property: `properties/${PROPERTY_ID}`,
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
      (acc, d) => ({ users: acc.users + d.users, pageViews: acc.pageViews + d.pageViews, sessions: acc.sessions + d.sessions }),
      { users: 0, pageViews: 0, sessions: 0 }
    )

    const topPages = (topPagesResponse.rows ?? []).map((row) => ({
      path: row.dimensionValues?.[0]?.value ?? '',
      views: parseInt(row.metricValues?.[0]?.value ?? '0'),
      users: parseInt(row.metricValues?.[1]?.value ?? '0'),
    }))

    return NextResponse.json({ totals, dailyData, topPages, days })
  } catch (err: any) {
    console.error('GA4 analytics error:', err)
    return NextResponse.json({ error: err.message ?? 'Failed to fetch analytics' }, { status: 500 })
  }
}
