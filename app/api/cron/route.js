import { NextResponse } from 'next/server'

// This route is called by Vercel Cron every weekday at 6pm SGT (10am UTC)
// Configure in vercel.json: { "crons": [{ "path": "/api/cron", "schedule": "0 10 * * 1-5" }] }
export async function GET(request) {
  // Verify this is called by Vercel Cron (optional security check)
  const authHeader = request.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://yhportfoliotracker.vercel.app'
    const res = await fetch(`${baseUrl}/api/prices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    })
    const data = await res.json()
    return NextResponse.json({
      success: true,
      message: `Cron: ${data.message || 'prices updated'}`,
      count: data.count,
      timestamp: new Date().toISOString()
    })
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
