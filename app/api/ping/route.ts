import { NextResponse } from 'next/server'

/**
 * Lightweight health check endpoint for cron-job.org or other uptime monitors.
 * Prevents "Output too large" errors by returning a minimal JSON payload.
 */
export async function GET() {
  return NextResponse.json(
    { 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      service: 'BeatToday API'
    },
    { status: 200 }
  )
}
