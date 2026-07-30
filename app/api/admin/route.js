// TEMPORARY ADMIN ROUTE — remove after use
import { NextResponse } from 'next/server'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://oeegjflkqfkxgtfzxbny.supabase.co'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9lZWdqZmxrcWZreGd0Znp4Ym55Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTkwMjA1MywiZXhwIjoyMDYxNDc4MDUzfQ.PkBNcELJCOLGNVMFMoBPrFZJIhv9nAYpL5q8FmNiMaM'
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Low-level REST helper — avoids supabase-js client initialization issues
async function supa(method, table, opts = {}) {
  const { filter, body, select = '*', limit } = opts
  let url = `${SUPA_URL}/rest/v1/${table}`
  const params = new URLSearchParams()
  if (select) params.set('select', select)
  if (limit) params.set('limit', String(limit))
  if (filter) Object.entries(filter).forEach(([k, v]) => params.set(k, `eq.${v}`))
  if (params.toString()) url += '?' + params.toString()

  const headers = {
    'apikey': SERVICE_KEY,
    'Authorization': `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': method === 'POST' ? 'return=minimal' : 'return=representation',
  }
  const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined })
  const text = await res.text()
  try { return { ok: res.ok, status: res.status, data: JSON.parse(text) } }
  catch { return { ok: res.ok, status: res.status, data: text } }
}

async function supaDelete(table, filter) {
  let url = `${SUPA_URL}/rest/v1/${table}`
  const params = new URLSearchParams()
  if (filter.in) {
    params.set(filter.in.col, `in.(${filter.in.vals.join(',')})`)
  } else if (filter.eq) {
    Object.entries(filter.eq).forEach(([k, v]) => params.set(k, `eq.${v}`))
  }
  url += '?' + params.toString()
  const res = await fetch(url, {
    method: 'DELETE',
    headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' }
  })
  return { ok: res.ok, status: res.status }
}

export async function POST(req) {
  let body
  try { body = await req.json() } catch(e) { return NextResponse.json({ error: 'bad json' }, { status: 400 }) }
  const { action, payload } = body

  if (action === 'test') {
    // Verify connectivity
    const r = await supa('GET', 'policies', { select: 'id', limit: 1 })
    return NextResponse.json({ ok: r.ok, status: r.status, supaUrl: SUPA_URL.substring(0, 40), hasAnon: !!ANON_KEY })
  }

  if (action === 'list_policies') {
    const r = await supa('GET', 'policies', { select: 'id,policy_number', limit: 25 })
    return NextResponse.json({ data: r.data, error: r.ok ? null : r.data })
  }

  if (action === 'get_policy_id') {
    const r = await supa('GET', 'policies', { select: 'id,policy_number,invested,dividends', filter: { policy_number: payload.policy_number } })
    const row = Array.isArray(r.data) ? r.data[0] : r.data
    return NextResponse.json({ data: row, error: r.ok ? null : r.data })
  }

  if (action === 'get_transactions') {
    const r = await supa('GET', 'transactions', { filter: { policy_id: payload.policy_id } })
    return NextResponse.json(r.data)
  }

  if (action === 'delete_transactions') {
    const r = await supaDelete('transactions', { in: { col: 'id', vals: payload.ids } })
    return NextResponse.json({ ok: r.ok, status: r.status })
  }

  if (action === 'insert_transactions') {
    // Insert in batches of 100
    const rows = payload.rows
    const errors = []
    for (let i = 0; i < rows.length; i += 100) {
      const batch = rows.slice(i, i + 100)
      const r = await supa('POST', 'transactions', { body: batch, select: null })
      if (!r.ok) errors.push({ batch: i, error: r.data })
    }
    return NextResponse.json({ inserted: rows.length, errors })
  }

  if (action === 'update_policy') {
    const r = await fetch(
      `${SUPA_URL}/rest/v1/policies?id=eq.${payload.id}`,
      { method: 'PATCH', headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' }, body: JSON.stringify(payload.fields) }
    )
    return NextResponse.json({ ok: r.ok, status: r.status })
  }

  if (action === 'delete_fund_holdings') {
    const r = await supaDelete('fund_holdings', { eq: { policy_id: payload.policy_id } })
    return NextResponse.json({ ok: r.ok })
  }

  if (action === 'insert_fund_holdings') {
    const r = await supa('POST', 'fund_holdings', { body: payload.rows, select: null })
    return NextResponse.json({ ok: r.ok, status: r.status, err: r.ok ? null : r.data })
  }

  if (action === 'sync_holdings') {
    // Get all transactions for this policy
    const txR = await supa('GET', 'transactions', { filter: { policy_id: payload.policy_id } })
    const txs = Array.isArray(txR.data) ? txR.data : []

    // Compute balances
    const byFund = {}
    txs.sort((a, b) => new Date(a.date) - new Date(b.date))
    txs.forEach(tx => {
      if (!tx.fund_name) return
      if (!byFund[tx.fund_name]) byFund[tx.fund_name] = 0
      const u = Math.abs(parseFloat(tx.units) || 0)
      const delta = ['Switch Out', 'Welcome Bonus Clawback'].includes(tx.type) ? -u : u
      byFund[tx.fund_name] = Math.max(0, byFund[tx.fund_name] + delta)
    })

    // Get existing holdings for avg_price / last_known_price
    const existR = await supa('GET', 'fund_holdings', { filter: { policy_id: payload.policy_id } })
    const existMap = {}
    ;(Array.isArray(existR.data) ? existR.data : []).forEach(h => { existMap[h.fund_name] = h })

    // Delete and re-insert
    await supaDelete('fund_holdings', { eq: { policy_id: payload.policy_id } })
    const updates = Object.entries(byFund)
      .filter(([, u]) => u > 0.000001)
      .map(([fund, u]) => ({
        policy_id: payload.policy_id,
        fund_name: fund,
        units: u,
        avg_price: existMap[fund]?.avg_price || null,
        last_known_price: existMap[fund]?.last_known_price || null,
      }))
    if (updates.length) await supa('POST', 'fund_holdings', { body: updates, select: null })
    return NextResponse.json({ holdings: updates })
  }

  return NextResponse.json({ error: 'unknown action' }, { status: 400 })
}
