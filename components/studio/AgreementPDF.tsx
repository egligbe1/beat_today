import React from 'react'
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import type { StudioAgreement } from '@/lib/types'
import { AGREEMENT_FIELDS, studioMoney } from '@/lib/studio/domain'
const styles = StyleSheet.create({
  page: { padding: 42, fontSize: 10, fontFamily: 'Helvetica', lineHeight: 1.55, color: '#222' },
  title: { fontSize: 22, fontFamily: 'Helvetica-Bold', marginBottom: 8 },
  meta: { color: '#666', fontSize: 9, marginBottom: 18 },
  section: { marginBottom: 15 }, label: { fontFamily: 'Helvetica-Bold', fontSize: 10, marginBottom: 5 },
  footer: { position: 'absolute', bottom: 20, left: 42, right: 42, fontSize: 8, color: '#888' },
})
export default function AgreementPDF({ agreement: a }: { agreement: StudioAgreement }) {
  const t = a.terms
  return <Document title={`${t.project_title} — agreement v${a.version}`} author="BeatToday">
    <Page size="A4" style={styles.page} wrap>
      <Text style={styles.meta}>BEATTODAY STUDIO · AGREEMENT VERSION {a.version}</Text>
      <Text style={styles.title}>{t.project_title}</Text>
      <Text style={styles.meta}>{t.studio_name} | {t.producer_name} and {t.artist_name}</Text>
      {AGREEMENT_FIELDS.map(f => <View key={f.key} style={styles.section}><Text style={styles.label} minPresenceAhead={30}>{f.label}</Text><Text>{t[f.key]}</Text></View>)}
      {!!t.milestones?.length && <View style={styles.section}><Text style={styles.label}>Milestones</Text>{t.milestones.map((m, i) => <Text key={i}>{m.title}{m.due_date ? ` — ${m.due_date}` : ''}</Text>)}</View>}
      <View style={styles.section}><Text style={styles.label}>Commercial terms</Text><Text>Total: {studioMoney(t.total_minor)} | Deposit: {studioMoney(t.deposit_minor)}</Text><Text>Included revision rounds: {t.revision_rounds}</Text><Text>Agreement amounts are not payment receipts.</Text></View>
      <View style={styles.section}><Text style={styles.label}>Confirmation record</Text><Text>Status of this version: {a.status}</Text><Text>Producer ({t.producer_id}) confirmed: {a.producer_accepted_at}</Text><Text>Artist ({t.artist_id}) confirmed: {a.artist_accepted_at || 'Not confirmed'}</Text>{a.changes_requested && <Text>Changes requested: {a.changes_requested}</Text>}<Text>SHA-256: {a.content_hash}</Text></View>
      <Text fixed style={styles.footer} render={({ pageNumber, totalPages }) => `BeatToday · Agreement v${a.version} · Page ${pageNumber} of ${totalPages}`} />
    </Page>
  </Document>
}
