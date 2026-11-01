import {NextResponse} from 'next/server'
import {purchaseAccess} from '@/lib/commerce/purchaseAccess'
export async function GET(request:Request){
 const access=await purchaseAccess(new URL(request.url).searchParams.get('order_id')||'')
 if(!access)return NextResponse.json({error:'Purchase not found'},{status:404})
 return NextResponse.json({status:access.order.status},{headers:{'Cache-Control':'private, no-store'}})
}
