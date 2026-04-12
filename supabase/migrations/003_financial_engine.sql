-- 003_financial_engine.sql
-- Merges: 005, 010 (neutralized), 012, 013, 015, 020, 026

-- 1. Producer Wallet
CREATE TABLE wallets (
    producer_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    available_balance NUMERIC DEFAULT 0.00,
    pending_balance NUMERIC DEFAULT 0.00,
    currency VARCHAR(3) DEFAULT 'USD',
    payout_currency VARCHAR(3) DEFAULT 'USD',
    recipient_code TEXT, -- Paystack Transfer Recipient Code (Bank)
    mobile_money_recipient_code TEXT, -- Paystack Recipient Code (Mobile Money)
    bank_details JSONB DEFAULT '{}', -- { "bank_name", "account_number", "account_name", "bank_code" }
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_payout_at TIMESTAMPTZ
);

-- 2. Immutable Ledger
CREATE TABLE ledger_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    producer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL, -- positive for credits (sales), negative for debits (payouts)
    type VARCHAR NOT NULL CHECK (type IN ('SALE', 'PAYOUT', 'REFUND', 'ADJUSTMENT')),
    status VARCHAR DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'AVAILABLE', 'FAILED')),
    description TEXT,
    reference_id VARCHAR, -- Order ID or Payout ID
    clearance_date TIMESTAMPTZ, -- When funds move from pending to available
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Payout Tracker
CREATE TABLE payouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    producer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL,
    status VARCHAR DEFAULT 'PROCESSING' CHECK (status IN ('PROCESSING', 'SUCCESS', 'FAILED')),
    reference VARCHAR UNIQUE NOT NULL, -- Idempotency key for Paystack
    paystack_transfer_code VARCHAR,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indices
CREATE INDEX idx_wallets_producer_id ON wallets(producer_id);
CREATE INDEX idx_ledger_producer_id ON ledger_transactions(producer_id);
CREATE INDEX idx_ledger_status ON ledger_transactions(status);
CREATE INDEX idx_payouts_producer_id ON payouts(producer_id);

-- Enable RLS
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payouts ENABLE ROW LEVEL SECURITY;

-- Policies: Wallets
CREATE POLICY "Producers can view their own wallet" ON wallets
    FOR SELECT USING (auth.uid() = producer_id);

CREATE POLICY "Service role manages wallets" ON wallets
    FOR ALL USING (true) WITH CHECK (true);

-- Policies: Ledger
CREATE POLICY "Producers can view their own ledger" ON ledger_transactions
    FOR SELECT USING (auth.uid() = producer_id);

-- Policies: Payouts
CREATE POLICY "Producers can view their own payouts" ON payouts
    FOR SELECT USING (auth.uid() = producer_id);

-- 4. Financial RPCs

-- Deduct balance for payouts
CREATE OR REPLACE FUNCTION deduct_available_balance(p_producer_id UUID, p_amount NUMERIC)
RETURNS VOID AS $$
BEGIN
    UPDATE wallets
    SET available_balance = available_balance - p_amount,
        updated_at = NOW()
    WHERE producer_id = p_producer_id 
    AND available_balance >= p_amount;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Insufficient balance or wallet not found';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Clear funds (Move from pending to available)
CREATE OR REPLACE FUNCTION clear_ledger_funds(p_producer_id UUID, p_amount NUMERIC, p_transaction_id UUID)
RETURNS VOID AS $$
BEGIN
    -- 1. Update the specific ledger transaction
    UPDATE ledger_transactions
    SET status = 'AVAILABLE',
        clearance_date = NOW()
    WHERE id = p_transaction_id 
    AND status = 'PENDING'
    AND producer_id = p_producer_id;

    IF FOUND THEN
        -- 2. Update the wallet balances
        UPDATE wallets
        SET pending_balance = pending_balance - p_amount,
            available_balance = available_balance + p_amount,
            updated_at = NOW()
        WHERE producer_id = p_producer_id;
    ELSE
        RAISE EXCEPTION 'Transaction not found or already cleared';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically create a wallet when a producer profile is created
CREATE OR REPLACE FUNCTION handle_new_producer_wallet() 
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role = 'producer' THEN
    INSERT INTO public.wallets (producer_id)
    VALUES (NEW.id)
    ON CONFLICT (producer_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_producer_profile_created_wallet ON users_profiles;
CREATE TRIGGER on_producer_profile_created_wallet
  AFTER INSERT OR UPDATE ON users_profiles
  FOR EACH ROW EXECUTE FUNCTION handle_new_producer_wallet();
