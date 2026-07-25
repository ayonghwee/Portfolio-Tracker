-- Run this in Supabase SQL Editor AFTER the previous migration.sql

-- Add charges column
ALTER TABLE policies ADD COLUMN IF NOT EXISTS charges DECIMAL(12,2) DEFAULT 0;

-- Update RLS: only authenticated users can access data
DROP POLICY IF EXISTS "Allow all on policies" ON policies;
DROP POLICY IF EXISTS "Allow all on fund_holdings" ON fund_holdings;
DROP POLICY IF EXISTS "Allow all on price_cache" ON price_cache;
DROP POLICY IF EXISTS "Allow all on transactions" ON transactions;

CREATE POLICY "Auth users only - policies" ON policies FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Auth users only - holdings" ON fund_holdings FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Auth users only - prices" ON price_cache FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Auth users only - transactions" ON transactions FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
