import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import type { ChallanWithItems } from '@/types/challan'
import type { Business } from '@/types/business'
import { formatDate } from '@utils/date'
import { paiseToWords } from '@utils/number-to-words'

export interface ChallanPDFProps {
  challan: ChallanWithItems
  business: Business
}

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 8.8,
    paddingTop: 24,
    paddingBottom: 24,
    paddingLeft: 24,
    paddingRight: 24,
    color: '#0F172A',
    backgroundColor: '#ffffff',
  },
  frame: {
    borderWidth: 1,
    borderColor: '#0F172A',
    backgroundColor: '#ffffff',
  },
  // Top Header
  topHeader: {
    padding: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#0F172A',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  brandTitle: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: '#1E3A5F',
    textTransform: 'uppercase',
  },
  businessDetails: {
    fontSize: 8,
    color: '#1E293B',
    marginTop: 1,
    lineHeight: 1.35,
  },
  // Banner
  bannerContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#0F172A',
    backgroundColor: '#EEF4FA',
  },
  bannerTitleBox: {
    width: '65%',
    padding: 6,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#0F172A',
  },
  bannerTitleText: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: '#1E3A5F',
    letterSpacing: 1.5,
  },
  bannerMetaBox: {
    width: '35%',
    padding: 4,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 1,
  },
  metaLabel: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#1E293B',
  },
  metaVal: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#0F172A',
  },
  // Parties Strip
  partiesRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#0F172A',
  },
  partiesCol: {
    width: '50%',
    padding: 5,
  },
  colHeader: {
    backgroundColor: '#1E3A5F',
    paddingHorizontal: 4,
    paddingVertical: 2,
    marginBottom: 4,
  },
  colHeaderText: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#ffffff',
  },
  partyLine: {
    fontSize: 8,
    color: '#1E293B',
    lineHeight: 1.35,
  },
  // Table
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#1E3A5F',
    borderBottomWidth: 1,
    borderBottomColor: '#0F172A',
  },
  thText: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#ffffff',
    padding: 3.5,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#0F172A',
  },
  tdText: {
    fontSize: 8.2,
    color: '#0F172A',
    padding: 3.5,
  },
  tdTextBold: {
    fontSize: 8.2,
    fontFamily: 'Helvetica-Bold',
    color: '#0F172A',
    padding: 3.5,
  },
  cellBorder: {
    borderRightWidth: 1,
    borderRightColor: '#0F172A',
  },
  // Totals & Footer
  bottomRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#0F172A',
  },
  wordsBox: {
    width: '60%',
    padding: 6,
    borderRightWidth: 1,
    borderRightColor: '#0F172A',
  },
  amountBox: {
    width: '40%',
    padding: 6,
    backgroundColor: '#F1F5F9',
  },
  footerRow: {
    flexDirection: 'row',
  },
  termsCol: {
    width: '60%',
    padding: 6,
    borderRightWidth: 1,
    borderRightColor: '#0F172A',
  },
  signCol: {
    width: '40%',
    padding: 6,
    justifyContent: 'space-between',
    alignItems: 'center',
    textAlign: 'center',
  },
})

export function ChallanPDF({ challan, business }: ChallanPDFProps) {
  const customer = challan.customerSnapshot
  const totalQty = challan.items.reduce((sum, it) => sum + (it.quantity / 100), 0)

  // Empty padding rows so challan looks balanced
  const blankRowsCount = Math.max(0, 5 - challan.items.length)

  return (
    <Document title={`Challan-${challan.challanNumber}`} author={business.name}>
      <Page size="A4" style={styles.page}>
        <View style={styles.frame} wrap={false}>
          {/* 1. Header */}
          <View style={styles.topHeader}>
            <View style={{ width: '55%' }}>
              <Text style={styles.brandTitle}>{business.name}</Text>
              <Text style={styles.businessDetails}>
                {[business.address, business.city, business.state, business.pin].filter(Boolean).join(', ')}
              </Text>
              <Text style={styles.businessDetails}>
                {business.phone ? `Phone: ${business.phone}` : ''}
                {business.phone && business.email ? ' | ' : ''}
                {business.email ? `Email: ${business.email}` : ''}
              </Text>
            </View>
            <View style={{ width: '42%', alignItems: 'flex-end' }}>
              <Text style={{ fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: '#0F172A' }}>
                GSTIN: {business.gstin || '—'}
              </Text>
              {business.state && (
                <Text style={styles.businessDetails}>State: {business.state}</Text>
              )}
            </View>
          </View>

          {/* 2. Banner */}
          <View style={styles.bannerContainer}>
            <View style={styles.bannerTitleBox}>
              <Text style={styles.bannerTitleText}>DELIVERY CHALLAN</Text>
            </View>
            <View style={styles.bannerMetaBox}>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Challan No:</Text>
                <Text style={styles.metaVal}>{challan.challanNumber}</Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Date:</Text>
                <Text style={styles.metaVal}>{formatDate(challan.challanDate)}</Text>
              </View>
              {challan.vehicleNumber && (
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Vehicle No:</Text>
                  <Text style={styles.metaVal}>{challan.vehicleNumber}</Text>
                </View>
              )}
            </View>
          </View>

          {/* 3. Dispatch / Customer Details */}
          <View style={styles.partiesRow}>
            <View style={[styles.partiesCol, styles.cellBorder]}>
              <View style={styles.colHeader}>
                <Text style={styles.colHeaderText}>Dispatched To (Customer)</Text>
              </View>
              <Text style={[styles.partyLine, { fontFamily: 'Helvetica-Bold', fontSize: 9 }]}>
                {customer?.name || 'Walk-in Customer'}
              </Text>
              {customer?.address && <Text style={styles.partyLine}>{customer.address}</Text>}
              <Text style={styles.partyLine}>
                {[customer?.pin, customer?.city, customer?.state].filter(Boolean).join(', ')}
              </Text>
              {customer?.phone && <Text style={styles.partyLine}>Contact: {customer.phone}</Text>}
              {customer?.gstin && <Text style={styles.partyLine}>GSTIN: {customer.gstin}</Text>}
            </View>

            <View style={styles.partiesCol}>
              <View style={styles.colHeader}>
                <Text style={styles.colHeaderText}>Transport & Delivery Details</Text>
              </View>
              <Text style={styles.partyLine}>
                <Text style={{ fontFamily: 'Helvetica-Bold' }}>Transporter: </Text>
                {challan.transporterName || 'Self / Direct'}
              </Text>
              <Text style={styles.partyLine}>
                <Text style={{ fontFamily: 'Helvetica-Bold' }}>Transport Mode: </Text>
                {challan.transportMode || 'Road'}
              </Text>
              <Text style={styles.partyLine}>
                <Text style={{ fontFamily: 'Helvetica-Bold' }}>L.R. / R.R. No: </Text>
                {challan.lrRrNumber || '—'}
              </Text>
              {challan.notes && (
                <Text style={[styles.partyLine, { marginTop: 2, fontStyle: 'italic' }]}>
                  Notes: {challan.notes}
                </Text>
              )}
            </View>
          </View>

          {/* 4. Products Table (NO GST) */}
          <View style={styles.tableHeader}>
            <View style={[{ width: '8%' }, styles.cellBorder]}>
              <Text style={[styles.thText, { textAlign: 'center' }]}>#</Text>
            </View>
            <View style={[{ width: '42%' }, styles.cellBorder]}>
              <Text style={styles.thText}>Item Description</Text>
            </View>
            <View style={[{ width: '15%' }, styles.cellBorder]}>
              <Text style={[styles.thText, { textAlign: 'center' }]}>HSN/SAC</Text>
            </View>
            <View style={[{ width: '11%' }, styles.cellBorder]}>
              <Text style={[styles.thText, { textAlign: 'center' }]}>Qty</Text>
            </View>
            <View style={[{ width: '9%' }, styles.cellBorder]}>
              <Text style={[styles.thText, { textAlign: 'center' }]}>Unit</Text>
            </View>
            <View style={[{ width: '15%' }]}>
              <Text style={[styles.thText, { textAlign: 'right' }]}>Amount (Rs.)</Text>
            </View>
          </View>

          {challan.items.map((it, idx) => (
            <View key={it.id || idx} style={styles.tableRow}>
              <View style={[{ width: '8%' }, styles.cellBorder]}>
                <Text style={[styles.tdText, { textAlign: 'center' }]}>{idx + 1}</Text>
              </View>
              <View style={[{ width: '42%' }, styles.cellBorder]}>
                <Text style={styles.tdTextBold}>{it.description}</Text>
              </View>
              <View style={[{ width: '15%' }, styles.cellBorder]}>
                <Text style={[styles.tdText, { textAlign: 'center' }]}>{it.hsnCode || '—'}</Text>
              </View>
              <View style={[{ width: '11%' }, styles.cellBorder]}>
                <Text style={[styles.tdText, { textAlign: 'center', fontFamily: 'Helvetica-Bold' }]}>
                  {(it.quantity / 100).toFixed(0)}
                </Text>
              </View>
              <View style={[{ width: '9%' }, styles.cellBorder]}>
                <Text style={[styles.tdText, { textAlign: 'center' }]}>{it.unit || 'Nos'}</Text>
              </View>
              <View style={[{ width: '15%' }]}>
                <Text style={[styles.tdTextBold, { textAlign: 'right' }]}>
                  {(it.totalAmount / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </Text>
              </View>
            </View>
          ))}

          {/* Blank padding rows */}
          {Array.from({ length: blankRowsCount }).map((_, bIdx) => (
            <View key={`b-${bIdx}`} style={[styles.tableRow, { minHeight: 16 }]}>
              <View style={[{ width: '8%' }, styles.cellBorder]}><Text style={styles.tdText}> </Text></View>
              <View style={[{ width: '42%' }, styles.cellBorder]}><Text style={styles.tdText}> </Text></View>
              <View style={[{ width: '15%' }, styles.cellBorder]}><Text style={styles.tdText}> </Text></View>
              <View style={[{ width: '11%' }, styles.cellBorder]}><Text style={styles.tdText}> </Text></View>
              <View style={[{ width: '9%' }, styles.cellBorder]}><Text style={styles.tdText}> </Text></View>
              <View style={{ width: '15%' }}><Text style={styles.tdText}> </Text></View>
            </View>
          ))}

          {/* Table Totals */}
          <View style={[styles.tableRow, { backgroundColor: '#F1F5F9' }]}>
            <View style={[{ width: '65%' }, styles.cellBorder, { padding: 3 }]}>
              <Text style={{ fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: '#1E293B' }}>
                Total Dispatched Items
              </Text>
            </View>
            <View style={[{ width: '11%' }, styles.cellBorder]}>
              <Text style={[styles.tdTextBold, { textAlign: 'center' }]}>
                {totalQty % 1 === 0 ? totalQty.toFixed(0) : totalQty.toFixed(2)}
              </Text>
            </View>
            <View style={[{ width: '9%' }, styles.cellBorder]}><Text> </Text></View>
            <View style={{ width: '15%' }}>
              <Text style={[styles.tdTextBold, { textAlign: 'right', fontSize: 9 }]}>
                Rs. {(challan.totalAmount / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </Text>
            </View>
          </View>

          {/* 5. Amount in words & Totals */}
          <View style={styles.bottomRow}>
            <View style={styles.wordsBox}>
              <Text style={{ fontSize: 7.5, color: '#64748B', fontFamily: 'Helvetica-Bold' }}>
                AMOUNT IN WORDS
              </Text>
              <Text style={{ fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: '#0F172A', marginTop: 2 }}>
                {paiseToWords(challan.totalAmount)}
              </Text>
            </View>
            <View style={styles.amountBox}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#1E293B' }}>
                  Grand Total:
                </Text>
                <Text style={{ fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#0F172A' }}>
                  Rs. {(challan.totalAmount / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </Text>
              </View>
            </View>
          </View>

          {/* 6. Terms & Signature */}
          <View style={styles.footerRow}>
            <View style={styles.termsCol}>
              <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#1E3A5F', marginBottom: 2 }}>
                Delivery Declaration
              </Text>
              <Text style={{ fontSize: 7.5, color: '#475569', lineHeight: 1.3 }}>
                1. Goods dispatched as per delivery specifications above.
              </Text>
              <Text style={{ fontSize: 7.5, color: '#475569', lineHeight: 1.3 }}>
                2. Goods received in sound condition. Subject to local jurisdiction.
              </Text>
            </View>
            <View style={styles.signCol}>
              <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#1E293B' }}>
                For {business.name}
              </Text>
              <View style={{ height: 20 }} />
              <Text style={{ fontSize: 7.5, fontFamily: 'Helvetica-Bold', borderTopWidth: 1, borderTopColor: '#0F172A', width: '80%', paddingTop: 2 }}>
                Authorized Signatory
              </Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  )
}
