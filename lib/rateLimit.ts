import 'server-only'
import { createHash } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'
export async function rateLimit(key: string, limit: number, seconds: number) {
  const { data, error } = await createAdminClient().rpc('consume_request_limit', {
    p_key: createHash('sha256').update(key).digest('hex'), p_limit: limit, p_seconds: seconds,
  })
  if (error) throw error
  return data === true
}
export function requestAddress(request: Request) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'shared-unknown-address'
}
