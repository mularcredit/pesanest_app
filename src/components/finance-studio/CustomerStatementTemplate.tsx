"use client";

import React from 'react';
import { EditableImage } from './EditableImage';

export interface Transaction {
    id: string | number;
    operator: string;
    invoiceRef: string;
    period: string;
    debit?: number;
    credit?: number;
    balance: number;
}

export interface CustomerStatementProps {
    statementNo: string;
    date: Date;
    period: string;
    customer: {
        name: string;
        group: string;
        country: string;
        accountType: string;
    };
    summary: {
        openingBalance: number;
        totalCharges: number;
        totalPayments: number;
        outstandingBalance: number;
    };
    transactions: Transaction[];
    notes: string[];
}

export const CustomerStatementTemplate: React.FC<CustomerStatementProps> = ({
    statementNo,
    date,
    period,
    customer,
    summary,
    transactions,
    notes,
}) => {
    const formatCurrency = (val: number) =>
        new Intl.NumberFormat('en-US', { style: 'currency', currency: 'KES' }).format(val);

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
            .print-container {
                box-shadow: none !important;
                margin: 0 !important;
                height: auto !important;
                min-height: 297mm !important;
                padding-bottom: 30mm !important; 
            }
            .footer-absolute {
                position: fixed !important; /* Fixed pins it to the page bottom */
                bottom: 0 !important;
                left: 0 !important; 
                right: 0 !important;
                width: 210mm !important; /* Match A4 width */
                padding: 0 15mm 10mm 15mm !important; /* Padding for content inside footer */
                background: white !important; /* Ensure no transparent overlap */
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

            <div className="print-container w-[210mm] max-w-full bg-white relative p-[5mm_15mm_20mm] shadow-lg min-h-[297mm] flex flex-col justify-between mx-auto relative content-container">
                <div className="watermark">
                    {process.env.NEXT_PUBLIC_APP_NAME !== "Pesanest" && (
                        <img src="/assets/branding/emblem_of_south_sudan-freelogovectors.net_-400x395.png" alt="South Sudan Emblem" className="w-full h-full object-contain filter grayscale" />
                    )}
                </div>

                <div className="relative z-10">
                    {process.env.NEXT_PUBLIC_APP_NAME === "Pesanest" ? (
                        <div className="flex justify-start items-center mb-[8px] pb-[8px] border-b-2 border-[#eee]">
                            <div className="logo-container right-logo flex items-center justify-start w-[140px] h-[60px]">
                                <EditableImage 
                                    settingKey="pesanest_statement_logo" 
                                    defaultSrc="/pesanest/pesanest-dark.png" 
                                    alt="Pesanest Logo" 
                                    className="w-full h-full" 
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="flex justify-between items-center mb-[8px] pb-[8px] border-b-2 border-[#eee]">
                            <div className="logo-container flex items-center justify-center w-[60px] h-[60px]">
                                <EditableImage 
                                    settingKey="nra_statement_logo_left"
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
                                    settingKey="caa_statement_logo_right"
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
                        Customer Statement of Account
                    </div>

                    {/* CONTENT WRAPPER */}
                    <div className="flex-grow flex flex-col justify-start pt-[15px] gap-[15px]">

                        {/* STATEMENT INFO */}
                        <div className="grid grid-cols-2 gap-[12px] mb-[10px]">
                            <div>
                                <h4 className="text-[8px] uppercase text-[#64748b] m-0 mb-[2px] font-normal">Statement No.</h4>
                                <p className="m-0 text-[9px] font-bold text-[#1a1a1a]">{statementNo}</p>
                            </div>
                            <div>
                                <h4 className="text-[8px] uppercase text-[#64748b] m-0 mb-[2px] font-normal">Statement Date</h4>
                                <p className="m-0 text-[9px] font-bold text-[#1a1a1a]">{formatDate(date)}</p>
                            </div>
                            <div>
                                <h4 className="text-[8px] uppercase text-[#64748b] m-0 mb-[2px] font-normal">Currency</h4>
                                <p className="m-0 text-[9px] font-bold text-[#1a1a1a]">KES</p>
                            </div>
                            <div className="text-right">
                                <h4 className="text-[8px] uppercase text-[#64748b] m-0 mb-[2px] font-normal">Statement Period</h4>
                                <p className="m-0 text-[9px] font-bold text-[#1a1a1a]">{period}</p>
                            </div>
                        </div>

                        {/* CUSTOMER BOX */}
                        <div className="border border-[#e2e8f0] rounded-[4px] overflow-hidden mb-[10px]">
                            <div className="p-[5px_10px] font-bold text-[10px] uppercase bg-[#f8fafc] text-[#333] border-b border-[#e2e8f0]">Customer Details</div>
                            <div className="p-[8px_10px] text-[10px] leading-[1.4] text-[#475569]">
                                <strong>{customer.name}</strong><br />
                                {customer.group}<br />
                                {customer.country}<br />
                                <span className="text-[#888] text-[11px] mt-[4px] block">Account Type: {customer.accountType}</span>
                            </div>
                        </div>

                        {/* SUMMARY BOX */}
                        <div className="bg-[#f8fafc] p-[8px_12px] rounded-[4px] mb-[10px] border border-[#e2e8f0]">
                            <h3 className="text-[13px] font-bold m-0 mb-[6px] text-[#236A9E]">Statement Summary</h3>
                            <div className="flex justify-between mb-[4px] text-[10px]">
                                <span>Opening Balance</span>
                                <span>{formatCurrency(summary.openingBalance)}</span>
                            </div>
                            <div className="flex justify-between mb-[4px] text-[10px]">
                                <span>Total Charges (Overflight Services)</span>
                                <span>{formatCurrency(summary.totalCharges)}</span>
                            </div>
                            <div className="flex justify-between mb-[4px] text-[10px]">
                                <span>Total Payments Received</span>
                                <span>({formatCurrency(summary.totalPayments)})</span>
                            </div>
                            <div className="flex justify-between mb-[4px] text-[11px] font-bold text-[#236A9E] border-t-2 border-[#e2e8f0] pt-[4px] mt-[4px]">
                                <span>Outstanding Balance</span>
                                <span>{formatCurrency(summary.outstandingBalance)}</span>
                            </div>
                        </div>

                        {/* TABLE */}
                        <table className="w-full border-collapse mb-[10px] text-[9px]">
                            <thead>
                                <tr>
                                    <th className="bg-[#236A9E] text-white text-left p-[5px_4px] text-[8px] uppercase font-semibold w-[5%]">#</th>
                                    <th className="bg-[#236A9E] text-white text-left p-[5px_4px] text-[8px] uppercase font-semibold w-[18%]">Description</th>
                                    <th className="bg-[#236A9E] text-white text-left p-[5px_4px] text-[8px] uppercase font-semibold w-[14%]">Reference</th>
                                    <th className="bg-[#236A9E] text-white text-left p-[5px_4px] text-[8px] uppercase font-semibold w-[23%]">Date</th>
                                    <th className="bg-[#236A9E] text-white text-right p-[5px_4px] text-[8px] uppercase font-semibold w-[13%]">Debit (KES)</th>
                                    <th className="bg-[#236A9E] text-white text-right p-[5px_4px] text-[8px] uppercase font-semibold w-[13%]">Credit (KES)</th>
                                    <th className="bg-[#236A9E] text-white text-right p-[5px_4px] text-[8px] uppercase font-semibold w-[14%]">Balance (KES)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {transactions.map((tx, idx) => (
                                    <tr key={idx}>
                                        <td className="p-[4px] border-b border-[#e2e8f0] text-[9px] text-[#334155]">{idx + 1}</td>
                                        <td className="p-[4px] border-b border-[#e2e8f0] text-[9px] text-[#334155]">{tx.operator}</td>
                                        <td className="p-[4px] border-b border-[#e2e8f0] text-[9px] text-[#334155]">{tx.invoiceRef}</td>
                                        <td className="p-[4px] border-b border-[#e2e8f0] text-[9px] text-[#334155]">{tx.period}</td>
                                        <td className="p-[4px] border-b border-[#e2e8f0] text-[9px] text-[#334155] text-right">{tx.debit ? formatCurrency(tx.debit) : '—'}</td>
                                        <td className="p-[4px] border-b border-[#e2e8f0] text-[9px] text-[#334155] text-right">{tx.credit ? formatCurrency(tx.credit) : '—'}</td>
                                        <td className="p-[4px] border-b border-[#e2e8f0] text-[9px] text-[#334155] text-right">{formatCurrency(tx.balance)}</td>
                                    </tr>
                                ))}
                                <tr className="bg-[#fef9c3] font-bold">
                                    <td colSpan={4} className="p-[4px] text-right uppercase text-[10px] border-t-2 border-[#236A9E]">Totals</td>
                                    <td className="p-[4px] text-right text-[10px] border-t-2 border-[#236A9E]">{formatCurrency(summary.totalCharges)}</td>
                                    <td className="p-[4px] text-right text-[10px] border-t-2 border-[#236A9E]">{formatCurrency(summary.totalPayments)}</td>
                                    <td className="p-[4px] text-right text-[10px] border-t-2 border-[#236A9E]">{formatCurrency(summary.outstandingBalance)}</td>
                                </tr>
                            </tbody>
                        </table>

                        {/* NOTES */}
                        {notes && notes.length > 0 && (
                            <div className="bg-[#f8fafc] p-[8px_10px] border-l-[3px] border-[#236A9E] mb-[10px] text-[9px] leading-[1.3]">
                                <h3 className="text-[10px] font-bold m-0 mb-[5px] text-[#236A9E]">Notes to Customer</h3>
                                <ul className="m-[3px_0] pl-[15px] list-disc">
                                    {notes.map((note, idx) => (
                                        <li key={idx} className="mb-[2px]">{note}</li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* OUTSTANDING BALANCE HIGHLIGHT */}
                        <div className="bg-[#dc2626] text-white p-[10px] rounded-[4px] text-center mb-[15px]">
                            <h3 className="text-[11px] font-semibold m-0 mb-[5px] uppercase">Total Outstanding Balance</h3>
                            <p className="text-[20px] font-[900] m-0">{formatCurrency(summary.outstandingBalance)}</p>
                            <p className="text-[11px] m-[8px_0_0_0] opacity-90">Payment Due Upon Receipt</p>
                        </div>
                    </div>

                    {/* FOOTER SECTION - Absolute Positioned for Reliability */}
                    <div className="footer-absolute">
                        {/* BOTTOM MESSAGE WITH BORDER */}
                        <div className="w-full border-t border-gray-200 pt-[6px] flex justify-center items-center mb-[10px]">
                            <p className="text-[8px] text-[#64748b] font-medium tracking-wide leading-tight">
                                We value your business. Please contact us for any billing inquiries.
                            </p>
                        </div>

                        {/* LOGOS FOOTER */}
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-[4px]">
                                {process.env.NEXT_PUBLIC_APP_NAME !== "Pesanest" && (
                                    <>
                                        <div className="w-[14px] h-[14px]">
                                            <EditableImage 
                                                settingKey="statement_footer_logo_left"
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
                                        settingKey="statement_footer_logo_center"
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
                                                settingKey="statement_footer_logo_right"
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
