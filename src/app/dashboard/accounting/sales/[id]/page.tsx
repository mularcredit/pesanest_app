import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { SalesForm } from "@/components/accounting/SalesForm";
import Link from "next/link";
import { PiCaretLeft, PiSealCheck, PiDownloadSimple } from "react-icons/pi";
import QRCode from "qrcode";

export default async function EditSalePage({ params }: { params: Promise<{ id: string }> }) {
    const session = await auth();
    if (!session?.user) return redirect("/login");

    const { id } = await params;

    const [sale, customers] = await Promise.all([
        prisma.sale.findUnique({
            where: { id },
            include: { items: true }
        }),
        prisma.customer.findMany({
            where: { isActive: true },
            orderBy: { name: 'asc' },
            select: { id: true, name: true, currency: true }
        })
    ]);

    if (!sale) return notFound();

    // KRA eTIMS signed receipt — rendered for screenshot / print once the invoice is accepted
    let etimsQrDataUrl: string | null = null;
    const etimsPin = process.env.ETIMS_PIN || "";
    const etimsAccepted = sale.etimsStatus === "ACCEPTED" && !!sale.etimsInvoiceNumber
        && !sale.etimsInvoiceNumber.startsWith("ETIMS-STUB-");
    if (etimsAccepted) {
        const verifyUrl = `https://etims-sbx.kra.go.ke/common/link/etims/receipt/indexEtimsReceiptData?Data=${etimsPin}00${sale.etimsControlUnit || ""}`;
        etimsQrDataUrl = await QRCode.toDataURL(verifyUrl, { margin: 1, width: 160 });
    }

    return (
        <div className="space-y-6 pb-24">
            {etimsAccepted && (
                <div className="rounded-[10px] border border-emerald-200 bg-emerald-50/60 p-5">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div>
                            <div className="flex items-center gap-1.5 text-emerald-700">
                                <PiSealCheck className="text-[16px]" />
                                <span className="text-[12px] font-[600] tracking-wide uppercase">KRA eTIMS Tax Invoice</span>
                            </div>
                            <dl className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1.5 text-[12.5px]">
                                <div className="flex justify-between gap-4"><dt className="text-gray-500">Supplier PIN</dt><dd className="font-mono text-gray-900">{etimsPin}</dd></div>
                                <div className="flex justify-between gap-4"><dt className="text-gray-500">Branch</dt><dd className="font-mono text-gray-900">00</dd></div>
                                <div className="flex justify-between gap-4"><dt className="text-gray-500">Invoice No.</dt><dd className="font-mono text-gray-900">{sale.invoiceNumber}</dd></div>
                                <div className="flex justify-between gap-4"><dt className="text-gray-500">eTIMS Receipt No.</dt><dd className="font-mono text-gray-900">{sale.etimsInvoiceNumber}</dd></div>
                                <div className="flex justify-between gap-4 sm:col-span-2"><dt className="text-gray-500">Receipt Signature (SCU)</dt><dd className="font-mono text-gray-900 break-all">{sale.etimsControlUnit}</dd></div>
                                <div className="flex justify-between gap-4"><dt className="text-gray-500">Total (incl. VAT 16%)</dt><dd className="font-mono text-gray-900">KES {Number(sale.totalAmount).toLocaleString()}</dd></div>
                                <div className="flex justify-between gap-4"><dt className="text-gray-500">Status</dt><dd className="text-emerald-700 font-[600]">ACCEPTED</dd></div>
                            </dl>
                        </div>
                        {etimsQrDataUrl && (
                            <div className="text-center">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={etimsQrDataUrl} alt="eTIMS verification QR" className="w-[130px] h-[130px] rounded-[6px] bg-white p-1.5 border border-emerald-200" />
                                <p className="text-[10px] text-gray-400 mt-1">Scan to verify on KRA</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                    <Link href="/dashboard/accounting/sales"
                        className="inline-flex items-center gap-1 text-[11.5px] text-gray-400 hover:text-gray-700 transition-colors mb-3">
                        <PiCaretLeft className="text-[12px]" /> Back to sales
                    </Link>
                    <div className="flex items-center gap-2.5">
                        <h1 className="text-[20px] font-[600] text-gray-900 tracking-tight">Edit Invoice</h1>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-[4px] text-gray-500 bg-gray-100 tracking-wider"
                            style={{ border: '1px solid rgba(0,0,0,0.09)' }}>
                            {sale.invoiceNumber}
                        </span>
                    </div>
                    <p className="text-[12.5px] text-gray-400 mt-0.5">Update details for this invoice</p>
                </div>
                <Link href={`/dashboard/accounting/sales/${id}/print`} target="_blank"
                    className="inline-flex items-center gap-1.5 rounded-[8px] bg-indigo-600 hover:bg-indigo-700 text-white text-[12.5px] font-[600] px-4 py-2 transition-colors">
                    <PiDownloadSimple className="text-[14px]" /> Download Invoice
                </Link>
            </div>

            <SalesForm customers={customers} initialData={{
                ...sale,
                subtotal: Number(sale.subtotal),
                taxAmount: Number(sale.taxAmount),
                totalAmount: Number(sale.totalAmount),
                items: sale.items.map((i: any) => ({
                    ...i,
                    quantity: Number(i.quantity),
                    unitPrice: Number(i.unitPrice),
                    total: i.total != null ? Number(i.total) : undefined,
                })),
            } as any} />
        </div>
    );
}
