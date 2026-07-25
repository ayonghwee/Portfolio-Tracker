import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export async function GET(req) {
  const { searchParams } = new URL(req.url)
  const policyId = searchParams.get('policy_id')
  let query = supabase.from('fund_holdings').select('*')
  if (policyId) query = query.eq('policy_id', policyId)
  const { data, error } = await query
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ holdings: data })
}

export async function POST(req) {
  const body = await req.json()
  const { data, error } = await supabase.from('fund_holdings').insert(body).select()
  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json({ holdings: data })
}
