import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

// GET — return cached prices
export async function GET() {
  const { data } = await supabase.from('price_cache').select('*')
  return Response.json({ prices: data || [] })
}

// POST — fetch from GE website and update cache
export async function POST() {
  try {
    const prices = await fetchGEPrices()
    if (prices.length > 0) {
      const now = new Date().toISOString()
      const today = now.split('T')[0]
      await supabase.from('price_cache').upsert(
        prices.map(p => ({
          fund_name: p.fund_name,
          bid_price: p.bid_price,
          offer_price: p.offer_price,
          price_date: today,
          updated_at: now,
        })),
        { onConflict: 'fund_name' }
      )
      return Response.json({ prices, count: prices.length })
    }
    return Response.json({
      prices: [],
      message: 'GE prices page is client-rendered — enter prices manually on each policy page.'
    })
  } catch (err) {
    return Response.json({ error: err.message, prices: [] }, { status: 500 })
  }
}

async function fetchGEPrices() {
  const url = 'https://www.greateasternlife.com/sg/en/personal-insurance/our-products/wealth-accumulation/great-invest-advantage/greatlink-funds-prices.html'

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-SG,en;q=0.9',
    },
    next: { revalidate: 3600 }, // cache for 1 hour
  })

  const html = await res.text()

  // Try to extract prices from the HTML
  // GE's page structure: table rows with fund name, bid price, offer price
  const prices = []

  // Pattern 1: JSON embedded in script tags
  const jsonMatches = html.match(/window\.__(?:INITIAL|NEXT)_DATA__\s*=\s*({.*?})\s*;/s)
  if (jsonMatches) {
    try {
      const data = JSON.parse(jsonMatches[1])
      // Parse fund prices from data structure if found
      const fundData = findFundPrices(data)
      if (fundData.length) return fundData
    } catch {}
  }

  // Pattern 2: Table rows — look for fund name + price pattern
  // Match rows like: FundName | date | bid | offer
  const rowPattern = /<tr[^>]*>[\s\S]*?<\/tr>/gi
  const cellPattern = /<td[^>]*>([\s\S]*?)<\/td>/gi
  const rows = html.match(rowPattern) || []

  for (const row of rows) {
    const cells = []
    let m
    while ((m = cellPattern.exec(row)) !== null) {
      cells.push(m[1].replace(/<[^>]+>/g, '').trim())
    }
    cellPattern.lastIndex = 0

    if (cells.length >= 3) {
      const name = cells[0]
      const bid = parseFloat(cells[cells.length - 2])
      const offer = parseFloat(cells[cells.length - 1])
      if (name.includes('GreatLink') && !isNaN(bid) && bid > 0) {
        prices.push({ fund_name: name, bid_price: bid, offer_price: isNaN(offer) ? bid : offer })
      }
    }
  }

  return prices
}

function findFundPrices(obj, depth = 0) {
  if (depth > 8) return []
  if (Array.isArray(obj)) {
    for (const item of obj) {
      const found = findFundPrices(item, depth + 1)
      if (found.length) return found
    }
  } else if (obj && typeof obj === 'object') {
    if (obj.fundName && obj.bidPrice) {
      return [{ fund_name: obj.fundName, bid_price: obj.bidPrice, offer_price: obj.offerPrice }]
    }
    for (const key of Object.keys(obj)) {
      const found = findFundPrices(obj[key], depth + 1)
      if (found.length) return found
    }
  }
  return []
}
