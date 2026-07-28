'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'
import { fmtMoney, calcROI, calcXIRR } from '../lib/utils'

const GE_URL = 'https://www.greateasternlife.com/bin/corp-site/fund-prices.json?name=gDaily'
const COLUMNS = [
  { key: 'policy_number', label: 'POLICY #' },
  { key: 'nickname',      label: 'NICKNAME' },
  { key: 'product',       label: 'PRODUCT' },
  { key: 'commenced',     label: 'COMMENCED' },
  { key: 'premium',       label: 'PREMIUM' },
  { key: 'invested',      label: 'INVESTED' },
  { key: 'aum',           label: 'AUM' },
  { key: 'cash',          label: 'CASH' },
  { key: 'dividends',     label: 'DIVIDENDS' },
  { key: 'roi',           label: 'ROI' },
  { key: 'xirr',          label: 'XIRR' },
]
const FUND_COLORS = ['#2d5016','#b8963e','#c0724a','#4a7c59','#8b6914','#5a3e2b','#3d6b8c','#7a4f3e','#4e6b2d','#9b7b3d']

export default function LedgerPage() {
  const router = useRouter()
  const [policies, setPolicies] = useState([])
  const [prices, setPrices] = useState({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [now, setNow] = useState('')
  const [showNames, setShowNames] = useState(false)
  const [sortCol, setSortCol] = useState('xirr')
  const [sortDir, setSortDir] = useState('desc')
  const [user, setUser] = useState(null)
  const [priceDate, setPriceDate] = useState('')
  const [priceStatus, setPriceStatus] = useState('')
  const [tooltip, setTooltip] = useState(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })

  useEffect(() => {
    setNow(new Date().toLocaleString('en-SG', { timeZone: 'Asia/Singapore', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }))
    checkAuth()
  }, [])

  async function checkAuth() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }
    setUser(session.user)
    loadData()
  }

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  async function loadData() {
    setLoading(true)
    const { data: policiesData } = await supabase.from('policies').select('*, fund_holdings(*)').order('commenced', { ascending: false })
    const { data: cachedPrices } = await supabase.from('price_cache').select('*')
    const priceMap = {}
    cachedPrices?.forEach(p => { priceMap[p.fund_name] = p.bid_price })
    const dates = cachedPrices?.map(p => p.price_date).filter(Boolean).sort().reverse()
    if (dates?.length) setPriceDate(dates[0])
    setPolicies(policiesData || [])
    setPrices(priceMap)
    setLoading(false)
    autoFetchPrices()
  }

  async function autoFetchPrices() {
    setPriceStatus('Updating prices…')
    try {
      // Fetch directly from browser (SG IP, bypasses Vercel geo-block)
      const res = await fetch(GE_URL)
      if (res.ok) {
        const data = await res.json()
        if (data.funds?.length) {
          const today = new Date().toISOString().split('T')[0]
          const upserts = data.funds.map(f => ({
            fund_name: f.fundName,
            bid_price: parseFloat(f.fundBidPrice),
            offer_price: parseFloat(f.fundOfferPrice),
            price_date: f.fundValueDate || today,
            updated_at: new Date().toISOString()
          }))
          await supabase.from('price_cache').upsert(upserts)
          const pm = {}
          upserts.forEach(p => { pm[p.fund_name] = p.bid_price })
          setPrices(pm)
          setPriceDate(upserts[0]?.price_date || today)
          setPriceStatus('')
          return
        }
      }
    } catch { /* CORS blocked — fall back to server */ }
    // Fall back to server-side
    try {
      const res = await fetch('/api/prices', { method: 'POST' })
      const data = await res.json()
      if (data.prices?.length) {
        const pm = {}
        data.prices.forEach(p => { pm[p.fund_name] = p.bid_price })
        setPrices(pm)
        if (data.date) setPriceDate(data.date)
      }
    } catch { }
    setPriceStatus('')
  }

  function getAUM(policy) {
    if (!policy.fund_holdings?.length) return 0
    return policy.fund_holdings.reduce((sum, h) => sum + (h.units * (prices[h.fund_name] || h.last_known_price || 0)), 0)
  }

  function handleSort(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('desc') }
  }

  function getSortArrow(col) {
    if (sortCol !== col) return <span className="text-gray-200 ml-1">↕</span>
    return <span className="ml-1" style={{ color: '#2d5016' }}>{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  const enriched = policies
    .filter(p => !search || p.policy_number?.toLowerCase().includes(search.toLowerCase()) || p.nickname?.toLowerCase().includes(search.toLowerCase()) || p.product?.toLowerCase().includes(search.toLowerCase()))
    .map(p => { const aum = getAUM(p); return { ...p, aum, roi: calcROI(aum, p.invested), xirr: calcXIRR(aum, p.invested, p.commenced) } })
    .sort((a, b) => {
      let av = a[sortCol], bv = b[sortCol]
      if (av == null) av = sortDir === 'asc' ? Infinity : -Infinity
      if (bv == null) bv = sortDir === 'asc' ? Infinity : -Infinity
      if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
      return sortDir === 'asc' ? av - bv : bv - av
    })

  const totalAUM = enriched.reduce((s, p) => s + p.aum, 0)
  const totalInvested = enriched.reduce((s, p) => s + (p.invested || 0), 0)
  const aggROI = calcROI(totalAUM, totalInvested)

  if (!user && loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#fafaf8' }}>
      <div className="text-gray-400 text-sm">Loading…</div>
    </div>
  )

  return (
    <div className="min-h-screen" style={{ background: '#fafaf8' }}>
      {tooltip && (
        <div style={{
          position: 'fixed', left: tooltipPos.x + 16, top: tooltipPos.y - 8,
          zIndex: 1000, background: 'white', border: '1px solid #e5e5e0',
          borderRadius: 6, padding: '10px 14px', boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
          minWidth: 240, pointerEvents: 'none'
        }}>
          <div className="text-xs text-gray-400 uppercase tracking-widest mb-2">{tooltip.policy_number}</div>
          {tooltip.holdings.length === 0 ? (
            <div className="text-xs text-gray-400">No fund holdings</div>
          ) : tooltip.holdings.map((h, i) => {
            const val = h.units * (prices[h.fund_name] || h.last_known_price || 0)
            return (
              <div key={i} className="flex items-center gap-2 mb-1.5">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: FUND_COLORS[i % FUND_COLORS.length] }} />
                <span className="text-xs text-gray-600 flex-1 truncate">{h.fund_name.replace('GreatLink ', '')}</span>
                <span className="text-xs font-mono text-gray-500 ml-2">{tooltip.aum ? ((val / tooltip.aum) * 100).toFixed(1) : 0}%</span>
                <span className="text-xs font-mono text-gray-700">${fmtMoney(val)}</span>
              </div>
            )
          })}
          <div className="border-t border-gray-100 mt-2 pt-2 flex justify-between">
            <span className="text-xs text-gray-400">Total AUM</span>
            <span className="text-xs font-mono font-medium">${fmtMoney(tooltip.aum)}</span>
          </div>
        </div>
      )}

      <div className="border-b border-gray-200 px-8 py-2 flex items-center justify-between text-xs text-gray-400 tracking-widest uppercase">
        <span>{new Date().toLocaleDateString('en-SG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase()}</span>
        <span className="font-medium text-gray-600">PORTFOLIO TRACKER</span>
        <span>SGT</span>
      </div>
      <div className="border-b border-gray-200 px-8 py-3 flex items-center justify-between">
        <span className="font-display text-xl font-semibold italic">Ledger <span className="text-xs font-sans font-normal not-italic text-gray-400">the portfolio ledger</span></span>
        <div className="flex gap-6 text-sm text-gray-500 items-center">
          <span className="text-gray-900 font-medium">Portfolios</span>
          <Link href="/policy/new" className="hover:text-gray-900">+ Add Policy</Link>
          {user && <button onClick={signOut} className="text-xs text-gray-400 hover:text-gray-600" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>Sign out</button>}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-10">
        <div className="flex items-start justify-between mb-8">
          <div>
            <div className="roman mb-1">I. PORTFOLIO OVERVIEW</div>
            <h1 className="font-display text-5xl font-medium">The ledger</h1>
          </div>
          <div className="text-right text-xs text-gray-400 mt-2 italic">
            <div>Twenty-four hours of fund movement, all your policies, one page.</div>
            <div className="mt-2 text-gray-500">
              AS OF {now}
              {priceDate && <span className="ml-1 text-green-600">· GE prices as of {priceDate}</span>}
              {priceStatus && <span className="ml-2 text-gray-400">· {priceStatus}</span>}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-4 border-t border-b border-gray-200 mb-8">
          <div className="stat-card border-r border-gray-200">
            <div className="text-xs tracking-widest text-gray-400 uppercase mb-2">Assets Under Management</div>
            <div className="font-display text-3xl font-medium">${fmtMoney(totalAUM)}</div>
          </div>
          <div className="stat-card border-r border-gray-200">
            <div className="text-xs tracking-widest text-gray-400 uppercase mb-2">Total Invested</div>
            <div className="font-display text-3xl font-medium">${fmtMoney(totalInvested)}</div>
          </div>
          <div className="stat-card border-r border-gray-200">
            <div className="text-xs tracking-widest text-gray-400 uppercase mb-2">Aggregate ROI</div>
            <div className={`font-display text-3xl font-medium ${aggROI >= 0 ? 'positive' : 'negative'}`}>{aggROI != null ? `${aggROI.toFixed(2)}%` : '—'}</div>
          </div>
          <div className="stat-card">
            <div className="text-xs tracking-widest text-gray-400 uppercase mb-2">Portfolios</div>
            <div className="font-display text-3xl font-medium">{policies.length}</div>
            <div className="text-xs text-gray-400 mt-1">across all products</div>
          </div>
        </div>

        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1">
            <input type="text" placeholder="Search policies, nicknames, products…" value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-4 pr-4 py-2 text-sm border border-gray-200 rounded" style={{ background: 'white' }} />
          </div>
          <button onClick={() => setShowNames(n => !n)} className="btn-secondary text-xs tracking-widest">
            {showNames ? '👁 HIDE NAMES' : '🙈 SHOW NAMES'}
          </button>
          <Link href="/policy/new"><button className="btn-primary text-xs tracking-widest">+ ADD POLICY</button></Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-300">
                {COLUMNS.map(col => (
                  <th key={col.key} onClick={() => handleSort(col.key)}
                    className="text-left py-2 pr-4 text-xs tracking-widest text-gray-400 font-normal cursor-pointer hover:text-gray-700 select-none whitespace-nowrap">
                    {col.label}{getSortArrow(col.key)}
                  </th>
                ))}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={12} className="py-12 text-center text-gray-400 text-sm">Loading portfolios…</td></tr>
              ) : enriched.length === 0 ? (
                <tr><td colSpan={12} className="py-12 text-center text-gray-400 text-sm">
                  No policies yet. <Link href="/policy/new" className="underline text-gray-600">Add your first policy →</Link>
                </td></tr>
              ) : enriched.map(p => (
                <tr key={p.id} className="table-row">
                  <td className="py-3 pr-4">
                    <Link href={`/policy/${p.policy_number}`} className="text-terracotta hover:underline font-mono text-xs"
                      onMouseEnter={e => { setTooltip({ policy_number: p.policy_number, holdings: p.fund_holdings || [], aum: p.aum }); setTooltipPos({ x: e.clientX, y: e.clientY }) }}
                      onMouseLeave={() => setTooltip(null)}
                      onMouseMove={e => setTooltipPos({ x: e.clientX, y: e.clientY })}>
                      {p.policy_number}
                    </Link>
                  </td>
                  <td className="py-3 pr-4 text-xs" style={{ maxWidth: 120 }}>
                    <span style={{ filter: showNames ? 'none' : 'blur(4px)', transition: 'filter 0.2s', userSelect: showNames ? 'auto' : 'none', display: 'inline-block', color: '#888' }}>{p.nickname || '—'}</span>
                  </td>
                  <td className="py-3 pr-4 font-medium text-xs">{p.product}</td>
                  <td className="py-3 pr-4 text-gray-500 text-xs whitespace-nowrap">{p.commenced ? new Date(p.commenced).toLocaleDateString('en-SG', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>
                  <td className="py-3 pr-4 text-right font-mono text-xs">{fmtMoney(p.premium)}</td>
                  <td className="py-3 pr-4 text-right font-mono text-xs">{fmtMoney(p.invested)}</td>
                  <td className="py-3 pr-4 text-right font-mono text-xs">{fmtMoney(p.aum)}</td>
                  <td className="py-3 pr-4 text-right font-mono text-xs neutral">{p.cash ? fmtMoney(p.cash) : '—'}</td>
                  <td className="py-3 pr-4 text-right font-mono text-xs neutral">{p.dividends ? fmtMoney(p.dividends) : '—'}</td>
                  <td className={`py-3 pr-4 text-right text-xs ${p.roi >= 0 ? 'positive' : p.roi < 0 ? 'negative' : ''}`}>{p.roi != null ? `${p.roi >= 0 ? '↑' : '↓'} ${Math.abs(p.roi).toFixed(2)}%` : '—'}</td>
                  <td className={`py-3 pr-4 text-right text-xs ${p.xirr >= 0 ? 'positive' : p.xirr < 0 ? 'negative' : ''}`}>{p.xirr != null ? `${p.xirr.toFixed(2)}%` : '—'}</td>
                  <td className="py-3"><Link href={`/policy/${p.policy_number}`} className="text-gray-300 hover:text-gray-600 text-lg">···</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
