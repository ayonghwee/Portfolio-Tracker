import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const GE_PRICE_URL = 'https://www.greateasternlife.com/bin/corp-site/fund-prices.json?name=gDaily'

export async function GET() {
  const { data } = await supabase.from('price_cache').select('*')
  return NextResponse.json({ prices: data || [] })
}

export async function POST() {
  try {
    const res = await fetch(GE_PRICE_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; portfolio-tracker/1.0)',
        'Accept': 'application/json',
      },
      next: { revalidate: 0 }
    })

    if (!res.ok) throw new Error(`GE API returned ${res.status}`)

    const data = await res.json()
    if (!data.funds?.length) throw new Error('No fund data returned')

    const today = new Date().toISOString().split('T')[0]
    const now = new Date().toISOString()

    const upserts = data.funds.map(f => ({
      fund_name: f.fundName,
      bid_price: parseFloat(f.fundBidPrice),
      offer_price: parseFloat(f.fundOfferPrice),
      price_date: f.fundValueDate || today,
      updated_at: now,
    }))

    const { error } = await supabase.from('price_cache').upsert(upserts)
    if (error) throw error

    return NextResponse.json({
      success: true,
      count: upserts.length,
      date: data.funds[0]?.fundValueDate || today,
      prices: upserts,
      message: `Updated ${upserts.length} fund prices as of ${data.funds[0]?.fundValueDate || today}`
    })
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
