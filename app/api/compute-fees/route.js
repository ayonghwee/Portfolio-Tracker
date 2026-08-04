import { NextResponse } from 'next/server'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://togtmfuaoizaqynahzzi.supabase.co'
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// 2.5% p.a. → 0.208333% per month
const FEE_RATE = 2.5 / 100 / 12

function lastBizDayOfMonth(year, month) {
  // month is 0-indexed; get last calendar day then step back over weekends
  let d = new Date(Date.UTC(year, month + 1, 0))
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().split('T')[0]
}

function nextBizDay(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + 1)
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().split('T')[0]
}

function toGEDate(dateStr) {
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

const FUND_CODE_MAP = {
  'GreatLink ASEAN Growth Fund':                    'FS02',
  'GreatLink Asia Dividend Advantage Fund':          'F227',
  'GreatLink Asia High Dividend Equity Fund':        'FS05',
  'GreatLink Asia Pacific Equity Fund':              'FS03',
  'GreatLink Cash Fund':                             'FS01',
  'GreatLink China Growth Fund':                     'FS32',
  'GreatLink Diversified Growth Portfolio':          'F212',
  'GreatLink Dynamic Balanced Portfolio':            'F229',
  'GreatLink Dynamic Growth Portfolio':              'F230',
  'GreatLink Dynamic Secure Portfolio':              'F228',
  'GreatLink European Sustainable Equity Fund':      'FS06',
  'GreatLink Far East Ex Japan Equities Fund':       'FS17',
  'GreatLink Global Bond Fund':                      'FS12',
  'GreatLink Global Disruptive Innovation Fund':     'F224',
  'GreatLink Global Emerging Markets Equity Fund':   'FS175',
  'GreatLink Global Equity Alpha Fund':              'FS19',
  'GreatLink Global Equity Fund':                    'FS07',
  'GreatLink Global Perspective Fund':               'FS16',
  'GreatLink Global Real Estate Securities Fund':    'FS26',
  'GreatLink Global Supreme Fund':                   'FS04',
  'GreatLink Global Technology Fund':                'FS09',
  'GreatLink Income Bond Fund':                      'FS216',
  'GreatLink Income Focus Fund':                     'FS34',
  'GreatLink International Health Care Fund':        'F222',
  'GreatLink Lifestyle Balanced Portfolio':          'FS23',
  'GreatLink Lifestyle Dynamic Portfolio':           'FS25',
  'GreatLink Lifestyle Progressive Portfolio':       'FS24',
  'GreatLink Lifestyle Secure Portfolio':            'FS21',
  'GreatLink Lifestyle Steady Portfolio':            'FS22',
  'GreatLink Lion Asian Balanced Fund':              'FS35',
  'GreatLink Lion India Fund':                       'FS33',
  'GreatLink Lion Japan Growth Fund':                'FS31',
  'GreatLink Lion Vietnam Fund':                     'FS36',
  'GreatLink Multi-Sector Income Fund':              'F226',
  'GreatLink Multi-Theme Equity Fund':               'F213',
  'GreatLink Short Duration Bond Fund':              'FS20',
  'GreatLink Singapore Equities Fund':               'FS18',
  'GreatLink Singapore Physical Gold Fund':          'F231',
  'GreatLink Sustainable Global Thematic Fund':      'FS11',
  'GreatLink US Income and Growth Fund (Dis)':       'F225',
}

async function fetchGEPrice(fundCode, dateStr) {
  const url =
    `https://www.greateasternlife.com/bin/corp-site/fund-prices.json` +
    `?name=gHistorical&mode=historical` +
    `&fundcode=${encodeURIComponent("'" + fundCode + "'")}&funddate=${encodeURIComponent(toGEDate(dateStr))}` +
    `&datepattern=dd%2Fmm%2Fyyyy&pageno=1&pagesize=1`
  try {
    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; portfolio-tracker/1.0)',
        'Accept': 'application/json',
        'Referer': 'https://www.greateasternlife.com/',
      },
      next: { revalidate: 0 },
    })
    if (!r.ok) return null
    const d = await r.json()
    const p = d.funds?.[0]
    return p ? parseFloat(p.fundBidPrice) : null
  } catch { return null }
}

// POST /api/compute-fees
// Body: { policy_id, commenced, access_token }
// Computes missing monthly policy fee transactions (auto_computed=true) and caches prices.
export async function POST(req) {
  const { policy_id, commenced, access_token } = await req.json()
  if (!policy_id || !commenced) {
    return NextResponse.json({ error: 'policy_id and commenced required' }, { status: 400 })
  }

  const key = access_token || ANON_KEY
  const hdrs = {
    'apikey': ANON_KEY,
    'Authorization': `Bearer ${key}`,
    'Content-Type': 'application/json',
  }

  // Fetch manual txs, existing auto fees, cached prices in parallel
  const [txR, feeR, cacheR] = await Promise.all([
    fetch(`${SUPA_URL}/rest/v1/transactions?policy_id=eq.${policy_id}&or=(auto_computed.is.null,auto_computed.eq.false)&order=date.asc`, { headers: hdrs }),
    fetch(`${SUPA_URL}/rest/v1/transactions?policy_id=eq.${policy_id}&auto_computed=eq.true&order=date.asc`, { headers: hdrs }),
    fetch(`${SUPA_URL}/rest/v1/hist_price_cache?select=fund_code,price_date,bid_price`, { headers: hdrs }),
  ])
  const [manualTxs, existingFees, cachedPrices] = await Promise.all([txR.json(), feeR.json(), cacheR.json()])

  const manual   = Array.isArray(manualTxs)   ? manualTxs   : []
  const existing = Array.isArray(existingFees) ? existingFees : []
  const existingKeys = new Set(existing.map(f => `${f.date}|${f.fund_name}`))

  const priceMap = {}
  if (Array.isArray(cachedPrices)) {
    cachedPrices.forEach(r => { priceMap[`${r.fund_code}|${r.price_date}`] = r.bid_price })
  }

  const newCaches = []
  async function getPrice(fundName, dateStr) {
    const code = FUND_CODE_MAP[fundName]
    if (!code) return null
    const k = `${code}|${dateStr}`
    if (priceMap[k] != null) return priceMap[k]
    const price = await fetchGEPrice(code, dateStr)
    if (price != null) {
      priceMap[k] = price
      newCaches.push({ fund_code: code, price_date: dateStr, bid_price: price })
    }
    return price
  }

  const toInsert = []
  const start = new Date(commenced + 'T00:00:00Z')
  const now   = new Date()
  let yr = start.getUTCFullYear(), mo = start.getUTCMonth()

  while (yr < now.getUTCFullYear() || (yr === now.getUTCFullYear() && mo <= now.getUTCMonth())) {
    const monthEnd = lastBizDayOfMonth(yr, mo)
    const runDate  = nextBizDay(monthEnd)

    // Only process months where the fee run date has already passed
    if (new Date(runDate + 'T00:00:00Z') > now) break

    // Snapshot: all transactions up to month-end (manual + previously stored fees + fees computed this run)
    const snapshot = [...manual, ...existing, ...toInsert]
      .filter(tx => tx.date <= monthEnd)
      .sort((a, b) => a.date.localeCompare(b.date))

    // Compute unit balances per fund at month-end
    const units = {}
    for (const tx of snapshot) {
      const f = tx.fund_name
      if (!f || tx.type === 'Dividend') continue
      if (!units[f]) units[f] = 0
      const u = Math.abs(parseFloat(tx.units) || 0)
      if (['Switch Out', 'Welcome Bonus Clawback', 'Policy Fee'].includes(tx.type)) {
        units[f] = Math.max(0, units[f] - u)
      } else {
        units[f] += u
      }
    }

    // For each fund with units, compute the monthly policy fee
    for (const [fund, u] of Object.entries(units)) {
      if (u < 0.0001) continue
      if (existingKeys.has(`${runDate}|${fund}`)) continue  // already stored

      // month-end price → fee in $; run-date price → convert $ to units deducted
      const [p1, p2] = await Promise.all([getPrice(fund, monthEnd), getPrice(fund, runDate)])
      if (!p1 || !p2) continue

      const feeVal   = parseFloat((u * p1 * FEE_RATE).toFixed(2))
      const feeUnits = parseFloat((feeVal / p2).toFixed(6))

      toInsert.push({
        policy_id,
        date:      runDate,
        fund_name: fund,
        type:      'Policy Fee',
        price:     p2,
        units:     feeUnits,
        value:     feeVal,
        auto_computed: true,
      })
    }

    mo++
    if (mo > 11) { mo = 0; yr++ }
  }

  // Write fees and cache prices in parallel
  const writes = []
  if (toInsert.length) {
    writes.push(
      fetch(`${SUPA_URL}/rest/v1/transactions`, {
        method: 'POST',
        headers: { ...hdrs, 'Prefer': 'return=minimal' },
        body: JSON.stringify(toInsert),
      })
    )
  }
  if (newCaches.length) {
    writes.push(
      fetch(`${SUPA_URL}/rest/v1/hist_price_cache`, {
        method: 'POST',
        headers: { ...hdrs, 'Prefer': 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(newCaches),
      })
    )
  }
  if (writes.length) await Promise.all(writes)

  return NextResponse.json({ ok: true, computed: toInsert.length })
}
