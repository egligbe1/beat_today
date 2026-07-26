import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { verifyQStashSignature } from '@/lib/qstash'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

// 7 Days in MS for the financial clearance period
const CLEARANCE_DELAY_MS = 7 * 24 * 60 * 60 * 1000 

export async function POST(req: Request) {
  const isValid = await verifyQStashSignature(req.clone())
  if (!isValid && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const cutoffDate = new Date(Date.now() - CLEARANCE_DELAY_MS).toISOString()

    // 2. Query all 'pending' credits older than the cutoff
    const { data: pendingLedgers, error: fetchError } = await supabaseAdmin
        .from('ledger_transactions')
        .select('*')
        .eq('status', 'PENDING')
        .eq('type', 'SALE')
        .lte('created_at', cutoffDate)
        
    if (fetchError) throw fetchError

    if (!pendingLedgers || pendingLedgers.length === 0) {
        return NextResponse.json({ success: true, message: 'No funds require clearance today.' })
    }

    let clearedCount = 0

    // 3. Process the clearance batch atomically
    // We iterate rather than bulk-update so we can track exact failures per ledger ID
    for (const trx of pendingLedgers) {
        
        // Use an RPC to guarantee atomic transfer from pending->available
        // 'rpc_clear_funds' would mathematically: wallet.pending -= trx.amount; wallet.available += trx.amount;
        const { error: rpcError } = await supabaseAdmin.rpc('clear_ledger_funds', {
            p_transaction_id: trx.id,
            p_producer_id: trx.producer_id,
            p_amount: trx.amount
        })

        if (!rpcError) {
            clearedCount++
        } else {
            console.error(`Clearance Failed for Trx: ${trx.id}`, rpcError)
        }
    }

    return NextResponse.json({ 
        success: true, 
        message: `Clearance Cycle Complete: ${clearedCount} ledger entries cleared from Pending to Available.` 
    })
  } catch (error: any) {
    console.error("Cron Error: Failed to clear funds", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
