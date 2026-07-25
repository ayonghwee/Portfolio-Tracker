import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export async function GET() {
  const { data, error } = await supabase
    .from('policies')
    .select('*, fund_holdings(*)')
    .order('commenced', { ascending: false })
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ policies: data })
}

export async function POST(req) {
  const body = await req.json()
  const { data, error } = await supabase
    .from('policies')
    .insert(body)
    .select()
    .single()
  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json({ policy: data })
}
