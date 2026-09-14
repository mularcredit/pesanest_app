import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import QRCode from "qrcode";
import { PrintControls } from "../../../sales/[id]/print/PrintControls";

export default async function CreditNotePrintPage({ params }: { params: Promise<{ id: string }> }) {
    const session = await auth();
    if (!session?.user) return redirect("/login");

    const { id } = await params;
    const cn: any = await (prisma as any).creditNote.findUnique({ where: { id }, include: { customer: true } });
    if (!cn) return notFound();

    // Pull the original invoice so the credit note mirrors its line + dates
    const origSale: any = cn.invoiceRef
        ? await prisma.sale.findUnique({ where: { invoiceNumber: cn.invoiceRef }, include: { items: true } }).catch(() => null)
        : null;

    const etimsPin = process.env.ETIMS_PIN || "";
    const appName = process.env.NEXT_PUBLIC_APP_NAME || "PesaNest";
    const accepted = cn.etimsStatus === "ACCEPTED" && !!cn.etimsReceiptNo && !String(cn.etimsReceiptNo).startsWith("ETIMS-STUB-");

    let qr: string | null = null;
    if (accepted) {
        const verifyUrl = `https://etims-sbx.kra.go.ke/common/link/etims/receipt/indexEtimsReceiptData?Data=${etimsPin}00${cn.etimsControlUnit || ""}`;
        qr = await QRCode.toDataURL(verifyUrl, { margin: 1, width: 150 });
    }

    const money = (n: number) => `KES ${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const fmtDate = (d: Date | string) => new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

    return (
        <div className="invoice-doc">
            <style>{`
                @page { size: A4; margin: 16mm; }
                @media print {
                    body * { visibility: hidden !important; }
                    .invoice-doc, .invoice-doc * { visibility: visible !important; }
                    .invoice-doc { position: absolute !important; left: 0; top: 0; width: 100%; margin: 0; padding: 0; }
                    .no-print { display: none !important; }
                    body { background: #fff !important; }
                }
                .invoice-doc { max-width: 800px; margin: 0 auto; background: #fff; color: #1a1a1a; padding: 40px; font-size: 13px; line-height: 1.5; }
                .inv-table { width: 100%; border-collapse: collapse; margin-top: 8px; }
                .inv-table th { text-align: left; font-size: 10.5px; text-transform: uppercase; letter-spacing: .04em; color: #6b7280; border-bottom: 2px solid #e5e7eb; padding: 8px 6px; }
                .inv-table td { padding: 10px 6px; border-bottom: 1px solid #f0f0f0; }
                .inv-table td.num, .inv-table th.num { text-align: right; }
            `}</style>

            <div className="no-print" style={{ maxWidth: 800, margin: "0 auto 12px", display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <PrintControls />
            </div>

            {/* Header — identical structure to the invoice */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #111", paddingBottom: 16 }}>
                <div>
                    <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em" }}>{appName}</div>
                    <div style={{ color: "#6b7280", marginTop: 2 }}>Nairobi, Kenya</div>
                    <div style={{ color: "#6b7280" }}>PIN: {etimsPin} · Branch 00</div>
                </div>
                <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: "#4f46e5" }}>CREDIT NOTE</div>
                    <div style={{ marginTop: 4, fontFamily: "monospace" }}>{cn.cnNumber}</div>
                    <div style={{ color: "#6b7280" }}>Date: {fmtDate(cn.createdAt)}</div>
                    <div style={{ color: "#6b7280" }}>Against Invoice: {cn.invoiceRef}</div>
                </div>
            </div>

            {/* Credit to */}
            <div style={{ marginTop: 20 }}>
                <div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".04em", color: "#6b7280" }}>Credit To</div>
                <div style={{ fontWeight: 600, marginTop: 3 }}>{cn.customer?.name}</div>
                {cn.customer?.taxId && <div style={{ color: "#6b7280" }}>PIN: {cn.customer.taxId}</div>}
                {cn.customer?.address && <div style={{ color: "#6b7280" }}>{cn.customer.address}</div>}
            </div>

            {/* Line items — mirrors the invoice table */}
            <table className="inv-table">
                <thead>
                    <tr>
                        <th>Description</th>
                        <th className="num">Qty</th>
                        <th className="num">Unit Price</th>
                        <th className="num">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    {origSale?.items?.length ? origSale.items.map((it: any) => (
                        <tr key={it.id}>
                            <td>{it.description} <span style={{ color: "#9ca3af", fontSize: 11 }}>(credit — {cn.reason})</span></td>
                            <td className="num">{Number(it.quantity)}</td>
                            <td className="num">{money(Number(it.unitPrice))}</td>
                            <td className="num">-{money(Number(it.total))}</td>
                        </tr>
                    )) : (
                        <tr>
                            <td>{cn.reason} <span style={{ color: "#9ca3af", fontSize: 11 }}>(Ref: {cn.invoiceRef})</span></td>
                            <td className="num">1</td>
                            <td className="num">{money(Number(cn.amount))}</td>
                            <td className="num">-{money(Number(cn.amount))}</td>
                        </tr>
                    )}
                </tbody>
            </table>

            {/* Totals */}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
                <div style={{ width: 260 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", marginTop: 4, borderTop: "2px solid #111", fontWeight: 700, fontSize: 15 }}>
                        <span>Total Credit</span><span>-{money(Number(cn.amount))}</span>
                    </div>
                </div>
            </div>

            {/* eTIMS block — same as the invoice */}
            {accepted && (
                <div style={{ marginTop: 28, border: "1px solid #a7f3d0", background: "#ecfdf5", borderRadius: 10, padding: 18, display: "flex", justifyContent: "space-between", gap: 16 }}>
                    <div>
                        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", color: "#047857" }}>KRA eTIMS Credit Note</div>
                        <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "auto 1fr", columnGap: 16, rowGap: 4 }}>
                            <span style={{ color: "#6b7280" }}>Supplier PIN</span><span style={{ fontFamily: "monospace" }}>{etimsPin}</span>
                            <span style={{ color: "#6b7280" }}>eTIMS Receipt No.</span><span style={{ fontFamily: "monospace" }}>{cn.etimsReceiptNo}</span>
                            <span style={{ color: "#6b7280" }}>Receipt Signature (SCU)</span><span style={{ fontFamily: "monospace" }}>{cn.etimsControlUnit}</span>
                            <span style={{ color: "#6b7280" }}>Type</span><span>Credit Note (rcptTyCd R)</span>
                            <span style={{ color: "#6b7280" }}>Status</span><span style={{ color: "#047857", fontWeight: 600 }}>ACCEPTED</span>
                        </div>
                    </div>
                    {qr && (
                        <div style={{ textAlign: "center" }}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={qr} alt="eTIMS verification QR" style={{ width: 120, height: 120, background: "#fff", padding: 6, borderRadius: 6, border: "1px solid #a7f3d0" }} />
                            <div style={{ fontSize: 9.5, color: "#9ca3af", marginTop: 3 }}>Scan to verify on KRA</div>
                        </div>
                    )}
                </div>
            )}

            <div style={{ marginTop: 28, paddingTop: 14, borderTop: "1px solid #eee", fontSize: 11, color: "#9ca3af", textAlign: "center" }}>
                This document confirms the credit adjustment to your account · Powered by {appName}
            </div>
        </div>
    );
}
