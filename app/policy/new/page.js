'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '../../../lib/supabase'

function calcAutoInvested(commenced, premium, frequency) {
  if (!commenced || !premium || frequency === 'Single') return parseFloat(premium) || 0
  const start = new Date(commenced)
  const now = new Date()
  if (start > now) return parseFloat(premium) || 0
  const prem = parseFloat(premium) || 0
  let count = 0
  const d = new Date(start)
  while (d <= now) {
    count++
    if (frequency === 'Monthly') d.setMonth(d.getMonth() + 1)
    else if (frequency === 'Annual') d.setFullYear(d.getFullYear() + 1)
    else if (frequency === 'Quarterly') d.setMonth(d.getMonth() + 3)
    else break
  }
  return parseFloat((count * prem).toFixed(2))
}

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

export default function NewPolicyPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [investedManual, setInvestedManual] = useState(false)
  const [policy, setPolicy] = useState({
    policy_number: '', nickname: '', product: '', commenced: '',
    premium: '', frequency: 'Monthly', invested: '',
    charges: '', cash: '', dividends: '', welcome_bonus: '',
  })
  const [holdings, setHoldings] = useState([{ fund_name: '', units: '', avg_price: '' }])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.push('/login')
    })
  }, [])

  useEffect(() => {
    if (!investedManual) {
      const auto = calcAutoInvested(policy.commenced, policy.premium, policy.frequency)
      if (auto) setPolicy(p => ({ ...p, invested: auto }))
    }
  }, [policy.commenced, policy.premium, policy.frequency, investedManual])

  function updatePolicy(k, v) { setPolicy(p => ({ ...p, [k]: v })) }
  function updateHolding(i, k, v) { setHoldings(h => h.map((row, idx) => idx === i ? { ...row, [k]: v } : row)) }
  function addFund() { setHoldings(h => [...h, { fund_name: '', units: '', avg_price: '' }]) }
  function removeFund(i) { setHoldings(h => h.filter((_, idx) => idx !== i)) }

  async function handleSave(e) {
    e.preventDefault()
    setError('')
    if (!policy.policy_number || !policy.product) { setError('Policy number and product are required.'); return }
    setSaving(true)
    try {
      const { data: newPolicy, error: pErr } = await supabase.from('policies').insert({
        policy_number: policy.policy_number.trim(),
        nickname: policy.nickname.trim() || null,
        product: policy.product.trim(),
        commenced: policy.commenced || null,
        premium: parseFloat(policy.premium) || 0,
        frequency: policy.frequency,
        invested: parseFloat(policy.invested) || 0,
        charges: parseFloat(policy.charges) || 0,
        cash: parseFloat(policy.cash) || 0,
        dividends: parseFloat(policy.dividends) || 0,
        welcome_bonus: parseFloat(policy.welcome_bonus) || 0,
      }).select().single()
      if (pErr) throw pErr

      const validHoldings = holdings.filter(h => h.fund_name && h.units)
      if (validHoldings.length > 0) {
        const { error: hErr } = await supabase.from('fund_holdings').insert(
          validHoldings.map(h => ({
            policy_id: newPolicy.id,
            fund_name: h.fund_name,
            units: parseFloat(h.units) || 0,
            avg_price: parseFloat(h.avg_price) || null,
            last_known_price: parseFloat(h.avg_price) || null,
          }))
        )
        if (hErr) throw hErr
      }

      router.push(`/policy/${newPolicy.policy_number}`)
    } catch (err) {
      setError(err.message || 'Failed to save policy.')
      setSaving(false)
    }
  }

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
          <span className="text-gray-900 font-medium">Add Policy</span>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-8 py-10">
        <div className="roman mb-1">NEW POLICY</div>
        <h1 className="font-display text-4xl font-medium mb-8">Add a policy</h1>

        <form onSubmit={handleSave}>
          <div className="mb-8">
            <div className="roman mb-3">I. POLICY DETAILS</div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1 uppercase tracking-wider">Policy Number *</label>
                <input type="text" placeholder="e.g. 0252800207" value={policy.policy_number} onChange={e => updatePolicy('policy_number', e.target.value)} required />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1 uppercase tracking-wider">Nickname / Client Name</label>
                <input type="text" placeholder="e.g. Kilian Ang" value={policy.nickname} onChange={e => updatePolicy('nickname', e.target.value)} />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-gray-500 mb-1 uppercase tracking-wider">Product *</label>
                <input type="text" placeholder="e.g. GREAT Invest Advantage (SP)" value={policy.product} onChange={e => updatePolicy('product', e.target.value)} required />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1 uppercase tracking-wider">Commenced Date</label>
                <input type="date" value={policy.commenced} onChange={e => updatePolicy('commenced', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1 uppercase tracking-wider">Frequency</label>
                <select value={policy.frequency} onChange={e => updatePolicy('frequency', e.target.value)}>
                  <option>Monthly</option><option>Single</option><option>Annual</option><option>Quarterly</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1 uppercase tracking-wider">Premium (per payment)</label>
                <input type="number" step="0.01" placeholder="0.00" value={policy.premium} onChange={e => updatePolicy('premium', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1 uppercase tracking-wider">
                  Total Invested
                  {!investedManual && <span className="ml-2 text-green-600 normal-case font-normal">auto-calculated</span>}
                  {investedManual && <button type="button" onClick={() => setInvestedManual(false)}
                    className="ml-2 text-gray-400 hover:text-gray-600 normal-case font-normal underline"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 11 }}>reset to auto</button>}
                </label>
                <input type="number" step="0.01" placeholder="0.00" value={policy.invested}
                  onChange={e => { setInvestedManual(true); updatePolicy('invested', e.target.value) }} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1 uppercase tracking-wider">Initial Charges (e.g. 3%)</label>
                <input type="number" step="0.01" placeholder="0.00 e.g. 150 for 3% of 5000" value={policy.charges} onChange={e => updatePolicy('charges', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1 uppercase tracking-wider">Welcome Bonus</label>
                <input type="number" step="0.01" placeholder="0.00" value={policy.welcome_bonus} onChange={e => updatePolicy('welcome_bonus', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1 uppercase tracking-wider">Cash Value</label>
                <input type="number" step="0.01" placeholder="0.00" value={policy.cash} onChange={e => updatePolicy('cash', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1 uppercase tracking-wider">Dividends Received</label>
                <input type="number" step="0.01" placeholder="0.00" value={policy.dividends} onChange={e => updatePolicy('dividends', e.target.value)} />
              </div>
            </div>
          </div>

          <div className="mb-8">
            <div className="roman mb-3">II. FUND HOLDINGS</div>
            <p className="text-xs text-gray-400 mb-4">Enter current units. Prices are fetched automatically from Great Eastern daily.</p>
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
                    <input type="number" step="0.000001" placeholder="0.000000" value={h.units} onChange={e => updateHolding(i, 'units', e.target.value)} />
                  </div>
                  <div className="col-span-2">
                    {i === 0 && <label className="block text-xs text-gray-500 mb-1 uppercase tracking-wider">Avg Price</label>}
                    <input type="number" step="0.000001" placeholder="optional" value={h.avg_price} onChange={e => updateHolding(i, 'avg_price', e.target.value)} />
                  </div>
                  <div className="col-span-1 pb-1">
                    {holdings.length > 1 && (
                      <button type="button" onClick={() => removeFund(i)}
                        className="text-gray-300 hover:text-red-400 text-lg w-full text-center"
                        style={{ background: 'none', border: 'none', cursor: 'pointer' }}>×</button>
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
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save Policy'}</button>
            <Link href="/"><button type="button" className="btn-secondary">Cancel</button></Link>
          </div>
        </form>
      </div>
    </div>
  )
}
