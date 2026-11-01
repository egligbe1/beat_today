import { Resend } from 'resend'
import { escapeHtml } from '@/lib/security'

const resend = new Resend(process.env.RESEND_API_KEY)

interface EmailPayload {
  to: string
  buyerName: string
  trackTitle: string
  contractHtml: string
  idempotencyKey?: string
  downloadUrl?: string
  attachments?: Array<{
    filename: string
    content: Buffer | string
  }>
}

export async function sendLicenseEmail({ to, buyerName, trackTitle, contractHtml, downloadUrl, attachments, idempotencyKey }: EmailPayload) {
  try {
    const { data, error } = await resend.emails.send({
      from: 'BeatToday <orders@beattoday.com>', // Ensure this domain is verified in Resend
      to: [to],
      subject: `📜 Your License Agreement: ${trackTitle}`,
      attachments: attachments,
      html: `
        <div style="font-family: sans-serif; background-color: #030303; color: white; padding: 40px; border-radius: 20px;">
          <h1 style="color: #FF5500; text-transform: uppercase; font-weight: 900;">Order Confirmed</h1>
          <p>Hi ${escapeHtml(buyerName)},</p>
          <p>Thank you for your purchase on <strong>BeatToday</strong>. Your license agreement for <strong>${escapeHtml(trackTitle)}</strong> is attached below.</p>
          
          <div style="background-color: #111; padding: 20px; border: 1px solid #333; border-radius: 12px; margin: 20px 0; color: #ccc; font-size: 14px;">
            ${escapeHtml(contractHtml).replace(/\n/g, '<br/>')}
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
    }, idempotencyKey ? { idempotencyKey } : undefined)

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

export async function sendGuestRecoveryEmail(to:string,links:{reference:string;url:string}[]){
 const items=links.map(item=>`<li style="margin:16px 0"><a href="${escapeHtml(item.url)}">Open purchase ${escapeHtml(item.reference)}</a></li>`).join('')
 const {error}=await resend.emails.send({from:'BeatToday <orders@beattoday.com>',to:[to],subject:'Your BeatToday purchase links',html:`<div style="font-family:sans-serif;line-height:1.6"><h1>Your purchases</h1><p>Use these private links to open your completed guest purchases. Keep them private.</p><ul>${items}</ul><p>If you have added a purchase to an account, sign in to your BeatToday library instead.</p></div>`})
 if(error)throw new Error('Purchase recovery email was not accepted')
}

export async function sendGuestClaimEmail(to:string,url:string){
 const {error}=await resend.emails.send({from:'BeatToday <orders@beattoday.com>',to:[to],subject:'Confirm your BeatToday purchase library',html:`<div style="font-family:sans-serif;line-height:1.6"><h1>Add your guest purchases</h1><p>Confirm that you own this email to add completed guest purchases to your BeatToday account. This confirmation expires in 15 minutes.</p><p><a href="${escapeHtml(url)}">Confirm my purchase library</a></p><p>If you did not request this, ignore this email. Your purchases have not been moved.</p></div>`})
 if(error)throw new Error('Purchase confirmation email was not accepted')
}
