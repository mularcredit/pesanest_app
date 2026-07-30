import React from 'react';
import {
    Page as PDFPage,
    Text as PDFText,
    View as PDFView,
    Document as PDFDocument,
    StyleSheet as PDFStyleSheet,
    Image as PDFImage,
    Font as PDFFont,
} from '@react-pdf/renderer';

/**
 * GOOGLE SANS FONT (via @fontsource npm CDN — woff format for react-pdf compatibility)
 * react-pdf requires woff (not woff2) to avoid "Offset is outside the bounds of the DataView" error.
 */
PDFFont.register({
    family: 'GoogleSans',
    fonts: [
        { src: 'https://cdn.jsdelivr.net/npm/@fontsource/google-sans@5.2.1/files/google-sans-latin-400-normal.woff', fontWeight: 400 },
        { src: 'https://cdn.jsdelivr.net/npm/@fontsource/google-sans@5.2.1/files/google-sans-latin-500-normal.woff', fontWeight: 500 },
        { src: 'https://cdn.jsdelivr.net/npm/@fontsource/google-sans@5.2.1/files/google-sans-latin-700-normal.woff', fontWeight: 700 },
    ]
});

const px = (p: number) => p * 0.75;

// Color interpolation for smooth gradients
const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
};

const lerpColor = (c1: string, c2: string, t: number) => {
    const rgb1 = hexToRgb(c1);
    const rgb2 = hexToRgb(c2);
    if (!rgb1 || !rgb2) return c1;
    const r = Math.round(rgb1.r + (rgb2.r - rgb1.r) * t);
    const g = Math.round(rgb1.g + (rgb2.g - rgb1.g) * t);
    const b = Math.round(rgb1.b + (rgb2.b - rgb1.b) * t);
    return `rgb(${r}, ${g}, ${b})`;
};

const styles = PDFStyleSheet.create({
    page: {
        fontFamily: 'GoogleSans',
        fontSize: px(11),
        color: '#111827',
        backgroundColor: '#ffffff',
    },
    // Header
    header: {
        position: 'relative',
        height: px(180),
        borderBottomWidth: px(1),
        borderBottomColor: '#E5E7EB',
        borderBottomStyle: 'solid',
        overflow: 'hidden',
    },
    // Footer
    footer: {
        position: 'relative',
        height: px(100),
        borderTopWidth: px(1),
        borderTopColor: '#E5E7EB',
        borderTopStyle: 'solid',
        marginTop: 'auto',
        overflow: 'hidden',
    },
    // Fill containers
    absoluteFill: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    },
    bgImage: {
        width: '100%',
        height: '100%',
        objectFit: 'cover',
    },
    // Content Overlays (Absolutely Opaque)
    contentOverlay: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: px(50),
        height: '100%',
        width: '100%',
    },
    logo: {
        height: px(60),
        width: px(150),
        objectFit: 'contain',
    },
    footerLogo: {
        height: px(30),
        width: px(100),
        objectFit: 'contain',
    },
    headerMeta: {
        textAlign: 'right',
    },
    headerLabel: {
        fontSize: px(11),
        textTransform: 'uppercase',
        letterSpacing: 2,
        color: '#374151',
        fontWeight: 700,
        marginBottom: px(8),
    },
    headerValue: {
        fontSize: px(11),
        fontWeight: 500,
        color: '#111827',
        fontFamily: 'Courier',
    },
    // Body
    body: {
        position: 'relative',
        paddingHorizontal: px(50),
        paddingVertical: px(60),
        flex: 1,
    },
    bodyWatermark: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        opacity: 0.28,
    },
    bodyWatermarkImage: {
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        objectPosition: 'center',
    },
    bodyContent: {
        position: 'relative',
        zIndex: 1,
    },
    infoGrid: {
        flexDirection: 'row',
        marginBottom: px(50),
        paddingBottom: px(30),
        borderBottomWidth: px(1),
        borderBottomColor: '#E5E7EB',
        borderBottomStyle: 'solid',
    },
    infoItem: {
        flex: 1,
    },
    infoLabel: {
        fontSize: px(10),
        textTransform: 'uppercase',
        letterSpacing: 1,
        color: '#374151',
        marginBottom: px(8),
        fontWeight: 700,
    },
    infoValue: {
        fontSize: px(11),
        fontWeight: 500,
        lineHeight: 1.5,
        color: '#111827',
    },
    // Table
    table: {
        marginBottom: px(50),
        borderWidth: px(1),
        borderColor: '#E5E7EB',
        borderStyle: 'solid',
        borderRadius: px(10),
        overflow: 'hidden',
    },
    tableHeaderRow: {
        flexDirection: 'row',
        backgroundColor: '#2d216d', // Deep Purple
    },
    tableHeaderCell: {
        paddingVertical: px(12),
        paddingHorizontal: px(15),
        fontSize: px(10),
        textTransform: 'uppercase',
        letterSpacing: 1,
        color: '#ffffff',
        fontWeight: 600,
    },
    tableRow: {
        flexDirection: 'row',
        borderBottomWidth: px(1),
        borderBottomColor: '#E5E7EB',
        borderBottomStyle: 'solid',
    },
    tableRowLast: {
        flexDirection: 'row',
    },
    tableCell: {
        paddingVertical: px(14),
        paddingHorizontal: px(15),
        fontSize: px(11),
        color: '#111827',
        borderRightWidth: px(1),
        borderRightColor: '#E5E7EB',
        borderRightStyle: 'solid',
    },
    tableCellLastColumn: {
        paddingVertical: px(14),
        paddingHorizontal: px(15),
        fontSize: px(11),
        color: '#111827',
    },
    itemDescription: {
        fontWeight: 600,
        marginBottom: px(4),
    },
    itemSubtext: {
        fontSize: px(10),
        color: '#374151',
        fontWeight: 600,
    },
    // Approvals
    approvalsGrid: {
        flexDirection: 'row',
        marginTop: px(40),
        paddingTop: px(30),
        borderTopWidth: px(1),
        borderTopColor: '#E5E7EB',
        borderTopStyle: 'solid',
    },
    // Total row
    tableTotalRow: {
        flexDirection: 'row',
        backgroundColor: '#F5F3FF',
    },
    tableTotalCell: {
        paddingVertical: px(10),
        paddingHorizontal: px(15),
        fontSize: px(11),
        textTransform: 'uppercase',
        letterSpacing: 1,
        color: '#374151',
        fontWeight: 700,
        borderRightWidth: px(1),
        borderRightColor: '#E5E7EB',
        borderRightStyle: 'solid',
    },
    tableTotalValueCell: {
        paddingVertical: px(10),
        paddingHorizontal: px(15),
        fontSize: px(13),
        fontWeight: 700,
        color: '#111827',
        borderRightWidth: px(1),
        borderRightColor: '#E5E7EB',
        borderRightStyle: 'solid',
    },
    tableTotalValueCellLast: {
        paddingVertical: px(10),
        paddingHorizontal: px(15),
        fontSize: px(13),
        fontWeight: 700,
        color: '#111827',
    },
    approvalBox: {
        flex: 1,
        justifyContent: 'flex-end',
        marginRight: px(20),
    },
    approvalBoxLast: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    approvalText: {
        fontSize: px(14),
        fontWeight: 600,
        color: '#111827',
        marginBottom: px(8),
        height: px(40),
        flexDirection: 'column',
        justifyContent: 'flex-end',
    },
    approvalLine: {
        borderBottomWidth: px(1),
        borderBottomColor: '#E5E7EB',
        borderBottomStyle: 'solid',
        marginBottom: px(8),
        height: px(40),
    },
    approvalLabel: {
        fontSize: px(9),
        textTransform: 'uppercase',
        letterSpacing: 1,
        color: '#374151',
        fontWeight: 700,
    },
    footerDisclaimer: {
        fontSize: px(9),
        color: '#374151',
        textAlign: 'right',
        lineHeight: 1.6,
        maxWidth: px(450),
        opacity: 1,
        fontWeight: 500,
        letterSpacing: 0.3,
    },
});

const formatCurrency = (val: number) => `$${Number(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatLongDate = (date: any) => {
    if (!date) return '';
    try {
        const d = date instanceof Date ? date : new Date(date);
        if (isNaN(d.getTime())) return String(date);
        return d.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch (e) {
        return String(date);
    }
};

const formatShortDate = (date: any) => {
    if (!date) return '';
    try {
        const d = date instanceof Date ? date : new Date(date);
        if (isNaN(d.getTime())) return String(date);
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' });
    } catch (e) {
        return String(date);
    }
};

const getImageUrl = (path: string, baseUrl: string) => {
    if (!path || path === '__REMOVE__') return '';
    if (path.startsWith('http')) return path;
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${baseUrl || ''}${cleanPath}`;
};

export const VoucherPDF = ({ data, baseUrl, settings = {} }: { data: any; baseUrl: string, settings?: Record<string, string> }) => {
    const totalAmount = data?.items?.reduce((sum: number, item: any) => sum + (item.amount || 0), 0) || data?.amount || 0;

    // Generate gradient strips for header (Top-Left to Bottom-Right roughly via linear strips)
    const headerStrips = [];
    const colorFrom = "#F3E8FF";
    const colorTo = "#DCFCE7";
    const STRIP_COUNT = 60;
    for (let i = 0; i < STRIP_COUNT; i++) {
        const t = i / (STRIP_COUNT - 1);
        const color = lerpColor(colorFrom, colorTo, t);
        headerStrips.push(
            <PDFView key={i} style={{ flex: 1, backgroundColor: color, opacity: 0.92 }} />
        );
    }

    // Generate gradient strips for footer
    const footerStrips = [];
    for (let i = 0; i < STRIP_COUNT; i++) {
        const t = i / (STRIP_COUNT - 1);
        const color = lerpColor(colorFrom, colorTo, t);
        footerStrips.push(
            <PDFView key={i} style={{ flex: 1, backgroundColor: color, opacity: 0.92 }} />
        );
    }

    return (
        <PDFDocument title={`Voucher - ${data?.receiptNo || 'DOC'}`}>
            <PDFPage size="A4" style={styles.page}>

                {/* HEADER */}
                <PDFView style={styles.header}>
                    {/* Layer 1: Watermark (Subtle Curvy Lines) */}
                    <PDFView style={styles.absoluteFill}>
                        <PDFImage
                            src={getImageUrl("/assets/receipts/abstract-curvy-smooth-blue-lines-layout-banner-design.png", baseUrl)}
                            style={styles.bgImage}
                        />
                    </PDFView>

                    {/* Layer 2: RELIABLE GRADIENT OVERLAY (60 Multi-color strips) */}
                    <PDFView style={[styles.absoluteFill, { flexDirection: 'row' }]}>
                        {headerStrips}
                    </PDFView>

                    {/* Layer 3: THE CONTENT (Logo and Text - 100% OPAQUE) */}
                    <PDFView style={styles.contentOverlay}>
                        {settings.voucher_header_logo !== '__REMOVE__' && (
                            <PDFImage
                                src={getImageUrl(settings.voucher_header_logo || process.env.NEXT_PUBLIC_LOGO_URL || (process.env.NEXT_PUBLIC_APP_NAME === "Pesanest" ? "/pesanest/pesanest-dark.png" : "/assets/receipts/cp.png"), baseUrl)}
                                style={[
                                    styles.logo,
                                    process.env.NEXT_PUBLIC_APP_NAME === "Pesanest" 
                                        ? { height: px(60), width: px(150), objectFit: 'contain' } 
                                        : { height: px(28), width: px(90) }
                                ]}
                            />
                        )}
                        <PDFView style={styles.headerMeta}>
                            <PDFText style={styles.headerLabel}>Voucher</PDFText>
                            <PDFText style={styles.headerValue}>{data?.receiptNo || ''}</PDFText>
                        </PDFView>
                    </PDFView>
                </PDFView>

                {/* BODY */}
                <PDFView style={styles.body}>
                    {/* Watermark Layer - Tiled Pattern */}
                    <PDFView style={styles.bodyWatermark}>
                        <PDFView style={{ flexDirection: 'row', flexWrap: 'wrap', width: '100%', height: '100%' }}>
                            {[...Array(6)].map((_, i) => (
                                <PDFImage
                                    key={i}
                                    src={getImageUrl("/imgi_22_guilloche-background-certificate-diploma-currency-design_462925-336.png", baseUrl)}
                                    style={{ width: '50%', height: '33.33%', objectFit: 'cover' }}
                                />
                            ))}
                        </PDFView>
                    </PDFView>

                    {/* Content Layer */}
                    <PDFView style={styles.bodyContent}>
                        <PDFView style={styles.infoGrid}>
                            <PDFView style={styles.infoItem}>
                                <PDFText style={styles.infoLabel}>Beneficiary</PDFText>
                                <PDFText style={styles.infoValue}>
                                    {data?.beneficiary?.name || ''}{'\n'}
                                    {data?.beneficiary?.address || ''}
                                </PDFText>
                            </PDFView>
                            <PDFView style={styles.infoItem}>
                                <PDFText style={styles.infoLabel}>Disbursement Date</PDFText>
                                <PDFText style={styles.infoValue}>
                                    {formatLongDate(data?.date)}
                                </PDFText>
                            </PDFView>
                            <PDFView style={styles.infoItem}>
                                <PDFText style={styles.infoLabel}>Payment Mode</PDFText>
                                <PDFText style={styles.infoValue}>
                                    {data?.paymentMode || ''}{'\n'}
                                    <PDFText style={{ color: '#374151', fontWeight: 600 }}>Ref: {data?.paymentRef || ''}</PDFText>
                                </PDFText>
                            </PDFView>
                        </PDFView>

                        <PDFView style={styles.table}>
                            <PDFView style={styles.tableHeaderRow}>
                                <PDFText style={[styles.tableHeaderCell, { width: '45%' }]}>Description</PDFText>
                                <PDFText style={[styles.tableHeaderCell, { width: '15%', textAlign: 'right' }]}>Date</PDFText>
                                <PDFText style={[styles.tableHeaderCell, { width: '20%', textAlign: 'right' }]}>Requested Amount</PDFText>
                                <PDFText style={[styles.tableHeaderCell, { width: '20%', textAlign: 'right' }]}>Total</PDFText>
                            </PDFView>

                            {data?.items && data.items.length > 0 ? (
                                <>
                                    {data.items.map((item: any, idx: number) => (
                                        <PDFView
                                            key={idx}
                                            style={styles.tableRow}
                                        >
                                            <PDFView style={[styles.tableCell, { width: '45%' }]}>
                                                <PDFText style={styles.itemDescription}>{item.description}</PDFText>
                                                {item.subtext && <PDFText style={styles.itemSubtext}>{item.subtext}</PDFText>}
                                            </PDFView>
                                            <PDFText style={[styles.tableCell, { width: '15%', textAlign: 'right' }]}>
                                                {formatShortDate(item.date)}
                                            </PDFText>
                                            <PDFText style={[styles.tableCell, { width: '20%', textAlign: 'right' }]}>
                                                {formatCurrency(item.amount)}
                                            </PDFText>
                                            <PDFText style={[styles.tableCellLastColumn, { width: '20%', textAlign: 'right' }]}>
                                                {formatCurrency(item.amount)}
                                            </PDFText>
                                        </PDFView>
                                    ))}
                                    {/* Total row — only when multiple items */}
                                    {data.items.length > 1 && (
                                        <PDFView style={styles.tableTotalRow}>
                                            <PDFText style={[styles.tableTotalCell, { width: '60%' }]}>Total</PDFText>
                                            <PDFText style={[styles.tableTotalValueCell, { width: '20%', textAlign: 'right' }]}>
                                                {formatCurrency(totalAmount)}
                                            </PDFText>
                                            <PDFText style={[styles.tableTotalValueCellLast, { width: '20%', textAlign: 'right' }]}>
                                                {formatCurrency(totalAmount)}
                                            </PDFText>
                                        </PDFView>
                                    )}
                                </>
                            ) : (
                                <PDFView style={styles.tableRowLast}>
                                    <PDFView style={[styles.tableCell, { width: '45%' }]}>
                                        <PDFText style={styles.itemDescription}>General Disbursement</PDFText>
                                    </PDFView>
                                    <PDFText style={[styles.tableCell, { width: '15%', textAlign: 'right' }]}>
                                        {formatShortDate(data?.date)}
                                    </PDFText>
                                    <PDFText style={[styles.tableCell, { width: '20%', textAlign: 'right' }]}>
                                        {formatCurrency(totalAmount)}
                                    </PDFText>
                                    <PDFText style={[styles.tableCellLastColumn, { width: '20%', textAlign: 'right' }]}>
                                        {formatCurrency(totalAmount)}
                                    </PDFText>
                                </PDFView>
                            )}
                        </PDFView>

                        {/* Approvals */}
                        <PDFView style={styles.approvalsGrid}>
                            <PDFView style={styles.approvalBox}>
                                <PDFView style={[styles.approvalText, { height: px(20), marginBottom: px(4) }]}>
                                    <PDFText style={{ fontSize: px(11), fontWeight: 600 }}>{data?.approvals?.requestedBy || ''}</PDFText>
                                </PDFView>
                                <PDFView style={[styles.approvalLine, { height: px(1), marginBottom: px(6) }]} />
                                <PDFText style={styles.approvalLabel}>Requested By</PDFText>
                            </PDFView>
                            <PDFView style={styles.approvalBox}>
                                <PDFView style={[styles.approvalText, { height: px(20), marginBottom: px(4) }]}>
                                    <PDFText style={{ fontSize: px(11), fontWeight: 600 }}>{data?.approvals?.authorizedBy || ''}</PDFText>
                                </PDFView>
                                <PDFView style={[styles.approvalLine, { height: px(1), marginBottom: px(6) }]} />
                                <PDFText style={styles.approvalLabel}>Authorized By <PDFText style={{ fontSize: px(7), fontWeight: 400 }}>(Sign)</PDFText></PDFText>
                            </PDFView>
                            <PDFView style={styles.approvalBox}>
                                <PDFView style={[styles.approvalText, { height: px(20), marginBottom: px(4) }]}>
                                    <PDFText style={{ fontSize: px(11), fontWeight: 600 }}>{data?.approvals?.paidBy || ''}</PDFText>
                                </PDFView>
                                <PDFView style={[styles.approvalLine, { height: px(1), marginBottom: px(6) }]} />
                                <PDFText style={styles.approvalLabel}>Paid By <PDFText style={{ fontSize: px(7), fontWeight: 400 }}>(Sign)</PDFText></PDFText>
                            </PDFView>
                            <PDFView style={styles.approvalBoxLast}>
                                <PDFView style={[styles.approvalText, { height: px(20), marginBottom: px(4) }]}>
                                    <PDFText style={{ fontSize: px(11), fontWeight: 600 }}>{data?.approvals?.receivedBy || ''}</PDFText>
                                </PDFView>
                                <PDFView style={[styles.approvalLine, { height: px(1), marginBottom: px(6) }]} />
                                <PDFText style={styles.approvalLabel}>Received By <PDFText style={{ fontSize: px(7), fontWeight: 400 }}>(Sign)</PDFText></PDFText>
                            </PDFView>
                        </PDFView>
                    </PDFView>
                </PDFView>

                {/* FOOTER */}
                <PDFView style={styles.footer} fixed>
                    <PDFView style={[styles.absoluteFill, { flexDirection: 'row' }]}>
                        {footerStrips}
                    </PDFView>

                    <PDFView style={styles.contentOverlay}>
                        {settings.voucher_footer_logo !== '__REMOVE__' && (
                            <PDFImage
                                src={getImageUrl(settings.voucher_footer_logo || process.env.NEXT_PUBLIC_LOGO_URL || (process.env.NEXT_PUBLIC_APP_NAME === "Pesanest" ? "/pesanest/pesanest-dark.png" : "/assets/receipts/cp.png"), baseUrl)}
                                style={[
                                    styles.footerLogo,
                                    process.env.NEXT_PUBLIC_APP_NAME === "Pesanest" 
                                        ? { height: px(60), width: px(150), objectFit: 'contain' } 
                                        : { height: px(15), width: px(60) }
                                ]}
                            />
                        )}
                        <PDFView style={{ textAlign: 'right', maxWidth: px(450) }}>
                            <PDFText style={[styles.footerDisclaimer, { fontSize: px(9), color: '#374151', marginBottom: px(3), fontWeight: 600, letterSpacing: 0.5 }]}>
                                | OFFICIAL RECORD • {(process.env.NEXT_PUBLIC_APP_NAME || 'CAPITAL PAY').toUpperCase()} SYSTEM |
                            </PDFText>
                            <PDFText style={[styles.footerDisclaimer, { fontSize: px(8), color: '#374151', fontWeight: 500, letterSpacing: 0.2 }]}>
                                Unauthorized alteration or reproduction is subject to legal action
                            </PDFText>
                        </PDFView>
                    </PDFView>
                </PDFView>

            </PDFPage>
        </PDFDocument>
    );
};
