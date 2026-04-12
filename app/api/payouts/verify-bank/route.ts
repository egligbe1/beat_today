import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return new NextResponse('Unauthorized', { status: 401 })

    const { searchParams } = new URL(req.url)
    const account_number = searchParams.get('account_number')
    const bank_code = searchParams.get('bank_code')

    if (!account_number || !bank_code) {
      return NextResponse.json({ success: false, error: 'Account number and bank code are required.' }, { status: 400 })
    }

    const secret = process.env.PAYSTACK_SECRET_KEY
    if (!secret) {
      return NextResponse.json({ success: false, error: 'Paystack secret key is not configured.' }, { status: 500 })
    }

    // Paystack Resolve API
    // GET https://api.paystack.co/bank/resolve?account_number=X&bank_code=Y
    const response = await fetch(`https://api.paystack.co/bank/resolve?account_number=${account_number}&bank_code=${bank_code}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
      },
    })

    const data = await response.json()

    if (!data.status) {
      return NextResponse.json({ 
        success: false, 
        error: data.message || 'Could not verify account. Please check your details.' 
      }, { status: 400 })
    }

    return NextResponse.json({ 
      success: true, 
      account_name: data.data.account_name,
      account_number: data.data.account_number
    })
  } catch (err: any) {
    console.error('Account verification failed:', err)
    return NextResponse.json({ success: false, error: err.message || 'Internal server error' }, { status: 500 })
  }
}
