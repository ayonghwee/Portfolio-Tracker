-- Run this in your Supabase SQL editor (supabase.com → your project → SQL Editor)

-- Policies table
CREATE TABLE policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_number TEXT UNIQUE NOT NULL,
  nickname TEXT,
  product TEXT,
  commenced DATE,
  premium DECIMAL(12,2) DEFAULT 0,
  frequency TEXT DEFAULT 'Monthly',
  invested DECIMAL(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Fund holdings table
CREATE TABLE fund_holdings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id UUID REFERENCES policies(id) ON DELETE CASCADE,
  fund_name TEXT NOT NULL,
  units DECIMAL(18,6) DEFAULT 0,
  avg_price DECIMAL(12,6),
  last_known_price DECIMAL(12,6),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Price cache table (stores latest GE fund prices)
CREATE TABLE price_cache (
  fund_name TEXT PRIMARY KEY,
  bid_price DECIMAL(12,6),
  offer_price DECIMAL(12,6),
  price_date DATE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (allow all for now — add auth later if needed)
ALTER TABLE policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE fund_holdings ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on policies" ON policies FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on fund_holdings" ON fund_holdings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on price_cache" ON price_cache FOR ALL USING (true) WITH CHECK (true);
