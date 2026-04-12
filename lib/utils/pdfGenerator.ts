import { renderToBuffer } from '@react-pdf/renderer'
import { ReactElement } from 'react'

/**
 * Generates a PDF buffer from a @react-pdf/renderer component.
 * This should only be called on the server (Node.js).
 */
export async function generatePdfBuffer(component: ReactElement): Promise<Buffer> {
  try {
    const buffer = await renderToBuffer(component)
    return Buffer.from(buffer)
  } catch (error) {
    console.error('Error generating PDF buffer:', error)
    throw error
  }
}

interface LicenseData {
  orderId: string
  buyerName: string
  producerName: string
  trackTitle: string
  licenseType: string
  terms: {
    streamingLimit: string
    mvLimit: string
    radioRights: string
    nonProfit: boolean
  }
  date: string
}

export async function generateLicensePdf(data: LicenseData): Promise<Buffer> {
  // We dynamic import here to ensure it's only loaded on the server
  const { LicensePDF } = await import('@/components/licenses/LicensePDF')
  const { createElement } = await import('react')
  
  const element = createElement(LicensePDF, data)
  return await generatePdfBuffer(element)
}
