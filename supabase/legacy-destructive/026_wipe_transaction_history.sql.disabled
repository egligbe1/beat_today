-- Wipe all transaction history for a fresh start
-- This clears Artist purchases, Producer sales, and all financial ledger records.

-- 1. Clear Licenses
TRUNCATE TABLE order_item_licenses RESTART IDENTITY CASCADE;

-- 2. Clear Order Items & Orders
TRUNCATE TABLE order_items RESTART IDENTITY CASCADE;
TRUNCATE TABLE orders RESTART IDENTITY CASCADE;

-- 3. Clear Financial Records
TRUNCATE TABLE ledger_transactions RESTART IDENTITY CASCADE;
TRUNCATE TABLE payouts RESTART IDENTITY CASCADE;

-- 4. Reset Wallet Balances
-- We keep the wallet records (to preserve bank info/Paystack codes) but reset balances to 0.
UPDATE wallets 
SET available_balance = 0, 
    pending_balance = 0;
