export const TIER_LIMITS = {
  free: {
    max_beats: 20,
    wav_upload: false,
    stems_upload: false,
    custom_licenses: false,
    promo_codes: false,
    platform_fee: 0.20,
  },
  starter: {
    max_beats: 100,
    wav_upload: true,
    stems_upload: false,
    custom_licenses: true,
    promo_codes: true,
    platform_fee: 0.10,
  },
  pro: {
    max_beats: Infinity,
    wav_upload: true,
    stems_upload: true,
    custom_licenses: true,
    promo_codes: true,
    platform_fee: 0.00,
  },
} as const

export type TierKey = keyof typeof TIER_LIMITS

export function getTierLimits(tier: string) {
  const key = tier.toLowerCase() as TierKey
  return TIER_LIMITS[key] ?? TIER_LIMITS.free
}
