'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '../../../lib/supabase'

const GE_FUNDS = [
  'GreatLink ASEAN Growth Fund',
  'GreatLink Asia Dividend Advantage Fund',
  'GreatLink Asia High Dividend Equity Fund',
  'GreatLink Asia Pacific Equity Fund',
  'GreatLink Cash Fund',
  'GreatLink China Growth Fund',
  'GreatLink Diversified Growth Portfolio',
  'GreatLink Dynamic Balanced Portfolio',
  'GreatLink Dynamic Growth Portfolio',
  'GreatLink Dynamic Secure Portfolio',
  'GreatLink European Sustainable Equity Fund',
  'GreatLink Far East Ex Japan Equities Fund',
  'GreatLink Global Bond Fund',
  'GreatLink Global Disruptive Innovation Fund',
  'GreatLink Global Emerging Markets Equity Fund',
  'GreatLink Global Equity Alpha Fund',
  'GreatLink Global Equity Fund',
  'GreatLink Global Perspective Fund',
  'GreatLink Global Real Estate Securities Fund',
  'GreatLink Global Supreme Fund',
  'GreatLink Global Technology Fund',
  'GreatLink Income Bond Fund',
  'GreatLink Income Focus Fund',
  'GreatLink International Health Care Fund',
  'GreatLink Lifestyle Balanced Portfolio',
  'GreatLink Lifestyle Dynamic Portfolio',
  'GreatLink Lifestyle Progressive Portfolio',
  'GreatLink Lifestyle Secure Portfolio',
  'GreatLink Lifestyle Steady Portfolio',
  'GreatLink Lion Asian Balanced Fund',
  'GreatLink Lion India Fund',
  'GreatLink Lion Japan Growth Fund',
  'GreatLink Lion Vietnam Fund',
  'GreatLink Multi-Sector Income Fund',
  'GreatLink Multi-Theme Equity Fund',
  'GreatLink Short Duration Bond Fund',
  'GreatLink Singapore Equities Fund',
  'GreatLink Singapore Physical Gold Fund',
  'GreatLink Sustainable Global Thematic Fund',
  'GreatLink US Income and Growth Fund (Dis)',
]

export default function NewPolicyPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [policy, setPolicy] = useState({
    policy_number: '',
    nickname: '',
    product: '',
    commenced: '',
    premium: '',
    frequency: 'Monthly',
    invested: '',
  })
  const [holdings, setHoldings] = useState([
    { fund_name: '', units: '', avg_price: '' }
  ])

  function updatePolicy(k, v) { setPolicy(p => ({ ...p, [k]: v })) }
  function updateHolding(i, k, v) {
    setHoldings(h => h.map((row, idx) => idx === i ? { ...row, [k]: v } : row))
  }
  function addFund() { setHoldings(h => [...h, { fund_name: '', units: '', avg_price: '' }]) }
  function removeFund(i) { setHoldings(h => h.filter((_, idx) => idx !== i)) }

  async function handleSave(e) {
    e.preventDefault()
    setError('')
    if (!policy.policy_number || !policy.product) {
      setError('Policy number and product are required.')
      return
    }
    setSaving(true)
    try {
      const { data: newPolicy, error: pErr } = await supabase
        .from('policies')
        .insert({
          policy_number: policy.policy_number.trim(),
          nickname: policy.nickname.trim() || null,
          product: policy.product.trim(),
          commenced: policy.commenced || null,
          premium: parseFloat(policy.premium) || 0,
          frequency: policy.frequency,
          invested: parseFloat(policy.invested) || 0,
        })
        .select()
        .single()

      if (pErr) throw pErr

      const validHoldings = holdings.filter(h => h.fund_name && h.units)
      if (validHoldings.length > 0) {
        const { error: hErr } = await supabase
          .from('fund_holdings')
          .insert(validHoldings.map(h => ({
            policy_id: newPolicy.id,
            fund_name: h.fund_name,
            units: parseFloat(h.units) || 0,
            avg_price: parseFloat(h.avg_price) || null,
            last_known_price: parseFloat(h.avg_price) || null,
          })))
        if (hErr) throw hErr
      }

      router.push(`/policy/${newPolicy.id}`)
    } catch (err) {
      setError(err.message || 'Failed to save policy.')
      setSaving(false)
    }
  }

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
          <span className="text-gray-900 font-medium">Add Policy</span>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-8 py-10">
        <div className="roman mb-1">NEW POLICY</div>
        <h1 className="font-display text-4xl font-medium mb-8">Add a policy</h1>

        <form onSubmit={handleSave}>
          {/* Policy details */}
          <div className="mb-8">
            <div className="roman mb-3">I. POLICY DETAILS</div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1 uppercase tracking-wider">Policy Number *</label>
                <input type="text" placeholder="e.g. 0252800207"
                  value={policy.policy_number}
                  onChange={e => updatePolicy('policy_number', e.target.value)} required />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1 uppercase tracking-wider">Nickname</label>
                <input type="text" placeholder="e.g. Kilian Ang"
                  value={policy.nickname}
                  onChange={e => updatePolicy('nickname', e.target.value)} />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-gray-500 mb-1 uppercase tracking-wider">Product *</label>
                <input type="text" placeholder="e.g. GREAT Invest Advantage (SP)"
                  value={policy.product}
                  onChange={e => updatePolicy('product', e.target.value)} required />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1 uppercase tracking-wider">Commenced Date</label>
                <input type="date" value={policy.commenced}
                  onChange={e => updatePolicy('commenced', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1 uppercase tracking-wider">Frequency</label>
                <select value={policy.frequency} onChange={e => updatePolicy('frequency', e.target.value)}>
                  <option>Monthly</option>
                  <option>Single</option>
                  <option>Annual</option>
                  <option>Quarterly</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1 uppercase tracking-wider">Premium (per payment)</label>
                <input type="number" step="0.01" placeholder="0.00"
                  value={policy.premium}
                  onChange={e => updatePolicy('premium', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1 uppercase tracking-wider">Total Invested</label>
                <input type="number" step="0.01" placeholder="0.00"
                  value={policy.invested}
                  onChange={e => updatePolicy('invested', e.target.value)} />
              </div>
            </div>
          </div>

          {/* Fund holdings */}
          <div className="mb-8">
            <div className="roman mb-3">II. FUND HOLDINGS</div>
            <p className="text-xs text-gray-400 mb-4">Enter the current units held per fund. Prices will be auto-fetched from Great Eastern.</p>

            <div className="space-y-3">
              {holdings.map((h, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-6">
                    {i === 0 && <label className="block text-xs text-gray-500 mb-1 uppercase tracking-wider">Fund Name</label>}
                    <select value={h.fund_name} onChange={e => updateHolding(i, 'fund_name', e.target.value)}>
                      <option value="">Select fund…</option>
                      {GE_FUNDS.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>
                  <div className="col-span-3">
                    {i === 0 && <label className="block text-xs text-gray-500 mb-1 uppercase tracking-wider">Units</label>}
                    <input type="number" step="0.000001" placeholder="0.000000"
                      value={h.units} onChange={e => updateHolding(i, 'units', e.target.value)} />
                  </div>
                  <div className="col-span-2">
                    {i === 0 && <label className="block text-xs text-gray-500 mb-1 uppercase tracking-wider">Avg Price</label>}
                    <input type="number" step="0.000001" placeholder="0.000"
                      value={h.avg_price} onChange={e => updateHolding(i, 'avg_price', e.target.value)} />
                  </div>
                  <div className="col-span-1 pb-1">
                    {holdings.length > 1 && (
                      <button type="button" onClick={() => removeFund(i)}
                        className="text-gray-300 hover:text-red-400 text-lg w-full text-center">×</button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <button type="button" onClick={addFund}
              className="mt-3 text-xs text-gray-400 hover:text-gray-700 underline"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              + Add another fund
            </button>
          </div>

          {error && <div className="text-red-500 text-sm mb-4">{error}</div>}

          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Saving…' : 'Save Policy'}
            </button>
            <Link href="/"><button type="button" className="btn-secondary">Cancel</button></Link>
          </div>
        </form>
      </div>
    </div>
  )
}
