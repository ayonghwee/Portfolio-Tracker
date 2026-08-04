'use client'
import React, { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '../../../lib/supabase'
import { fmtMoney, calcROI, calcXIRR, calcDuration, fmtDate } from '../../../lib/utils'
import SmartTxForm from '../../components/SmartTxForm'
import { FUND_CODE_MAP } from '../../components/FundTypeahead'

const FUND_COLORS = ['#2d5016','#b8963e','#c0724a','#4a7c59','#8b6914','#5a3e2b','#3d6b8c','#7a4f3e','#4e6b2d','#9b7b3d']
const TX_TYPES = ['Net Investment Premium','Reinvest','Switch In','Switch Out','Welcome Bonus','Dividend']
const GE_FUNDS = [
  'GreatLink ASEAN Growth Fund','GreatLink Asia Dividend Advantage Fund','GreatLink Asia High Dividend Equity Fund',
  'GreatLink Asia Pacific Equity Fund','GreatLink Cash Fund','GreatLink China Growth Fund',
  'GreatLink Diversified Growth Portfolio','GreatLink Dynamic Balanced Portfolio','GreatLink Dynamic Growth Portfolio',
  'GreatLink Dynamic Secure Portfolio','GreatLink European Sustainable Equity Fund','GreatLink Far East Ex Japan Equities Fund',
  'GreatLink Global Bond Fund','GreatLink Global Disruptive Innovation Fund','GreatLink Global Emerging Markets Equity Fund',
  'GreatLink Global Equity Alpha Fund','GreatLink Global Equity Fund','GreatLink Global Perspective Fund',
  'GreatLink Global Real Estate Securities Fund','GreatLink Global Supreme Fund','GreatLink Global Technology Fund',
  'GreatLink Income Bond Fund','GreatLink Income Focus Fund','GreatLink International Health Care Fund',
  'GreatLink Lifestyle Balanced Portfolio','GreatLink Lifestyle Dynamic Portfolio','GreatLink Lifestyle Progressive Portfolio',
  'GreatLink Lifestyle Secure Portfolio','GreatLink Lifestyle Steady Portfolio','GreatLink Lion Asian Balanced Fund',
  'GreatLink Lion India Fund','GreatLink Lion Japan Growth Fund','GreatLink Lion Vietnam Fund',
  'GreatLink Multi-Sector Income Fund','GreatLink Multi-Theme Equity Fund','GreatLink Short Duration Bond Fund',
  'GreatLink Singapore Equities Fund','GreatLink Singapore Physical Gold Fund','GreatLink Sustainable Global Thematic Fund',
  'GreatLink US Income and Growth Fund (Dis)',
]

// ─── helpers ────────────────────────────────────────────────────────────────

const fmtNum = (v, dp = 2) =>
  v != null && !isNaN(v)
    ? Number(v).toLocaleString('en-SG', { minimumFractionDigits: dp, maximumFractionDigits: dp })
    : '—'

function calcAvgPriceFromTx(transactions, fundName) {
  const buys = transactions.filter(t =>
    t.fund_name === fundName &&
    ['Net Investment Premium','Reinvest','Switch In','Welcome Bonus'].includes(t.type) &&
    parseFloat(t.units) > 0 && parseFloat(t.price) > 0
  )
  const totalUnits = buys.reduce((s, t) => s + parseFloat(t.units), 0)
  const totalCost  = buys.reduce((s, t) => s + parseFloat(t.units) * parseFloat(t.price), 0)
  return totalUnits > 0 ? totalCost / totalUnits : null
}

function calcNetInflow(transactions, fundName) {
  return transactions.filter(t => t.fund_name === fundName).reduce((sum, t) => {
    const v = Math.abs(parseFloat(t.value) || 0)
    if (['Net Investment Premium','Switch In','Welcome Bonus'].includes(t.type)) return sum + v
    if (t.type === 'Switch Out') return sum - v
    return sum
  }, 0)
}

// Returns { [fundName]: [{ ...tx, bal_units, units_delta }] } sorted date asc
function computeBalanceUnits(transactions) {
  const byFund = {}
  const sorted = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date))
  sorted.forEach(tx => {
    if (!tx.fund_name) return
    if (!byFund[tx.fund_name]) byFund[tx.fund_name] = []
    byFund[tx.fund_name].push(tx)
  })
  const result = {}
  Object.entries(byFund).forEach(([fund, txs]) => {
    let bal = 0
    result[fund] = txs.filter(tx => tx.type !== 'Dividend').map(tx => {
      const u = Math.abs(parseFloat(tx.units) || 0)
      const delta = ['Switch Out', 'Welcome Bonus Clawback'].includes(tx.type) ? -u : u
      bal = Math.max(0, bal + delta)
      return { ...tx, bal_units: bal, units_delta: delta }
    })
  })
  return result
}

// ─── DonutChart ─────────────────────────────────────────────────────────────

function DonutChart({ data, size = 220, sw = 40 }) {
  const [hovered, setHovered] = React.useState(null)
  const r = size / 2 - sw / 2
  const C = 2 * Math.PI * r
  const cx = size / 2, cy = size / 2
  const total = data.reduce((s, d) => s + d.value, 0)
  if (!total || !data.length) return null
  const GAP = data.length > 1 ? 4 : 0
  let acc = 0
  const h = hovered != null ? data[hovered] : null
  return (
    <svg width={size} height={size} style={{ overflow: 'visible' }}>
      {data.map((d, i) => {
        const dash   = Math.max(0, (d.value / total) * C - GAP)
        const gap    = C - dash
        const offset = C / 4 - acc
        acc += (d.value / total) * C
        return (
          <circle key={i} cx={cx} cy={cy} r={r}
            fill="none" stroke={d.color}
            strokeWidth={hovered === i ? sw + 6 : sw} strokeLinecap="butt"
            strokeDasharray={`${dash} ${gap}`} strokeDashoffset={offset}
            style={{ cursor: 'pointer', transition: 'stroke-width 0.15s' }}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
          />
        )
      })}
      {h && (
        <>
          <text x={cx} y={cy - 8} textAnchor="middle" fontSize="10" fill="#6b7280" style={{ pointerEvents: 'none' }}>
            {h.label.length > 14 ? h.label.slice(0, 14) + '…' : h.label}
          </text>
          <text x={cx} y={cy + 10} textAnchor="middle" fontSize="18" fill={h.color} fontWeight="600" style={{ pointerEvents: 'none' }}>
            {((h.value / total) * 100).toFixed(1)}%
          </text>
          <text x={cx} y={cy + 26} textAnchor="middle" fontSize="10" fill="#9ca3af" style={{ pointerEvents: 'none' }}>
            ${h.value.toLocaleString('en-SG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </text>
        </>
      )}
    </svg>
  )
}

// ─── PerformanceChart (Section IV) ──────────────────────────────────────────

function PerformanceChart({ commenced, invested, aum, transactions }) {
  const [showBenchmark, setShowBenchmark] = React.useState(false)
  const [tooltip, setTooltip] = React.useState(null)
  if (!commenced || !aum) return null
  const W = 800, H = 200, PL = 72, PR = 20, PT = 16, PB = 28
  const CW = W - PL - PR, CH = H - PT - PB
  const start = new Date(commenced), now = new Date()

  const months = []
  const md = new Date(start.getFullYear(), start.getMonth(), 1)
  while (md <= now) { months.push(new Date(md)); md.setMonth(md.getMonth() + 1) }
  if (months.length < 2) return null

  // TIA: flat line at invested amount (matches Meow behaviour)
  const tiaPoints = months.map(() => invested || 0)

  const totalMs = Math.max(now - start, 1)
  const tivPoints = months.map(m => {
    const ratio = Math.min((m - start) / totalMs, 1)
    return (invested || 0) + (aum - (invested || 0)) * ratio
  })

  const allV  = [...tiaPoints, ...tivPoints]
  const minV  = Math.max(0, Math.min(...allV) * 0.9)
  const maxV  = Math.max(...allV) * 1.05
  const range = maxV - minV || 1

  const toX = i => PL + (i / Math.max(months.length - 1, 1)) * CW
  const toY = v => PT + CH - ((v - minV) / range) * CH

  const yStep = Math.ceil((maxV - minV) / 4 / 500) * 500 || 1000
  const yTicks = []
  for (let v = Math.ceil(minV / yStep) * yStep; v <= maxV; v += yStep) yTicks.push(v)

  const xStep = Math.max(1, Math.ceil(months.length / 14))

  const YEAR_MS = 365.25 * 24 * 3600 * 1000
  const bmPoints = months.map(m => (invested || 0) * Math.pow(1.06, (m - start) / YEAR_MS))

  const allV2 = showBenchmark ? [...tiaPoints, ...tivPoints, ...bmPoints] : [...tiaPoints, ...tivPoints]
  const minV2  = Math.max(0, Math.min(...allV2) * 0.9)
  const maxV2  = Math.max(...allV2) * 1.05
  const range2 = maxV2 - minV2 || 1
  const toY2   = v => PT + CH - ((v - minV2) / range2) * CH

  const tiaPath = tiaPoints.map((v, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY2(v).toFixed(1)}`).join(' ')
  const tivPath = tivPoints.map((v, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY2(v).toFixed(1)}`).join(' ')
  const bmPath  = bmPoints.map((v, i)  => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY2(v).toFixed(1)}`).join(' ')

  const yStep2 = Math.ceil((maxV2 - minV2) / 4 / 500) * 500 || 1000
  const yTicks2 = []
  for (let v = Math.ceil(minV2 / yStep2) * yStep2; v <= maxV2; v += yStep2) yTicks2.push(v)

  return (
    <div style={{ border: '1px solid #e5e7eb', padding: '16px 16px 8px', background: 'white' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div className="text-xs text-gray-400 uppercase tracking-widest">
          INVESTMENT GROWTH &nbsp;·&nbsp; Updated {new Date().toLocaleDateString('en-SG', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
        </div>
        <button onClick={() => setShowBenchmark(b => !b)}
          style={{ fontSize: 10, letterSpacing: '0.08em', background: 'none', border: '1px solid #e5e7eb', borderRadius: 3, padding: '2px 8px', cursor: 'pointer', color: showBenchmark ? '#2c4a6e' : '#9ca3af' }}>
          {showBenchmark ? 'HIDE BENCHMARK' : 'SHOW BENCHMARK'}
        </button>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block', cursor: 'crosshair' }}
        onMouseMove={e => {
          const svg = e.currentTarget
          const rect = svg.getBoundingClientRect()
          const svgX = ((e.clientX - rect.left) / rect.width) * W
          const idx = Math.round(((svgX - PL) / CW) * (months.length - 1))
          if (idx >= 0 && idx < months.length) {
            setTooltip({ idx, x: toX(idx), tia: tiaPoints[idx], tiv: tivPoints[idx], bm: bmPoints[idx], month: months[idx] })
          }
        }}
        onMouseLeave={() => setTooltip(null)}>
        {yTicks2.map(v => (
          <g key={v}>
            <line x1={PL} y1={toY2(v)} x2={W - PR} y2={toY2(v)} stroke="#f3f4f6" strokeWidth="1" />
            <text x={PL - 4} y={toY2(v)} textAnchor="end" fontSize="9" fill="#9ca3af" dominantBaseline="middle">
              {v.toLocaleString('en-SG')}
            </text>
          </g>
        ))}
        <path d={tiaPath} fill="none" stroke="#c0c0c0" strokeWidth="1.5" strokeDasharray="5 3" />
        <path d={tivPath} fill="none" stroke="#2d5016" strokeWidth="2" />
        {showBenchmark && <path d={bmPath} fill="none" stroke="#b8963e" strokeWidth="1.5" strokeDasharray="4 4" />}
        {months.map((m, i) => {
          if (i % xStep !== 0 && i !== months.length - 1) return null
          return (
            <text key={i} x={toX(i)} y={H - 4} textAnchor="middle" fontSize="8" fill="#9ca3af">
              {m.toLocaleDateString('en-SG', { month: '2-digit', year: '2-digit' })}
            </text>
          )
        })}
        {tooltip && (() => {
          const tx = tooltip.x
          const tipW = showBenchmark ? 148 : 132
          const tipH = showBenchmark ? 58 : 48
          const tipX = tx + tipW + 12 > W - PR ? tx - tipW - 8 : tx + 8
          const fmt0 = v => '$' + Math.round(v).toLocaleString('en-SG')
          return (
            <g>
              <line x1={tx} y1={PT} x2={tx} y2={PT + CH} stroke="#9ca3af" strokeWidth="1" strokeDasharray="3 2" />
              <circle cx={tx} cy={toY2(tooltip.tiv)} r="3" fill="#2d5016" />
              <circle cx={tx} cy={toY2(tooltip.tia)} r="3" fill="#c0c0c0" />
              {showBenchmark && <circle cx={tx} cy={toY2(tooltip.bm)} r="3" fill="#b8963e" />}
              <rect x={tipX} y={PT + 4} width={tipW} height={tipH} fill="white" stroke="#e5e7eb" strokeWidth="1" rx="3" />
              <text x={tipX + 8} y={PT + 17} fontSize="8.5" fill="#6b7280" fontWeight="500">
                {tooltip.month.toLocaleDateString('en-SG', { month: 'short', year: 'numeric' })}
              </text>
              <text x={tipX + 8} y={PT + 30} fontSize="8.5" fill="#2d5016">TIV {fmt0(tooltip.tiv)}</text>
              <text x={tipX + 8} y={PT + 42} fontSize="8.5" fill="#9ca3af">TIA {fmt0(tooltip.tia)}</text>
              {showBenchmark && <text x={tipX + 8} y={PT + 54} fontSize="8.5" fill="#b8963e">BM  {fmt0(tooltip.bm)}</text>}
            </g>
          )
        })()}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 32, marginTop: 6 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#6b7280' }}>
          <svg width="20" height="8"><line x1="0" y1="4" x2="20" y2="4" stroke="#2d5016" strokeWidth="2" /></svg>
          Total Investment Value
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#6b7280' }}>
          <svg width="20" height="8"><line x1="0" y1="4" x2="20" y2="4" stroke="#c0c0c0" strokeWidth="1.5" strokeDasharray="5 3" /></svg>
          Total Investment Amount
        </span>
        {showBenchmark && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#6b7280' }}>
            <svg width="20" height="8"><line x1="0" y1="4" x2="20" y2="4" stroke="#b8963e" strokeWidth="1.5" strokeDasharray="4 4" /></svg>
            Benchmark (6% p.a.)
          </span>
        )}
      </div>
    </div>
  )
}

// ─── ContributionTimeline (Section VI) ──────────────────────────────────────

const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']

function ContributionTimeline({ transactions, year, holdings }) {
  const funds = holdings.map(h => h.fund_name)
  const allFundsWithTx = [...new Set(
    transactions
      .filter(t => ['Switch In','Switch Out','Net Investment Premium','Welcome Bonus'].includes(t.type) && t.fund_name)
      .map(t => t.fund_name)
  )]
  const displayFunds = [...new Set([...funds, ...allFundsWithTx])]

  const getCell = (fund, monthIdx) =>
    transactions.filter(t =>
      t.fund_name === fund &&
      ['Switch In','Switch Out','Net Investment Premium','Welcome Bonus'].includes(t.type) &&
      new Date(t.date).getFullYear() === year &&
      new Date(t.date).getMonth() === monthIdx
    )

  if (!displayFunds.length) return <div className="text-sm text-gray-400 py-4">No contribution data yet.</div>

  return (
    <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', background: 'white' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 9 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
            <th style={{ padding: '6px 10px', textAlign: 'left', fontSize: 9, color: '#9ca3af', fontWeight: 400, letterSpacing: '0.08em', width: 130, background: '#fafaf8' }}>FUND</th>
            {MONTHS.map(m => (
              <th key={m} style={{ padding: '6px 4px', textAlign: 'center', fontSize: 9, color: '#9ca3af', fontWeight: 400, letterSpacing: '0.08em', minWidth: 62, background: '#fafaf8', borderLeft: '1px solid #e5e7eb' }}>{m}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {displayFunds.map(fund => (
            <tr key={fund} style={{ borderBottom: '1px solid #f3f4f6' }}>
              <td style={{ padding: '6px 10px', fontSize: 9, color: '#6b7280', verticalAlign: 'top', fontWeight: 500 }}>
                {fund.replace('GreatLink ', '')}
              </td>
              {MONTHS.map((_, mi) => {
                const txs = getCell(fund, mi)
                return (
                  <td key={mi} style={{ padding: '4px 3px', verticalAlign: 'top', fontSize: 8.5, lineHeight: 1.4, borderLeft: '1px solid #e5e7eb' }}>
                    {txs.map((t, j) => {
                      const d = new Date(t.date)
                      const day = `${d.getDate().toString().padStart(2,'0')} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()]}`
                      const amt = Math.abs(parseFloat(t.value) || 0)
                      const isOut = t.type === 'Switch Out'
                      const label = t.type === 'Net Investment Premium' ? 'Premium' : t.type === 'Welcome Bonus' ? 'Bonus' : null
                      return (
                        <div key={j} style={{ marginBottom: 2, color: isOut ? '#c0724a' : '#2d5016' }}>
                          <div>{isOut ? '↑' : '↓'} {day} {fmtMoney(amt)}</div>
                          {label && <div style={{ color: '#9ca3af', fontSize: 7.5 }}>— {label}</div>}
                        </div>
                      )
                    })}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function PolicyPage() {
  const { number } = useParams()
  const router = useRouter()
  const [policy, setPolicy]           = useState(null)
  const [policyId, setPolicyId]       = useState(null)
  const [holdings, setHoldings]       = useState([])
  const [transactions, setTransactions] = useState([])
  const [prices, setPrices]           = useState({})
  const [priceDate, setPriceDate]     = useState('')
  const [loading, setLoading]         = useState(true)
  const [editMode, setEditMode]       = useState(false)
  const [editHoldings, setEditHoldings] = useState([])
  const [editPolicy, setEditPolicy]   = useState(null)
  const [editingPolicy, setEditingPolicy] = useState(false)
  const [saving, setSaving]           = useState(false)
  const [deleting, setDeleting]       = useState(false)
  const [priceStatus, setPriceStatus] = useState('')
  const [showAddTx, setShowAddTx]     = useState(false)
  const [newTx, setNewTx]             = useState({ date: '', type: 'Reinvest', fund_name: '', price: '', units: '', value: '' })
  const [savingTx, setSavingTx]       = useState(false)
  const [timelineYear, setTimelineYear] = useState(new Date().getFullYear())

  function openAddTx(type) {
    setNewTx({ date: '', type: type || 'Reinvest', fund_name: '', price: '', units: '', value: '' })
    setShowAddTx(true)
    setTimeout(() => document.getElementById('add-tx-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }

  useEffect(() => { checkAuthAndLoad() }, [number])

  async function checkAuthAndLoad() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }
    loadData()
  }

  async function loadData() {
    setLoading(true)
    const { data: p } = await supabase.from('policies').select('*').eq('policy_number', number).single()
    if (!p) { setLoading(false); return }
    const [{ data: h }, { data: tx }, { data: pr }] = await Promise.all([
      supabase.from('fund_holdings').select('*').eq('policy_id', p.id),
      supabase.from('transactions').select('*').eq('policy_id', p.id).order('date', { ascending: false }),
      supabase.from('price_cache').select('*'),
    ])
    const pm = {}
    pr?.forEach(r => { pm[r.fund_name] = r.bid_price })
    const pd = pr?.find(r => r.price_date)?.price_date || ''
    setPolicy(p)
    setPolicyId(p.id)
    setHoldings(h || [])
    setTransactions(tx || [])
    setPrices(pm)
    setPriceDate(pd)
    setEditHoldings(h || [])
    setEditPolicy(p)
    setLoading(false)
    autoFetchPrices()
  }

  const GE_URL = 'https://www.greateasternlife.com/bin/corp-site/fund-prices.json?name=gDaily'

  async function autoFetchPrices() {
    try {
      const res = await fetch(GE_URL)
      if (res.ok) {
        const data = await res.json()
        if (data.funds?.length) {
          const today = new Date().toISOString().split('T')[0]
          const upserts = data.funds.map(f => ({
            fund_name: f.fundName, bid_price: parseFloat(f.fundBidPrice),
            offer_price: parseFloat(f.fundOfferPrice),
            price_date: f.fundValueDate || today, updated_at: new Date().toISOString(),
          }))
          await supabase.from('price_cache').upsert(upserts)
          const pm = {}
          upserts.forEach(u => { pm[u.fund_name] = u.bid_price })
          setPrices(pm)
          const pd = upserts[0]?.price_date || today
          setPriceDate(pd)
          setPriceStatus(`Prices as of ${pd}`)
          setTimeout(() => setPriceStatus(''), 4000)
          return
        }
      }
    } catch { /* CORS — fall back */ }
    try {
      const res = await fetch('/api/prices', { method: 'POST' })
      const data = await res.json()
      if (data.prices?.length) {
        const pm = {}
        data.prices.forEach(p => { pm[p.fund_name] = p.bid_price })
        setPrices(pm)
        const pd = data.date || ''
        if (pd) setPriceDate(pd)
        setPriceStatus(`Prices as of ${pd || 'latest'}`)
        setTimeout(() => setPriceStatus(''), 4000)
      }
    } catch { }
  }

  async function saveHoldings() {
    setSaving(true)
    await supabase.from('fund_holdings').delete().eq('policy_id', policyId)
    const valid = editHoldings.filter(h => h.fund_name && h.units)
    if (valid.length) {
      await supabase.from('fund_holdings').insert(
        valid.map(h => ({
          policy_id: policyId, fund_name: h.fund_name,
          units: parseFloat(h.units) || 0,
          avg_price: parseFloat(h.avg_price) || null,
          last_known_price: parseFloat(h.avg_price) || null,
        }))
      )
    }
    await loadData(); setEditMode(false); setSaving(false)
  }

  async function savePolicyDetails() {
    setSaving(true)
    await supabase.from('policies').update({
      nickname: editPolicy.nickname, product: editPolicy.product,
      commenced: editPolicy.commenced, premium: parseFloat(editPolicy.premium) || 0,
      frequency: editPolicy.frequency, invested: parseFloat(editPolicy.invested) || 0,
      charges: parseFloat(editPolicy.charges) || 0, cash: parseFloat(editPolicy.cash) || 0,
      dividends: parseFloat(editPolicy.dividends) || 0,
      welcome_bonus: parseFloat(editPolicy.welcome_bonus) || 0,
    }).eq('id', policyId)
    await loadData(); setEditingPolicy(false); setSaving(false)
  }

  // Auto-derive fund_holdings units from transaction ledger.
  // Called after every transaction add so new funds appear without manual holdings edit.
  async function syncHoldingsFromTransactions(allTx) {
    const timeline = computeBalanceUnits(allTx)
    const updates = Object.entries(timeline)
      .map(([fund, txs]) => ({ fund_name: fund, units: txs[txs.length - 1]?.bal_units || 0 }))
      .filter(h => h.units > 0.000001)

    // Fetch existing holdings to preserve avg_price values
    const { data: existing } = await supabase.from('fund_holdings').select('*').eq('policy_id', policyId)
    const existingMap = {}
    existing?.forEach(h => { existingMap[h.fund_name] = h })

    await supabase.from('fund_holdings').delete().eq('policy_id', policyId)
    if (updates.length) {
      await supabase.from('fund_holdings').insert(
        updates.map(h => ({
          policy_id: policyId,
          fund_name: h.fund_name,
          units: h.units,
          avg_price: existingMap[h.fund_name]?.avg_price || null,
          last_known_price: existingMap[h.fund_name]?.last_known_price || null,
        }))
      )
    }
  }

  async function addTransaction() {
    if (!newTx.date || !newTx.type) return
    setSavingTx(true)
    const units = parseFloat(newTx.units) || 0
    const price = parseFloat(newTx.price) || 0
    const value = parseFloat(newTx.value) || (units * price)
    await supabase.from('transactions').insert({
      policy_id: policyId, fund_name: newTx.fund_name || null,
      date: newTx.date, type: newTx.type,
      price: price || null, units: units || null, value: value || null,
    })
    // Re-fetch all transactions then sync holdings
    const { data: allTx } = await supabase.from('transactions').select('*').eq('policy_id', policyId).order('date', { ascending: true })
    if (allTx) await syncHoldingsFromTransactions(allTx)
    setNewTx(t => ({ ...t, date: '', units: '', price: '', value: '' }))
    setShowAddTx(false)
    await loadData()
    setSavingTx(false)
  }

  async function deleteTransaction(txId) {
    await supabase.from('transactions').delete().eq('id', txId)
    const { data: allTx } = await supabase.from('transactions').select('*').eq('policy_id', policyId).order('date', { ascending: true })
    if (allTx) await syncHoldingsFromTransactions(allTx)
    await loadData()
  }

  async function updateManualPrice(fundName, price) {
    await supabase.from('price_cache').upsert({
      fund_name: fundName, bid_price: parseFloat(price), offer_price: parseFloat(price),
      price_date: new Date().toISOString().split('T')[0], updated_at: new Date().toISOString(),
    })
    setPrices(p => ({ ...p, [fundName]: parseFloat(price) }))
  }

  async function deletePolicy() {
    if (!confirm('Delete this policy? This cannot be undone.')) return
    setDeleting(true)
    await supabase.from('transactions').delete().eq('policy_id', policyId)
    await supabase.from('fund_holdings').delete().eq('policy_id', policyId)
    await supabase.from('policies').delete().eq('id', policyId)
    router.push('/')
  }

  function addEditFund() { setEditHoldings(h => [...h, { fund_name: '', units: '', avg_price: '' }]) }
  function removeEditFund(i) { setEditHoldings(h => h.filter((_, idx) => idx !== i)) }
  function updateEditHolding(i, k, v) { setEditHoldings(h => h.map((r, idx) => idx === i ? { ...r, [k]: v } : r)) }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#fafaf8' }}>
      <div className="text-gray-400 text-sm">Loading…</div>
    </div>
  )
  if (!policy) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#fafaf8' }}>
      <div className="text-center">
        <div className="text-gray-400 mb-4">Policy not found.</div>
        <Link href="/" className="btn-primary">← Back to ledger</Link>
      </div>
    </div>
  )

  // ── derived values ──
  const aum  = holdings.reduce((s, h) => s + h.units * (prices[h.fund_name] || h.last_known_price || 0), 0)
  const roi  = calcROI(aum, policy.invested, policy.dividends)
  const xirr = calcXIRR(aum, transactions, policy.invested, policy.commenced)
  const duration = calcDuration(policy.commenced)

  const donutData = holdings.map((h, i) => ({
    label: h.fund_name.replace('GreatLink ', ''),
    value: h.units * (prices[h.fund_name] || h.last_known_price || 0),
    color: FUND_COLORS[i % FUND_COLORS.length],
  })).filter(d => d.value > 0)
  const totalDonut = donutData.reduce((s, d) => s + d.value, 0)

  // dividends from transactions (Reinvest or Dividend types)
  const dividendTxs = [...transactions]
    .filter(t => ['Reinvest','Dividend'].includes(t.type) && t.value)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
  const totalDividends = dividendTxs.reduce((s, t) => s + Math.abs(parseFloat(t.value) || 0), 0)
  const cashDividendTotal = dividendTxs.filter(t => t.type === 'Dividend').reduce((s, t) => s + Math.abs(parseFloat(t.value) || 0), 0)

  // per-fund grouped transactions with BAL UNITS
  const fundTimeline = computeBalanceUnits(transactions)

  // unique funds with transactions, in holdings order first
  const txFunds = holdings.map(h => h.fund_name).filter(f => fundTimeline[f])
  const extraFunds = Object.keys(fundTimeline).filter(f => !txFunds.includes(f))
  const allTxFunds = [...txFunds, ...extraFunds]

  return (
    <div className="min-h-screen" style={{ background: '#fafaf8' }}>
      {/* Top bar */}
      <div className="border-b border-gray-200 px-8 py-2 flex items-center justify-between text-xs text-gray-400 tracking-widest uppercase">
        <span>{new Date().toLocaleDateString('en-SG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase()}</span>
        <span className="font-medium text-gray-600">PORTFOLIO TRACKER</span>
        <span>SGT</span>
      </div>
      <div className="border-b border-gray-200 px-8 py-3 flex items-center justify-between">
        <Link href="/" className="font-display text-xl font-semibold italic hover:opacity-70">
          Ledger <span className="text-xs font-sans font-normal not-italic text-gray-400">the portfolio ledger</span>
        </Link>
        <div className="flex gap-6 text-sm text-gray-500">
          <Link href="/" className="hover:text-gray-900">Portfolios</Link>
          <button onClick={deletePolicy} disabled={deleting}
            className="text-red-300 hover:text-red-500 text-xs"
            style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            {deleting ? 'Deleting…' : 'Delete policy'}
          </button>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-5 md:px-8 py-10">

        {/* ── I. Policy Detail ── */}
        <div className="mb-8">
          <div className="section-header mb-2"><span className="roman">I.</span><span className="section-title">POLICY DETAIL</span></div>
          <h1 className="font-display text-5xl font-medium mb-2">{(policy.nickname || policy.policy_number).toUpperCase()}</h1>
          <div className="text-sm text-gray-400">
            <span className="font-mono" style={{ color: '#2c4a6e' }}>{policy.policy_number}</span>
            <span className="mx-2">·</span>
            <span>{policy.product}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 border-y border-gray-200 divide-x divide-gray-200 mb-10">
          <div className="px-5 py-5 md:py-6 group relative overflow-hidden">
            <div className="eyebrow">ASSETS UNDER MANAGEMENT</div>
            <div className="mt-2 font-display text-3xl md:text-4xl leading-none tracking-tight tabular-nums">${fmtMoney(aum)}</div>
            <span aria-hidden="true" className="absolute left-5 bottom-0 h-px w-0 bg-terracotta transition-[width] duration-300 group-hover:w-12" />
          </div>
          <div className="px-5 py-5 md:py-6 group relative overflow-hidden">
            <div className="eyebrow">TOTAL INVESTED</div>
            <div className="mt-2 font-display text-3xl md:text-4xl leading-none tracking-tight tabular-nums">${fmtMoney(policy.invested)}</div>
            <span aria-hidden="true" className="absolute left-5 bottom-0 h-px w-0 bg-terracotta transition-[width] duration-300 group-hover:w-12" />
          </div>
          <div className="px-5 py-5 md:py-6 group relative overflow-hidden">
            <div className="eyebrow">RETURN ON INVESTMENT</div>
            <div className={`mt-2 font-display text-3xl md:text-4xl leading-none tracking-tight tabular-nums ${roi >= 0 ? 'positive' : 'negative'}`}>
              {roi != null ? `${roi.toFixed(2)}%` : '—'}
            </div>
            <span aria-hidden="true" className="absolute left-5 bottom-0 h-px w-0 bg-terracotta transition-[width] duration-300 group-hover:w-12" />
          </div>
          <div className="px-5 py-5 md:py-6 group relative overflow-hidden">
            <div className="eyebrow">DURATION</div>
            <div className="mt-2 font-display text-2xl md:text-3xl leading-snug tracking-tight">{duration}</div>
            {policy.commenced && <div className="text-xs mt-1" style={{color:'rgb(103,97,91)'}}>{fmtDate(policy.commenced)}</div>}
            <span aria-hidden="true" className="absolute left-5 bottom-0 h-px w-0 bg-terracotta transition-[width] duration-300 group-hover:w-12" />
          </div>
        </div>

        {/* ── II. Profile + III. Allocation ── */}
        <div className="grid grid-cols-2 gap-10 mb-10">

          {/* II. Profile */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="section-header"><span className="roman-sm">II.</span><span className="section-title">PROFILE</span></div>
              <button onClick={() => { setEditingPolicy(!editingPolicy); setEditPolicy(policy) }}
                className="text-xs text-gray-400 hover:text-gray-700 underline"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                {editingPolicy ? 'Cancel' : 'Edit'}
              </button>
            </div>
            {editingPolicy ? (
              <div className="space-y-2">
                {[
                  ['Nickname / Name', 'nickname', 'text'],
                  ['Product', 'product', 'text'],
                  ['Commenced', 'commenced', 'date'],
                  ['Premium', 'premium', 'number'],
                  ['Total Invested', 'invested', 'number'],
                  ['Charges (%)', 'charges', 'number'],
                  ['Welcome Bonus', 'welcome_bonus', 'number'],
                  ['Cash Value', 'cash', 'number'],
                  ['Dividends', 'dividends', 'number'],
                ].map(([label, key, type]) => (
                  <div key={key} className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 w-32 flex-shrink-0">{label}</span>
                    <input type={type} value={editPolicy?.[key] || ''}
                      onChange={e => setEditPolicy(p => ({ ...p, [key]: e.target.value }))}
                      className="flex-1 text-sm" style={{ padding: '4px 8px' }} />
                  </div>
                ))}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 w-32 flex-shrink-0">Frequency</span>
                  <select value={editPolicy?.frequency || 'Monthly'}
                    onChange={e => setEditPolicy(p => ({ ...p, frequency: e.target.value }))}
                    className="flex-1 text-sm" style={{ padding: '4px 8px' }}>
                    <option>Monthly</option><option>Single</option><option>Annual</option><option>Quarterly</option>
                  </select>
                </div>
                <div className="flex gap-2 mt-3">
                  <button onClick={savePolicyDetails} disabled={saving} className="btn-primary text-xs">{saving ? 'Saving…' : 'Save'}</button>
                  <button onClick={() => setEditingPolicy(false)} className="btn-secondary text-xs">Cancel</button>
                </div>
              </div>
            ) : (
              <table className="w-full text-sm">
                <tbody>
                  {[
                    ['Name',         policy.nickname || '—'],
                    ['Product',      policy.product],
                    ['Policy Number', policy.policy_number],
                    ['Commencement', fmtDate(policy.commenced)],
                    ['Premium',      `$${fmtMoney(policy.premium)}`],
                    ['Frequency',    policy.frequency],
                    ['Charges',      policy.charges ? `${policy.charges}% ($${fmtMoney(policy.premium * policy.charges / 100)})` : '—'],
                    ['Welcome Bonus', policy.welcome_bonus ? `$${fmtMoney(policy.welcome_bonus)}` : '0.00'],
                  ].map(([k, v]) => (
                    <tr key={k} className="border-b border-gray-100">
                      <td className="py-2 text-xs text-gray-400 uppercase tracking-wider pr-4 w-36">{k}</td>
                      <td className="py-2 text-sm font-medium text-right">{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* III. Allocation */}
          <div>
            <div className="section-header mb-2"><span className="roman-sm">III.</span><span className="section-title">ALLOCATION</span></div>
            <div className="text-xs text-gray-400 mb-4">Current portfolio distribution by fund</div>
            {donutData.length > 0 ? (
              <div className="flex flex-col items-center">
                <DonutChart data={donutData} size={220} sw={40} />
                <div className="mt-4 space-y-1.5 w-full">
                  {donutData.map((d, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: d.color }} />
                      <span className="text-gray-600 flex-1 truncate">{d.label}</span>
                      <span className="font-mono text-gray-500 flex-shrink-0">
                        {totalDonut ? ((d.value / totalDonut) * 100).toFixed(1) : 0}%
                      </span>
                    </div>
                  ))}
                </div>
                {priceDate && (
                  <div className="text-xs text-gray-400 mt-3 text-center">
                    Updated as of {new Date(priceDate).toLocaleDateString('en-SG', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm text-gray-400">No fund holdings yet.</div>
            )}
          </div>
        </div>

        {/* ── IV. Performance over time ── */}
        <div className="mb-10">
          <div className="section-header mb-2"><span className="roman-sm">IV.</span><span className="section-title">PERFORMANCE OVER TIME</span></div>
          <div className="text-xs text-gray-400 mb-4">TIV vs TIA monthly trajectory</div>
          <PerformanceChart
            commenced={policy.commenced}
            invested={policy.invested}
            aum={aum}
            transactions={transactions}
          />
        </div>

        {/* ── V. Portfolio summary ── */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-1">
            <div className="section-header"><span className="roman-sm">V.</span><span className="section-title">PORTFOLIO SUMMARY</span></div>
            <div className="flex items-center gap-3">
              {priceStatus && <span className="text-xs text-gray-400">{priceStatus}</span>}
              <button onClick={autoFetchPrices} className="text-xs text-gray-400 hover:text-gray-700 underline"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>↻ Refresh prices</button>
              <button onClick={() => { setEditMode(!editMode); setEditHoldings(holdings) }}
                className="text-xs text-gray-400 hover:text-gray-700 underline"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                {editMode ? 'Cancel' : 'Edit holdings'}
              </button>
            </div>
          </div>
          <div className="text-xs text-gray-400 mb-4">
            GE published price date: {priceDate ? new Date(priceDate).toLocaleDateString('en-SG', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}
            {transactions.length > 0 && <span className="ml-2 text-green-600">· Avg cost prices calculated from all transactions since inception</span>}
          </div>

          {editMode ? (
            <div>
              <div className="space-y-2 mb-4">
                {editHoldings.map((h, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-5">
                      {i === 0 && <div className="text-xs text-gray-400 mb-1 uppercase tracking-wider">Fund</div>}
                      <select value={h.fund_name} onChange={e => updateEditHolding(i, 'fund_name', e.target.value)}>
                        <option value="">Select fund…</option>
                        {GE_FUNDS.map(f => <option key={f} value={f}>{f}</option>)}
                      </select>
                    </div>
                    <div className="col-span-3">
                      {i === 0 && <div className="text-xs text-gray-400 mb-1 uppercase tracking-wider">Units</div>}
                      <input type="number" step="0.000001" placeholder="0.000000"
                        value={h.units} onChange={e => updateEditHolding(i, 'units', e.target.value)} />
                    </div>
                    <div className="col-span-3">
                      {i === 0 && <div className="text-xs text-gray-400 mb-1 uppercase tracking-wider">Avg Price (opt)</div>}
                      <input type="number" step="0.000001" placeholder="auto from tx"
                        value={h.avg_price} onChange={e => updateEditHolding(i, 'avg_price', e.target.value)} />
                    </div>
                    <div className="col-span-1 pb-1 text-center">
                      <button type="button" onClick={() => removeEditFund(i)}
                        className="text-gray-300 hover:text-red-400 text-lg"
                        style={{ background: 'none', border: 'none', cursor: 'pointer' }}>×</button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-3 mb-4">
                <button onClick={addEditFund} className="text-xs text-gray-400 hover:text-gray-700 underline"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>+ Add fund</button>
              </div>
              <div className="flex gap-3">
                <button onClick={saveHoldings} disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save Holdings'}</button>
                <button onClick={() => setEditMode(false)} className="btn-secondary">Cancel</button>
              </div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="w-full text-sm" style={{ minWidth: 780 }}>
                <thead>
                  <tr className="border-b border-gray-200">
                    {[
                      { label: 'FUND',          align: 'left'  },
                      { label: 'UNITS',         align: 'right' },
                      { label: 'PRICE',         align: 'right' },
                      { label: 'VALUE',         align: 'right' },
                      { label: 'AVG PRICE',     align: 'right' },
                      { label: 'AVG ROI',       align: 'right' },
                      { label: 'NET INFLOW',    align: 'right' },
                      { label: 'CURRENT PNL',  align: 'right' },
                      { label: 'APPORTIONMENT',align: 'right' },
                    ].map(({ label, align }) => (
                      <th key={label} className="py-2 pr-3 text-xs tracking-widest text-gray-400 font-normal" style={{ textAlign: align }}>{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {holdings.length === 0 ? (
                    <tr><td colSpan={9} className="py-8 text-center text-gray-400 text-sm">
                      No fund holdings.{' '}
                      <button onClick={() => setEditMode(true)} className="underline text-gray-600"
                        style={{ background: 'none', border: 'none', cursor: 'pointer' }}>Add funds →</button>
                    </td></tr>
                  ) : holdings.map((h, i) => {
                    const price      = prices[h.fund_name]
                    const value      = h.units * (price || h.last_known_price || 0)
                    const avgFromTx  = calcAvgPriceFromTx(transactions, h.fund_name)
                    const avgPrice   = avgFromTx || h.avg_price
                    const ret        = avgPrice && price ? ((price - avgPrice) / avgPrice) * 100 : null
                    const netInflow  = calcNetInflow(transactions, h.fund_name)
                    const pnl        = value - netInflow
                    const apportion  = totalDonut > 0 ? (value / totalDonut) * 100 : 0
                    return (
                      <tr key={h.id} className="table-row">
                        <td className="py-3 pr-3">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: FUND_COLORS[i % FUND_COLORS.length] }} />
                            <span className="text-xs">{h.fund_name.replace('GreatLink ', '')}</span>
                          </div>
                        </td>
                        <td className="py-3 pr-3 text-right font-mono text-xs">{fmtNum(h.units, 2)}</td>
                        <td className="py-3 pr-3 text-right font-mono text-xs">
                          {price ? (
                            <span>{fmtNum(price, 3)}</span>
                          ) : (
                            <input type="number" step="0.001" placeholder="Enter"
                              className="w-20 text-right text-xs py-0.5 px-1"
                              style={{ border: '1px solid #ddd', borderRadius: 3 }}
                              onBlur={e => e.target.value && updateManualPrice(h.fund_name, e.target.value)} />
                          )}
                        </td>
                        <td className="py-3 pr-3 text-right font-mono text-xs">{fmtMoney(value)}</td>
                        <td className={`py-3 pr-3 text-right font-mono text-xs ${ret == null ? '' : ret >= 0 ? 'positive' : 'negative'}`}>
                          {avgPrice ? fmtNum(avgPrice, 3) : '—'}
                        </td>
                        <td className={`py-3 pr-3 text-right text-xs ${ret == null ? 'neutral' : ret >= 0 ? 'positive' : 'negative'}`}>
                          {ret != null ? `${ret >= 0 ? '+' : ''}${ret.toFixed(2)}%` : 'N/A'}
                        </td>
                        <td className="py-3 pr-3 text-right font-mono text-xs">
                          {netInflow > 0 ? fmtMoney(netInflow) : <span className="neutral">0.00</span>}
                        </td>
                        <td className={`py-3 pr-3 text-right font-mono text-xs ${pnl >= 0 ? 'positive' : 'negative'}`}>
                          {`${fmtMoney(pnl)} (${netInflow > 0 ? ((pnl / netInflow) * 100).toFixed(2) + '%' : 'N/A'})`}
                        </td>
                        <td className="py-3 text-right font-mono text-xs">{apportion.toFixed(2)}</td>
                      </tr>
                    )
                  })}
                </tbody>
                {holdings.length > 0 && (
                  <tfoot>
                    <tr className="border-t border-gray-200">
                      <td colSpan={3} className="py-2 text-xs text-gray-400 uppercase tracking-wider">Total Investment Value</td>
                      <td className="py-2 text-right font-mono font-semibold text-base" colSpan={6}>${fmtMoney(aum)}</td>
                    </tr>
                    <tr>
                      <td colSpan={3} className="py-1 text-xs text-gray-400 uppercase tracking-wider">Total Dividends Received</td>
                      <td className="py-1 text-right font-mono font-semibold text-base" colSpan={6}>${fmtMoney(policy.dividends || 0)}</td>
                    </tr>
                    <tr>
                      <td colSpan={3} className="py-1 text-xs text-gray-400 uppercase tracking-wider">Total Investment Amount</td>
                      <td className="py-1 text-right font-mono text-xs" colSpan={6}>${fmtMoney(policy.invested)}</td>
                    </tr>
                    <tr>
                      <td colSpan={3} className="py-1 text-xs text-gray-400 uppercase tracking-wider">Return on Investment</td>
                      <td className={`py-1 text-right font-mono text-sm ${roi >= 0 ? 'positive' : 'negative'}`} colSpan={6}>{roi != null ? `${roi.toFixed(2)}%` : '—'}</td>
                    </tr>
                    <tr>
                      <td colSpan={3} className="py-1 text-xs text-gray-400 uppercase tracking-wider">XIRR</td>
                      <td className={`py-1 text-right font-mono text-sm ${xirr >= 0 ? 'positive' : 'negative'}`} colSpan={6}>{xirr != null ? `${xirr.toFixed(2)}%` : '—'}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </div>

        {/* ── VI. Contribution timeline ── */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-1">
            <div className="section-header"><span className="roman-sm">VI.</span><span className="section-title">CONTRIBUTION TIMELINE</span></div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <button onClick={() => setTimelineYear(y => y - 1)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}>‹</button>
                <span className="font-medium text-gray-700 text-sm">{timelineYear}</span>
                <button onClick={() => setTimelineYear(y => y + 1)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}>›</button>
              </div>
              <button onClick={() => { setShowAddTx(true); setTimeout(() => document.getElementById('add-tx-form')?.scrollIntoView({behavior:'smooth'}), 50) }}
                className="text-xs text-gray-400 hover:text-gray-700 underline"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>+ Add switch</button>
            </div>
          </div>
          <div className="text-xs text-gray-400 mb-4">Monthly premium allocations across funds</div>
          <ContributionTimeline transactions={transactions} year={timelineYear} holdings={holdings} />
        </div>

        {/* ── VII. Dividends ── */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-1">
            <div className="section-header"><span className="roman-sm">VII.</span><span className="section-title">DIVIDENDS</span></div>
            <button onClick={() => { setShowAddTx(true); setTimeout(() => document.getElementById('add-tx-form')?.scrollIntoView({behavior:'smooth'}), 50) }}
              className="text-xs text-gray-400 hover:text-gray-700 underline"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>+ Add dividend</button>
          </div>
          <div className="text-xs text-gray-400 mb-4">Distributions received from underlying funds</div>
          {dividendTxs.length === 0 ? (
            <div className="text-sm text-gray-400 py-4">No dividend transactions recorded yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  {[
                    { label: 'FUND',       align: 'left'   },
                    { label: 'PAYOUT',     align: 'center' },
                    { label: 'RATE',       align: 'right'  },
                    { label: 'ANNUALISED', align: 'right'  },
                    { label: 'DATE',       align: 'center' },
                    { label: 'METHOD',     align: 'center' },
                    { label: 'AMOUNT',     align: 'right'  },
                    { label: '',           align: 'center' },
                  ].map(({ label, align }) => (
                    <th key={label} className="py-2 pr-3 text-xs tracking-widest text-gray-400 font-normal" style={{ textAlign: align }}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dividendTxs.map(t => {
                  // Dividend type: price=per-unit rate, dividend_rate=annualised (already stored as such)
                  // Reinvest type: dividend_rate=per-unit rate (if stored), else null
                  const rate = t.type === 'Dividend'
                    ? (t.price != null ? parseFloat(t.price) : null)
                    : (t.dividend_rate != null ? parseFloat(t.dividend_rate) : null)
                  const annualised = t.type === 'Dividend'
                    ? (t.dividend_rate != null ? parseFloat(t.dividend_rate).toFixed(3) : null)
                    : (rate != null ? (rate * 12).toFixed(3) : null)
                  const amount     = t.value ? Math.abs(parseFloat(t.value)) : null
                  const method     = t.type === 'Reinvest' ? 'Reinvest' : (t.payment_method || 'Cash')
                  return (
                    <tr key={t.id} className="table-row">
                      <td className="py-2 pr-3 text-xs">{t.fund_name ? t.fund_name.replace('GreatLink ', '') : '—'}</td>
                      <td className="py-2 pr-3 text-center text-xs text-gray-400">Dividend</td>
                      <td className="py-2 pr-3 text-right font-mono text-xs">
                        {rate != null ? rate.toFixed(3) : '—'}
                      </td>
                      <td className="py-2 pr-3 text-right font-mono text-xs">
                        {annualised || '—'}
                      </td>
                      <td className="py-2 pr-3 font-mono text-center text-gray-500 text-xs">
                        {t.date ? new Date(t.date).toLocaleDateString('en-SG',{day:'2-digit',month:'short',year:'numeric'}) : '—'}
                      </td>
                      <td className="py-2 pr-3 text-center text-xs">
                        <span className={method === 'Reinvest' ? 'positive' : 'text-gray-500'}>{method}</span>
                      </td>
                      <td className="py-2 text-right font-mono font-medium text-xs">
                        {amount != null ? fmtMoney(amount) : '—'}
                      </td>
                      <td className="py-2">
                        <button onClick={() => deleteTransaction(t.id)}
                          className="text-gray-200 hover:text-red-400 text-xs"
                          style={{ background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-200">
                  <td colSpan={7} className="py-2 text-xs text-gray-400 uppercase tracking-wider">Total Dividend Amount</td>
                  <td className="py-2 text-right font-mono text-xs font-medium">{fmtMoney(cashDividendTotal)}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>

        {/* ── VIII. Transactions ── */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <div className="section-header"><span className="roman-sm">VIII.</span><span className="section-title">TRANSACTIONS</span></div>
            <button onClick={() => showAddTx ? setShowAddTx(false) : openAddTx('Net Investment Premium')}
              className="text-xs text-gray-400 hover:text-gray-700 underline"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              {showAddTx ? 'Cancel' : '+ Add transaction'}
            </button>
          </div>
          <div className="text-xs text-gray-400 mb-4">Per-fund transaction ledger</div>

          {showAddTx && (
            <div id="add-tx-form">
              <SmartTxForm
                policyId={policyId}
                transactions={transactions}
                onSaved={() => { setShowAddTx(false); fetchData() }}
                onCancel={() => setShowAddTx(false)}
              />
            </div>
          )}

          {transactions.length === 0 ? (
            <div className="py-8 text-center text-gray-400 text-sm">
              No transactions yet.{' '}
              <button onClick={() => setShowAddTx(true)} className="underline text-gray-600"
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}>Add your first →</button>
            </div>
          ) : (
            <div>
              {allTxFunds.map((fund, fi) => {
                const fundTxs = fundTimeline[fund] || []
                const price      = prices[fund]
                const holding    = holdings.find(h => h.fund_name === fund)
                const avgFromTx  = calcAvgPriceFromTx(transactions, fund)
                const avgPrice   = avgFromTx || holding?.avg_price
                const ret        = avgPrice && price ? ((price - avgPrice) / avgPrice) * 100 : null
                const currentUnits = fundTxs.length ? fundTxs[fundTxs.length - 1].bal_units : 0

                // totals — Meow's "before fees" = NET signed sum of all transactions
                const totalBeforeUnits = fundTxs.reduce((s, t) => s + (t.units_delta || 0), 0)  // units_delta already signed
                const totalBeforeValue = fundTxs.reduce((s, t) => {
                  const v = Math.abs(parseFloat(t.value) || 0)
                  return s + (['Switch Out', 'Welcome Bonus Clawback'].includes(t.type) ? -v : v)
                }, 0)
                // "after fees" value = current units × current market price (matches Meow)
                const afterFeesValue = currentUnits * (price || holding?.last_known_price || 0)

                return (
                  <div key={fund} className={fi > 0 ? 'mt-8' : ''}>
                    {/* Fund header row */}
                    <div className="flex items-center justify-between py-2 border-b border-gray-300">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ background: FUND_COLORS[fi % FUND_COLORS.length] }} />
                        <span className="font-medium text-sm">{fund.replace('GreatLink ', '')}</span>
                      </div>
                      <div className="flex items-center gap-6 text-xs text-gray-400">
                        <span>AVG PRICE <span className="text-gray-700 font-mono ml-1">{avgPrice ? fmtNum(avgPrice, 3) : '—'}</span></span>
                        <span>CURRENT PRICE <span className="text-gray-700 font-mono ml-1">{price ? fmtNum(price, 3) : '—'}</span></span>
                        <span className={`ml-1 font-mono ${ret == null ? '' : ret >= 0 ? 'positive' : 'negative'}`}>
                          {ret != null ? `${ret >= 0 ? '+' : ''}${ret.toFixed(2)}%` : 'N/A'}
                        </span>
                      </div>
                    </div>

                    <table className="w-full text-sm mb-2">
                      <thead>
                        <tr className="border-b border-gray-100">
                          {[
                            { label: 'DATE',        align: 'left'   },
                            { label: 'DESCRIPTION', align: 'left'   },
                            { label: 'PRICE',       align: 'right'  },
                            { label: 'BAL UNITS',   align: 'right'  },
                            { label: 'UNITS',       align: 'right'  },
                            { label: 'VALUE',       align: 'right'  },
                            { label: '',            align: 'center' },
                          ].map(({ label, align }, i) => (
                            <th key={i} className="py-1.5 pr-3 text-xs tracking-widest text-gray-400 font-normal" style={{ textAlign: align }}>{label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[...fundTxs].reverse().map(tx => (
                          <tr key={tx.id} className="table-row">
                            <td className="py-2 pr-3 font-mono text-gray-400">
                              {tx.date ? new Date(tx.date).toLocaleDateString('en-SG', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'}
                            </td>
                            <td className="py-2 pr-3 text-xs">
                              <span className={tx.type === 'Switch Out' ? 'negative' : tx.type === 'Switch In' ? 'positive' : 'neutral'}>{tx.type}</span>
                            </td>
                            <td className="py-2 pr-3 text-right font-mono text-xs">{tx.price ? fmtNum(tx.price, 3) : '—'}</td>
                            <td className="py-2 pr-3 text-right font-mono text-xs">{tx.bal_units != null ? fmtNum(tx.bal_units, 2) : '—'}</td>
                            <td className="py-2 pr-3 text-right font-mono text-xs">
                              {tx.units_delta != null ? (
                                tx.type === 'Switch Out'
                                  ? <span className="negative">-{fmtNum(Math.abs(tx.units_delta), 2)}</span>
                                  : fmtNum(Math.abs(tx.units_delta), 2)
                              ) : '—'}
                            </td>
                            <td className="py-2 pr-3 text-right font-mono text-xs">
                              {tx.value ? (
                                tx.type === 'Switch Out'
                                  ? <span className="negative">-{fmtMoney(Math.abs(parseFloat(tx.value)))}</span>
                                  : fmtMoney(Math.abs(parseFloat(tx.value)))
                              ) : '—'}
                            </td>
                            <td className="py-2">
                              <button onClick={() => deleteTransaction(tx.id)}
                                className="text-gray-200 hover:text-red-400 text-xs"
                                style={{ background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-gray-100">
                          <td colSpan={3} className="py-1 text-xs text-gray-400 uppercase tracking-wider">Total (before fees)</td>
                          <td />
                          <td className="py-1 text-right font-mono text-xs">{fmtNum(totalBeforeUnits, 2)}</td>
                          <td className="py-1 text-right font-mono text-xs">{fmtMoney(totalBeforeValue)}</td>
                          <td />
                        </tr>
                        <tr>
                          <td colSpan={3} className="py-1 text-xs text-gray-400 uppercase tracking-wider">Total (after fees)</td>
                          <td />
                          <td className="py-1 text-right font-mono text-xs">{fmtNum(currentUnits, 2)}</td>
                          <td className="py-1 text-right font-mono text-xs">{fmtMoney(afterFeesValue)}</td>
                          <td />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
