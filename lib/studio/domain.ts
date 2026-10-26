import type { StudioProjectStatus } from '@/lib/types'
export const STUDIO_SERVICES = ['RECORDING', 'MIXING', 'MASTERING', 'PRODUCTION'] as const
export const PROJECT_STAGE: Record<StudioProjectStatus, string> = {
  AWAITING_AGREEMENT: 'Agreement needed', AGREED: 'Agreement confirmed', IN_PRODUCTION: 'In production', ON_HOLD: 'On hold',
}
export const AGREEMENT_FIELDS = [
  { key: 'scope', label: 'Scope of work', hint: 'Describe the work, the brief and anything excluded.' },
  { key: 'deliverables', label: 'Deliverables & revisions', hint: 'List songs, file formats, versions and what an included revision covers.' },
  { key: 'timeline', label: 'Schedule & deadlines', hint: 'Include session dates, milestone dates, timezone and expected delivery.' },
  { key: 'payment_terms', label: 'Payment & delivery conditions', hint: 'State deposit timing, remaining balance and when final files will be released.' },
  { key: 'rights', label: 'Credits & usage rights', hint: 'Agree on ownership, credits and any separate beat license required.' },
  { key: 'cancellation', label: 'Changes, cancellation & refunds', hint: 'Describe rescheduling, cancellations, refunds and additional-work approval.' },
] as const
export function studioMoney(minor: number) {
  return new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' }).format(minor / 100)
}
export function priceToMinor(value: string): number {
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(value)) throw new Error('Enter an amount with up to two decimal places')
  const [whole, fraction = ''] = value.split('.')
  const minor = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
  if (minor > 100000000) throw new Error('Amount is above the supported limit')
  return minor
}
export function missingStudioSchema(error: { code?: string } | null) {
  return !!error && ['42P01', 'PGRST205', 'PGRST202'].includes(error.code || '')
}
