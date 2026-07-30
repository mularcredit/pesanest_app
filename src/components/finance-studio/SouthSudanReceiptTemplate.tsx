"use client";

import React from 'react';
import { EditableImage } from '@/components/finance-studio/EditableImage';
import { cn } from '@/lib/utils';

export interface SouthSudanReceiptProps {
    receiptNo: string;
    date: Date;
    amount: number;
    beneficiary: {
        name: string;
        address: string;
    };
    paymentMode: string;
    paymentRef: string;
    items: Array<{
        description: string;
        subtext?: string;
        date: Date;
        amount: number;
    }>;
    approvals: {
        requestedBy: string;
        authorizedBy: string;
        paidBy: string;
        receivedBy: string;
    };
    settings?: Record<string, string>;
}

export const SouthSudanReceiptTemplate = ({ 
    receiptNo, 
    date, 
    amount, 
    beneficiary, 
    paymentMode, 
    paymentRef, 
    items, 
    approvals,
    settings = {},
    onSettingChange
}: any) => {
    const formatCurrency = (val: number) =>
        new Intl.NumberFormat('en-US', { style: 'currency', currency: 'KES' }).format(val);

    const formatDate = (d: Date) =>
        d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '';

    const formatLongDate = (d: Date) =>
        d ? new Date(d).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' }) : '';

    const totalAmount = items.reduce((sum: number, item: any) => sum + item.amount, 0);

    return (
        <div className="text-[#111827] print:text-black" style={{ fontFamily: "'Google Sans', 'Roboto', sans-serif", fontSize: '11px' }}>
            <style jsx global>{`
                @import url('https://fonts.googleapis.com/css2?family=Google+Sans:wght@400;500;700&family=Roboto:wght@300;400;500;700&display=swap');
                
                @media print {
                    @page {
                        size: A4;
                        margin: 0;
                    }
                    body {
                        background: white !important;
                        padding: 0 !important;
                        margin: 0 !important;
                    }
                    .receipt-container {
                        box-shadow: none !important;
                        margin: 0 !important;
                        width: 100% !important;
                        height: 100vh !important;
                        border: none !important;
                        print-color-adjust: exact !important;
                        -webkit-print-color-adjust: exact !important;
                    }
                    .header, .footer {
                        print-color-adjust: exact !important;
                        -webkit-print-color-adjust: exact !important;
                    }
                }
            `}</style>

            <div className="receipt-container w-[210mm] min-h-[297mm] bg-white shadow-lg flex flex-col overflow-hidden mx-auto relative content-container" style={{ fontFamily: "'Google Sans', 'Roboto', sans-serif", fontSize: '11px' }}>

                {/* HEADER (Gradient Background) */}
                <header className="header bg-[url('/assets/receipts/abstract-curvy-smooth-blue-lines-layout-banner-design.png')] bg-cover bg-center relative px-[50px] py-[60px] flex justify-between items-center border-b border-[#E5E7EB]">
                    <div className="absolute inset-0 bg-gradient-to-br from-[#F3E8FF]/92 to-[#DCFCE7]/92 z-0"></div>

                    <div className="logo-container relative z-10">
                        <EditableImage 
                            settingKey="voucher_header_logo" 
                            defaultSrc={process.env.NEXT_PUBLIC_LOGO_URL || (process.env.NEXT_PUBLIC_APP_NAME === "Pesanest" ? "/pesanest/pesanest-dark.png" : "/assets/receipts/cp.png")} 
                            onUploadSuccess={(url) => onSettingChange?.('voucher_header_logo', url)}
                            className={cn(
                                "w-auto block max-w-[250px] object-contain",
                                process.env.NEXT_PUBLIC_APP_NAME === "Pesanest" ? "h-[60px]" : "h-[32px]"
                            )}
                        />
                    </div>

                    <div className="header-meta text-right relative z-10">
                        <div className="text-[11px] uppercase tracking-[2px] text-[#374151] font-bold mb-[8px]">Voucher</div>
                        <div className="text-[11px] font-medium text-[#111827] font-mono">{receiptNo}</div>
                    </div>
                </header>

                {/* BODY (White Background) */}
                <div className="body-content px-[50px] py-[60px] bg-white flex-1 relative">
                    {/* Watermark Layer */}
                    <div
                        className="absolute inset-0 opacity-[0.28] pointer-events-none bg-repeat bg-center"
                        style={{
                            backgroundImage: 'url(/imgi_22_guilloche-background-certificate-diploma-currency-design_462925-336.png)',
                            backgroundSize: 'auto'
                        }}
                    >
                    </div>

                    {/* Content Layer */}
                    <div className="relative z-10">


                        <div className="info-grid grid grid-cols-3 gap-[30px] mb-[50px] pb-[30px] border-b border-[#E5E7EB]">
                            <div className="info-item">
                                <h4 className="text-[10px] uppercase tracking-[1px] text-[#374151] mb-[8px] font-bold">Beneficiary</h4>
                                <p className="text-[11px] font-medium leading-relaxed whitespace-pre-line">
                                    {beneficiary.name}<br />
                                    {beneficiary.address}
                                </p>
                            </div>
                            <div className="info-item">
                                <h4 className="text-[10px] uppercase tracking-[1px] text-[#374151] mb-[8px] font-bold">Disbursement Date</h4>
                                <p className="text-[11px] font-medium leading-relaxed">
                                    {formatLongDate(date)}
                                </p>
                            </div>
                            <div className="info-item">
                                <h4 className="text-[10px] uppercase tracking-[1px] text-[#374151] mb-[8px] font-bold">Payment Mode</h4>
                                <p className="text-[11px] font-medium leading-relaxed">
                                    {paymentMode}<br />
                                    <span className="text-[#374151] font-semibold">Ref: {paymentRef}</span>
                                </p>
                            </div>
                        </div>

                        <table className="items-table w-full border-separate border-spacing-0 mb-[50px] border border-[#E5E7EB] rounded-[10px] overflow-hidden">
                            <thead>
                                <tr className="bg-[#2d216d]">
                                    <th className="text-left text-[10px] uppercase tracking-[1px] text-white font-bold p-[12px_15px] border-b border-[#E5E7EB] w-[45%]">Description</th>
                                    <th className="text-right text-[10px] uppercase tracking-[1px] text-white font-bold p-[12px_15px] border-b border-[#E5E7EB] w-[15%]">Date</th>
                                    <th className="text-right text-[10px] uppercase tracking-[1px] text-white font-bold p-[12px_15px] border-b border-[#E5E7EB] w-[20%]">Requested Amount</th>
                                    <th className="text-right text-[10px] uppercase tracking-[1px] text-white font-bold p-[12px_15px] border-b border-[#E5E7EB] w-[20%] border-r-0">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((item: any, idx: number) => (
                                    <tr key={idx}>
                                        <td className="p-[14px_15px] border-r border-[#E5E7EB] border-b border-[#E5E7EB] text-[11px] text-[#111827]">
                                            <span className="block font-medium mb-[4px]">{item.description}</span>
                                            {item.subtext && <span className="text-[10px] text-[#374151] font-semibold">{item.subtext}</span>}
                                        </td>
                                        <td className="p-[14px_15px] border-r border-[#E5E7EB] border-b border-[#E5E7EB] text-[11px] text-[#111827] text-right">
                                            {formatDate(item.date)}
                                        </td>
                                        <td className="p-[14px_15px] border-r border-[#E5E7EB] border-b border-[#E5E7EB] text-[11px] text-[#111827] text-right">
                                            {formatCurrency(item.amount)}
                                        </td>
                                        <td className="p-[14px_15px] border-b border-[#E5E7EB] text-[11px] text-[#111827] text-right border-r-0">
                                            {formatCurrency(item.amount)}
                                        </td>
                                    </tr>
                                ))}
                                {/* Total row — only shown when there are multiple items */}
                                {items.length > 1 && (
                                    <tr className="bg-[#2d216d]/5">
                                        <td colSpan={2} className="p-[10px_15px] text-[10px] uppercase tracking-[1px] text-[#374151] font-bold border-r border-[#E5E7EB]">
                                            Total
                                        </td>
                                        <td className="p-[10px_15px] text-[11px] font-bold text-[#111827] text-right border-r border-[#E5E7EB]">
                                            {formatCurrency(totalAmount)}
                                        </td>
                                        <td className="p-[10px_15px] text-[11px] font-bold text-[#111827] text-right border-r-0">
                                            {formatCurrency(totalAmount)}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>

                        <div className="approvals-grid grid grid-cols-4 gap-[20px] mt-[40px] pt-[30px] border-t border-[#E5E7EB]">
                            <div className="approval-box flex flex-col justify-end">
                                <div className="approval-text text-[11px] font-semibold text-[#111827] min-h-[20px] mb-[1px]">
                                    {approvals.requestedBy}
                                </div>
                                <div className="approval-line border-b border-[#E5E7EB] w-full mb-[4px]"></div>
                                <div className="approval-label text-[9px] uppercase tracking-[1px] text-[#374151] font-bold">
                                    Requested By
                                </div>
                            </div>
                            <div className="approval-box flex flex-col justify-end">
                                <div className="text-[11px] font-semibold text-[#111827] min-h-[20px] mb-[1px]">
                                    {approvals.authorizedBy}
                                </div>
                                <div className="approval-line border-b border-[#E5E7EB] w-full mb-[4px]"></div>
                                <div className="text-[9px] uppercase tracking-[1px] text-[#374151] font-bold">
                                    Authorized By <span className="text-[8px] text-gray-400 font-normal ml-1">(Sign)</span>
                                </div>
                            </div>
                            <div className="approval-box flex flex-col justify-end">
                                <div className="text-[11px] font-semibold text-[#111827] min-h-[20px] mb-[1px]">
                                    {approvals.paidBy}
                                </div>
                                <div className="approval-line border-b border-[#E5E7EB] w-full mb-[4px]"></div>
                                <div className="text-[9px] uppercase tracking-[1px] text-[#374151] font-bold">
                                    Paid By <span className="text-[8px] text-gray-400 font-normal ml-1">(Sign)</span>
                                </div>
                            </div>
                            <div className="approval-box flex flex-col justify-end">
                                <div className="text-[11px] font-semibold text-[#111827] min-h-[20px] mb-[1px]">
                                    {approvals.receivedBy}
                                </div>
                                <div className="approval-line border-b border-[#E5E7EB] w-full mb-[4px]"></div>
                                <div className="text-[9px] uppercase tracking-[1px] text-[#374151] font-bold">
                                    Received By <span className="text-[8px] text-gray-400 font-normal ml-1">(Sign)</span>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>

                {/* FOOTER (Gradient Background) */}
                <footer className="footer bg-gradient-to-br from-[#F3E8FF] to-[#DCFCE7] px-[50px] py-[40px] border-t border-[#E5E7EB] flex justify-between items-end relative">
                    {/* Watermark Layer */}
                    <div
                        className="absolute inset-0 opacity-[0.28] pointer-events-none bg-repeat bg-center z-0"
                        style={{
                            backgroundImage: 'url(/imgi_22_guilloche-background-certificate-diploma-currency-design_462925-336.png)',
                            backgroundSize: 'auto'
                        }}
                    >
                    </div>

                    {/* Content Layer */}
                    <div className="footer-left relative z-10">
                         <EditableImage 
                            settingKey="voucher_footer_logo" 
                            defaultSrc={process.env.NEXT_PUBLIC_LOGO_URL || (process.env.NEXT_PUBLIC_APP_NAME === "Pesanest" ? "/pesanest/pesanest-dark.png" : "/assets/receipts/cp.png")} 
                            onUploadSuccess={(url) => onSettingChange?.('voucher_footer_logo', url)}
                            className={cn(
                                "w-auto block mb-[10px] max-w-[150px] object-contain",
                                process.env.NEXT_PUBLIC_APP_NAME === "Pesanest" ? "h-[30px]" : "h-[16px]"
                            )}
                        />
                    </div>
                    <div className="disclaimer-footer text-right max-w-[450px] ml-auto relative z-10">
                        <div className="text-[9px] text-[#374151] font-semibold tracking-wide leading-[1.6] mb-[3px] letter-spacing-[0.5px]">
                            | OFFICIAL RECORD • CAPITAL PAY SYSTEM |
                        </div>
                        <div className="text-[7.5px] text-[#374151] font-medium leading-[1.6] tracking-[0.3px]">
                            Unauthorized alteration or reproduction is subject to legal action
                        </div>
                    </div>
                </footer>

            </div>
        </div>
    );
};
