import { renderToBuffer } from '@react-pdf/renderer'
import { AgreementPDF } from '@/components/licenses/LicensePDF'
export async function generateAgreementPdf(legalText: string): Promise<Buffer> {
  if (!legalText.trim()) throw new Error('Agreement text is missing')
  return Buffer.from(await renderToBuffer(AgreementPDF({ legalText })))
}
