import { NextResponse } from 'next/server'
import { verifyQStashSignature } from '@/lib/qstash'
import { processWatermarkJob } from '@/lib/audio/watermarkWorker'
export async function POST(request: Request) {
  if(!await verifyQStashSignature(request.clone())) return NextResponse.json({error:'Unauthorized'},{status:401})
  const results=[]
  for(let i=0;i<3;i++) results.push(await processWatermarkJob())
  return NextResponse.json({results})
}
