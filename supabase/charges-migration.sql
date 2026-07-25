-- Run this in Supabase SQL Editor if you haven't run auth-migration.sql yet
-- If you already ran auth-migration.sql, this is already included — skip it

ALTER TABLE policies ADD COLUMN IF NOT EXISTS charges DECIMAL(12,2) DEFAULT 0;
