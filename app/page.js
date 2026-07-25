'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../lib/supabase'
import { fmtMoney, fmtPct, calcROI, calcXIRR } from '../lib/utils'

export default function LedgerPage() {
  const [policies, setPolicies] = useState([])
  const [prices, setPrices] = useState({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [now, setNow] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    setNow(new Date().toLocaleString('en-SG', {
      timeZone: 'Asia/Singapore',
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    }))
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    // Load policies with their fund holdings
    const { data: policiesData } = await supabase
      .from('policies')
      .select('*, fund_holdings(*)')
      .order('commenced', { ascending: false })

    // Load cached prices
    const { data: pricesData } = await supabase
      .from('price_cache')
      .select('*')

    const priceMap = {}
    pricesData?.forEach(p => { priceMap[p.fund_name] = p.bid_price })

    setPolicies(policiesData || [])
    setPrices(priceMap)
    setLoading(false)
  }

  async function refreshPrices() {
    setRefreshing(true)
    try {
      const res = await fetch('/api/prices', { method: 'POST' })
      const data = await res.json()
      if (data.prices) {
        const pm = {}
        data.prices.forEach(p => { pm[p.fund_name] = p.bid_price })
        setPrices(pm)
      }
    } catch (e) {
      console.error(e)
    }
    setRefreshing(false)
  }

  function getAUM(policy) {
    if (!policy.fund_holdings?.length) return 0
    return policy.fund_holdings.reduce((sum, h) => {
      const price = prices[h.fund_name] || h.last_known_price || 0
      return sum + (h.units * price)
    }, 0)
  }

  const filtered = policies.filter(p =>
    !search ||
    p.policy_number?.toLowerCase().includes(search.toLowerCase()) ||
    p.nickname?.toLowerCase().includes(search.toLowerCase()) ||
    p.product?.toLowerCase().includes(search.toLowerCase())
  )

  const totalAUM = filtered.reduce((s, p) => s + getAUM(p), 0)
  const totalInvested = filtered.reduce((s, p) => s + (p.invested || 0), 0)
  const aggROI = calcROI(totalAUM, totalInvested)

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
        <span className="font-display text-xl font-semibold italic">Ledger <span className="text-xs font-sans font-normal not-italic text-gray-400">the portfolio ledger</span></span>
        <div className="flex gap-6 text-sm text-gray-500">
          <span className="text-gray-900 font-medium cursor-pointer">Portfolios</span>
          <Link href="/policy/new" className="hover:text-gray-900 cursor-pointer">+ Add Policy</Link>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-10">
        {/* Section header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <div className="roman mb-1">I. PORTFOLIO OVERVIEW</div>
            <h1 className="font-display text-5xl font-medium" style={{ color: '#1a1a1a' }}>The ledger</h1>
          </div>
          <div className="text-right text-xs text-gray-400 mt-2 italic">
            <div>Twenty-four hours of fund movement,</div>
            <div>all your policies, one page.</div>
            <div className="mt-2 text-gray-500">
              AS OF {now}{' '}
              <button onClick={refreshPrices} disabled={refreshing}
                className="underline ml-1 hover:text-gray-800"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                {refreshing ? 'Refreshing…' : 'Refresh'}
              </button>
            </div>
          </div>
        </div>

        {/* Stats */}
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
            <div className={`font-display text-3xl font-medium ${aggROI >= 0 ? 'positive' : 'negative'}`}>
              {aggROI != null ? `${aggROI.toFixed(2)}%` : '—'}
            </div>
          </div>
          <div className="stat-card">
            <div className="text-xs tracking-widest text-gray-400 uppercase mb-2">Portfolios</div>
            <div className="font-display text-3xl font-medium">{policies.length}</div>
            <div className="text-xs text-gray-400 mt-1">across all products</div>
          </div>
        </div>

        {/* Search + Add */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder="Search policies, nicknames, funds…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-4 pr-4 py-2 text-sm border border-gray-200 rounded"
              style={{ background: 'white' }}
            />
          </div>
          <Link href="/policy/new">
            <button className="btn-primary text-xs tracking-widest">+ ADD POLICY</button>
          </Link>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-300">
                {['POLICY #', 'NICKNAME', 'PRODUCT', 'COMMENCED', 'PREMIUM', 'INVESTED', 'AUM', 'ROI', 'XIRR'].map(h => (
                  <th key={h} className="text-left py-2 pr-4 text-xs tracking-widest text-gray-400 font-normal">{h}</th>
                ))}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} className="py-12 text-center text-gray-400 text-sm">Loading portfolios…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={10} className="py-12 text-center text-gray-400 text-sm">
                  No policies yet.{' '}
                  <Link href="/policy/new" className="underline text-gray-600">Add your first policy →</Link>
                </td></tr>
              ) : filtered.map(p => {
                const aum = getAUM(p)
                const roi = calcROI(aum, p.invested)
                const xirr = calcXIRR(aum, p.invested, p.commenced)
                return (
                  <tr key={p.id} className="table-row">
                    <td className="py-3 pr-4">
                      <Link href={`/policy/${p.id}`} className="text-terracotta hover:underline font-mono text-xs">{p.policy_number}</Link>
                    </td>
                    <td className="py-3 pr-4 text-gray-500 text-xs">{p.nickname || '—'}</td>
                    <td className="py-3 pr-4 font-medium text-xs">{p.product}</td>
                    <td className="py-3 pr-4 text-gray-500 text-xs">
                      {p.commenced ? new Date(p.commenced).toLocaleDateString('en-SG', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                    </td>
                    <td className="py-3 pr-4 text-right font-mono text-xs">{fmtMoney(p.premium)}</td>
                    <td className="py-3 pr-4 text-right font-mono text-xs">{fmtMoney(p.invested)}</td>
                    <td className="py-3 pr-4 text-right font-mono text-xs">{fmtMoney(aum)}</td>
                    <td className={`py-3 pr-4 text-right text-xs ${roi >= 0 ? 'positive' : roi < 0 ? 'negative' : ''}`}>
                      {roi != null ? `${roi >= 0 ? '↑' : '↓'} ${Math.abs(roi).toFixed(2)}%` : '—'}
                    </td>
                    <td className={`py-3 pr-4 text-right text-xs ${xirr >= 0 ? 'positive' : xirr < 0 ? 'negative' : ''}`}>
                      {xirr != null ? `${xirr.toFixed(2)}%` : '—'}
                    </td>
                    <td className="py-3">
                      <Link href={`/policy/${p.id}`} className="text-gray-300 hover:text-gray-600 text-lg">···</Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
