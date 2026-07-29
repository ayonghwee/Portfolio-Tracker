// Format currency
export function fmtMoney(val, decimals = 2) {
  if (val == null || isNaN(val)) return '—'
  return Number(val).toLocaleString('en-SG', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

// Format percentage
export function fmtPct(val, decimals = 2) {
  if (val == null || isNaN(val)) return '—'
  return `${Number(val) >= 0 ? '↑' : '↓'} ${Math.abs(Number(val)).toFixed(decimals)}%`
}

// ROI = (aum + dividends_paid - invested) / invested * 100
// dividendsPaid = cash dividends received (not reinvested), from p.dividends
export function calcROI(aum, invested, dividendsPaid = 0) {
  if (!invested || invested === 0) return null
  return ((aum + (dividendsPaid || 0) - invested) / invested) * 100
}

// Proper XIRR via Newton-Raphson, using "Net Investment Premium" transaction history.
// Falls back to simple CAGR if no transactions available.
export function calcXIRR(aum, transactions, invested, commencedDate) {
  if (!aum) return null
  const YEAR_MS = 365.25 * 24 * 3600 * 1000

  // Build cash flows from actual premium transactions
  const premTxs = (transactions || []).filter(t => t.type === 'Net Investment Premium')

  if (premTxs.length === 0) {
    // Fallback: CAGR (only used when no transaction history, e.g. legacy policies)
    if (!invested || !commencedDate) return null
    const years = (Date.now() - new Date(commencedDate).getTime()) / YEAR_MS
    if (years <= 0) return null
    return (Math.pow(aum / invested, 1 / years) - 1) * 100
  }

  // Aggregate by date (multiple funds share same date)
  const byDate = {}
  let totalPrem = 0
  premTxs.forEach(t => { byDate[t.date] = (byDate[t.date] || 0) + (t.value || 0); totalPrem += (t.value || 0) })

  // Scale cash flows to net-of-charges (Meow's invested = premiums - insurance charges)
  const scale = (invested && totalPrem > 0) ? invested / totalPrem : 1

  // Cash flows: negative (client outflow) for each premium, positive for current AUM
  const flows = Object.entries(byDate)
    .map(([date, val]) => ({ t: new Date(date).getTime(), amount: -val * scale }))
  flows.push({ t: Date.now(), amount: aum })
  flows.sort((a, b) => a.t - b.t)

  if (flows.length < 2) return null

  const t0 = flows[0].t

  // Newton-Raphson
  let rate = 0.1
  for (let i = 0; i < 150; i++) {
    let npv = 0, dnpv = 0
    for (const f of flows) {
      const yr = (f.t - t0) / YEAR_MS
      const fac = Math.pow(1 + rate, yr)
      npv  += f.amount / fac
      dnpv += -yr * f.amount / ((1 + rate) * fac)
    }
    if (Math.abs(dnpv) < 1e-12) break
    const next = rate - npv / dnpv
    if (!isFinite(next) || next < -0.9999) break
    if (Math.abs(next - rate) < 1e-8) { rate = next; break }
    rate = next
  }

  return isFinite(rate) ? rate * 100 : null
}

// Duration string — "1 Year 4 Months 20 Days"
export function calcDuration(commencedDate) {
  if (!commencedDate) return '—'
  const start = new Date(commencedDate)
  const now = new Date()
  let years = now.getFullYear() - start.getFullYear()
  let months = now.getMonth() - start.getMonth()
  let days = now.getDate() - start.getDate()
  if (days < 0) { months--; days += 30 }
  if (months < 0) { years--; months += 12 }
  const parts = []
  if (years > 0) parts.push(`${years} ${years === 1 ? 'Year' : 'Years'}`)
  if (months > 0) parts.push(`${months} ${months === 1 ? 'Month' : 'Months'}`)
  if (days > 0) parts.push(`${days} ${days === 1 ? 'Day' : 'Days'}`)
  return parts.join(' ') || '< 1 Day'
}

// Format date
export function fmtDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-SG', {
    day: '2-digit', month: 'short', year: 'numeric'
  })
}

// SGT datetime string
export function nowSGT() {
  return new Date().toLocaleString('en-SG', {
    timeZone: 'Asia/Singapore',
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

// Donut chart SVG path helper
export function donutSlices(data, r = 60, cx = 70, cy = 70, stroke = 12) {
  const total = data.reduce((s, d) => s + d.value, 0)
  if (total === 0) return []
  let cumAngle = -Math.PI / 2
  return data.map(d => {
    const angle = (d.value / total) * 2 * Math.PI
    const x1 = cx + r * Math.cos(cumAngle)
    const y1 = cy + r * Math.sin(cumAngle)
    cumAngle += angle
    const x2 = cx + r * Math.cos(cumAngle)
    const y2 = cy + r * Math.sin(cumAngle)
    const large = angle > Math.PI ? 1 : 0
    return {
      ...d,
      d: `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`,
    }
  })
}
