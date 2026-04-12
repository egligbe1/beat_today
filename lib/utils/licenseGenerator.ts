interface LicenseVariables {
  PRODUCER_NAME: string
  BUYER_NAME: string
  TRACK_TITLE: string
  STREAM_LIMIT: string
  MV_LIMIT: string
  RADIO_RIGHTS: string
  DATE: string
}

export function generateLicenseContract(template: string, vars: LicenseVariables) {
  let contract = template

  Object.entries(vars).forEach(([key, value]) => {
    const regex = new RegExp(`{{${key}}}`, 'g')
    contract = contract.replace(regex, value)
  })

  const signature = `

---
DOCUMENT FOOTPRINT
Order ID: BT-{{ORDER_ID}}
Digitally Agreed By: {{BUYER_NAME}}
Agreement Date: {{DATE}}
Platform: BeatToday (beattoday.com)
---`

  return contract
    + signature
        .replace('{{ORDER_ID}}', String(Date.now()))
        .replace('{{BUYER_NAME}}', vars.BUYER_NAME)
        .replace('{{DATE}}', vars.DATE)
}

// ─────────────────────────────────────────────────────────────────────────────
// INDUSTRY-STANDARD DEFAULT LICENSE TEXTS
// Each tier has its own full legal text with appropriate rights.
// Producers can override these per-tier in dashboard > Licenses.
// ─────────────────────────────────────────────────────────────────────────────

export const LICENSE_DEFAULTS: Record<string, {
  streaming_limit: number
  music_video_limit: number
  radio_broadcasting: boolean
  is_non_profit_only: boolean
  contract_text: string
}> = {

  // ── BASIC LEASE (MP3) ──────────────────────────────────────────────────────
  basic: {
    streaming_limit: 50000,
    music_video_limit: 1,
    radio_broadcasting: false,
    is_non_profit_only: false,
    contract_text: `NON-EXCLUSIVE LICENSE AGREEMENT — BASIC LEASE (MP3)

This Non-Exclusive License Agreement ("Agreement") is entered into as of {{DATE}} by and between:

  Producer / Licensor: {{PRODUCER_NAME}} ("Licensor")
  Purchaser / Licensee: {{BUYER_NAME}} ("Licensee")

for the musical composition and sound recording known as:

  "{{TRACK_TITLE}}" ("the Beat")

────────────────────────────────────────────────────────────────────────────────
1. GRANT OF LICENSE

The Licensor hereby grants the Licensee a non-exclusive, non-transferable, worldwide license to use the Beat solely under the following conditions:

  a) FORMAT — Licensee receives a tagged MP3 file of the Beat.
  b) STREAMS — Up to {{STREAM_LIMIT}} total audio streams across all platforms combined (Spotify, Apple Music, YouTube, SoundCloud, etc.).
  c) MUSIC VIDEOS — Up to {{MV_LIMIT}} official music video(s) distributed online (YouTube, Vimeo, etc.).
  d) FREE DOWNLOADS — Up to 2,500 free digital downloads for promotional purposes.
  e) RADIO — {{RADIO_RIGHTS}}.
  f) PERFORMANCES — Unlimited live performances permitted.
  g) NON-PROFIT / COMMERCIAL — This license permits commercial use for independent releases. Major label or major distribution deal use requires an Unlimited or Exclusive license.

2. OWNERSHIP & COPYRIGHT

  a) The Licensor retains 100% ownership of the Beat, including all copyrights in the composition and master recording.
  b) The Licensee shall credit the Licensor as the producer in all releases as: "Prod. by {{PRODUCER_NAME}}".
  c) The Beat may not be registered as an original composition or sample-free work by the Licensee on any PRO (Performance Rights Organization), Content ID system, or similar service.
  d) The Licensor retains the right to license the Beat to other artists (non-exclusive).

3. RESTRICTIONS

  a) The Licensee may NOT re-sell, lease, sub-license, or otherwise transfer the Beat to any third party.
  b) The Licensee may NOT alter, interpolate, sample, or otherwise incorporate the Beat into a new composition for re-licensing purposes.
  c) The Licensee may NOT use the Beat in advertisements, film/TV synchronization, or any media beyond music recordings without purchasing an Unlimited or Exclusive license.
  d) The Licensee may NOT use the Beat for NFT minting or blockchain-based sales without the Licensor's express written consent.
  e) Exceeding the stream, download, or video limits described in this Agreement automatically voids this license. The Licensee must upgrade to an appropriate tier.

4. TERM

This license is perpetual and does not expire provided the Licensee remains within the usage limits stated herein and does not breach any term of this Agreement.

5. TERMINATION

This license terminates automatically and immediately if:
  a) The Licensee exceeds any usage limit stated in Section 1.
  b) The Licensee breaches any restriction stated in Section 3.
  c) The Licensee fails to credit the Licensor as specified.
Upon termination, the Licensee must immediately cease all use of the Beat and remove all distributed recordings.

6. WARRANTIES & INDEMNIFICATION

  a) The Licensor warrants that they own or have the right to license the Beat and that it does not knowingly infringe any third-party copyright.
  b) The Licensor is not responsible for clearance of any third-party samples that may exist within the Beat. It is the Licensee's responsibility to verify and clear any samples before commercial release.
  c) The Licensee agrees to indemnify and hold harmless the Licensor from any claims arising from the Licensee's use of the Beat in violation of this Agreement.

7. GOVERNING LAW

This Agreement shall be governed by and construed in accordance with applicable copyright law. Any disputes shall be resolved through good-faith negotiation, and if unresolved, through binding arbitration.

8. ENTIRE AGREEMENT

This Agreement constitutes the entire agreement between the parties with respect to the Beat and supersedes all prior discussions.`,
  },

  // ── PREMIUM LEASE (WAV) ───────────────────────────────────────────────────
  premium: {
    streaming_limit: 150000,
    music_video_limit: 1,
    radio_broadcasting: false,
    is_non_profit_only: false,
    contract_text: `NON-EXCLUSIVE LICENSE AGREEMENT — PREMIUM LEASE (WAV)

This Non-Exclusive License Agreement ("Agreement") is entered into as of {{DATE}} by and between:

  Producer / Licensor: {{PRODUCER_NAME}} ("Licensor")
  Purchaser / Licensee: {{BUYER_NAME}} ("Licensee")

for the musical composition and sound recording known as:

  "{{TRACK_TITLE}}" ("the Beat")

────────────────────────────────────────────────────────────────────────────────
1. GRANT OF LICENSE

The Licensor hereby grants the Licensee a non-exclusive, non-transferable, worldwide license to use the Beat under the following conditions:

  a) FORMAT — Licensee receives a high-quality untagged WAV file of the Beat.
  b) STREAMS — Up to {{STREAM_LIMIT}} total audio streams across all platforms combined.
  c) MUSIC VIDEOS — Up to {{MV_LIMIT}} official music video(s) distributed online or broadcast.
  d) FREE DOWNLOADS — Up to 5,000 free digital downloads for promotional purposes.
  e) RADIO — {{RADIO_RIGHTS}}.
  f) PERFORMANCES — Unlimited live performances permitted.
  g) COMMERCIAL USE — Full commercial use is permitted including independent releases, label-backed releases, and digital distribution with monetization on all major DSPs.
  h) SYNC — Limited synchronization use is permitted for self-produced short-form content (social media videos, vlogs). Full film/TV sync requires an Unlimited or Exclusive license.

2. OWNERSHIP & COPYRIGHT

  a) The Licensor retains 100% ownership of the Beat, including all copyrights in the composition and master recording.
  b) The Licensee shall credit the Licensor in all releases as: "Prod. by {{PRODUCER_NAME}}".
  c) The Beat may not be registered by the Licensee on any Content ID system, PRO, or similar service as an original or sample-free composition.
  d) The Licensor retains the right to license the Beat non-exclusively to other artists.

3. RESTRICTIONS

  a) The Licensee may NOT re-sell, sub-license, or transfer this license or the Beat files to any third party.
  b) The Licensee may NOT use the Beat for advertising, commercial broadcast TV/Film, or sync licensing without purchasing an appropriate upgrade.
  c) The Licensee may NOT use the Beat for NFT creation or blockchain distribution without express written consent from the Licensor.
  d) Exceeding usage limits voids this license and requires the Licensee to upgrade or cease distribution.

4. TERM

This license is perpetual provided all usage limits and terms are observed.

5. TERMINATION

This license terminates automatically upon breach of any term. The Licensee must immediately remove all distributed recordings upon termination.

6. WARRANTIES & INDEMNIFICATION

  a) The Licensor warrants ownership and right to license the Beat.
  b) Sample clearance is the sole responsibility of the Licensee prior to commercial release.
  c) The Licensee indemnifies the Licensor against any claims arising from breach of this Agreement.

7. GOVERNING LAW

This Agreement is governed by applicable copyright law.`,
  },

  // ── UNLIMITED LEASE (TRACKOUT / STEMS) ────────────────────────────────────
  unlimited: {
    streaming_limit: 0, // unlimited — 0 = no cap
    music_video_limit: 0, // unlimited
    radio_broadcasting: true,
    is_non_profit_only: false,
    contract_text: `NON-EXCLUSIVE LICENSE AGREEMENT — UNLIMITED LEASE (TRACKOUT)

This Non-Exclusive License Agreement ("Agreement") is entered into as of {{DATE}} by and between:

  Producer / Licensor: {{PRODUCER_NAME}} ("Licensor")
  Purchaser / Licensee: {{BUYER_NAME}} ("Licensee")

for the musical composition and sound recording known as:

  "{{TRACK_TITLE}}" ("the Beat")

────────────────────────────────────────────────────────────────────────────────
1. GRANT OF LICENSE

The Licensor hereby grants the Licensee a non-exclusive, non-transferable, worldwide, unlimited-use license as follows:

  a) FORMAT — Licensee receives a high-quality untagged WAV file and a full trackout/stems ZIP package.
  b) STREAMS — Unlimited streams across all platforms with no cap.
  c) MUSIC VIDEOS — Unlimited music videos for online and broadcast distribution.
  d) FREE DOWNLOADS — Unlimited free digital downloads.
  e) RADIO BROADCASTING — {{RADIO_RIGHTS}}. FM, AM, internet radio, and satellite radio broadcast are fully permitted.
  f) PERFORMANCES — Unlimited live performances, festivals, and tours.
  g) COMMERCIAL USE — Full commercial use permitted including major label releases, major distribution, film/TV synchronization (limited to one production), advertising (one campaign), and brand partnerships.
  h) SYNC — One (1) synchronization license for film, TV, game, or commercial use is included. Additional sync placements require separate licensing.

2. OWNERSHIP & COPYRIGHT

  a) The Licensor retains full copyright ownership of the Beat (composition and master).
  b) The Licensee shall credit the Licensor in all releases as: "Prod. by {{PRODUCER_NAME}}".
  c) The Licensee may register the song (lyrics + melody as a new composition) with their PRO for their songwriting share ONLY. The Beat/instrumental copyright remains with the Licensor.
  d) The Licensor retains the right to license the Beat non-exclusively to other artists.

3. TRACKOUT / STEMS

  a) The stems are provided strictly for mixing and mastering the Licensee's own vocal recording against the Beat.
  b) The Licensee may NOT use individual stems independently as standalone recordings, loops, or samples in other compositions.
  c) The stems may NOT be re-sold, shared, or distributed in isolation.

4. RESTRICTIONS

  a) This license is non-transferable and non-sub-licensable.
  b) NFT minting or blockchain-based distribution requires express written consent from the Licensor.
  c) The Beat may not be registered in any Content ID or audio fingerprinting system by the Licensee.

5. TERM

This license is perpetual with no stream or distribution caps, subject to the restrictions above.

6. TERMINATION

This license terminates upon material breach. The Licensor must provide written notice and a 14-day cure period before termination for non-willful violations.

7. WARRANTIES & INDEMNIFICATION

  a) The Licensor warrants ownership and the right to grant this license.
  b) Sample clearance is the Licensee's responsibility.
  c) The Licensee indemnifies the Licensor against any claims arising from breach.

8. GOVERNING LAW

This Agreement is governed by applicable copyright law.`,
  },

  // ── EXCLUSIVE RIGHTS ──────────────────────────────────────────────────────
  exclusive: {
    streaming_limit: 0, // unlimited
    music_video_limit: 0, // unlimited
    radio_broadcasting: true,
    is_non_profit_only: false,
    contract_text: `EXCLUSIVE RIGHTS AGREEMENT

This Exclusive Rights Agreement ("Agreement") is entered into as of {{DATE}} by and between:

  Producer / Licensor: {{PRODUCER_NAME}} ("Licensor")
  Purchaser / Licensee: {{BUYER_NAME}} ("Licensee")

for the musical composition and sound recording known as:

  "{{TRACK_TITLE}}" ("the Beat")

────────────────────────────────────────────────────────────────────────────────
IMPORTANT NOTICE: Upon full payment and execution of this Agreement, the Beat will be permanently removed from public sale. No other artist may license this Beat after this date.

────────────────────────────────────────────────────────────────────────────────
1. EXCLUSIVE GRANT OF RIGHTS

The Licensor hereby transfers and grants to the Licensee the following exclusive, worldwide, perpetual, irrevocable rights:

  a) FORMAT — Licensee receives the full untagged WAV master, full trackout/stems ZIP, and any project files in the Licensor's possession.
  b) MASTER RECORDING — Exclusive ownership of the master recording of the Beat as delivered. The Licensee may release the Beat under their name as the master owner.
  c) STREAMS — Unlimited streams across all platforms with no restriction.
  d) MUSIC VIDEOS — Unlimited music videos for all distribution channels.
  e) BROADCAST — Full AM/FM radio, internet radio, satellite, podcast, and television broadcast rights.
  f) SYNC — Full film, TV, game, commercial, and advertising synchronization rights without limitation.
  g) PERFORMANCES — Unlimited live, televised, and streamed performances.
  h) SUB-LICENSING — The Licensee may sub-license the Beat as part of a signed label deal or sync placement, but may NOT re-sell the Beat itself as a standalone beat to third parties.

2. PUBLISHER'S SHARE & WRITER'S CREDIT

  a) COMPOSITION — The underlying musical composition (melody and arrangement) copyright is hereby assigned to the Licensee. The Licensee is entitled to register the composition with their PRO.
  b) WRITER'S CREDIT — Notwithstanding the above, the Licensor shall retain a 50% co-writer credit and 50% publishing share of the composition as the Beat's creator. This is a standard industry practice for produced works and is non-negotiable.
  c) SPLIT SHEET — A formal split sheet reflecting 50% producer/50% artist split for publishing and performance royalties is implied by this Agreement. The parties are encouraged to execute a separate split sheet.
  d) The Licensor's PRO-registered writer share entitles them to receive their pro-rata performance royalties directly from relevant PROs (ASCAP, BMI, SOCAN, SAMRO, etc.).

3. EXCLUSIVITY

  a) Upon execution and full payment, the Licensor agrees not to sell, license, or otherwise distribute the Beat to any other party.
  b) Any previously sold non-exclusive licenses for this Beat (if any) will remain valid. Exclusivity applies only from the date of this Agreement forward.

4. REPRESENTATIONS & WARRANTIES

  a) The Licensor represents and warrants that they are the sole creator and owner of the Beat, that it does not infringe any third-party rights, and that they have full authority to grant these rights.
  b) If the Beat contains any third-party samples, the Licensor will disclose them to the Licensee. Clearance of disclosed samples is negotiated separately. Undisclosed sample infringement is the sole liability of the Licensor.
  c) The Licensee warrants that they will comply with all applicable laws regarding copyright, music licensing, and distribution.

5. INDEMNIFICATION

  a) The Licensor shall indemnify and hold harmless the Licensee from any third-party claims arising from the Licensor's breach of their warranties in Section 4(a).
  b) The Licensee shall indemnify and hold harmless the Licensor from any claims arising from the Licensee's use of the Beat beyond the scope of this Agreement.

6. PAYMENT

This Agreement becomes binding and effective only upon full receipt of the agreed purchase price by the Licensor through the BeatToday platform.

7. REVERSION

If the Licensee abandons the Beat (no commercial release, distribution, or PRO registration within 5 years of this Agreement), all rights revert to the Licensor.

8. GOVERNING LAW & DISPUTE RESOLUTION

This Agreement is governed by applicable copyright and contract law. Any dispute shall first be addressed through good-faith negotiation. If unresolved within 30 days, both parties agree to binding arbitration.

9. ENTIRE AGREEMENT

This Agreement, together with the BeatToday platform order record, constitutes the entire agreement between the parties regarding the Beat and supersedes all prior representations, negotiations, and discussions.`,
  },
}

// Convenience: a fallback for older code that references PLATFORM_DEFAULT_LICENSE
export const PLATFORM_DEFAULT_LICENSE = LICENSE_DEFAULTS.basic.contract_text
