// Return only local application paths. OAuth and password sign-in share this rule.
export function authReturnTo(value: string | null | undefined, fallback = '/'): string {
 if (!value || value.length > 2000 || !value.startsWith('/') || value.startsWith('//')) return fallback
 try {
  let decoded = value
  for (let i = 0; i < 3; i++) {
   if (/[\\\u0000-\u0020\u007f]/.test(decoded) || decoded.startsWith('//')) return fallback
   const next = decodeURIComponent(decoded)
   if (next === decoded) break
   decoded = next
  }
  if (/[\\\u0000-\u0020\u007f]/.test(decoded) || decoded.startsWith('//')) return fallback
  const url = new URL(value, 'https://beattoday.invalid')
  if (url.origin !== 'https://beattoday.invalid' || /^\/(login|signup|api\/auth)(\/|$)/.test(url.pathname)) return fallback
  return url.pathname + url.search + url.hash
 } catch { return fallback }
}
export function requestedAuthReturn(search: string, fallback = '/') {
 const params = new URLSearchParams(search)
 return authReturnTo(params.get('redirect') || params.get('next'), fallback)
}
