'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '../../../lib/supabase'
import { fmtMoney, calcROI, calcXIRR, calcDuration, fmtDate } from '../../../lib/utils'

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

function calcAvgPriceFromTx(transactions, fundName) {
  const buys = transactions.filter(t =>
    t.fund_name === fundName &&
    ['Net Investment Premium','Reinvest','Switch In','Welcome Bonus'].includes(t.type) &&
    parseFloat(t.units) > 0 && parseFloat(t.price) > 0
  )
  const totalUnits = buys.reduce((s, t) => s + parseFloat(t.units), 0)
  const totalCost = buys.reduce((s, t) => s + (parseFloat(t.units) * parseFloat(t.price)), 0)
  return totalUnits > 0 ? totalCost / totalUnits : null
}

// Stroke-dasharray donut chart — handles single fund (100%) correctly
function DonutChart({ data, size = 130, sw = 14 }) {
  const r = (size / 2) - (sw / 2)
  const C = 2 * Math.PI * r
  const cx = size / 2, cy = size / 2
  const total = data.reduce((s, d) => s + d.value, 0)
  if (!total || data.length === 0) return null

  let acc = 0
  return (
    <svg width={size} height={size}>
      {data.map((d, i) => {
        const dash = (d.value / total) * C
        const gap = C - dash
        const offset = C / 4 - acc
        acc += dash
        return (
          <circle key={i} cx={cx} cy={cy} r={r}
            fill="none" stroke={d.color}
            strokeWidth={sw} strokeLinecap="butt"
            strokeDasharray={`${dash} ${gap}`}
            strokeDashoffset={offset}
          />
        )
      })}
    </svg>
  )
}

export default function PolicyPage() {
  const { number } = useParams()
  const router = useRouter()
  const [policy, setPolicy] = useState(null)
  const [policyId, setPolicyId] = useState(null)
  const [holdings, setHoldings] = useState([])
  const [transactions, setTransactions] = useState([])
  const [prices, setPrices] = useState({})
  const [loading, setLoading] = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [editHoldings, setEditHoldings] = useState([])
  const [editPolicy, setEditPolicy] = useState(null)
  const [editingPolicy, setEditingPolicy] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [priceStatus, setPriceStatus] = useState('')
  const [showAddTx, setShowAddTx] = useState(false)
  const [newTx, setNewTx] = useState({ date: '', type: 'Reinvest', fund_name: '', price: '', units: '', value: '' })
  const [savingTx, setSavingTx] = useState(false)

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
    setPolicy(p)
    setPolicyId(p.id)
    setHoldings(h || [])
    setTransactions(tx || [])
    setPrices(pm)
    setEditHoldings(h || [])
    setEditPolicy(p)
    setLoading(false)
    // Auto-fetch fresh prices from GE in the background
    autoFetchPrices()
  }

  async function autoFetchPrices() {
    try {
      const res = await fetch('/api/prices', { method: 'POST' })
      const data = await res.json()
      if (data.prices?.length) {
        const pm = {}
        data.prices.forEach(p => { pm[p.fund_name] = p.bid_price })
        setPrices(pm)
        setPriceStatus(`Prices as of ${data.date || 'latest'}`)
        setTimeout(() => setPriceStatus(''), 4000)
      }
    } catch { /* silent fail */ }
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
        setPriceStatus(`Updated ${data.prices.length} prices`)
      } else {
        setPriceStatus(data.message || 'Prices set automatically via daily schedule')
      }
    } catch { setPriceStatus('Enter prices manually below') }
    setTimeout(() => setPriceStatus(''), 5000)
  }

  async function saveHoldings() {
    setSaving(true)
    await supabase.from('fund_holdings').delete().eq('policy_id', policyId)
    const valid = editHoldings.filter(h => h.fund_name && h.units)
    if (valid.length) {
      await supabase.from('fund_holdings').insert(
        valid.map(h => ({
          policy_id: policyId,
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

  async function savePolicyDetails() {
    setSaving(true)
    await supabase.from('policies').update({
      nickname: editPolicy.nickname,
      product: editPolicy.product,
      commenced: editPolicy.commenced,
      premium: parseFloat(editPolicy.premium) || 0,
      frequency: editPolicy.frequency,
      invested: parseFloat(editPolicy.invested) || 0,
      charges: parseFloat(editPolicy.charges) || 0,
      cash: parseFloat(editPolicy.cash) || 0,
      dividends: parseFloat(editPolicy.dividends) || 0,
      welcome_bonus: parseFloat(editPolicy.welcome_bonus) || 0,
    }).eq('id', policyId)
    await loadData()
    setEditingPolicy(false)
    setSaving(false)
  }

  async function addTransaction() {
    if (!newTx.date || !newTx.type) return
    setSavingTx(true)
    const units = parseFloat(newTx.units) || 0
    const price = parseFloat(newTx.price) || 0
    const value = parseFloat(newTx.value) || (units * price)
    await supabase.from('transactions').insert({
      policy_id: policyId,
      fund_name: newTx.fund_name || null,
      date: newTx.date,
      type: newTx.type,
      price: price || null,
      units: units || null,
      value: value || null,
    })
    setNewTx({ date: '', type: 'Reinvest', fund_name: '', price: '', units: '', value: '' })
    setShowAddTx(false)
    await loadData()
    setSavingTx(false)
  }

  async function deleteTransaction(txId) {
    await supabase.from('transactions').delete().eq('id', txId)
    setTransactions(t => t.filter(tx => tx.id !== txId))
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

  const aum = holdings.reduce((s, h) => s + (h.units * (prices[h.fund_name] || h.last_known_price || 0)), 0)
  const roi = calcROI(aum, policy.invested)
  const xirr = calcXIRR(aum, policy.invested, policy.commenced)
  const duration = calcDuration(policy.commenced)

  const donutData = holdings.map((h, i) => ({
    label: h.fund_name.replace('GreatLink ', ''),
    value: h.units * (prices[h.fund_name] || h.last_known_price || 0),
    color: FUND_COLORS[i % FUND_COLORS.length],
  })).filter(d => d.value > 0)
  const totalDonut = donutData.reduce((s, d) => s + d.value, 0)

  return (
    <div className="min-h-screen" style={{ background: '#fafaf8' }}>
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

      <div className="max-w-5xl mx-auto px-8 py-10">
        <div className="mb-8">
          <div className="roman mb-1">I. POLICY DETAIL</div>
          <h1 className="font-display text-5xl font-medium mb-2">{policy.nickname || policy.policy_number}</h1>
          <div className="text-sm text-gray-400">
            <span className="text-terracotta font-mono">{policy.policy_number}</span>
            <span className="mx-2">·</span>
            <span>{policy.product}</span>
          </div>
        </div>

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
            <div className="flex items-center justify-between mb-3">
              <div className="roman">II. Profile</div>
              <button onClick={() => { setEditingPolicy(!editingPolicy); setEditPolicy(policy) }}
                className="text-xs text-gray-400 hover:text-gray-700 underline"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                {editingPolicy ? 'Cancel' : 'Edit'}
              </button>
            </div>
            {editingPolicy ? (
              <div className="space-y-2">
                {[
                  ['Nickname', 'nickname', 'text'],
                  ['Product', 'product', 'text'],
                  ['Commenced', 'commenced', 'date'],
                  ['Premium', 'premium', 'number'],
                  ['Total Invested', 'invested', 'number'],
                  ['Charges', 'charges', 'number'],
                  ['Cash Value', 'cash', 'number'],
                  ['Dividends', 'dividends', 'number'],
                  ['Welcome Bonus', 'welcome_bonus', 'number'],
                ].map(([label, key, type]) => (
                  <div key={key} className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 w-28 flex-shrink-0">{label}</span>
                    <input type={type} value={editPolicy?.[key] || ''}
                      onChange={e => setEditPolicy(p => ({ ...p, [key]: e.target.value }))}
                      className="flex-1 text-sm" style={{ padding: '4px 8px' }} />
                  </div>
                ))}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 w-28 flex-shrink-0">Frequency</span>
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
                    ['Name', policy.nickname || '—'],
                    ['Product', policy.product],
                    ['Policy Number', policy.policy_number],
                    ['Commencement', fmtDate(policy.commenced)],
                    ['Premium', `$${fmtMoney(policy.premium)}`],
                    ['Frequency', policy.frequency],
                    ['Total Invested', `$${fmtMoney(policy.invested)}`],
                    ['Charges', policy.charges ? `$${fmtMoney(policy.charges)}` : '—'],
                    ['Welcome Bonus', policy.welcome_bonus ? `$${fmtMoney(policy.welcome_bonus)}` : '—'],
                    ['Cash Value', policy.cash ? `$${fmtMoney(policy.cash)}` : '—'],
                    ['Dividends', policy.dividends ? `$${fmtMoney(policy.dividends)}` : '—'],
                    ['XIRR (est.)', xirr != null ? `${xirr.toFixed(2)}%` : '—'],
                  ].map(([k, v]) => (
                    <tr key={k} className="border-b border-gray-100">
                      <td className="py-2 text-xs text-gray-400 uppercase tracking-wider pr-4 w-36">{k}</td>
                      <td className="py-2 text-sm font-medium">{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Section III: Allocation */}
          <div>
            <div className="roman mb-3">III. Allocation</div>
            <div className="text-xs text-gray-400 mb-4">Current portfolio distribution by fund</div>
            {donutData.length > 0 ? (
              <div className="flex items-center gap-6">
                <DonutChart data={donutData} size={130} sw={14} />
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
        <div className="mb-10">
          <div className="flex items-center justify-between mb-1">
            <div className="roman">V. Portfolio summary</div>
            <div className="flex items-center gap-3">
              {priceStatus && <span className="text-xs text-gray-400">{priceStatus}</span>}
              <button onClick={fetchPrices} className="text-xs text-gray-400 hover:text-gray-700 underline"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>↻ Fetch live prices</button>
              <button onClick={() => { setEditMode(!editMode); setEditHoldings(holdings) }}
                className="text-xs text-gray-400 hover:text-gray-700 underline"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                {editMode ? 'Cancel' : 'Edit holdings'}
              </button>
            </div>
          </div>
          <div className="text-xs text-gray-400 mb-4">
            Prices auto-updated daily via schedule
            {transactions.length > 0 && <span className="ml-2 text-green-600">· Avg prices from {transactions.length} transactions</span>}
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
                      {i === 0 && <div className="text-xs text-gray-400 mb-1 uppercase tracking-wider">Avg Price (optional)</div>}
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
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  {['FUND','UNITS','PRICE','VALUE','AVG PRICE','RETURN'].map(h => (
                    <th key={h} className="text-left py-2 pr-4 text-xs tracking-widest text-gray-400 font-normal">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {holdings.length === 0 ? (
                  <tr><td colSpan={6} className="py-8 text-center text-gray-400 text-sm">
                    No fund holdings.{' '}
                    <button onClick={() => setEditMode(true)} className="underline text-gray-600"
                      style={{ background: 'none', border: 'none', cursor: 'pointer' }}>Add funds →</button>
                  </td></tr>
                ) : holdings.map((h, i) => {
                  const price = prices[h.fund_name]
                  const value = h.units * (price || h.last_known_price || 0)
                  const avgFromTx = calcAvgPriceFromTx(transactions, h.fund_name)
                  const avgPrice = avgFromTx || h.avg_price
                  const ret = avgPrice && price ? ((price - avgPrice) / avgPrice) * 100 : null
                  return (
                    <tr key={h.id} className="table-row">
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: FUND_COLORS[i % FUND_COLORS.length] }} />
                          <span className="text-xs">{h.fund_name.replace('GreatLink ', '')}</span>
                          {avgFromTx && <span className="text-xs text-green-500" title="Avg price calculated from transactions">●</span>}
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
                            onBlur={e => e.target.value && updateManualPrice(h.fund_name, e.target.value)} />
                        )}
                      </td>
                      <td className="py-3 pr-4 text-right font-mono text-xs">{fmtMoney(value)}</td>
                      <td className="py-3 pr-4 text-right font-mono text-xs">
                        {avgPrice ? (
                          <span className={avgFromTx ? 'text-green-600' : ''}>{Number(avgPrice).toFixed(3)}</span>
                        ) : '—'}
                      </td>
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
                    <td colSpan={3} className="py-1 text-xs text-gray-400 uppercase tracking-wider">Total Invested</td>
                    <td className="py-1 text-right font-mono text-xs">{fmtMoney(policy.invested)}</td>
                    <td colSpan={2} />
                  </tr>
                  <tr>
                    <td colSpan={3} className="py-1 text-xs text-gray-400 uppercase tracking-wider">ROI</td>
                    <td className={`py-1 text-right font-mono text-xs ${roi >= 0 ? 'positive' : 'negative'}`}>{roi != null ? `${roi.toFixed(2)}%` : '—'}</td>
                    <td colSpan={2} />
                  </tr>
                  <tr>
                    <td colSpan={3} className="py-1 text-xs text-gray-400 uppercase tracking-wider">XIRR (est.)</td>
                    <td className={`py-1 text-right font-mono text-xs ${xirr >= 0 ? 'positive' : 'negative'}`}>{xirr != null ? `${xirr.toFixed(2)}%` : '—'}</td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              )}
            </table>
          )}
        </div>

        {/* Section VIII: Transactions */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <div className="roman">VIII. Transactions</div>
            <button onClick={() => setShowAddTx(s => !s)}
              className="text-xs text-gray-400 hover:text-gray-700 underline"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              {showAddTx ? 'Cancel' : '+ Add transaction'}
            </button>
          </div>
          <div className="text-xs text-gray-400 mb-4">
            Per-fund transaction ledger · used to auto-calculate weighted avg price
          </div>

          {showAddTx && (
            <div className="border border-gray-200 rounded p-4 mb-4" style={{ background: 'white' }}>
              <div className="grid grid-cols-6 gap-3 mb-3">
                <div>
                  <div className="text-xs text-gray-400 mb-1 uppercase tracking-wider">Date</div>
                  <input type="date" value={newTx.date} onChange={e => setNewTx(t => ({ ...t, date: e.target.value }))} />
                </div>
                <div>
                  <div className="text-xs text-gray-400 mb-1 uppercase tracking-wider">Type</div>
                  <select value={newTx.type} onChange={e => setNewTx(t => ({ ...t, type: e.target.value }))}>
                    {TX_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <div className="text-xs text-gray-400 mb-1 uppercase tracking-wider">Fund</div>
                  <select value={newTx.fund_name} onChange={e => setNewTx(t => ({ ...t, fund_name: e.target.value }))}>
                    <option value="">Select fund…</option>
                    {GE_FUNDS.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div>
                  <div className="text-xs text-gray-400 mb-1 uppercase tracking-wider">Price</div>
                  <input type="number" step="0.000001" placeholder="0.000"
                    value={newTx.price} onChange={e => setNewTx(t => ({ ...t, price: e.target.value }))} />
                </div>
                <div>
                  <div className="text-xs text-gray-400 mb-1 uppercase tracking-wider">Units</div>
                  <input type="number" step="0.000001" placeholder="0.000"
                    value={newTx.units} onChange={e => setNewTx(t => ({ ...t, units: e.target.value }))} />
                </div>
              </div>
              <button onClick={addTransaction} disabled={savingTx} className="btn-primary text-xs">
                {savingTx ? 'Saving…' : 'Add Transaction'}
              </button>
            </div>
          )}

          {transactions.length === 0 ? (
            <div className="py-8 text-center text-gray-400 text-sm">
              No transactions yet.{' '}
              <button onClick={() => setShowAddTx(true)} className="underline text-gray-600"
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                Add your first transaction →
              </button>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  {['FUND','DATE','TYPE','PRICE','UNITS','VALUE',''].map((h, i) => (
                    <th key={i} className="text-left py-2 pr-4 text-xs tracking-widest text-gray-400 font-normal">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {transactions.map(tx => (
                  <tr key={tx.id} className="table-row">
                    <td className="py-2 pr-4 text-xs">{tx.fund_name ? tx.fund_name.replace('GreatLink ', '') : '—'}</td>
                    <td className="py-2 pr-4 text-xs text-terracotta font-mono">
                      {tx.date ? new Date(tx.date).toLocaleDateString('en-SG', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                    </td>
                    <td className="py-2 pr-4 text-xs">
                      <span className={tx.type === 'Switch Out' ? 'negative' : tx.type === 'Switch In' ? 'positive' : 'neutral'}>{tx.type}</span>
                    </td>
                    <td className="py-2 pr-4 text-right font-mono text-xs">{tx.price ? Number(tx.price).toFixed(3) : '—'}</td>
                    <td className="py-2 pr-4 text-right font-mono text-xs">{tx.units ? Number(tx.units).toFixed(3) : '—'}</td>
                    <td className="py-2 pr-4 text-right font-mono text-xs">
                      <span className={tx.type === 'Switch Out' ? 'negative' : ''}>{tx.value ? fmtMoney(Math.abs(tx.value)) : '—'}</span>
                    </td>
                    <td className="py-2">
                      <button onClick={() => deleteTransaction(tx.id)}
                        className="text-gray-200 hover:text-red-400 text-xs"
                        style={{ background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
