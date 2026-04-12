import Link from 'next/link'

export const metadata = {
  title: 'Terms of Service — BeatToday',
  description: 'BeatToday Terms of Service. Read our terms before using the platform.',
}

const LAST_UPDATED = 'April 9, 2025'

const SECTIONS = [
  {
    title: '1. Acceptance of Terms',
    content: `By accessing or using BeatToday ("the Platform"), you agree to be bound by these Terms of Service and all applicable laws and regulations. If you do not agree with any part of these terms, you may not use the Platform. BeatToday reserves the right to update these terms at any time, and continued use after changes constitutes acceptance.`
  },
  {
    title: '2. Eligibility',
    content: `You must be at least 13 years of age to use BeatToday. If you are under 18, you represent that a parent or legal guardian has reviewed and agreed to these terms on your behalf. By creating an account, you confirm that all information you provide is accurate and complete.`
  },
  {
    title: '3. Producer Accounts',
    content: `Producers who upload beats to BeatToday ("Producers") are solely responsible for the content they upload. By uploading a beat, you represent and warrant that:\n\n• You own or have the necessary rights to all elements of the beat (samples, melodies, loops)\n• The beat does not infringe any third-party intellectual property rights\n• You have cleared all samples, if any, used in the production\n• The beat does not contain any illegal, defamatory, or harmful content\n\nBeatToday reserves the right to remove any content that violates these terms or that we deem inappropriate, without prior notice.`
  },
  {
    title: '4. Buyer Accounts',
    content: `When you purchase a beat license, you are purchasing a license to use the beat under the specific terms of the license type purchased. You do not purchase ownership of the underlying copyright unless you purchase an Exclusive license. You agree to:\n\n• Use the beat only within the scope of the purchased license\n• Credit the producer as specified in your license agreement\n• Not share, redistribute, or resell the purchased audio files\n• Not claim ownership of the beat's underlying composition or melody`
  },
  {
    title: '5. License Types and Usage Rights',
    content: `BeatToday facilitates three primary license structures:\n\n• Basic/MP3 License: Non-exclusive. Limited to the stream and distribution caps specified at time of purchase. The beat remains available for sale to other buyers.\n\n• Premium/WAV License: Non-exclusive. Higher usage caps. Includes WAV audio files.\n\n• Exclusive License: Full commercial rights transferred to buyer. Beat removed from marketplace. Producer retains songwriting credit and performance royalty rights unless explicitly waived.\n\nCustom license terms may apply if the Producer uses BeatToday's custom license template feature. Always review the license agreement before purchase.`
  },
  {
    title: '6. Platform Fees and Subscriptions',
    content: `BeatToday charges a platform fee on each beat sale, which varies by the Producer's subscription tier:\n\n• FREE Plan: 20% platform fee per sale\n• STARTER Plan ($9.99/year): 10% platform fee per sale\n• PRO Plan ($59.99/year): 0% platform fee\n\nSubscriptions are billed annually and are non-refundable once the subscription period has commenced. You may cancel at any time; your subscription remains active until the end of the paid period. Platform fees are deducted automatically before crediting the Producer's wallet.`
  },
  {
    title: '7. Payouts',
    content: `Producers may withdraw their earned balance to a linked bank account. Payouts are processed automatically on the 1st and 15th of each month. A minimum balance threshold applies before payout triggers. BeatToday supports bank transfers to Ghana (GHS), Nigeria (NGN), Kenya (KES), and South Africa (ZAR) via Paystack. All earnings are held for a 48-hour review period before becoming available for payout.`
  },
  {
    title: '8. Prohibited Conduct',
    content: `You agree not to:\n\n• Upload beats containing samples you do not have rights to\n• Engage in fraudulent transactions or chargebacks\n• Attempt to circumvent platform fees by conducting off-platform transactions\n• Scrape, crawl, or extract data from the Platform without permission\n• Use the Platform to distribute malware, spam, or illegal content\n• Impersonate other producers or misrepresent your identity\n\nViolation of these rules may result in immediate account suspension and forfeiture of any unpaid earnings.`
  },
  {
    title: '9. Intellectual Property',
    content: `BeatToday does not claim ownership of your beats. You retain all rights to your music. You grant BeatToday a limited, non-exclusive license to host, display, and transmit your beats solely for the purpose of operating the Platform and facilitating sales.\n\nThe BeatToday brand, logo, UI, and codebase are the exclusive property of BeatToday and may not be reproduced without written permission.`
  },
  {
    title: '10. Limitation of Liability',
    content: `BeatToday is provided "as is" without warranties of any kind. We do not guarantee uninterrupted access, error-free operation, or that the Platform will meet your specific requirements. To the maximum extent permitted by law, BeatToday shall not be liable for any indirect, incidental, or consequential damages arising from your use of the Platform.\n\nIn no event shall our total liability to you exceed the amount you have paid to BeatToday in the twelve (12) months preceding the claim.`
  },
  {
    title: '11. Termination',
    content: `Either party may terminate this agreement at any time. Upon termination, you lose access to the Platform. Any outstanding earnings at the time of termination will be paid out in accordance with normal payout procedures, provided there are no outstanding violations or disputes. BeatToday may terminate accounts without notice for violations of these Terms.`
  },
  {
    title: '12. Governing Law',
    content: `These Terms shall be governed by the laws of the Republic of Ghana, without regard to its conflict of law provisions. Any disputes shall be resolved through binding arbitration in Accra, Ghana, except where prohibited by law.`
  },
  {
    title: '13. Contact',
    content: `For questions about these Terms of Service, contact us at support@beattoday.com.`
  },
]

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-bg-primary pt-32 pb-24">
      <div className="max-w-3xl mx-auto px-6">

        <div className="mb-12">
          <div className="text-[10px] font-black uppercase tracking-widest text-text-muted mb-3">Legal</div>
          <h1 className="text-4xl md:text-5xl font-black text-white mb-4">Terms of Service</h1>
          <p className="text-text-muted text-sm">Last updated: {LAST_UPDATED}</p>
        </div>

        <div className="bg-accent-orange/5 border border-accent-orange/20 rounded-2xl p-5 mb-10">
          <p className="text-sm text-text-muted">
            <strong className="text-white">Summary:</strong> BeatToday connects beat producers and artists. Producers keep their copyright. Buyers get a license to use the beat. We take a fee on each sale (0–20% depending on plan). Payouts go directly to your bank twice a month. Play fair, and we&apos;ll do the same.
          </p>
        </div>

        <div className="space-y-10">
          {SECTIONS.map((section) => (
            <section key={section.title}>
              <h2 className="text-lg font-black text-white mb-3">{section.title}</h2>
              <div className="text-text-muted text-sm leading-relaxed whitespace-pre-line">{section.content}</div>
            </section>
          ))}
        </div>

        <div className="mt-16 pt-10 border-t border-white/5 flex flex-wrap gap-4 text-xs text-text-muted">
          <Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
          <Link href="/licensing" className="hover:text-white transition-colors">License Info</Link>
          <a href="mailto:support@beattoday.com" className="hover:text-white transition-colors">Contact Support</a>
        </div>
      </div>
    </div>
  )
}
