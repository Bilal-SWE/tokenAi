-- Migration: Switch wallet balance from credits to nanodollars
-- Run this ONCE against your Supabase database before deploying the new code.
--
-- What changes:
--   wallets.balance   : INT  → BIGINT  (nanodollars; 1 USD = 1,000,000,000)
--   transactions.amount: INT → BIGINT
--   transactions.balance_after: INT → BIGINT  (if column exists)
--
-- If you have existing users with credit balances you want to preserve,
-- uncomment the UPDATE statements below to convert them proportionally.
-- Conversion rate: old credits → nanodollars
--   Old system: $5 = 7,000,000 credits  →  1 credit ≈ 714 nanodollars
--   Multiply existing balances by 714 to convert.

ALTER TABLE wallets ALTER COLUMN balance TYPE BIGINT;
ALTER TABLE transactions ALTER COLUMN amount TYPE BIGINT;

-- Only run if balance_after column exists:
-- ALTER TABLE transactions ALTER COLUMN balance_after TYPE BIGINT;

-- ── Optional: convert existing balances ───────────────────────────────────
-- UPDATE wallets SET balance = balance * 714;
-- UPDATE transactions SET amount = amount * 714;
-- UPDATE transactions SET balance_after = balance_after * 714 WHERE balance_after IS NOT NULL;
-- ─────────────────────────────────────────────────────────────────────────
