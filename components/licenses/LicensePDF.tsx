import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer'

// Define styles for the PDF
const styles = StyleSheet.create({
  page: {
    padding: 60,
    backgroundColor: '#fff',
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 40,
    borderBottom: '2pt solid #030303',
    paddingBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'black',
    textTransform: 'uppercase',
    color: '#030303',
  },
  subtitle: {
    fontSize: 10,
    color: '#666',
    marginTop: 4,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    marginBottom: 8,
    color: '#030303',
  },
  text: {
    fontSize: 10,
    lineHeight: 1.6,
    color: '#333',
  },
  bold: {
    fontWeight: 'bold',
    color: '#000',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  footer: {
    position: 'absolute',
    bottom: 40,
    left: 60,
    right: 60,
    borderTop: '1pt solid #eee',
    paddingTop: 10,
    fontSize: 8,
    color: '#999',
    textAlign: 'center',
  },
})

interface LicensePdfProps {
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

export const LicensePDF = ({
  orderId,
  buyerName,
  producerName,
  trackTitle,
  licenseType,
  terms,
  date
}: LicensePdfProps) => (
  <Document>
    <Page size="A4" style={styles.page}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>BEATTODAY</Text>
        <Text style={styles.subtitle}>OFFICIAL LICENSE AGREEMENT</Text>
      </View>

      {/* Summary Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Agreement Summary</Text>
        <View style={styles.row}>
          <Text style={styles.text}>License Type:</Text>
          <Text style={[styles.text, styles.bold]}>{licenseType}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.text}>Effective Date:</Text>
          <Text style={[styles.text, styles.bold]}>{date}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.text}>Order ID:</Text>
          <Text style={[styles.text, styles.bold]}>{orderId}</Text>
        </View>
      </View>

      {/* Parties Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Parties</Text>
        <View style={styles.row}>
          <Text style={styles.text}>Producer (Licensor):</Text>
          <Text style={[styles.text, styles.bold]}>{producerName}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.text}>Artist (Licensee):</Text>
          <Text style={[styles.text, styles.bold]}>{buyerName}</Text>
        </View>
      </View>

      {/* Track Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Licensed Composition</Text>
        <View style={styles.row}>
          <Text style={styles.text}>Track Title:</Text>
          <Text style={[styles.text, styles.bold]}>{'"' + trackTitle + '"'}</Text>
        </View>
      </View>

      {/* Rights Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Grant of Rights</Text>
        <Text style={styles.text}>
          The Licensor hereby grants the Licensee a non-exclusive, non-transferable right to use the Licensed Composition for the following commercial and non-commercial purposes:
        </Text>
        <View style={{ marginTop: 8, paddingLeft: 10 }}>
          <Text style={styles.text}>• Audio Streaming: Up to {terms.streamingLimit} streams.</Text>
          <Text style={styles.text}>• Music Videos: Up to {terms.mvLimit} video(s).</Text>
          <Text style={styles.text}>• Radio Broadcasting: {terms.radioRights}.</Text>
          <Text style={styles.text}>• Distribution: Units as specified in the platform&apos;s standard terms.</Text>
        </View>
      </View>

      {/* Legal Disclaimer */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Restrictions & Ownership</Text>
        <Text style={styles.text}>
          Licensor retains 100% of the copyright in and to the Licensed Composition. Licensee may not sell, lease, or transfer this agreement to any third party. Any violation of these terms will automatically terminate this license.
        </Text>
      </View>

      {/* Footer */}
      <Text style={styles.footer}>
        BeatToday Marketplace - Digital Signature Verified - Agreement #: {orderId}
      </Text>
    </Page>
  </Document>
)
