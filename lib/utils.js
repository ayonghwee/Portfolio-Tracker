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

// ROI = (aum - invested) / invested * 100
export function calcROI(aum, invested) {
  if (!invested || invested === 0) return null
  return ((aum - invested) / invested) * 100
}

// CAGR as XIRR approximation for single/regular premiums
// years = duration in years
export function calcXIRR(aum, invested, commencedDate) {
  if (!aum || !invested || !commencedDate) return null
  const years = (Date.now() - new Date(commencedDate).getTime()) / (365.25 * 24 * 3600 * 1000)
  if (years <= 0) return null
  return (Math.pow(aum / invested, 1 / years) - 1) * 100
}

// Duration string
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
  if (years > 0) parts.push(`${years}Y`)
  if (months > 0) parts.push(`${months}M`)
  if (days > 0) parts.push(`${days}D`)
  return parts.join(' ') || '< 1 day'
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
