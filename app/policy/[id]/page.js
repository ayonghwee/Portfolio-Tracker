'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '../../../lib/supabase'
import { fmtMoney, fmtPct, calcROI, calcXIRR, calcDuration, fmtDate, donutSlices } from '../../../lib/utils'

const FUND_COLORS = [
  '#2d5016', '#b8963e', '#c0724a', '#4a7c59', '#8b6914',
  '#5a3e2b', '#3d6b8c', '#7a4f3e', '#4e6b2d', '#9b7b3d',
]

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

export default function PolicyPage() {
  const { id } = useParams()
  const router = useRouter()
  const [policy, setPolicy] = useState(null)
  const [holdings, setHoldings] = useState([])
  const [prices, setPrices] = useState({})
  const [loading, setLoading] = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [editHoldings, setEditHoldings] = useState([])
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [priceStatus, setPriceStatus] = useState('')

  useEffect(() => { loadData() }, [id])

  async function loadData() {
    setLoading(true)
    const { data: p } = await supabase.from('policies').select('*').eq('id', id).single()
    const { data: h } = await supabase.from('fund_holdings').select('*').eq('policy_id', id)
    const { data: pr } = await supabase.from('price_cache').select('*')

    const pm = {}
    pr?.forEach(r => { pm[r.fund_name] = r.bid_price })

    setPolicy(p)
    setHoldings(h || [])
    setPrices(pm)
    setEditHoldings(h || [])
    setLoading(false)
  }

  async function fetchPrices() {
    setPriceStatus('Fetching…')
    try {
      const res = await fetch('/api/prices', { method: 'POST' })
      const data = await res.json()
      if (data.prices?.length) {
        const pm = {}
        data.prices.forEach(p => { pm[p.fund_name] = p.bid_price })
        setPrices(pm)
        setPriceStatus(`Updated ${data.prices.length} fund prices`)
      } else {
        setPriceStatus(data.message || 'No prices returned — enter manually below')
      }
    } catch {
      setPriceStatus('Could not fetch prices — enter manually')
    }
    setTimeout(() => setPriceStatus(''), 5000)
  }

  async function saveHoldings() {
    setSaving(true)
    // Delete existing, re-insert
    await supabase.from('fund_holdings').delete().eq('policy_id', id)
    const valid = editHoldings.filter(h => h.fund_name && h.units)
    if (valid.length) {
      await supabase.from('fund_holdings').insert(
        valid.map(h => ({
          policy_id: id,
          fund_name: h.fund_name,
          units: parseFloat(h.units) || 0,
          avg_price: parseFloat(h.avg_price) || null,
          last_known_price: parseFloat(h.avg_price) || null,
        }))
      )
    }
    await loadData()
    setEditMode(false)
    setSaving(false)
  }

  async function updateManualPrice(fundName, price) {
    await supabase.from('price_cache').upsert({
      fund_name: fundName,
      bid_price: parseFloat(price),
      offer_price: parseFloat(price),
      price_date: new Date().toISOString().split('T')[0],
      updated_at: new Date().toISOString(),
    })
    setPrices(p => ({ ...p, [fundName]: parseFloat(price) }))
  }

  async function deletePolicy() {
    if (!confirm('Delete this policy? This cannot be undone.')) return
    setDeleting(true)
    await supabase.from('fund_holdings').delete().eq('policy_id', id)
    await supabase.from('policies').delete().eq('id', id)
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
      <div className="text-center"><div className="text-gray-400 mb-4">Policy not found.</div>
        <Link href="/" className="btn-primary">← Back to ledger</Link></div>
    </div>
  )

  const aum = holdings.reduce((s, h) => s + (h.units * (prices[h.fund_name] || h.last_known_price || 0)), 0)
  const roi = calcROI(aum, policy.invested)
  const xirr = calcXIRR(aum, policy.invested, policy.commenced)
  const duration = calcDuration(policy.commenced)

  const donutData = holdings.map((h, i) => ({
    label: h.fund_name.replace('GreatLink ', ''),
    value: h.units * (prices[h.fund_name] || h.last_known_price || 0),
    color: FUND_COLORS[i % FUND_COLORS.length],
  })).filter(d => d.value > 0)
  const slices = donutSlices(donutData, 55, 65, 65, 14)
  const totalDonut = donutData.reduce((s, d) => s + d.value, 0)

  return (
    <div className="min-h-screen" style={{ background: '#fafaf8' }}>
      {/* Top bar */}
      <div className="border-b border-gray-200 px-8 py-2 flex items-center justify-between text-xs text-gray-400 tracking-widest uppercase">
        <span>{new Date().toLocaleDateString('en-SG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase()}</span>
        <span className="font-medium text-gray-600">PORTFOLIO TRACKER</span>
        <span>SGT</span>
      </div>

      {/* Nav */}
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

      <div className="max-w-5xl mx-auto px-8 py-10">
        {/* Section I: Header */}
        <div className="mb-8">
          <div className="roman mb-1">I. POLICY DETAIL</div>
          <h1 className="font-display text-5xl font-medium mb-2">{policy.nickname || policy.policy_number}</h1>
          <div className="text-sm text-gray-400">
            <span className="text-terracotta font-mono">{policy.policy_number}</span>
            <span className="mx-2">·</span>
            <span>{policy.product}</span>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 border-t border-b border-gray-200 mb-10">
          <div className="stat-card border-r border-gray-200">
            <div className="text-xs tracking-widest text-gray-400 uppercase mb-2">Assets Under Management</div>
            <div className="font-display text-3xl font-medium">${fmtMoney(aum)}</div>
          </div>
          <div className="stat-card border-r border-gray-200">
            <div className="text-xs tracking-widest text-gray-400 uppercase mb-2">Total Invested</div>
            <div className="font-display text-3xl font-medium">${fmtMoney(policy.invested)}</div>
          </div>
          <div className="stat-card border-r border-gray-200">
            <div className="text-xs tracking-widest text-gray-400 uppercase mb-2">Return on Investment</div>
            <div className={`font-display text-3xl font-medium ${roi >= 0 ? 'positive' : 'negative'}`}>
              {roi != null ? `${roi.toFixed(2)}%` : '—'}
            </div>
          </div>
          <div className="stat-card">
            <div className="text-xs tracking-widest text-gray-400 uppercase mb-2">Duration</div>
            <div className="font-display text-3xl font-medium">{duration}</div>
            {policy.commenced && <div className="text-xs text-gray-400 mt-1">{fmtDate(policy.commenced)}</div>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-10 mb-10">
          {/* Section II: Profile */}
          <div>
            <div className="roman mb-3">II. Profile</div>
            <table className="w-full text-sm">
              <tbody>
                {[
                  ['Name', policy.nickname || '—'],
                  ['Product', policy.product],
                  ['Policy Number', policy.policy_number],
                  ['Commencement', fmtDate(policy.commenced)],
                  ['Premium', `$${fmtMoney(policy.premium)}`],
                  ['Frequency', policy.frequency],
                  ['Total Invested', `$${fmtMoney(policy.invested)}`],
                  ['XIRR (est.)', xirr != null ? `${xirr.toFixed(2)}%` : '—'],
                ].map(([k, v]) => (
                  <tr key={k} className="border-b border-gray-100">
                    <td className="py-2 text-xs text-gray-400 uppercase tracking-wider pr-4 w-40">{k}</td>
                    <td className="py-2 text-sm font-medium">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Section III: Allocation */}
          <div>
            <div className="roman mb-3">III. Allocation</div>
            <div className="text-xs text-gray-400 mb-4">Current portfolio distribution by fund</div>
            {donutData.length > 0 ? (
              <div className="flex items-center gap-6">
                <svg viewBox="0 0 130 130" width="130" height="130">
                  {slices.map((s, i) => (
                    <path key={i} d={s.d} fill={s.color} />
                  ))}
                  <circle cx="65" cy="65" r="38" fill="#fafaf8" />
                </svg>
                <div className="space-y-1.5 flex-1">
                  {donutData.map((d, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: d.color }} />
                      <span className="text-gray-600 truncate flex-1">{d.label}</span>
                      <span className="font-mono text-gray-500 flex-shrink-0">
                        {totalDonut ? ((d.value / totalDonut) * 100).toFixed(1) : 0}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-sm text-gray-400">No fund holdings yet.</div>
            )}
          </div>
        </div>

        {/* Section V: Portfolio Summary */}
        <div className="mb-2">
          <div className="flex items-center justify-between mb-1">
            <div className="roman">V. Portfolio summary</div>
            <div className="flex items-center gap-3">
              {priceStatus && <span className="text-xs text-gray-400">{priceStatus}</span>}
              <button onClick={fetchPrices}
                className="text-xs text-gray-400 hover:text-gray-700 underline"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                ↻ Fetch live prices
              </button>
              <button onClick={() => { setEditMode(!editMode); setEditHoldings(holdings) }}
                className="text-xs text-gray-400 hover:text-gray-700 underline"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                {editMode ? 'Cancel' : 'Edit holdings'}
              </button>
            </div>
          </div>
          <div className="text-xs text-gray-400 mb-4">Daily fund prices last updated from Great Eastern</div>

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
                      {i === 0 && <div className="text-xs text-gray-400 mb-1 uppercase tracking-wider">Avg / Manual Price</div>}
                      <input type="number" step="0.000001" placeholder="0.000"
                        value={h.avg_price} onChange={e => updateEditHolding(i, 'avg_price', e.target.value)} />
                    </div>
                    <div className="col-span-1 pb-1 text-center">
                      <button type="button" onClick={() => removeEditFund(i)}
                        className="text-gray-300 hover:text-red-400 text-lg" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>×</button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-3 mb-6">
                <button onClick={addEditFund}
                  className="text-xs text-gray-400 hover:text-gray-700 underline"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  + Add fund
                </button>
              </div>
              <div className="flex gap-3">
                <button onClick={saveHoldings} disabled={saving} className="btn-primary">
                  {saving ? 'Saving…' : 'Save Holdings'}
                </button>
                <button onClick={() => setEditMode(false)} className="btn-secondary">Cancel</button>
              </div>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 pr-4 text-xs tracking-widest text-gray-400 font-normal">FUND</th>
                  <th className="text-right py-2 pr-4 text-xs tracking-widest text-gray-400 font-normal">UNITS</th>
                  <th className="text-right py-2 pr-4 text-xs tracking-widest text-gray-400 font-normal">PRICE</th>
                  <th className="text-right py-2 pr-4 text-xs tracking-widest text-gray-400 font-normal">VALUE</th>
                  <th className="text-right py-2 pr-4 text-xs tracking-widest text-gray-400 font-normal">AVG PRICE</th>
                  <th className="text-right py-2 text-xs tracking-widest text-gray-400 font-normal">RETURN</th>
                </tr>
              </thead>
              <tbody>
                {holdings.length === 0 ? (
                  <tr><td colSpan={6} className="py-8 text-center text-gray-400 text-sm">
                    No fund holdings. <button onClick={() => setEditMode(true)} className="underline text-gray-600" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>Add funds →</button>
                  </td></tr>
                ) : holdings.map((h, i) => {
                  const price = prices[h.fund_name]
                  const value = h.units * (price || h.last_known_price || 0)
                  const ret = h.avg_price && price ? ((price - h.avg_price) / h.avg_price) * 100 : null
                  return (
                    <tr key={h.id} className="table-row">
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: FUND_COLORS[i % FUND_COLORS.length] }} />
                          <span className="text-xs">{h.fund_name.replace('GreatLink ', '')}</span>
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-right font-mono text-xs">{Number(h.units).toFixed(3)}</td>
                      <td className="py-3 pr-4 text-right font-mono text-xs">
                        {price ? (
                          <span className="text-forest">{Number(price).toFixed(3)}</span>
                        ) : (
                          <input type="number" step="0.001" placeholder="Enter price"
                            className="w-24 text-right text-xs py-0.5 px-1"
                            style={{ border: '1px solid #ddd', borderRadius: 3 }}
                            onBlur={e => e.target.value && updateManualPrice(h.fund_name, e.target.value)}
                          />
                        )}
                      </td>
                      <td className="py-3 pr-4 text-right font-mono text-xs">{fmtMoney(value)}</td>
                      <td className="py-3 pr-4 text-right font-mono text-xs">{h.avg_price ? Number(h.avg_price).toFixed(3) : '—'}</td>
                      <td className={`py-3 text-right text-xs ${ret >= 0 ? 'positive' : ret < 0 ? 'negative' : 'neutral'}`}>
                        {ret != null ? `${ret >= 0 ? '↑' : '↓'} ${Math.abs(ret).toFixed(2)}%` : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              {holdings.length > 0 && (
                <tfoot>
                  <tr className="border-t border-gray-200">
                    <td colSpan={3} className="py-3 text-xs text-gray-400 uppercase tracking-wider">Total Investment Value</td>
                    <td className="py-3 text-right font-mono text-sm font-medium">{fmtMoney(aum)}</td>
                    <td colSpan={2} />
                  </tr>
                  <tr>
                    <td colSpan={3} className="py-1 text-xs text-gray-400 uppercase tracking-wider">Total Investment Amount</td>
                    <td className="py-1 text-right font-mono text-xs">{fmtMoney(policy.invested)}</td>
                    <td colSpan={2} />
                  </tr>
                  <tr>
                    <td colSpan={3} className="py-1 text-xs text-gray-400 uppercase tracking-wider">Return on Investment</td>
                    <td className={`py-1 text-right font-mono text-xs ${roi >= 0 ? 'positive' : 'negative'}`}>
                      {roi != null ? `${roi.toFixed(2)}%` : '—'}
                    </td>
                    <td colSpan={2} />
                  </tr>
                  <tr>
                    <td colSpan={3} className="py-1 text-xs text-gray-400 uppercase tracking-wider">XIRR (est.)</td>
                    <td className={`py-1 text-right font-mono text-xs ${xirr >= 0 ? 'positive' : 'negative'}`}>
                      {xirr != null ? `${xirr.toFixed(2)}%` : '—'}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              )}
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
