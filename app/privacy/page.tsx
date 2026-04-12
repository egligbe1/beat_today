import Link from 'next/link'

export const metadata = {
  title: 'Privacy Policy — BeatToday',
  description: 'BeatToday Privacy Policy. Learn how we collect, use, and protect your data.',
}

const LAST_UPDATED = 'April 9, 2025'

const SECTIONS = [
  {
    title: '1. Introduction',
    content: `BeatToday ("we", "us", "our") is committed to protecting your privacy. This Privacy Policy explains what data we collect, why we collect it, how we use it, and your rights regarding your information. By using BeatToday, you agree to the collection and use of information as described in this policy.`
  },
  {
    title: '2. Information We Collect',
    content: `We collect the following categories of information:\n\n**Account Information:** When you register, we collect your email address, display name, and handle. Producers additionally provide their country and payout bank details.\n\n**Transaction Data:** When beats are purchased, we record transaction amounts, license types, timestamps, and Paystack payment references.\n\n**Usage Data:** We collect data on beat plays, searches, page views, and feature interactions. This helps us improve the platform and surface relevant content.\n\n**Device Data:** IP address, browser type, operating system, and general location (city/country level). We use IP-based location to suggest a default currency.\n\n**Uploaded Content:** Beat files, cover artwork, and metadata that producers upload to the platform.`
  },
  {
    title: '3. How We Use Your Information',
    content: `We use collected data to:\n\n• Operate and improve the BeatToday platform\n• Process payments and facilitate beat sales\n• Send payouts to producers via bank transfer\n• Send transactional notifications (sales, downloads, payout confirmations)\n• Detect and prevent fraud, abuse, and unauthorized access\n• Generate anonymized analytics for platform improvements\n• Comply with legal obligations\n\nWe do not sell your personal data to third parties.`
  },
  {
    title: '4. Payment Processing',
    content: `All payments are processed by Paystack. When you make a purchase or set up payout bank details, your financial information is transmitted directly to Paystack's secure servers. BeatToday stores only the Paystack payment reference and the last 4 digits of your bank account number for display purposes. We never store full card numbers or full bank account numbers.\n\nPaystack's privacy policy is available at paystack.com/privacy.`
  },
  {
    title: '5. Data Sharing',
    content: `We share your data only with:\n\n• **Paystack:** For payment processing and bank transfers\n• **Supabase:** Our database and authentication infrastructure\n• **Vercel:** Our hosting and serverless functions infrastructure\n• **Law Enforcement:** When legally required to do so\n\nWe do not share your data with advertisers or marketing companies.`
  },
  {
    title: '6. Data Retention',
    content: `Account data is retained for as long as your account is active. Transaction records are retained for a minimum of 7 years for financial compliance purposes. Uploaded beat files are retained until the producer manually deletes them or their account is terminated. You may request deletion of your account at any time; some data may be retained as required by law.`
  },
  {
    title: '7. Cookies and Tracking',
    content: `BeatToday uses minimal cookies:\n\n• **Authentication cookies:** Essential for keeping you logged in. Cannot be disabled.\n• **Preference cookies:** Store your currency preference. Can be cleared from your browser.\n\nWe do not use advertising cookies, third-party tracking pixels, or cross-site tracking. We do not use Google Analytics or Facebook Pixel.`
  },
  {
    title: '8. Your Rights',
    content: `Depending on your location, you may have the following rights:\n\n• **Access:** Request a copy of the personal data we hold about you\n• **Correction:** Request correction of inaccurate personal data\n• **Deletion:** Request deletion of your account and associated data\n• **Portability:** Request your data in a machine-readable format\n• **Opt-out of marketing emails:** Use the unsubscribe link in any marketing email\n\nTo exercise any of these rights, contact us at support@beattoday.com. We will respond within 30 days.`
  },
  {
    title: '9. Security',
    content: `We implement industry-standard security measures including:\n\n• All data transmitted via HTTPS/TLS encryption\n• Supabase Row-Level Security (RLS) so users can only access their own data\n• Paystack PCI-DSS compliant payment processing\n• Service role keys never exposed to the client\n• Regular security audits\n\nNo system is perfectly secure. In the event of a data breach affecting your personal information, we will notify you within 72 hours of becoming aware.`
  },
  {
    title: '10. Children\'s Privacy',
    content: `BeatToday is not directed to children under 13. We do not knowingly collect personal information from children under 13. If you believe we have inadvertently collected such information, please contact us immediately and we will delete it.`
  },
  {
    title: '11. Changes to This Policy',
    content: `We may update this Privacy Policy periodically. When we make material changes, we will notify you by email or by posting a notice on the Platform. Your continued use of BeatToday after changes take effect constitutes acceptance of the updated policy.`
  },
  {
    title: '12. Contact',
    content: `For privacy-related questions or requests, contact our privacy team at:\n\nEmail: support@beattoday.com\nAddress: Accra, Ghana`
  },
]

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-bg-primary pt-32 pb-24">
      <div className="max-w-3xl mx-auto px-6">

        <div className="mb-12">
          <div className="text-[10px] font-black uppercase tracking-widest text-text-muted mb-3">Legal</div>
          <h1 className="text-4xl md:text-5xl font-black text-white mb-4">Privacy Policy</h1>
          <p className="text-text-muted text-sm">Last updated: {LAST_UPDATED}</p>
        </div>

        <div className="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-5 mb-10">
          <p className="text-sm text-text-muted">
            <strong className="text-white">Short version:</strong> We collect only what we need to run the platform. We don&apos;t sell your data. Payments go through Paystack. You can request your data or deletion at any time.
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
          <Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link>
          <Link href="/licensing" className="hover:text-white transition-colors">License Info</Link>
          <a href="mailto:support@beattoday.com" className="hover:text-white transition-colors">Contact Support</a>
        </div>
      </div>
    </div>
  )
}
