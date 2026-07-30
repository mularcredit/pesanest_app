"use client";

import React from 'react';
import { EditableImage } from './EditableImage';

interface CreditNoteProps {
    cnNumber: string;
    invoiceRef: string;
    amount: number;
    reason: string;
    date: Date;
    customer: {
        name: string;
        address: string;
        tin?: string;
    };
}

export const CreditNoteTemplate: React.FC<CreditNoteProps> = ({
    cnNumber,
    invoiceRef,
    amount,
    reason,
    date,
    customer,
}) => {
    const formattedAmount = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'KES',
    }).format(amount);

    const formattedDate = date.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });

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
                min-height: 297mm !important; /* Force full A4 height */
                padding-bottom: 30mm !important; /* Reserve space for absolute footer */
                position: relative !important;
            }
            .footer-absolute {
                position: absolute !important;
                bottom: 10mm !important;
                left: 15mm !important;
                right: 15mm !important;
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

                {/* HEADER */}
                {process.env.NEXT_PUBLIC_APP_NAME === "Pesanest" ? (
                    <div className="flex justify-start items-center mb-[5px] pb-[5px] border-b-2 border-[#eee]">
                        <div className="logo-container right-logo flex items-center justify-start w-[140px] h-[60px]">
                            <EditableImage 
                                settingKey="pesanest_credit_note_logo" 
                                defaultSrc="/Mular.png" 
                                alt="Mular Logo" 
                                className="w-full h-full" 
                            />
                        </div>
                    </div>
                ) : (
                    <div className="flex justify-between items-center mb-[5px] pb-[5px] border-b-2 border-[#eee]">
                        <div className="logo-container flex items-center justify-center w-[60px] h-[60px]">
                            <EditableImage 
                                settingKey="nra_credit_note_logo_left"
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
                                settingKey="caa_credit_note_logo_right"
                                defaultSrc="/assets/branding/logo.857ac6f8bbd7.png" 
                                alt="Civil Aviation Authority Logo" 
                                className="w-full h-full" 
                            />
                        </div>
                    </div>
                )}

                {/* ISSUER CONTACT */}
                <div className="flex justify-between items-center mb-[20px] pb-[4px] border-b border-[#eee] text-[9px] text-[#555]">
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

                <div className="bg-[#dc2626] text-white py-[5px] px-[20px] text-[18px] font-bold uppercase mb-[8px] text-center rounded-[4px]">
                    Credit Note
                </div>

                {/* CONTENT WRAPPER FOR VERTICAL BALANCE */}
                <div className="flex-grow flex flex-col justify-start pt-[20px] gap-[20px]">

                    {/* INFO GRID */}
                    <div className="grid grid-cols-4 gap-[10px] mb-[8px]">
                        <div>
                            <h4 className="text-[10px] uppercase text-[#64748b] m-0 mb-[4px] font-normal">Original Invc. Ref</h4>
                            <p className="m-0 text-[11px] font-bold text-[#1a1a1a]">{invoiceRef}</p>
                        </div>
                        <div>
                            <h4 className="text-[10px] uppercase text-[#64748b] m-0 mb-[4px] font-normal">Credit Note No.</h4>
                            <p className="m-0 text-[11px] font-bold text-[#1a1a1a]">{cnNumber}</p>
                        </div>
                        <div>
                            <h4 className="text-[10px] uppercase text-[#64748b] m-0 mb-[4px] font-normal">Date</h4>
                            <p className="m-0 text-[11px] font-bold text-[#1a1a1a]">{formattedDate}</p>
                        </div>
                        <div className="text-right">
                            <h4 className="text-[10px] uppercase text-[#64748b] m-0 mb-[4px] font-normal">Reason</h4>
                            <p className="m-0 text-[11px] font-bold text-[#1a1a1a]">{reason}</p>
                        </div>
                    </div>

                    {/* BOXES SECTION */}
                    <div className="grid grid-cols-2 gap-[15px] mb-[8px]">
                        <div className="border border-[#e2e8f0] rounded-[4px] overflow-hidden">
                            <div className="p-[8px_15px] font-bold text-[12px] uppercase bg-[#f8fafc] text-[#333] border-b border-[#e2e8f0]">E-Government Services</div>
                            <div className="p-[15px] text-[12px] leading-[1.5] text-[#475569]">
                                UAP Equatoria Tower<br />
                                Hai Malakal Road<br />
                                8th Floor, Wing B, Suite 2
                            </div>
                        </div>

                        <div className="border border-[#e2e8f0] rounded-[4px] overflow-hidden text-right">
                            <div className="p-[8px_15px] font-bold text-[12px] uppercase bg-[#f8fafc] text-[#333] border-b border-[#e2e8f0]">Credit To</div>
                            <div className="p-[15px] text-[12px] leading-[1.5] text-[#475569]">
                                <strong>{customer.name}</strong><br />
                                {customer.address.split('\n').map((line, i) => <React.Fragment key={i}>{line}<br /></React.Fragment>)}
                                <span className="text-[#888] text-[11px] mt-[4px] block">TIN/Reg: {customer.tin || 'N/A'}</span>
                            </div>
                        </div>
                    </div>

                    {/* TABLE */}
                    <table className="w-full border-collapse mb-[8px] text-[12px]">
                        <thead>
                            <tr>
                                <th className="bg-[#236A9E] text-white text-left p-[10px_12px] text-[11px] uppercase font-semibold w-1/2">Description</th>
                                <th className="bg-[#236A9E] text-white text-left p-[10px_12px] text-[11px] uppercase font-semibold">Period</th>
                                <th className="bg-[#236A9E] text-white text-right p-[10px_12px] text-[11px] uppercase font-semibold">Amount (KES)</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td className="p-[12px] border-b border-[#e2e8f0] text-[12px] text-[#334155]">
                                    {reason}
                                    <div className="text-[11px] text-[#666] mt-[4px]">Ref: Invoice #{invoiceRef}</div>
                                </td>
                                <td className="p-[12px] border-b border-[#e2e8f0] text-[12px] text-[#334155]">-</td>
                                <td className="p-[12px] border-b border-[#e2e8f0] text-[12px] text-[#334155] text-right">{formattedAmount}</td>
                            </tr>
                        </tbody>
                    </table>

                    {/* TOTALS */}
                    <div className="flex justify-end mt-[15px]">
                        <div className="bg-[#f8fafc] p-[15px] rounded-[6px] w-[280px]">
                            <div className="flex justify-between mb-[6px] text-[12px]">
                                <span>Subtotal</span>
                                <span>{formattedAmount}</span>
                            </div>
                            <div className="flex justify-between mb-[6px] text-[11px] text-[#666]">
                                <span>Tax / VAT (0%)</span>
                                <span>0.00</span>
                            </div>
                            <div className="flex justify-between mt-[4px] pt-[8px] border-t-2 border-[#e2e8f0] font-bold text-[16px] text-[#236A9E]">
                                <span>Total Credit KES</span>
                                <span>{formattedAmount}</span>
                            </div>
                        </div>

                    </div>
                </div>



                {/* FOOTER SECTION - Absolute Positioned for Reliability */}
                <div className="footer-absolute">
                    {/* BOTTOM MESSAGE WITH BORDER */}
                    <div className="w-full border-t border-gray-200 pt-[6px] flex justify-center items-center mb-[10px]">
                        <p className="text-[8px] text-[#64748b] font-medium tracking-wide leading-tight">
                            This document officially confirms the credit adjustment to your account.
                        </p>
                    </div>

                    {/* LOGOS FOOTER */}
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-[4px]">
                            {process.env.NEXT_PUBLIC_APP_NAME !== "Pesanest" && (
                                <>
                                    <div className="w-[14px] h-[14px]">
                                        <EditableImage 
                                            settingKey="credit_note_footer_logo_left"
                                            defaultSrc="/assets/branding/eservice-logo.png" 
                                            alt="eServices Logo" 
                                            className="w-full h-full" 
                                        />
                                    </div>
                                    <div className="text-[8px] font-bold text-black">eServices<span className="text-[#dc2626]">.</span>gov<span className="text-[#dc2626]">.</span>ss</div>
                                </>
                            )}
                        </div>
                        <div className="flex items-center justify-center mt-2">
                            <div className="h-[20px]">
                                <EditableImage
                                    settingKey="credit_note_footer_logo_center"
                                    defaultSrc="/cpfooter.png"
                                    alt="Footer Logo"
                                    className="h-full"
                                />
                            </div>
                        </div>
                        <div className="flex items-center gap-[6px]">
                            {process.env.NEXT_PUBLIC_APP_NAME !== "Pesanest" && (
                                <>
                                    <div className="text-[7px] font-bold text-black text-right leading-[1.1]">Proudly South<br />Sudanese</div>
                                    <div className="w-[18px] h-[12px]">
                                        <EditableImage 
                                            settingKey="credit_note_footer_logo_right"
                                            defaultSrc="/assets/branding/Flag_of_South_Sudan.svg.png" 
                                            alt="South Sudan Flag" 
                                            className="w-full h-full" 
                                        />
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};
