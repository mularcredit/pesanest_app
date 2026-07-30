"use client";

import React from 'react';
import { EditableImage } from './EditableImage';

interface PaymentReceiptProps {
    receiptNo: string;
    receiptDate: Date;
    currency: string;
    receivedFrom: string;
    paymentMethod: string;
    transactionRef: string;
    paymentDate: Date;
    invoiceNumber: string;
    serviceType: string;
    billingPeriod: string;
    originalAmount: number;
    creditNoteApplied?: number;
    adjustedAmountDue: number;
    amountPaid: number;
    notes: string;
}

export const PaymentReceiptTemplate: React.FC<PaymentReceiptProps> = ({
    receiptNo,
    receiptDate,
    currency = 'USD',
    receivedFrom,
    paymentMethod,
    transactionRef,
    paymentDate,
    invoiceNumber,
    serviceType,
    billingPeriod,
    originalAmount,
    creditNoteApplied = 0,
    adjustedAmountDue,
    amountPaid,
    notes,
}) => {
    const formatCurrency = (val: number) =>
        new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(val);

    const formatDate = (d: Date) =>
        d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

    return (
        <div className="text-[#333] print:text-black" style={{ fontFamily: "'Google Sans', 'Product Sans', 'Outfit', 'Inter', sans-serif" }}>
            <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Outfit:wght@400;500;600;700;800;900&display=swap');
        @media print {
            * {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
            }
            .logo-container {
                width: 70px !important;
                height: 70px !important;
            }
            .logo-container.right-logo {
                width: 120px !important;
                height: 120px !important;
            }
            .print-container {
                box-shadow: none !important;
                margin: 0 !important;
                height: auto !important;
                min-height: auto !important;
                padding-bottom: 20px !important;
            }
        }
        .watermark {
            position: absolute;
            top: 500px;
            left: 50%;
            transform: translate(-50%, -50%);
            opacity: 0.04;
            z-index: 0;
            pointer-events: none;
            width: 500px;
            height: 500px;
        }
      `}</style>

            <div className="print-container w-[210mm] max-w-full bg-white relative p-[5mm_15mm_20mm] shadow-lg min-h-[297mm] flex flex-col justify-between mx-auto content-container">
                <div className="watermark">
                    {process.env.NEXT_PUBLIC_APP_NAME !== "Pesanest" && (
                        <img src="/assets/branding/emblem_of_south_sudan-freelogovectors.net_-400x395.png" alt="South Sudan Emblem" className="w-full h-full object-contain filter grayscale" />
                    )}
                </div>

                <div className="relative z-10">
                    {/* HEADER */}
                    {process.env.NEXT_PUBLIC_APP_NAME === "Pesanest" ? (
                        <div className="flex justify-start items-center mb-[5px] pb-[5px] border-b-2 border-[#eee]">
                            <div className="logo-container right-logo flex items-center justify-start w-[140px] h-[60px]">
                                <EditableImage 
                                    settingKey="pesanest_receipt_logo" 
                                    defaultSrc="/pesanest/pesanest-dark.png" 
                                    alt="Pesanest Logo" 
                                    className="w-full h-full" 
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="flex justify-between items-center mb-[5px] pb-[5px] border-b-2 border-[#eee]">
                            <div className="logo-container flex items-center justify-center w-[60px] h-[60px]">
                                <EditableImage 
                                    settingKey="nra_receipt_logo_left"
                                    defaultSrc="/assets/branding/south-sudan-revenue-authority-formerly-national-revenue-authority-586928.jpg" 
                                    alt="Revenue Authority Logo" 
                                    className="w-full h-full" 
                                />
                            </div>
                            <div className="flex-grow text-center">
                                <div className="text-[#dc2626] text-[13px] font-[900] uppercase tracking-[0.5px] m-0">The Republic of South Sudan</div>
                                <div className="text-black text-[13px] font-[900] mt-[3px]">Civil Aviation Authority</div>
                            </div>
                            <div className="logo-container right-logo flex items-center justify-center w-[100px] h-[100px]">
                                <EditableImage 
                                    settingKey="caa_receipt_logo_right"
                                    defaultSrc="/assets/branding/logo.857ac6f8bbd7.png" 
                                    alt="Civil Aviation Authority Logo" 
                                    className="w-full h-full" 
                                />
                            </div>
                        </div>
                    )}

                    {/* ISSUER CONTACT */}
                    <div className="flex justify-between items-center mb-[20px] pb-[8px] border-b border-[#eee] text-[8px] text-[#555]">
                        <div className="flex-1 text-left font-bold text-[#333]">
                            <strong className="block text-[#666] mb-[1px] uppercase text-[8px] font-normal">Site</strong>
                            www.pesanest.com
                        </div>
                        <div className="flex-1 text-center font-bold text-[#333]">
                            <strong className="block text-[#666] mb-[1px] uppercase text-[8px] font-normal">Contact Number</strong>
                            +211 980 11 77 99
                        </div>
                        <div className="flex-1 text-right font-bold text-[#333]">
                            <strong className="block text-[#666] mb-[1px] uppercase text-[8px] font-normal">Email</strong>
                            support@pesanest.com
                        </div>
                    </div>

                    {/* TITLE */}
                    <div className="bg-[#dc2626] text-white py-[5px] px-[15px] text-[16px] font-bold uppercase mb-[8px] text-center rounded-[4px]">
                        Payment Receipt
                    </div>

                    {/* CONTENT WRAPPER */}
                    <div className="flex-grow flex flex-col justify-start pt-[15px] gap-[15px]">

                        {/* INFO GRID */}
                        <div className="grid grid-cols-3 gap-[12px] mb-[10px]">
                            <div>
                                <h4 className="text-[9px] uppercase text-[#64748b] m-0 mb-[2px] font-normal">Receipt No.</h4>
                                <p className="m-0 text-[10px] font-bold text-[#1a1a1a]">{receiptNo}</p>
                            </div>
                            <div>
                                <h4 className="text-[9px] uppercase text-[#64748b] m-0 mb-[2px] font-normal">Receipt Date</h4>
                                <p className="m-0 text-[10px] font-bold text-[#1a1a1a]">{formatDate(receiptDate)}</p>
                            </div>
                            <div>
                                <h4 className="text-[9px] uppercase text-[#64748b] m-0 mb-[2px] font-normal">Currency</h4>
                                <p className="m-0 text-[10px] font-bold text-[#1a1a1a]">{currency}</p>
                            </div>
                        </div>

                        {/* PAYMENT DETAILS */}
                        <div className="border border-[#e2e8f0] rounded-[6px] overflow-hidden mb-[15px]">
                            <div className="p-[6px_12px] font-bold text-[11px] uppercase bg-[#236A9E] text-white">Payment Information</div>
                            <div className="p-[12px] bg-[#f8fafc]">
                                <div className="flex justify-between mb-[8px] text-[11px] pb-[8px] border-b border-[#e2e8f0]">
                                    <span className="text-[#64748b]">Received From:</span>
                                    <span className="text-[#1a1a1a] font-bold">{receivedFrom}</span>
                                </div>
                                <div className="flex justify-between mb-[8px] text-[11px] pb-[8px] border-b border-[#e2e8f0]">
                                    <span className="text-[#64748b]">Payment Method:</span>
                                    <span className="text-[#1a1a1a] font-bold">{paymentMethod}</span>
                                </div>
                                <div className="flex justify-between mb-[8px] text-[11px] pb-[8px] border-b border-[#e2e8f0]">
                                    <span className="text-[#64748b]">Transaction Reference:</span>
                                    <span className="text-[#1a1a1a] font-bold">{transactionRef}</span>
                                </div>
                                <div className="flex justify-between mb-0 text-[11px]">
                                    <span className="text-[#64748b]">Payment Date:</span>
                                    <span className="text-[#1a1a1a] font-bold">{formatDate(paymentDate)}</span>
                                </div>
                            </div>
                        </div>

                        {/* INVOICE DETAILS */}
                        <div className="bg-[#f8fafc] p-[10px_15px] rounded-[6px] mb-[15px]">
                            <h3 className="text-[11px] font-bold m-0 mb-[8px] text-[#236A9E] uppercase">Invoice Details</h3>
                            <div className="flex justify-between mb-[5px] text-[10px]">
                                <span className="text-[#64748b]">Invoice Number:</span>
                                <span className="text-[#1a1a1a] font-semibold">{invoiceNumber}</span>
                            </div>
                            <div className="flex justify-between mb-[5px] text-[10px]">
                                <span className="text-[#64748b]">Service Type:</span>
                                <span className="text-[#1a1a1a] font-semibold">{serviceType}</span>
                            </div>
                            <div className="flex justify-between mb-[5px] text-[10px]">
                                <span className="text-[#64748b]">Billing Period:</span>
                                <span className="text-[#1a1a1a] font-semibold">{billingPeriod}</span>
                            </div>
                            <div className="flex justify-between mb-[5px] text-[10px]">
                                <span className="text-[#64748b]">Original Invoice Amount:</span>
                                <span className="text-[#1a1a1a] font-semibold">{formatCurrency(originalAmount)}</span>
                            </div>
                            {creditNoteApplied !== 0 && (
                                <div className="flex justify-between mb-[5px] text-[10px]">
                                    <span className="text-[#64748b]">Credit Note Applied:</span>
                                    <span className="text-[#1a1a1a] font-semibold text-red-600">{formatCurrency(creditNoteApplied)}</span>
                                </div>
                            )}
                            <div className="flex justify-between mb-[5px] text-[10px]">
                                <span className="text-[#64748b]">Adjusted Amount Due:</span>
                                <span className="text-[#1a1a1a] font-semibold">{formatCurrency(adjustedAmountDue)}</span>
                            </div>
                        </div>

                        {/* AMOUNT PAID */}
                        <div className="bg-gradient-to-br from-[#10b981] to-[#059669] text-white p-[20px] rounded-[8px] text-center mb-[20px] shadow-[0_4px_6px_rgba(16,185,129,0.3)]">
                            <h3 className="text-[13px] font-semibold m-0 mb-[8px] uppercase opacity-90">Amount Paid</h3>
                            <p className="text-[32px] font-[900] m-0 tracking-[1px]">{formatCurrency(amountPaid)}</p>
                            <p className="text-[11px] m-[8px_0_0_0] opacity-90 bg-[rgba(255,255,255,0.2)] inline-block p-[4px_12px] rounded-[12px] font-semibold">✓ PAYMENT RECEIVED</p>
                        </div>

                        {/* NOTES */}
                        {notes && (
                            <div className="bg-[#fef3c7] p-[12px] mb-[20px] text-[10px] leading-[1.5] rounded-[4px]">
                                <strong className="text-[#92400e]">Payment Confirmation:</strong> {notes}
                            </div>
                        )}

                        {/* SIGNATURE */}
                        <div className="grid grid-cols-2 gap-[30px] mt-[30px] pt-[20px] border-t border-[#e2e8f0]">
                            <div className="text-center">
                                <div className="border-b-2 border-[#334155] mb-[8px] h-[50px]"></div>
                                <div className="text-[10px] text-[#64748b] font-semibold">Received By</div>

                            </div>
                            <div className="text-center">
                                <div className="border-b-2 border-[#334155] mb-[8px] h-[50px]"></div>
                                <div className="text-[10px] text-[#64748b] font-semibold">Date</div>
                            </div>
                        </div>
                    </div>

                    {/* FOOTER SECTION */}
                    <div className="mt-auto">
                        {/* BOTTOM MESSAGE WITH BORDER */}
                        <div className="w-full border-t border-gray-200 pt-[6px] flex justify-center items-center mb-[10px]">
                            <p className="text-[8px] text-[#64748b] font-medium tracking-wide leading-tight">
                                Thank you for your payment. We appreciate your continued partnership.
                            </p>
                        </div>

                        {/* LOGOS FOOTER */}
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-[4px]">
                                {process.env.NEXT_PUBLIC_APP_NAME !== "Pesanest" && (
                                    <>
                                        <div className="w-[14px] h-[14px]">
                                            <EditableImage 
                                                settingKey="receipt_footer_logo_left"
                                                defaultSrc="/assets/branding/eservice-logo.png" 
                                                alt="eServices Logo" 
                                                className="w-full h-full object-contain" 
                                            />
                                        </div>
                                        <div className="text-[8px] font-bold text-black">eServices<span className="text-[#dc2626]">.</span>gov<span className="text-[#dc2626]">.</span>ss</div>
                                    </>
                                )}
                            </div>
                            <div className="flex items-center justify-center mt-2">
                                <div className="h-[20px]">
                                    <EditableImage
                                        settingKey="receipt_footer_logo_center"
                                        defaultSrc="/cpfooter.png"
                                        alt="Footer Logo"
                                        className="h-full object-contain"
                                    />
                                </div>
                            </div>
                            <div className="flex items-center gap-[6px]">
                                {process.env.NEXT_PUBLIC_APP_NAME !== "Pesanest" && (
                                    <>
                                        <div className="text-[7px] font-bold text-black text-right leading-[1.1]">Proudly South<br />Sudanese</div>
                                        <div className="w-[18px] h-[12px]">
                                            <EditableImage 
                                                settingKey="receipt_footer_logo_right"
                                                defaultSrc="/assets/branding/Flag_of_South_Sudan.svg.png" 
                                                alt="South Sudan Flag" 
                                                className="w-full h-full object-cover" 
                                            />
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
