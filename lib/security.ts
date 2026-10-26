export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function ownsAsset(key: unknown, producerId: string, kind: 'master' | 'stems') {
  if (typeof key !== 'string' || key.includes('..') || /[%\\?#\s]/.test(key)) return false
  return key.startsWith(`${kind === 'master' ? 'masters' : 'stems'}/${producerId}/`)
    && !key.slice(key.indexOf(`/${producerId}/`) + producerId.length + 2).includes('/')
}

export function effectiveTier(settings: any, now = Date.now()): 'FREE' | 'STARTER' | 'PRO' {
  if (!settings || settings.subscription_active === false) return 'FREE'
  const expires = settings.subscription_expires_at
  if (expires && (!Number.isFinite(Date.parse(expires)) || Date.parse(expires) <= now)) return 'FREE'
  const tier = String(settings.subscription_tier || '').toUpperCase()
  // Paid access requires a known paid period; legacy null expiry is not a paid entitlement.
  return expires && (tier === 'STARTER' || tier === 'PRO') ? tier : 'FREE'
}

export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}

export function safeExternalUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return
  try {
    const url = new URL(value)
    if (['http:', 'https:'].includes(url.protocol) && !url.username && !url.password) return url.href
  } catch { /* Invalid public profile links are not rendered. */ }
}
