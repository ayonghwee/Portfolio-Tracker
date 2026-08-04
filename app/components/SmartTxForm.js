'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import FundTypeahead, { FUND_CODE_MAP } from './FundTypeahead'

// ── helpers ──────────────────────────────────────────────────────────────────

function addBusinessDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00')
  let added = 0
  while (added < n) {
    d.setDate(d.getDate() + 1)
    const dow = d.getDay()
    if (dow !== 0 && dow !== 6) added++
  }
  return d.toISOString().split('T')[0]
}

function fmt(n, dec = 3) {
  if (n == null || isNaN(n)) return '—'
  return Number(n).toLocaleString('en-SG', { minimumFractionDigits: dec, maximumFractionDigits: dec })
}

function fmtMoney(n) {
  if (n == null || isNaN(n)) return '—'
  return 'SGD ' + Number(n).toLocaleString('en-SG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

async function fetchPrice(fundName, date, offset = 0) {
  const code = FUND_CODE_MAP[fundName]
  if (!code || !date) return null
  const res = await fetch(
    `/api/prices/historical?fundcode=${encodeURIComponent(code)}&date=${date}&offset=${offset}`
  )
  if (!res.ok) return null
  const data = await res.json()
  return data.bidPrice ? data : null
}

// Get the current balance units for a fund from the transaction history
function balanceUnitsFor(fundName, transactions) {
  const sorted = [...transactions]
    .filter(t => t.fund_name === fundName)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
  if (!sorted.length) return 0
  // use bal_units if stored, else compute
  const last = sorted[sorted.length - 1]
  if (last.bal_units != null) return parseFloat(last.bal_units)
  return sorted.reduce((sum, t) => {
    const u = parseFloat(t.units) || 0
    if (['Net Investment Premium', 'Switch In', 'Welcome Bonus', 'Reinvest'].includes(t.type)) return sum + Math.abs(u)
    if (t.type === 'Switch Out') return sum - Math.abs(u)
    return sum
  }, 0)
}

// ── MODES ────────────────────────────────────────────────────────────────────
const MODES = [
  { key: 'switch',   label: 'Switch' },
  { key: 'reinvest', label: 'Reinvest / Dividend' },
  { key: 'premium',  label: 'Premium / Top-up' },
  { key: 'bonus',    label: 'Welcome Bonus' },
]

// ── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function SmartTxForm({ policyId, transactions = [], onSaved, onCancel }) {
  const [mode,       setMode]       = useState('switch')
  const [date,       setDate]       = useState('')
  const [timeOfDay,  setTimeOfDay]  = useState('before') // 'before' | 'after' 12pm
  const [fromFund,   setFromFund]   = useState('')
  const [toFund,     setToFund]     = useState('')
  const [fund,       setFund]       = useState('')       // reinvest / premium
  const [amount,     setAmount]     = useState('')       // SGD amount
  const [divRate,    setDivRate]    = useState('')       // dividend rate %
  const [saving,     setSaving]     = useState(false)
  const [error,      setError]      = useState('')

  // price preview state
  const [priceData,        setPriceData]        = useState(null)  // toFund price (switch) / premium
  const [fromPriceData,    setFromPriceData]    = useState(null)  // fromFund price (switch only)
  const [exDivPriceData,   setExDivPriceData]   = useState(null)  // for reinvest: price at ex-div date
  const [reinvestPriceData,setReinvestPriceData]= useState(null)  // for reinvest: next-day price

  const [fetchingPrice,    setFetchingPrice]    = useState(false)
  const [manualPrice,      setManualPrice]      = useState('')  // fallback for toFund / premium
  const [manualFromPrice,  setManualFromPrice]  = useState('')  // fallback for fromFund (switch)

  // ── price fetch logic ──
  const loadPriceSwitch = useCallback(async () => {
    if (!date || !toFund || !fromFund) return
    setFetchingPrice(true)
    // GE convention: transaction date D uses price from D−1 (prev business day)
    // Before 12pm → processes on D → price = D−1 (offset -1)
    // After 12pm  → processes on D+1 → price = D (offset 0, i.e. the entered date)
    const priceOffset = timeOfDay === 'after' ? 0 : -1
    const [fromData, toData] = await Promise.all([
      fetchPrice(fromFund, date, priceOffset),
      fetchPrice(toFund,   date, priceOffset),
    ])
    setFromPriceData(fromData)
    setPriceData(toData)
    setFetchingPrice(false)
  }, [date, fromFund, toFund, timeOfDay])

  const loadPriceReinvest = useCallback(async () => {
    if (!date || !fund) return
    setFetchingPrice(true)
    const [exDiv, reinv] = await Promise.all([
      fetchPrice(fund, date, 0),          // ex-div date price
      fetchPrice(fund, date, 1),          // next business day (reinvest price)
    ])
    setExDivPriceData(exDiv)
    setReinvestPriceData(reinv)
    setFetchingPrice(false)
  }, [date, fund])

  const loadPricePremium = useCallback(async () => {
    if (!date || !fund) return
    setFetchingPrice(true)
    // GE convention: transaction date D uses price from D−1
    const data = await fetchPrice(fund, date, -1)
    setPriceData(data)
    setFetchingPrice(false)
  }, [date, fund])

  useEffect(() => { setPriceData(null); setFromPriceData(null); setExDivPriceData(null); setReinvestPriceData(null); setManualPrice(''); setManualFromPrice('') }, [mode, date, fromFund, toFund])

  useEffect(() => { if (mode === 'switch')   loadPriceSwitch()   }, [loadPriceSwitch,   mode])
  useEffect(() => { if (mode === 'reinvest') loadPriceReinvest() }, [loadPriceReinvest, mode])
  useEffect(() => { if (mode === 'premium' || mode === 'bonus') loadPricePremium() }, [loadPricePremium, mode])

  // ── derived calculations ──
  // Switch uses separate prices: fromFund price for Switch Out, toFund price for Switch In
  const fromSwitchPrice = fromPriceData?.bidPrice || (manualFromPrice ? parseFloat(manualFromPrice) : null)
  const toSwitchPrice   = priceData?.bidPrice     || (manualPrice     ? parseFloat(manualPrice)     : null)
  const fromSwitchUnits = fromSwitchPrice && amount ? parseFloat(amount) / fromSwitchPrice : null
  const toSwitchUnits   = toSwitchPrice   && amount ? parseFloat(amount) / toSwitchPrice   : null
  // legacy alias kept for PricePreview below
  const switchPrice = toSwitchPrice

  // reinvest: either user-entered amount OR derived from rate% × NAV
  const currentUnits  = fund ? balanceUnitsFor(fund, transactions) : 0
  const navAtExDiv    = exDivPriceData?.bidPrice ? currentUnits * exDivPriceData.bidPrice : null
  const divRateNum    = parseFloat(divRate) / 100 || 0
  const divAmount     = divRate && navAtExDiv != null
    ? navAtExDiv * divRateNum
    : (amount ? parseFloat(amount) : null)
  const reinvestPrice = reinvestPriceData?.bidPrice
  const reinvestUnits = reinvestPrice && divAmount ? divAmount / reinvestPrice : null

  const premiumPrice  = priceData?.bidPrice
  const premiumUnits  = premiumPrice && amount ? parseFloat(amount) / premiumPrice : null

  // Previous business day helper (for label display)
  function prevBizDay(d) { return addBusinessDays(d, -1) }

  // effective date label
  const effectiveDateLabel = (() => {
    if (!date) return null
    if (mode === 'switch') {
      if (timeOfDay === 'after') return `Tx date: ${addBusinessDays(date, 1)} · Price: ${date} (prev day)`
      return `Tx date: ${date} · Price: ${prevBizDay(date)} (prev day)`
    }
    if (mode === 'reinvest') {
      return `Ex-div: ${date} | Reinvest: ${date ? addBusinessDays(date, 1) : '—'}`
    }
    return null
  })()

  // ── save ──
  async function handleSave() {
    setError('')
    setSaving(true)
    try {
      if (mode === 'switch') {
        if (!date || !fromFund || !toFund || !amount)
          throw new Error('Please fill in date, both funds, and amount.')
        if (fromFund === toFund)
          throw new Error('Switch From and To fund cannot be the same.')
        if (!fromSwitchPrice)
          throw new Error(`No price for "${fromFund.replace('GreatLink ', '')}". Enter it manually above.`)
        if (!toSwitchPrice)
          throw new Error(`No price for "${toFund.replace('GreatLink ', '')}". Enter it manually above.`)

        const pairId = crypto.randomUUID()
        const fromUnits = parseFloat(amount) / fromSwitchPrice
        const toUnits   = parseFloat(amount) / toSwitchPrice
        // After 12pm → GE processes next business day → transaction date = D+1
        // Before 12pm → processes same day → transaction date = D
        const txDate = timeOfDay === 'after' ? addBusinessDays(date, 1) : date

        // Compute running balances
        const fromBal = balanceUnitsFor(fromFund, transactions)
        const toBal   = balanceUnitsFor(toFund,   transactions)

        const rows = [
          {
            policy_id: policyId, date: txDate, type: 'Switch Out',
            fund_name: fromFund, price: fromSwitchPrice, units: -fromUnits,
            value: -parseFloat(amount), bal_units: Math.max(0, fromBal - fromUnits),
            time_of_day: timeOfDay, pair_id: pairId,
          },
          {
            policy_id: policyId, date: txDate, type: 'Switch In',
            fund_name: toFund, price: toSwitchPrice, units: toUnits,
            value: parseFloat(amount), bal_units: toBal + toUnits,
            time_of_day: timeOfDay, pair_id: pairId,
          },
        ]
        const { error: e } = await supabase.from('transactions').insert(rows)
        if (e) throw e

      } else if (mode === 'reinvest') {
        if (!date || !fund || (!divRate && !amount) || !reinvestPrice)
          throw new Error('Please fill all fields and wait for price to load.')

        const amt   = divAmount
        const units = amt / reinvestPrice
        const bal   = balanceUnitsFor(fund, transactions)
        const reinvestDate = addBusinessDays(date, 1)

        const row = {
          policy_id: policyId, date: reinvestDate, type: 'Reinvest',
          fund_name: fund, price: reinvestPrice, units,
          value: amt, bal_units: bal + units,
          dividend_rate: divRateNum * 100,         // store as %
          nav_at_date: navAtExDiv,
          price_effective_date: reinvestDate,
          time_of_day: null,
          pair_id: null,
        }
        const { error: e } = await supabase.from('transactions').insert([row])
        if (e) throw e

      } else if (mode === 'premium' || mode === 'bonus') {
        if (!date || !fund || !amount || !premiumPrice)
          throw new Error('Please fill all fields and wait for price to load.')

        const units = parseFloat(amount) / premiumPrice
        const bal   = balanceUnitsFor(fund, transactions)
        const type  = mode === 'bonus' ? 'Welcome Bonus' : 'Net Investment Premium'

        const row = {
          policy_id: policyId, date, type,
          fund_name: fund, price: premiumPrice, units,
          value: parseFloat(amount), bal_units: bal + units,
          price_effective_date: date, time_of_day: null, pair_id: null,
        }
        const { error: e } = await supabase.from('transactions').insert([row])
        if (e) throw e
      }

      onSaved?.()
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      setSaving(false)
    }
  }

  // ── render ──
  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 6, padding: '16px 20px', background: '#fafafa', marginBottom: 16 }}>

      {/* Mode tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {MODES.map(m => (
          <button key={m.key} onClick={() => { setMode(m.key); setError('') }}
            style={{
              padding: '4px 12px', borderRadius: 4, border: '1px solid',
              fontSize: 11, cursor: 'pointer', fontWeight: mode === m.key ? 600 : 400,
              background: mode === m.key ? '#1a1a1a' : '#fff',
              color:      mode === m.key ? '#fff'    : '#6b7280',
              borderColor:mode === m.key ? '#1a1a1a' : '#e5e7eb',
            }}>
            {m.label}
          </button>
        ))}
      </div>

      {/* ── SWITCH ── */}
      {mode === 'switch' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 1fr 130px', gap: 12, marginBottom: 12 }}>
            {/* Date */}
            <div>
              <div className="text-xs text-gray-400 mb-1 uppercase tracking-wider">Switch Date</div>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ width: '100%' }} />
            </div>
            {/* From Fund */}
            <FundTypeahead label="Switch From" value={fromFund} onChange={setFromFund} placeholder="Type fund…" />
            {/* To Fund */}
            <FundTypeahead label="Switch To"   value={toFund}   onChange={setToFund}   placeholder="Type fund…" />
            {/* Amount */}
            <div>
              <div className="text-xs text-gray-400 mb-1 uppercase tracking-wider">Amount (SGD)</div>
              <input type="number" step="0.01" min="0" placeholder="0.00"
                value={amount} onChange={e => setAmount(e.target.value)} style={{ width: '100%' }} />
            </div>
          </div>

          {/* AM/PM toggle */}
          {date && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span className="text-xs text-gray-400">Switch submitted:</span>
              {['before','after'].map(t => (
                <button key={t} onClick={() => setTimeOfDay(t)}
                  style={{
                    padding: '3px 10px', borderRadius: 4, border: '1px solid',
                    fontSize: 11, cursor: 'pointer',
                    background: timeOfDay === t ? '#2d5016' : '#fff',
                    color:      timeOfDay === t ? '#fff'    : '#6b7280',
                    borderColor:timeOfDay === t ? '#2d5016' : '#e5e7eb',
                  }}>
                  {t === 'before' ? 'Before 12pm' : 'After 12pm'}
                </button>
              ))}
              {effectiveDateLabel && (
                <span className="text-xs text-gray-400 ml-2">{effectiveDateLabel}</span>
              )}
            </div>
          )}

          {/* Price previews — from fund (Switch Out) and to fund (Switch In) */}
          {fetchingPrice && <div className="text-xs text-gray-400 mb-2">Fetching prices…</div>}
          {!fetchingPrice && fromFund && toFund && date && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              {/* From fund price */}
              <div>
                <div className="text-xs text-gray-400 mb-1">{fromFund.replace('GreatLink ', '')} (Switch Out)</div>
                {fromPriceData?.bidPrice ? (
                  <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 4, padding: '6px 10px', fontSize: 12, display: 'flex', gap: 12 }}>
                    <span style={{ color: '#6b7280' }}>Bid:</span>
                    <strong>{fmt(fromPriceData.bidPrice, 4)}</strong>
                    {amount && fromSwitchUnits && <><span style={{ color: '#6b7280' }}>→</span><strong style={{ color: '#7c2d12' }}>{fmt(fromSwitchUnits)} units</strong></>}
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                    <input type="number" step="0.0001" min="0" placeholder="Enter price"
                      value={manualFromPrice} onChange={e => setManualFromPrice(e.target.value)}
                      style={{ width: 110, padding: '3px 8px', border: '1px solid #fca5a5', borderRadius: 4, fontSize: 12 }} />
                    {manualFromPrice && amount && (
                      <span style={{ color: '#7c2d12', fontWeight: 600 }}>
                        → {fmt(parseFloat(amount) / parseFloat(manualFromPrice))} units
                      </span>
                    )}
                  </div>
                )}
              </div>
              {/* To fund price */}
              <div>
                <div className="text-xs text-gray-400 mb-1">{toFund.replace('GreatLink ', '')} (Switch In)</div>
                {priceData?.bidPrice ? (
                  <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 4, padding: '6px 10px', fontSize: 12, display: 'flex', gap: 12 }}>
                    <span style={{ color: '#6b7280' }}>Bid:</span>
                    <strong>{fmt(priceData.bidPrice, 4)}</strong>
                    {amount && toSwitchUnits && <><span style={{ color: '#6b7280' }}>→</span><strong style={{ color: '#2d5016' }}>{fmt(toSwitchUnits)} units</strong></>}
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                    <input type="number" step="0.0001" min="0" placeholder="Enter price"
                      value={manualPrice} onChange={e => setManualPrice(e.target.value)}
                      style={{ width: 110, padding: '3px 8px', border: '1px solid #fca5a5', borderRadius: 4, fontSize: 12 }} />
                    {manualPrice && amount && (
                      <span style={{ color: '#2d5016', fontWeight: 600 }}>
                        → {fmt(parseFloat(amount) / parseFloat(manualPrice))} units
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── REINVEST / DIVIDEND ── */}
      {mode === 'reinvest' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 130px 130px', gap: 12, marginBottom: 12 }}>
            <div>
              <div className="text-xs text-gray-400 mb-1 uppercase tracking-wider">Ex-Div Date</div>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ width: '100%' }} />
            </div>
            <FundTypeahead label="Fund" value={fund} onChange={setFund} placeholder="Type fund…" />
            <div>
              <div className="text-xs text-gray-400 mb-1 uppercase tracking-wider">Rate % (declared)</div>
              <input type="number" step="0.0001" min="0" placeholder="0.5440"
                value={divRate} onChange={e => setDivRate(e.target.value)} style={{ width: '100%' }} />
            </div>
            <div>
              <div className="text-xs text-gray-400 mb-1 uppercase tracking-wider">Or Amount (SGD)</div>
              <input type="number" step="0.01" min="0" placeholder="auto if rate set"
                value={amount} onChange={e => setAmount(e.target.value)}
                disabled={!!divRate}
                style={{ width: '100%', opacity: divRate ? 0.5 : 1 }} />
            </div>
          </div>

          {/* Reinvest preview */}
          {(exDivPriceData || reinvestPriceData) && (
            <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 4, padding: '10px 14px', marginBottom: 10, fontSize: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                <PreviewItem label="Units at ex-div"   value={fmt(currentUnits)} />
                <PreviewItem label="Bid at ex-div"     value={exDivPriceData   ? fmt(exDivPriceData.bidPrice, 4)   : '—'} />
                <PreviewItem label="NAV"               value={navAtExDiv != null ? fmtMoney(navAtExDiv) : '—'} />
                <PreviewItem label="Rate"              value={divRate ? divRate + '%' : '—'} />
                <PreviewItem label="Payout Amount"     value={divAmount != null ? fmtMoney(divAmount) : '—'} highlight />
                <PreviewItem label="Reinvest Price"    value={reinvestPriceData ? fmt(reinvestPriceData.bidPrice, 4) : '—'} />
                <PreviewItem label="Units Reinvested"  value={reinvestUnits != null ? fmt(reinvestUnits) : '—'} highlight />
                <PreviewItem label="Annualised Rate"   value={divRate ? (parseFloat(divRate) * 12).toFixed(4) + '% p.a.' : '—'} />
              </div>
            </div>
          )}
          {fetchingPrice && <div className="text-xs text-gray-400 mb-2">Fetching prices…</div>}
        </div>
      )}

      {/* ── PREMIUM / BONUS ── */}
      {(mode === 'premium' || mode === 'bonus') && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 130px', gap: 12, marginBottom: 12 }}>
            <div>
              <div className="text-xs text-gray-400 mb-1 uppercase tracking-wider">Date</div>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ width: '100%' }} />
            </div>
            <FundTypeahead label="Fund" value={fund} onChange={setFund} placeholder="Type fund…" />
            <div>
              <div className="text-xs text-gray-400 mb-1 uppercase tracking-wider">Amount (SGD)</div>
              <input type="number" step="0.01" min="0" placeholder="0.00"
                value={amount} onChange={e => setAmount(e.target.value)} style={{ width: '100%' }} />
            </div>
          </div>
          <PricePreview
            loading={fetchingPrice} price={premiumPrice}
            units={premiumUnits} amount={amount}
            label={`${fund ? fund.replace('GreatLink ', '') : 'Fund'} bid price`}
          />
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ color: '#dc2626', fontSize: 12, marginBottom: 10 }}>{error}</div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={handleSave} disabled={saving}
          className="btn-primary text-xs"
          style={{ opacity: saving ? 0.6 : 1 }}>
          {saving ? 'Saving…' : mode === 'switch' ? 'Add Switch (2 records)' : 'Add Transaction'}
        </button>
        <button onClick={onCancel}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#9ca3af' }}>
          Cancel
        </button>
      </div>
    </div>
  )
}

// ── sub-components ────────────────────────────────────────────────────────────

function PricePreview({ loading, price, units, amount, label }) {
  if (loading) return <div className="text-xs text-gray-400 mb-3">Fetching price…</div>
  if (!price)  return null
  return (
    <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 4, padding: '8px 12px', marginBottom: 10, fontSize: 12, display: 'flex', gap: 24, alignItems: 'center' }}>
      <span style={{ color: '#6b7280' }}>{label}:</span>
      <strong>{fmt(price, 4)}</strong>
      {amount && units && (
        <>
          <span style={{ color: '#6b7280' }}>→ Units:</span>
          <strong style={{ color: '#2d5016' }}>{fmt(units)}</strong>
        </>
      )}
    </div>
  )
}

function PreviewItem({ label, value, highlight }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 2 }}>{label}</div>
      <div style={{ fontWeight: highlight ? 600 : 400, color: highlight ? '#2d5016' : '#374151' }}>{value}</div>
    </div>
  )
}
