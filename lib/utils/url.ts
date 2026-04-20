export const getSiteUrl = () => {
  let url = process.env.NEXT_PUBLIC_SITE_URL ?? (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000')
  return url.replace(/\/$/, '')
}
