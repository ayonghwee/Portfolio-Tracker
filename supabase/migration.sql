-- Run this in Supabase SQL Editor (new query)

ALTER TABLE policies ADD COLUMN IF NOT EXISTS cash DECIMAL(12,2) DEFAULT 0;
ALTER TABLE policies ADD COLUMN IF NOT EXISTS dividends DECIMAL(12,2) DEFAULT 0;
ALTER TABLE policies ADD COLUMN IF NOT EXISTS welcome_bonus DECIMAL(12,2) DEFAULT 0;

CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id UUID REFERENCES policies(id) ON DELETE CASCADE,
  fund_name TEXT,
  date DATE NOT NULL,
  type TEXT NOT NULL,
  price DECIMAL(12,6),
  units DECIMAL(18,6),
  value DECIMAL(12,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on transactions" ON transactions FOR ALL USING (true) WITH CHECK (true);
