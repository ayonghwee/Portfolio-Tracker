import { NextResponse } from 'next/server'

// Add N business days to a YYYY-MM-DD date string (negative = subtract)
function addBusinessDays(dateStr, days) {
  if (days === 0) return dateStr
  const d = new Date(dateStr + 'T00:00:00')
  const step = days > 0 ? 1 : -1
  let moved = 0
  while (moved < Math.abs(days)) {
    d.setDate(d.getDate() + step)
    const dow = d.getDay()
    if (dow !== 0 && dow !== 6) moved++
  }
  return d.toISOString().split('T')[0]
}

function toGEFormat(dateStr) {
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

// GET /api/prices/historical?fundcode=F226&date=2026-04-21&offset=0
// offset=0 → same day  |  offset=1 → next business day
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const fundcode = searchParams.get('fundcode')
  const date     = searchParams.get('date')
  const offset   = parseInt(searchParams.get('offset') || '0')

  if (!fundcode || !date) {
    return NextResponse.json({ error: 'fundcode and date required' }, { status: 400 })
  }

  const effectiveDate = offset !== 0 ? addBusinessDays(date, offset) : date
  const geDate = toGEFormat(effectiveDate)

  const url =
    `https://www.greateasternlife.com/bin/corp-site/fund-prices.json` +
    `?name=gHistorical&mode=historical` +
    `&fundcode=${encodeURIComponent("'" + fundcode + "'")}` +
    `&funddate=${encodeURIComponent(geDate)}` +
    `&datepattern=dd%2Fmm%2Fyyyy&pageno=1&pagesize=5`

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; portfolio-tracker/1.0)',
        'Accept': 'application/json',
        'Referer': 'https://www.greateasternlife.com/',
      },
      next: { revalidate: 0 },
    })
    if (!res.ok) throw new Error(`GE API ${res.status}`)
    const data = await res.json()
    const fund = data.funds?.[0]
    if (!fund) return NextResponse.json({ error: 'No price found', requestedDate: effectiveDate }, { status: 404 })

    return NextResponse.json({
      fundCode:      fund.fundCode,
      fundName:      fund.fundName,
      bidPrice:      parseFloat(fund.fundBidPrice),
      offerPrice:    parseFloat(fund.fundOfferPrice),
      date:          fund.fundValueDate,
      requestedDate: effectiveDate,
      status:        fund.fundPriceStatusDescription,
    })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
