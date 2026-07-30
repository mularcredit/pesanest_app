import React from 'react';
import {
    Page as PDFPage,
    Text as PDFText,
    View as PDFView,
    Document as PDFDocument,
    StyleSheet as PDFStyleSheet,
    Image as PDFImage,
    Font as PDFFont
} from '@react-pdf/renderer';

/**
 * GOOGLE SANS REPLACEMENT (Metric-Compatible Outfit)
 * We use Fontsource-hosted Outfit as a reliable, licensed, and visually identical 
 * alternative to the proprietary Google Sans.
 */
PDFFont.register({
    family: 'Google Sans',
    fonts: [
        { src: 'https://cdn.jsdelivr.net/npm/@fontsource/outfit@5.0.1/files/outfit-latin-400-normal.woff', fontWeight: 400 },
        { src: 'https://cdn.jsdelivr.net/npm/@fontsource/outfit@5.0.1/files/outfit-latin-500-normal.woff', fontWeight: 500 },
        { src: 'https://cdn.jsdelivr.net/npm/@fontsource/outfit@5.0.1/files/outfit-latin-600-normal.woff', fontWeight: 600 },
        { src: 'https://cdn.jsdelivr.net/npm/@fontsource/outfit@5.0.1/files/outfit-latin-700-normal.woff', fontWeight: 700 },
        { src: 'https://cdn.jsdelivr.net/npm/@fontsource/outfit@5.0.1/files/outfit-latin-900-normal.woff', fontWeight: 900 },
    ]
});

PDFFont.register({
    family: 'Inter',
    fonts: [
        { src: 'https://cdn.jsdelivr.net/npm/@fontsource/inter@5.0.1/files/inter-latin-400-normal.woff', fontWeight: 400 },
        { src: 'https://cdn.jsdelivr.net/npm/@fontsource/inter@5.0.1/files/inter-latin-700-normal.woff', fontWeight: 700 },
    ]
});

const styles = PDFStyleSheet.create({
    page: {
        padding: '20pt 40pt',
        fontFamily: 'Google Sans',
        fontSize: 10, // 10px base as requested
        color: '#333',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
    },
    watermark: {
        position: 'absolute',
        top: 250,
        left: 100,
        width: 400,
        height: 400,
        opacity: 0.04,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '2pt solid #eee',
        paddingBottom: 4,
        marginBottom: 8,
    },
    logoLeft: { width: 45, height: 45, objectFit: 'contain' },
    logoRight: { width: 85, height: 85, objectFit: 'contain' }, // Fixed expansion by adding fixed height + contain
    headerTextContainer: { flex: 1, textAlign: 'center', paddingHorizontal: 10 },
    republicText: { color: '#dc2626', fontSize: 9, fontWeight: 900, textTransform: 'uppercase' },
    authorityText: { color: '#000', fontSize: 9, fontWeight: 900, marginTop: 1 },
    contactStrip: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        borderBottom: '1pt solid #eee',
        paddingVertical: 3,
        marginBottom: 8,
        fontSize: 8,
    },
    contactItem: { flex: 1, textAlign: 'center' },
    contactLabel: { fontSize: 8, color: '#666', textTransform: 'uppercase', marginBottom: 1, fontWeight: 400 },
    contactValue: { fontSize: 8, color: '#333', fontWeight: 700 },
    titleBadge: {
        backgroundColor: '#dc2626',
        color: '#fff',
        padding: 4,
        textAlign: 'center',
        fontSize: 11,
        fontWeight: 700,
        textTransform: 'uppercase',
        borderRadius: 4,
        marginBottom: 6,
    },
    section: { marginBottom: 8 },
    sectionTitle: { fontSize: 9, fontWeight: 700, color: '#236A9E', textTransform: 'uppercase', marginBottom: 3 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 5 },
    gridItem: { flex: 1, minWidth: '30%' },
    label: { fontSize: 7, color: '#64748b', textTransform: 'uppercase', marginBottom: 2, fontWeight: 400 },
    value: { fontSize: 7.5, fontWeight: 700, color: '#1a1a1a' },
    infoBox: {
        border: '1pt solid #e2e8f0',
        borderRadius: 6,
        overflow: 'hidden',
        backgroundColor: '#f8fafc',
        marginBottom: 8,
    },
    boxHeader: {
        backgroundColor: '#236A9E',
        color: '#fff',
        padding: '2pt 10pt',
        fontSize: 9,
        fontWeight: 700,
        textTransform: 'uppercase',
    },
    boxContent: { padding: 6 },
    row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2, borderBottom: '1pt solid #e2e8f0' },
    rowLast: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
    rowLabel: { fontSize: 7.5, color: '#64748b' },
    rowValue: { fontSize: 7.5, color: '#1a1a1a', fontWeight: 700 },
    amountCard: {
        backgroundColor: '#10b981',
        padding: 10,
        borderRadius: 8,
        textAlign: 'center',
        color: '#fff',
        marginBottom: 10,
    },
    amountLabel: { fontSize: 10, fontWeight: 500, textTransform: 'uppercase', opacity: 0.9, marginBottom: 3 },
    amountValue: { fontSize: 24, fontWeight: 900 },
    paidBadge: {
        marginTop: 4,
        fontSize: 9,
        backgroundColor: 'rgba(255,255,255,0.2)',
        padding: '1pt 6pt',
        borderRadius: 10,
        alignSelf: 'center',
        fontWeight: 700,
    },
    notesBox: {
        backgroundColor: '#fef3c7',
        padding: 6,
        borderRadius: 4,
        fontSize: 8,
        color: '#333',
        marginBottom: 8,
        lineHeight: 1.3,
    },
    signatureSection: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 30, paddingTop: 10 },
    signatureBox: { width: '45%', textAlign: 'center' },
    signatureLine: { borderBottom: '1pt solid #333', height: 35, marginBottom: 5 },
    signatureLabel: { fontSize: 10, color: '#64748b', fontWeight: 700 },
    footer: {
        marginTop: 'auto',
        borderTop: '0.5pt solid #eee',
        paddingTop: 4,
    },
    footerText: { fontSize: 7, color: '#64748b', textAlign: 'center', marginBottom: 4, fontWeight: 500 },
    footerLogos: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    logoBrand: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    eServiceIcon: { width: 12, height: 12 },
    eServiceText: { fontSize: 8, fontWeight: 700 },
    dot: { color: '#dc2626' },
    southSudanBrand: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    flagIcon: { width: 16, height: 10 },
    proudText: { fontSize: 7, fontWeight: 700, textAlign: 'right' },
    centerFooterLogo: { height: 16, marginTop: 4 },
});

// Helper to format currency
const formatCurrency = (val: number) => `KSh ${Number(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const formatDate = (date: any) => {
    if (!date) return '';
    try {
        const d = date instanceof Date ? date : new Date(date);
        if (isNaN(d.getTime())) return String(date);
        return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch (e) {
        return String(date);
    }
}

const getImageUrl = (path: string, baseUrl: string) => {
    if (!path || path === '__REMOVE__') return '';
    if (path.startsWith('http')) return path;
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${baseUrl || ''}${cleanPath}`;
}

export const ReceiptPDF = ({ data, baseUrl, settings = {} }: { data: any, baseUrl: string, settings?: Record<string, string> }) => (
    <PDFDocument title={`Receipt - ${data?.receiptNo || 'DOC'}`}>
        <PDFPage size="A4" style={styles.page}>
            {process.env.NEXT_PUBLIC_APP_NAME !== "Pesanest" && (
                <PDFImage
                    src={getImageUrl(settings.watermark_logo || "/assets/branding/emblem_of_south_sudan-freelogovectors.net_-400x395.png", baseUrl)}
                    style={styles.watermark}
                />
            )}

            {process.env.NEXT_PUBLIC_APP_NAME === "Pesanest" ? (
                <PDFView style={[styles.header, { justifyContent: 'flex-start', paddingBottom: 10 }]}>
                    {settings.pesanest_receipt_logo !== '__REMOVE__' && (
                        <PDFImage src={getImageUrl(settings.pesanest_receipt_logo || "/pesanest/pesanest-dark.png", baseUrl)} style={{ height: 60, objectFit: 'contain' }} />
                    )}
                </PDFView>
            ) : (
                <PDFView style={styles.header}>
                    {settings.nra_receipt_logo_left !== '__REMOVE__' && (
                        <PDFImage src={getImageUrl(settings.nra_receipt_logo_left || "/assets/branding/south-sudan-revenue-authority-formerly-national-revenue-authority-586928.jpg", baseUrl)} style={styles.logoLeft} />
                    )}
                    <PDFView style={styles.headerTextContainer}>
                        <PDFText style={styles.republicText}>The Republic of South Sudan</PDFText>
                        <PDFText style={styles.authorityText}>Civil Aviation Authority</PDFText>
                    </PDFView>
                    {settings.caa_receipt_logo_right !== '__REMOVE__' && (
                        <PDFImage src={getImageUrl(settings.caa_receipt_logo_right || "/assets/branding/logo.857ac6f8bbd7.png", baseUrl)} style={styles.logoRight} />
                    )}
                </PDFView>
            )}

            <PDFView style={styles.contactStrip}>
                <PDFView style={[styles.contactItem, { textAlign: 'left' }]}>
                    <PDFText style={styles.contactLabel}>Site</PDFText>
                    <PDFText style={styles.contactValue}>www.pesanest.com</PDFText>
                </PDFView>
                <PDFView style={styles.contactItem}>
                    <PDFText style={styles.contactLabel}>Contact Number</PDFText>
                    <PDFText style={styles.contactValue}>+211 980 11 77 99</PDFText>
                </PDFView>
                <PDFView style={[styles.contactItem, { textAlign: 'right' }]}>
                    <PDFText style={styles.contactLabel}>Email</PDFText>
                    <PDFText style={styles.contactValue}>support@pesanest.com</PDFText>
                </PDFView>
            </PDFView>

            <PDFText style={styles.titleBadge}>Payment Receipt</PDFText>

            <PDFView style={styles.grid}>
                <PDFView style={styles.gridItem}>
                    <PDFText style={styles.label}>Receipt No.</PDFText>
                    <PDFText style={styles.value}>{data?.receiptNo || ''}</PDFText>
                </PDFView>
                <PDFView style={styles.gridItem}>
                    <PDFText style={styles.label}>Receipt Date</PDFText>
                    <PDFText style={styles.value}>{formatDate(data?.receiptDate)}</PDFText>
                </PDFView>
                <PDFView style={styles.gridItem}>
                    <PDFText style={styles.label}>Currency</PDFText>
                    <PDFText style={styles.value}>{data?.currency || 'KES'}</PDFText>
                </PDFView>
            </PDFView>

            <PDFView style={styles.infoBox}>
                <PDFText style={styles.boxHeader}>Payment Information</PDFText>
                <PDFView style={styles.boxContent}>
                    <PDFView style={styles.row}>
                        <PDFText style={styles.rowLabel}>Received From:</PDFText>
                        <PDFText style={styles.rowValue}>{data?.receivedFrom || ''}</PDFText>
                    </PDFView>
                    <PDFView style={styles.row}>
                        <PDFText style={styles.rowLabel}>Payment Method:</PDFText>
                        <PDFText style={styles.rowValue}>{data?.paymentMethod || ''}</PDFText>
                    </PDFView>
                    <PDFView style={styles.row}>
                        <PDFText style={styles.rowLabel}>Transaction Reference:</PDFText>
                        <PDFText style={styles.rowValue}>{data?.transactionRef || ''}</PDFText>
                    </PDFView>
                    <PDFView style={styles.rowLast}>
                        <PDFText style={styles.rowLabel}>Payment Date:</PDFText>
                        <PDFText style={styles.rowValue}>{formatDate(data?.paymentDate)}</PDFText>
                    </PDFView>
                </PDFView>
            </PDFView>

            <PDFView style={styles.section}>
                <PDFText style={styles.sectionTitle}>Invoice Details</PDFText>
                <PDFView style={{ gap: 4 }}>
                    <PDFView style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <PDFText style={{ fontSize: 10 }}>Invoice Number:</PDFText>
                        <PDFText style={{ fontSize: 10, fontWeight: 700 }}>{data?.invoiceNumber || ''}</PDFText>
                    </PDFView>
                    <PDFView style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <PDFText style={{ fontSize: 10 }}>Service Type:</PDFText>
                        <PDFText style={{ fontSize: 10, fontWeight: 700 }}>{data?.serviceType || ''}</PDFText>
                    </PDFView>
                    <PDFView style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <PDFText style={{ fontSize: 10 }}>Billing Period:</PDFText>
                        <PDFText style={{ fontSize: 10, fontWeight: 700 }}>{data?.billingPeriod || ''}</PDFText>
                    </PDFView>
                    <PDFView style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <PDFText style={{ fontSize: 10 }}>Original Amount:</PDFText>
                        <PDFText style={{ fontSize: 10, fontWeight: 700 }}>{formatCurrency(data?.originalAmount || 0)}</PDFText>
                    </PDFView>
                    {data?.creditNoteApplied > 0 && (
                        <PDFView style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <PDFText style={{ fontSize: 10 }}>Credit Note Applied:</PDFText>
                            <PDFText style={{ fontSize: 10, fontWeight: 700, color: '#dc2626' }}>{formatCurrency(data?.creditNoteApplied)}</PDFText>
                        </PDFView>
                    )}
                    <PDFView style={{ flexDirection: 'row', justifyContent: 'space-between', borderTop: '0.8pt solid #eee', paddingTop: 6 }}>
                        <PDFText style={{ fontSize: 11, fontWeight: 700 }}>Adjusted Amount Due:</PDFText>
                        <PDFText style={{ fontSize: 11, fontWeight: 700 }}>{formatCurrency(data?.adjustedAmountDue || 0)}</PDFText>
                    </PDFView>
                </PDFView>
            </PDFView>

            <PDFView style={styles.amountCard}>
                <PDFText style={styles.amountLabel}>Amount Paid</PDFText>
                <PDFText style={styles.amountValue}>{formatCurrency(data?.amountPaid || 0)}</PDFText>
                <PDFText style={styles.paidBadge}>✓ PAYMENT RECEIVED</PDFText>
            </PDFView>

            {data?.notes && (
                <PDFView style={styles.notesBox}>
                    <PDFText><PDFText style={{ fontWeight: 700, color: '#92400e' }}>Payment Confirmation: </PDFText>{data?.notes}</PDFText>
                </PDFView>
            )}

            <PDFView style={styles.signatureSection}>
                <PDFView style={styles.signatureBox}>
                    <PDFView style={styles.signatureLine} />
                    <PDFText style={styles.signatureLabel}>Received By</PDFText>
                </PDFView>
                <PDFView style={styles.signatureBox}>
                    <PDFView style={styles.signatureLine} />
                    <PDFText style={styles.signatureLabel}>Date</PDFText>
                </PDFView>
            </PDFView>

            <PDFView style={styles.footer}>
                <PDFText style={styles.footerText}>Thank you for your payment. We appreciate your continued partnership.</PDFText>
                <PDFView style={styles.footerLogos}>
                    <PDFView style={styles.logoBrand}>
                        {process.env.NEXT_PUBLIC_APP_NAME !== "Pesanest" && (
                            <>
                                <PDFImage src={getImageUrl("/assets/branding/eservice-logo.png", baseUrl)} style={styles.eServiceIcon} />
                                <PDFText style={styles.eServiceText}>eServices<PDFText style={{ color: '#dc2626' }}>.</PDFText>gov<PDFText style={{ color: '#dc2626' }}>.</PDFText>ss</PDFText>
                            </>
                        )}
                    </PDFView>
                    <PDFView style={{ alignItems: 'center' }}>
                        <PDFImage src={getImageUrl("/cpfooter.png", baseUrl)} style={styles.centerFooterLogo} />
                    </PDFView>
                    <PDFView style={styles.southSudanBrand}>
                        {process.env.NEXT_PUBLIC_APP_NAME !== "Pesanest" && (
                            <>
                                <PDFText style={styles.proudText}>Proudly South{"\n"}Sudanese</PDFText>
                                <PDFImage src={getImageUrl("/assets/branding/Flag_of_South_Sudan.svg.png", baseUrl)} style={styles.flagIcon} />
                            </>
                        )}
                    </PDFView>
                </PDFView>
            </PDFView>
        </PDFPage>
    </PDFDocument>
);

export const CreditNotePDF = ({ data, baseUrl, settings = {} }: { data: any, baseUrl: string, settings?: Record<string, string> }) => (
    <PDFDocument title={`Credit Note - ${data?.cnNumber || 'DOC'}`}>
        <PDFPage size="A4" style={styles.page}>
            {process.env.NEXT_PUBLIC_APP_NAME !== "Pesanest" && (
                <PDFImage
                    src={getImageUrl(settings.watermark_logo || "/assets/branding/emblem_of_south_sudan-freelogovectors.net_-400x395.png", baseUrl)}
                    style={styles.watermark}
                />
            )}

            {process.env.NEXT_PUBLIC_APP_NAME === "Pesanest" ? (
                <PDFView style={[styles.header, { justifyContent: 'flex-start', paddingBottom: 10 }]}>
                    {settings.pesanest_receipt_logo !== '__REMOVE__' && (
                        <PDFImage src={getImageUrl(settings.pesanest_receipt_logo || "/pesanest/pesanest-dark.png", baseUrl)} style={{ height: 60, objectFit: 'contain' }} />
                    )}
                </PDFView>
            ) : (
                <PDFView style={styles.header}>
                    {settings.nra_receipt_logo_left !== '__REMOVE__' && (
                        <PDFImage src={getImageUrl(settings.nra_receipt_logo_left || "/assets/branding/south-sudan-revenue-authority-formerly-national-revenue-authority-586928.jpg", baseUrl)} style={styles.logoLeft} />
                    )}
                    <PDFView style={styles.headerTextContainer}>
                        <PDFText style={styles.republicText}>The Republic of South Sudan</PDFText>
                        <PDFText style={styles.authorityText}>Civil Aviation Authority</PDFText>
                    </PDFView>
                    {settings.caa_receipt_logo_right !== '__REMOVE__' && (
                        <PDFImage src={getImageUrl(settings.caa_receipt_logo_right || "/assets/branding/logo.857ac6f8bbd7.png", baseUrl)} style={styles.logoRight} />
                    )}
                </PDFView>
            )}

            <PDFView style={[styles.contactStrip, { fontSize: 9, paddingVertical: 4 }]}>
                <PDFView style={[styles.contactItem, { textAlign: 'left' }]}>
                    <PDFText style={[styles.contactLabel, { fontSize: 8 }]}>Site</PDFText>
                    <PDFText style={[styles.contactValue, { fontSize: 9 }]}>www.pesanest.com</PDFText>
                </PDFView>
                <PDFView style={styles.contactItem}>
                    <PDFText style={[styles.contactLabel, { fontSize: 8 }]}>Contact Number</PDFText>
                    <PDFText style={[styles.contactValue, { fontSize: 9 }]}>+211 980 11 77 99</PDFText>
                </PDFView>
                <PDFView style={[styles.contactItem, { textAlign: 'right' }]}>
                    <PDFText style={[styles.contactLabel, { fontSize: 8 }]}>Email</PDFText>
                    <PDFText style={[styles.contactValue, { fontSize: 9 }]}>support@pesanest.com</PDFText>
                </PDFView>
            </PDFView>

            <PDFText style={styles.titleBadge}>Credit Note</PDFText>

            <PDFView style={[styles.grid, { marginBottom: 8 }]}>
                <PDFView style={styles.gridItem}>
                    <PDFText style={styles.label}>Original Invc. Ref</PDFText>
                    <PDFText style={styles.value}>{data?.invoiceRef || ''}</PDFText>
                </PDFView>
                <PDFView style={styles.gridItem}>
                    <PDFText style={styles.label}>Credit Note No.</PDFText>
                    <PDFText style={styles.value}>{data?.cnNumber || ''}</PDFText>
                </PDFView>
                <PDFView style={styles.gridItem}>
                    <PDFText style={styles.label}>Date</PDFText>
                    <PDFText style={styles.value}>{formatDate(data?.date)}</PDFText>
                </PDFView>
                <PDFView style={[styles.gridItem, { textAlign: 'right' }]}>
                    <PDFText style={styles.label}>Reason</PDFText>
                    <PDFText style={styles.value}>{data?.reason || ''}</PDFText>
                </PDFView>
            </PDFView>

            <PDFView style={{ flexDirection: 'row', gap: 15, marginBottom: 8 }}>
                <PDFView style={{ flex: 1, border: '1pt solid #e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
                    <PDFText style={{ backgroundColor: '#f8fafc', padding: '6pt 10pt', fontSize: 10, fontWeight: 700, borderBottom: '1pt solid #e2e8f0', color: '#333' }}>E-Government Services</PDFText>
                    <PDFText style={{ padding: 10, fontSize: 10, color: '#475569', lineHeight: 1.5 }}>
                        UAP Equatoria Tower{"\n"}
                        Hai Malakal Road{"\n"}
                        8th Floor, Wing B, Suite 2
                    </PDFText>
                </PDFView>
                <PDFView style={{ flex: 1, border: '1pt solid #e2e8f0', borderRadius: 4, overflow: 'hidden', textAlign: 'right' }}>
                    <PDFText style={{ backgroundColor: '#f8fafc', padding: '6pt 10pt', fontSize: 10, fontWeight: 700, borderBottom: '1pt solid #e2e8f0', color: '#333' }}>Credit To</PDFText>
                    <PDFView style={{ padding: 10 }}>
                        <PDFText style={{ fontSize: 10, fontWeight: 700, color: '#333' }}>{data?.customer?.name || ''}</PDFText>
                        <PDFText style={{ fontSize: 10, color: '#475569', lineHeight: 1.5 }}>{data?.customer?.address || ''}</PDFText>
                        <PDFText style={{ fontSize: 9, color: '#888', marginTop: 4 }}>TIN/Reg: {data?.customer?.tin || 'N/A'}</PDFText>
                    </PDFView>
                </PDFView>
            </PDFView>

            <PDFView style={{ marginBottom: 8 }}>
                <PDFView style={{ flexDirection: 'row', backgroundColor: '#236A9E', padding: 10 }}>
                    <PDFText style={{ flex: 2, color: '#fff', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Description</PDFText>
                    <PDFText style={{ flex: 0.5, color: '#fff', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Period</PDFText>
                    <PDFText style={{ flex: 1, color: '#fff', fontSize: 11, fontWeight: 700, textAlign: 'right', textTransform: 'uppercase' }}>Amount (KES)</PDFText>
                </PDFView>
                <PDFView style={{ flexDirection: 'row', padding: 8, borderBottom: '1pt solid #e2e8f0' }}>
                    <PDFView style={{ flex: 2 }}>
                        <PDFText style={{ fontSize: 10, color: '#334155' }}>{data?.reason || ''}</PDFText>
                        <PDFText style={{ fontSize: 9, color: '#666', marginTop: 2 }}>Ref: Invoice #{data?.invoiceRef || ''}</PDFText>
                    </PDFView>
                    <PDFText style={{ flex: 0.5, fontSize: 10, color: '#334155' }}>-</PDFText>
                    <PDFText style={{ flex: 1, fontSize: 10, color: '#334155', textAlign: 'right' }}>{formatCurrency(data?.amount || 0)}</PDFText>
                </PDFView>
            </PDFView>

            <PDFView style={{ alignItems: 'flex-end', marginTop: 15 }}>
                <PDFView style={{ backgroundColor: '#f8fafc', padding: 15, borderRadius: 6, width: 280 }}>
                    <PDFView style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                        <PDFText style={{ fontSize: 12 }}>Subtotal</PDFText>
                        <PDFText style={{ fontSize: 12 }}>{formatCurrency(data?.amount || 0)}</PDFText>
                    </PDFView>
                    <PDFView style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                        <PDFText style={{ fontSize: 11, color: '#666' }}>Tax / VAT (0%)</PDFText>
                        <PDFText style={{ fontSize: 11, color: '#666' }}>0.00</PDFText>
                    </PDFView>
                    <PDFView style={{ flexDirection: 'row', justifyContent: 'space-between', borderTop: '2pt solid #e2e8f0', paddingTop: 8, marginTop: 4 }}>
                        <PDFText style={{ fontSize: 16, fontWeight: 700, color: '#236A9E' }}>Total Credit KES</PDFText>
                        <PDFText style={{ fontSize: 16, fontWeight: 700, color: '#236A9E' }}>{formatCurrency(data?.amount || 0)}</PDFText>
                    </PDFView>
                </PDFView>
            </PDFView>

            <PDFView style={styles.footer}>
                <PDFText style={styles.footerText}>This document officially confirms the credit adjustment to your account.</PDFText>
                <PDFView style={styles.footerLogos}>
                    <PDFView style={styles.logoBrand}>
                        {process.env.NEXT_PUBLIC_APP_NAME !== "Pesanest" && (
                            <>
                                <PDFImage src={getImageUrl("/assets/branding/eservice-logo.png", baseUrl)} style={styles.eServiceIcon} />
                                <PDFText style={styles.eServiceText}>eServices<PDFText style={{ color: '#dc2626' }}>.</PDFText>gov<PDFText style={{ color: '#dc2626' }}>.</PDFText>ss</PDFText>
                            </>
                        )}
                    </PDFView>
                    <PDFView style={{ alignItems: 'center' }}>
                        <PDFImage src={getImageUrl("/cpfooter.png", baseUrl)} style={styles.centerFooterLogo} />
                    </PDFView>
                    <PDFView style={styles.southSudanBrand}>
                        {process.env.NEXT_PUBLIC_APP_NAME !== "Pesanest" && (
                            <>
                                <PDFText style={styles.proudText}>Proudly South{"\n"}Sudanese</PDFText>
                                <PDFImage src={getImageUrl("/assets/branding/Flag_of_South_Sudan.svg.png", baseUrl)} style={styles.flagIcon} />
                            </>
                        )}
                    </PDFView>
                </PDFView>
            </PDFView>
        </PDFPage>
    </PDFDocument>
);

export const StatementPDF = ({ data, baseUrl, settings = {} }: { data: any, baseUrl: string, settings?: Record<string, string> }) => (
    <PDFDocument title={`Statement - ${data?.statementNo || 'DOC'}`}>
        <PDFPage size="A4" style={[styles.page, { fontSize: 8, padding: '20pt 30pt' }]}>
            {process.env.NEXT_PUBLIC_APP_NAME !== "Pesanest" && (
                <PDFImage
                    src={getImageUrl(settings.watermark_logo || "/assets/branding/emblem_of_south_sudan-freelogovectors.net_-400x395.png", baseUrl)}
                    style={styles.watermark}
                />
            )}

            {process.env.NEXT_PUBLIC_APP_NAME === "Pesanest" ? (
                <PDFView style={[styles.header, { marginBottom: 6, paddingBottom: 6, justifyContent: 'flex-start' }]}>
                    {settings.pesanest_statement_logo !== '__REMOVE__' && (
                        <PDFImage src={getImageUrl(settings.pesanest_statement_logo || "/pesanest/pesanest-dark.png", baseUrl)} style={{ height: 60, objectFit: 'contain' }} />
                    )}
                </PDFView>
            ) : (
                <PDFView style={[styles.header, { marginBottom: 6, paddingBottom: 2 }]}>
                    {settings.nra_statement_logo_left !== '__REMOVE__' && (
                        <PDFImage src={getImageUrl(settings.nra_statement_logo_left || "/assets/branding/south-sudan-revenue-authority-formerly-national-revenue-authority-586928.jpg", baseUrl)} style={{ width: 40, height: 40, objectFit: 'contain' }} />
                    )}
                    <PDFView style={styles.headerTextContainer}>
                        <PDFText style={[styles.republicText, { fontSize: 8 }]}>The Republic of South Sudan</PDFText>
                        <PDFText style={[styles.authorityText, { fontSize: 8 }]}>Civil Aviation Authority</PDFText>
                    </PDFView>
                    {settings.caa_statement_logo_right !== '__REMOVE__' && (
                        <PDFImage src={getImageUrl(settings.caa_statement_logo_right || "/assets/branding/logo.857ac6f8bbd7.png", baseUrl)} style={{ width: 70, height: 70, objectFit: 'contain' }} />
                    )}
                </PDFView>
            )}

            <PDFView style={[styles.contactStrip, { fontSize: 7, marginBottom: 6, paddingVertical: 2 }]}>
                <PDFView style={[styles.contactItem, { textAlign: 'left' }]}>
                    <PDFText style={[styles.contactLabel, { fontSize: 6 }]}>Site</PDFText>
                    <PDFText style={[styles.contactValue, { fontSize: 7 }]}>www.pesanest.com</PDFText>
                </PDFView>
                <PDFView style={styles.contactItem}>
                    <PDFText style={[styles.contactLabel, { fontSize: 6 }]}>Contact Number</PDFText>
                    <PDFText style={[styles.contactValue, { fontSize: 7 }]}>+211 980 11 77 99</PDFText>
                </PDFView>
                <PDFView style={[styles.contactItem, { textAlign: 'right' }]}>
                    <PDFText style={[styles.contactLabel, { fontSize: 6 }]}>Email</PDFText>
                    <PDFText style={[styles.contactValue, { fontSize: 7 }]}>support@pesanest.com</PDFText>
                </PDFView>
            </PDFView>

            <PDFText style={[styles.titleBadge, { fontSize: 9, padding: 3, marginBottom: 6 }]}>Customer Statement of Account</PDFText>

            <PDFView style={[styles.grid, { marginBottom: 6 }]}>
                <PDFView style={styles.gridItem}>
                    <PDFText style={[styles.label, { fontSize: 6 }]}>Statement No.</PDFText>
                    <PDFText style={[styles.value, { fontSize: 8 }]}>{data?.statementNo || ''}</PDFText>
                </PDFView>
                <PDFView style={[styles.gridItem, { textAlign: 'center' }]}>
                    <PDFText style={[styles.label, { fontSize: 6 }]}>Statement Date</PDFText>
                    <PDFText style={[styles.value, { fontSize: 8 }]}>{formatDate(data?.date)}</PDFText>
                </PDFView>
                <PDFView style={[styles.gridItem, { textAlign: 'right' }]}>
                    <PDFText style={[styles.label, { fontSize: 6 }]}>Currency</PDFText>
                    <PDFText style={[styles.value, { fontSize: 8 }]}>KES</PDFText>
                </PDFView>
                <PDFView style={[styles.gridItem, { textAlign: 'right' }]}>
                    <PDFText style={[styles.label, { fontSize: 6 }]}>Statement Period</PDFText>
                    <PDFText style={[styles.value, { fontSize: 8 }]}>{data?.period || ''}</PDFText>
                </PDFView>
            </PDFView>

            <PDFView style={{ flexDirection: 'row', gap: 10, marginBottom: 8 }}>
                {/* Customer Details */}
                <PDFView style={{ flex: 1.2, border: '0.5pt solid #e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
                    <PDFText style={{ backgroundColor: '#f8fafc', padding: '3pt 6pt', fontSize: 8, fontWeight: 700, borderBottom: '0.5pt solid #e2e8f0' }}>Customer Details</PDFText>
                    <PDFView style={{ padding: '4pt 6pt' }}>
                        <PDFText style={{ fontSize: 8, fontWeight: 700, color: '#333' }}>{data?.customer?.name || ''}</PDFText>
                        <PDFText style={{ fontSize: 7.5, color: '#475569', marginTop: 1 }}>{data?.customer?.group || ''}</PDFText>
                        <PDFText style={{ fontSize: 7.5, color: '#475569' }}>{data?.customer?.country || ''}</PDFText>
                        <PDFText style={{ fontSize: 7, color: '#888', marginTop: 2 }}>Account Type: {data?.customer?.accountType || ''}</PDFText>
                    </PDFView>
                </PDFView>

                {/* Summary */}
                <PDFView style={{ flex: 1, backgroundColor: '#f8fafc', padding: '4pt 8pt', borderRadius: 4, border: '0.5pt solid #e2e8f0' }}>
                    <PDFText style={{ fontSize: 8, fontWeight: 700, color: '#236A9E', marginBottom: 3 }}>Statement Summary</PDFText>
                    <PDFView style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
                        <PDFText style={{ fontSize: 7.5, color: '#64748b' }}>Opening Balance</PDFText>
                        <PDFText style={{ fontSize: 7.5, fontWeight: 700 }}>{formatCurrency(data?.summary?.openingBalance || 0)}</PDFText>
                    </PDFView>
                    <PDFView style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
                        <PDFText style={{ fontSize: 7.5, color: '#64748b' }}>Total Charges (Overflight Services)</PDFText>
                        <PDFText style={{ fontSize: 7.5, fontWeight: 700 }}>{formatCurrency(data?.summary?.totalCharges || 0)}</PDFText>
                    </PDFView>
                    <PDFView style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
                        <PDFText style={{ fontSize: 7.5, color: '#64748b' }}>Total Payments Received</PDFText>
                        <PDFText style={{ fontSize: 7.5, fontWeight: 700 }}>({formatCurrency(data?.summary?.totalPayments || 0)})</PDFText>
                    </PDFView>
                    <PDFView style={{ flexDirection: 'row', justifyContent: 'space-between', borderTop: '0.5pt solid #cbd5e1', paddingTop: 3, marginTop: 2 }}>
                        <PDFText style={{ fontSize: 8, fontWeight: 700, color: '#236A9E' }}>Outstanding Balance</PDFText>
                        <PDFText style={{ fontSize: 8, fontWeight: 700, color: '#236A9E' }}>{formatCurrency(data?.summary?.outstandingBalance || 0)}</PDFText>
                    </PDFView>
                </PDFView>
            </PDFView>

            <PDFView style={{ marginBottom: 6 }}>
                <PDFView style={{ flexDirection: 'row', backgroundColor: '#236A9E', padding: '3pt 4pt' }}>
                    <PDFText style={{ width: '5%', color: '#fff', fontSize: 7, fontWeight: 700, textTransform: 'uppercase' }}>#</PDFText>
                    <PDFText style={{ width: '26%', color: '#fff', fontSize: 7, fontWeight: 700, textTransform: 'uppercase' }}>Description</PDFText>
                    <PDFText style={{ width: '14%', color: '#fff', fontSize: 7, fontWeight: 700, textTransform: 'uppercase' }}>Reference</PDFText>
                    <PDFText style={{ width: '15%', color: '#fff', fontSize: 7, fontWeight: 700, textTransform: 'uppercase' }}>Date</PDFText>
                    <PDFText style={{ width: '13%', color: '#fff', fontSize: 7, fontWeight: 700, textAlign: 'right', textTransform: 'uppercase' }}>Debit (KES)</PDFText>
                    <PDFText style={{ width: '13%', color: '#fff', fontSize: 7, fontWeight: 700, textAlign: 'right', textTransform: 'uppercase' }}>Credit (KES)</PDFText>
                    <PDFText style={{ width: '14%', color: '#fff', fontSize: 7, fontWeight: 700, textAlign: 'right', textTransform: 'uppercase' }}>Balance (KES)</PDFText>
                </PDFView>
                {data?.transactions?.map((tx: any, idx: number) => (
                    <PDFView key={idx} style={{ flexDirection: 'row', padding: '2pt 4pt', borderBottom: '0.5pt solid #e2e8f0' }} wrap={false}>
                        <PDFText style={{ width: '5%', fontSize: 7, color: '#334155' }}>{idx + 1}</PDFText>
                        <PDFText style={{ width: '26%', fontSize: 7, color: '#334155' }}>{tx.operator || ''}</PDFText>
                        <PDFText style={{ width: '14%', fontSize: 7, color: '#334155' }}>{tx.invoiceRef || ''}</PDFText>
                        <PDFText style={{ width: '15%', fontSize: 7, color: '#334155' }}>{tx.period || ''}</PDFText>
                        <PDFText style={{ width: '13%', fontSize: 7, color: '#334155', textAlign: 'right' }}>{tx.debit ? formatCurrency(tx.debit).replace('KSh ', '') : '—'}</PDFText>
                        <PDFText style={{ width: '13%', fontSize: 7, color: '#334155', textAlign: 'right' }}>{tx.credit ? formatCurrency(tx.credit).replace('KSh ', '') : '—'}</PDFText>
                        <PDFText style={{ width: '14%', fontSize: 7, color: '#334155', textAlign: 'right', fontWeight: 700 }}>{formatCurrency(tx.balance || 0).replace('KSh ', '')}</PDFText>
                    </PDFView>
                ))}
                <PDFView style={{ flexDirection: 'row', backgroundColor: '#fef9c3', padding: '4pt 4pt', borderTop: '2pt solid #236A9E' }} wrap={false}>
                    <PDFText style={{ width: '60%', textAlign: 'right', fontSize: 7, fontWeight: 700, textTransform: 'uppercase' }}>TOTALS</PDFText>
                    <PDFText style={{ width: '13%', textAlign: 'right', fontSize: 7, fontWeight: 700 }}>{formatCurrency(data?.summary?.totalCharges || 0).replace('KSh ', '')}</PDFText>
                    <PDFText style={{ width: '13%', textAlign: 'right', fontSize: 7, fontWeight: 700 }}>{formatCurrency(data?.summary?.totalPayments || 0).replace('KSh ', '')}</PDFText>
                    <PDFText style={{ width: '14%', textAlign: 'right', fontSize: 7, fontWeight: 700 }}>{formatCurrency(data?.summary?.outstandingBalance || 0).replace('KSh ', '')}</PDFText>
                </PDFView>
            </PDFView>

            {data?.notes && data?.notes.length > 0 && (
                <PDFView style={{ backgroundColor: '#f8fafc', padding: '4pt 8pt', borderLeft: '2pt solid #236A9E', marginBottom: 8 }}>
                    <PDFText style={{ fontSize: 7, fontWeight: 700, color: '#236A9E', marginBottom: 2 }}>Notes to Customer</PDFText>
                    {data.notes.map((note: string, idx: number) => (
                        <PDFText key={idx} style={{ fontSize: 7, marginBottom: 1, color: '#475569' }}>• {note}</PDFText>
                    ))}
                </PDFView>
            )}

            <PDFView style={{ marginTop: 'auto', marginBottom: 6 }}>
                <PDFView style={{ backgroundColor: '#dc2626', color: '#fff', padding: 10, borderRadius: 4, textAlign: 'center' }}>
                    <PDFText style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase', marginBottom: 2 }}>Total Outstanding Balance</PDFText>
                    <PDFText style={{ fontSize: 14, fontWeight: 900 }}>{formatCurrency(data?.summary?.outstandingBalance || 0)}</PDFText>
                    <PDFText style={{ fontSize: 8, marginTop: 4, opacity: 0.9 }}>Payment Due Upon Receipt</PDFText>
                </PDFView>
            </PDFView>

            <PDFView style={[styles.footer, { borderTop: '0.5pt solid #eee', paddingTop: 4 }]}>
                <PDFText style={[styles.footerText, { fontSize: 6 }]}>We value your business. Please contact us for any billing inquiries.</PDFText>
                <PDFView style={styles.footerLogos}>
                    <PDFView style={styles.logoBrand}>
                        {process.env.NEXT_PUBLIC_APP_NAME !== "Pesanest" && (
                            <>
                                <PDFImage src={getImageUrl(settings.statement_footer_logo_left || "/assets/branding/eservice-logo.png", baseUrl)} style={{ width: 10, height: 10 }} />
                                <PDFText style={[styles.eServiceText, { fontSize: 7 }]}>eServices<PDFText style={{ color: '#dc2626' }}>.</PDFText>gov<PDFText style={{ color: '#dc2626' }}>.</PDFText>ss</PDFText>
                            </>
                        )}
                    </PDFView>
                    <PDFView style={{ alignItems: 'center' }}>
                        <PDFImage src={getImageUrl(settings.statement_footer_logo_center || "/cpfooter.png", baseUrl)} style={[styles.centerFooterLogo, { height: 14 }]} />
                    </PDFView>
                    <PDFView style={styles.southSudanBrand}>
                        {process.env.NEXT_PUBLIC_APP_NAME !== "Pesanest" && (
                            <>
                                <PDFText style={[styles.proudText, { fontSize: 6 }]}>Proudly South{"\n"}Sudanese</PDFText>
                                <PDFImage src={getImageUrl(settings.statement_footer_logo_right || "/assets/branding/Flag_of_South_Sudan.svg.png", baseUrl)} style={{ width: 14, height: 9 }} />
                            </>
                        )}
                    </PDFView>
                </PDFView>
            </PDFView>
        </PDFPage>
    </PDFDocument>
);




