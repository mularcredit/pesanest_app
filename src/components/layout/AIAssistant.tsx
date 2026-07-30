'use client';

import { useState, useRef, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
    PiSparkle, PiX, PiArrowRight, PiMagnifyingGlass,
    PiReceipt, PiChartBar, PiFileText, PiUsers,
    PiCalendar, PiWallet, PiTag, PiBuildings,
    PiShieldCheck, PiClockCounterClockwise,
} from 'react-icons/pi';

const HAIRLINE = '1px solid rgba(0,0,0,0.07)';

const TOPICS = [
    {
        icon: PiWallet,
        color: '#6366F1',
        title: 'Wallet & Funds',
        summary: 'Manage your corporate wallet balance.',
        content: [
            'Go to **Dashboard** to see your live wallet balance.',
            'Use **Allocate** to distribute funds to branches by category.',
            'Use **Top Up** to add funds via Paystack.',
            'The wallet syncs automatically with your payment gateway.',
        ],
    },
    {
        icon: PiFileText,
        color: '#7c3aed',
        title: "Expenses",
        summary: 'Submit and approve purchase requests.',
        content: [
            'Navigate to **Expenses** to create a new request.',
            'Add line items with category, quantity, and amount.',
            'Submit for approval — the workflow routes to your approver.',
            'Approved expenses can be linked to vouchers or invoices.',
        ],
    },
    {
        icon: PiReceipt,
        color: '#059669',
        title: 'Voucher Studio',
        summary: 'Create and issue disbursement vouchers.',
        content: [
            'Open **Voucher Studio** from the sidebar.',
            'Fill in beneficiary, payment mode, and line items.',
            'Save a draft anytime — it persists across sessions.',
            'Download as a professional PDF when ready.',
        ],
    },
    {
        icon: PiChartBar,
        color: '#0284c7',
        title: 'Finance Studio',
        summary: 'Generate credit notes, receipts, and statements.',
        content: [
            'Switch between **Credit Note**, **Receipt**, and **Statement** tabs.',
            'Select a customer to auto-populate their details.',
            'Add transaction rows and set date ranges.',
            'Export to PDF directly from the studio.',
        ],
    },
    {
        icon: PiCalendar,
        color: '#d97706',
        title: 'Schedules',
        summary: 'Automate recurring payment workflows.',
        content: [
            'Go to **Schedules** to set up recurring expenses.',
            'Link a schedule to an existing expense item.',
            'Set frequency: Daily, Weekly, Monthly, Quarterly, or Yearly.',
            'Run overdue schedules manually from the schedule list.',
        ],
    },
    {
        icon: PiUsers,
        color: '#db2777',
        title: 'Vendors & Customers',
        summary: 'Manage your counterparties.',
        content: [
            'Find **Vendors** and **Customers** under the Accounting menu.',
            'Add contact details, payment terms, and reference docs.',
            'Attach statements and agreements to each record.',
            'Deleted records go to trash and can be restored.',
        ],
    },
    {
        icon: PiBuildings,
        color: '#0891b2',
        title: 'Branches',
        summary: 'Manage multi-branch fund allocation.',
        content: [
            'Each branch has its own allocated balance and category limits.',
            'Allocate funds from the corporate wallet to any branch.',
            'Branch managers see only their branch transactions.',
            'Bulk allocate to multiple branches at once from the wallet page.',
        ],
    },
    {
        icon: PiTag,
        color: '#65a30d',
        title: 'Expense Categories',
        summary: 'Organise spending by category.',
        content: [
            'Categories are configured in **Settings → Categories**.',
            'Each expense and allocation is tagged to a category.',
            'Dashboard charts break down spend by category.',
            'Use categories to set budgets and track utilisation.',
        ],
    },
    {
        icon: PiShieldCheck,
        color: '#6366F1',
        title: 'Approvals & Roles',
        summary: 'Understand the approval workflow.',
        content: [
            'Roles: **Admin**, **Manager**, **Employee** — set in Settings.',
            'Employees submit expenses; Managers approve or reject.',
            'Admins can override any stage in the workflow.',
            'All actions are logged in the Audit Trail.',
        ],
    },
    {
        icon: PiClockCounterClockwise,
        color: '#64748b',
        title: 'Audit Trail',
        summary: 'Track every action in the system.',
        content: [
            'Find **Audit Trail** under Settings.',
            'Every create, edit, approve, and delete is logged.',
            'Filter by user, date range, or action type.',
            'Exported as CSV for compliance reporting.',
        ],
    },
];

function renderContent(text: string) {
    return text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
}

export function AIAssistant() {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [selected, setSelected] = useState<typeof TOPICS[0] | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (open && !selected) setTimeout(() => inputRef.current?.focus(), 150);
    }, [open, selected]);

    const filtered = TOPICS.filter(t =>
        !search || t.title.toLowerCase().includes(search.toLowerCase()) ||
        t.summary.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <>
            {/* Floater button */}
            <button
                onClick={() => setOpen(true)}
                className="fixed bottom-6 right-6 z-[999] flex items-center gap-2.5 px-4 py-3 rounded-full text-white text-[13px] font-[600] shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5 active:scale-95"
                style={{ background: 'linear-gradient(135deg, #6366F1, #4f46e5)', boxShadow: '0 8px 24px rgba(99,102,241,0.35)' }}
            >
                Help
            </button>

            {/* Panel */}
            <AnimatePresence>
                {open && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            className="fixed inset-0 z-[998] bg-black/20"
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            onClick={() => { setOpen(false); setSelected(null); setSearch(''); }}
                        />

                        <motion.div
                            className="fixed bottom-20 right-6 z-[999] w-[360px] bg-white rounded-2xl overflow-hidden flex flex-col"
                            style={{ maxHeight: '520px', boxShadow: '0 24px 60px rgba(0,0,0,0.14), 0 0 0 1px rgba(0,0,0,0.06)' }}
                            initial={{ opacity: 0, y: 16, scale: 0.96 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 16, scale: 0.96 }}
                            transition={{ duration: 0.18 }}
                        >
                            {/* Header */}
                            <div className="px-5 py-4 shrink-0" style={{ borderBottom: HAIRLINE }}>
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-[28px] h-[28px] rounded-[7px] flex items-center justify-center"
                                            style={{ background: 'linear-gradient(135deg, #6366F1, #4f46e5)' }}>
                                            <PiSparkle className="text-white text-[14px]" />
                                        </div>
                                        <div>
                                            <p className="text-[13px] font-[700] text-gray-900 leading-tight">System Help</p>
                                            <p className="text-[10px] text-gray-400">AI assistant coming soon</p>
                                        </div>
                                    </div>
                                    <button onClick={() => { setOpen(false); setSelected(null); setSearch(''); }}
                                        className="w-[26px] h-[26px] flex items-center justify-center rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
                                        <PiX className="text-[14px]" />
                                    </button>
                                </div>

                                {!selected && (
                                    <div>
                                        <input
                                            ref={inputRef}
                                            value={search}
                                            onChange={e => setSearch(e.target.value)}
                                            placeholder="Search topics…"
                                            className="w-full rounded-[8px] pl-3 pr-3 py-2 text-[12.5px] text-gray-900 outline-none focus:ring-2 focus:ring-[#6366F1]/15"
                                            style={{ border: HAIRLINE, background: '#fafafa' }}
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Body */}
                            <div className="flex-1 overflow-y-auto">
                                <AnimatePresence mode="wait">
                                    {selected ? (
                                        <motion.div key="detail"
                                            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
                                            transition={{ duration: 0.15 }} className="p-5">

                                            <button onClick={() => setSelected(null)}
                                                className="flex items-center gap-1.5 text-[11px] font-[600] text-[#6366F1] mb-4 hover:opacity-70 transition-opacity">
                                                ← Back
                                            </button>

                                            <div className="flex items-center gap-3 mb-4">
                                                <div className="w-[36px] h-[36px] rounded-[9px] flex items-center justify-center shrink-0"
                                                    style={{ background: `${selected.color}18` }}>
                                                    <selected.icon className="text-[18px]" style={{ color: selected.color }} />
                                                </div>
                                                <div>
                                                    <p className="text-[14px] font-[700] text-gray-900">{selected.title}</p>
                                                    <p className="text-[11.5px] text-gray-400">{selected.summary}</p>
                                                </div>
                                            </div>

                                            <div className="space-y-3">
                                                {selected.content.map((line, i) => (
                                                    <div key={i} className="flex gap-3 items-start">
                                                        <div className="w-[20px] h-[20px] rounded-full flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-[700] text-white"
                                                            style={{ background: selected.color }}>
                                                            {i + 1}
                                                        </div>
                                                        <p className="text-[12.5px] text-gray-600 leading-relaxed flex-1"
                                                            dangerouslySetInnerHTML={{ __html: renderContent(line) }} />
                                                    </div>
                                                ))}
                                            </div>

                                            <div className="mt-5 pt-4 rounded-[10px] p-3.5 text-center"
                                                style={{ background: 'rgba(99,102,241,0.04)', border: '1px dashed rgba(99,102,241,0.2)' }}>
                                                <PiSparkle className="text-[#6366F1] text-[16px] mx-auto mb-1" />
                                                <p className="text-[11px] text-gray-400">AI assistant coming soon for deeper guidance</p>
                                            </div>
                                        </motion.div>
                                    ) : (
                                        <motion.div key="list"
                                            initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                                            transition={{ duration: 0.15 }}>

                                            {filtered.length === 0 ? (
                                                <div className="py-12 text-center">
                                                    <p className="text-[12px] text-gray-400">No topics found</p>
                                                </div>
                                            ) : (
                                                filtered.map((topic, i) => (
                                                    <button key={topic.title}
                                                        onClick={() => setSelected(topic)}
                                                        className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-gray-50 transition-colors group"
                                                        style={i > 0 ? { borderTop: HAIRLINE } : {}}>
                                                        <div className="w-[32px] h-[32px] rounded-[8px] flex items-center justify-center shrink-0"
                                                            style={{ background: `${topic.color}15` }}>
                                                            <topic.icon className="text-[16px]" style={{ color: topic.color }} />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-[12.5px] font-[600] text-gray-900">{topic.title}</p>
                                                            <p className="text-[11px] text-gray-400 truncate">{topic.summary}</p>
                                                        </div>
                                                        <PiArrowRight className="text-gray-300 group-hover:text-[#6366F1] text-[13px] transition-colors shrink-0" />
                                                    </button>
                                                ))
                                            )}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    );
}
