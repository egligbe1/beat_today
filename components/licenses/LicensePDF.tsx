import React from 'react'
import { Document, Page, Text, StyleSheet } from '@react-pdf/renderer'
const styles = StyleSheet.create({
  page: { padding: 48, fontFamily: 'Helvetica', fontSize: 10, lineHeight: 1.5 },
  title: { fontSize: 18, marginBottom: 20 },
  paragraph: { marginBottom: 8 },
})
/** Render the immutable agreement without inventing additional grant-of-rights text. */
export function AgreementPDF({ legalText }: { legalText: string }) {
  return <Document title="BeatToday License Agreement">
    <Page size="A4" style={styles.page} wrap>
      <Text style={styles.title}>BeatToday License Agreement</Text>
      {legalText.split('\n').map((paragraph, index) => <Text key={index} style={styles.paragraph}>{paragraph || ' '}</Text>)}
    </Page>
  </Document>
}
