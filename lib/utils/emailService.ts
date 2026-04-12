import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

interface EmailPayload {
  to: string
  buyerName: string
  trackTitle: string
  contractHtml: string
  downloadUrl?: string
  attachments?: Array<{
    filename: string
    content: Buffer | string
  }>
}

export async function sendLicenseEmail({ to, buyerName, trackTitle, contractHtml, downloadUrl, attachments }: EmailPayload) {
  try {
    const { data, error } = await resend.emails.send({
      from: 'BeatToday <orders@beattoday.com>', // Ensure this domain is verified in Resend
      to: [to],
      subject: `📜 Your License Agreement: ${trackTitle}`,
      attachments: attachments,
      html: `
        <div style="font-family: sans-serif; background-color: #030303; color: white; padding: 40px; border-radius: 20px;">
          <h1 style="color: #FF5500; text-transform: uppercase; font-weight: 900;">Order Confirmed</h1>
          <p>Hi ${buyerName},</p>
          <p>Thank you for your purchase on <strong>BeatToday</strong>. Your license agreement for <strong>${trackTitle}</strong> is attached below.</p>
          
          <div style="background-color: #111; padding: 20px; border: 1px solid #333; border-radius: 12px; margin: 20px 0; color: #ccc; font-size: 14px;">
            ${contractHtml.replace(/\n/g, '<br/>')}
          </div>

          ${downloadUrl ? `
          <a href="${downloadUrl}" style="background-color: #FF5500; color: white; padding: 16px 32px; border-radius: 12px; text-decoration: none; font-weight: bold; display: inline-block; text-transform: uppercase;">
             Download Your Files
          </a>
          ` : ''}

          <p style="font-size: 12px; color: #666; margin-top: 40px;">
            This is an automated legal document. Please keep this email for your records.
          </p>
        </div>
      `,
    })

    if (error) {
      console.error("Resend Error:", error)
      return { success: false, error }
    }

    return { success: true, data }
  } catch (err) {
    console.error("Email fatal error:", err)
    return { success: false, error: err }
  }
}
