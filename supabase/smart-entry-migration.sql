-- Smart Entry Migration
-- Run this in Supabase SQL Editor

-- Add balance units (running unit balance after each transaction)
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS bal_units DECIMAL(18,6);

-- For dividends: store the declared rate % and NAV at ex-div date
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS dividend_rate DECIMAL(10,6);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS nav_at_date DECIMAL(12,2);

-- Actual price effective date (may differ from transaction date due to AM/PM rule)
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS price_effective_date DATE;

-- Time of day for switches: 'before' or 'after' (12pm cutoff)
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS time_of_day TEXT;

-- Paired transaction reference (Switch Out links to its Switch In and vice versa)
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS pair_id UUID;

-- Index for faster fund-level queries
CREATE INDEX IF NOT EXISTS idx_transactions_policy_fund ON transactions(policy_id, fund_name, date);
CREATE INDEX IF NOT EXISTS idx_transactions_pair ON transactions(pair_id);
