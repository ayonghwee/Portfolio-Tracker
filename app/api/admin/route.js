// TEMPORARY ADMIN ROUTE — remove after use
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  'https://oeegjflkqfkxgtfzxbny.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9lZWdqZmxrcWZreGd0Znp4Ym55Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTkwMjA1MywiZXhwIjoyMDYxNDc4MDUzfQ.PkBNcELJCOLGNVMFMoBPrFZJIhv9nAYpL5q8FmNiMaM'
)

export async function POST(req) {
  const { action, payload } = await req.json()

  if (action === 'get_policy_id') {
    const { data, error } = await supabase.from('policies').select('id,policy_number,invested,dividends').eq('policy_number', payload.policy_number).single()
    return NextResponse.json({ data, error: error?.message, url: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0,30), hasServiceKey: !!process.env.SUPABASE_SERVICE_KEY })
  }

  if (action === 'list_policies') {
    const { data, error } = await supabase.from('policies').select('id,policy_number').limit(5)
    return NextResponse.json({ data, error: error?.message })
  }

  if (action === 'get_transactions') {
    const { data } = await supabase.from('transactions').select('*').eq('policy_id', payload.policy_id).order('date')
    return NextResponse.json(data)
  }

  if (action === 'delete_transactions') {
    // Delete specific transaction IDs
    const { error } = await supabase.from('transactions').delete().in('id', payload.ids)
    return NextResponse.json({ error: error?.message })
  }

  if (action === 'insert_transactions') {
    const { error } = await supabase.from('transactions').insert(payload.rows)
    return NextResponse.json({ error: error?.message, count: payload.rows.length })
  }

  if (action === 'update_policy') {
    const { error } = await supabase.from('policies').update(payload.fields).eq('id', payload.id)
    return NextResponse.json({ error: error?.message })
  }

  if (action === 'sync_holdings') {
    // Recalculate and upsert fund_holdings from transactions
    const { data: txs } = await supabase.from('transactions').select('*').eq('policy_id', payload.policy_id)

    const byFund = {}
    const sorted = [...(txs || [])].sort((a, b) => new Date(a.date) - new Date(b.date))
    sorted.forEach(tx => {
      if (!tx.fund_name) return
      if (!byFund[tx.fund_name]) byFund[tx.fund_name] = 0
      const u = Math.abs(parseFloat(tx.units) || 0)
      const delta = ['Switch Out', 'Welcome Bonus Clawback'].includes(tx.type) ? -u : u
      byFund[tx.fund_name] = Math.max(0, byFund[tx.fund_name] + delta)
    })

    const { data: existing } = await supabase.from('fund_holdings').select('*').eq('policy_id', payload.policy_id)
    const existMap = {}
    existing?.forEach(h => { existMap[h.fund_name] = h })

    await supabase.from('fund_holdings').delete().eq('policy_id', payload.policy_id)
    const updates = Object.entries(byFund).filter(([, u]) => u > 0.000001).map(([fund, u]) => ({
      policy_id: payload.policy_id,
      fund_name: fund,
      units: u,
      avg_price: existMap[fund]?.avg_price || null,
      last_known_price: existMap[fund]?.last_known_price || null,
    }))
    if (updates.length) await supabase.from('fund_holdings').insert(updates)
    return NextResponse.json({ holdings: updates })
  }

  return NextResponse.json({ error: 'unknown action' }, { status: 400 })
}
