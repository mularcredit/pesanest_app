'use client';

import { useState, useRef, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
    PiSparkle, PiX, PiArrowRight, PiMagnifyingGlass,
    PiReceipt, PiChartBar, PiFileText, PiUsers,
    PiCalendar, PiWallet, PiTag, PiBuildings,
    PiShieldCheck, PiClockCounterClockwise, PiPaperPlaneTilt,
    PiBooks,
} from 'react-icons/pi';

interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
}

const SUGGESTED_PROMPTS = [
    "What's our total cash and bank balance?",
    'List payments pending authorization',
    'Which invoices are overdue?',
];

/** Warm, specific openers — deliberately not "How may I assist you today." Picked once per session. */
const GREETINGS = [
    "Hey! So good to see you — what can I dig into for you today?",
    "Hi there — I've got the books open and ready. What's on your mind?",
    "Welcome back! Excited to help — what would you like to know?",
    "Hey, glad you stopped by. Ask me anything about the numbers.",
    "Hi! Think of me as your finance sidekick — what's up?",
];

const NURI_AVATAR_SRC = '/Nuri%20Avatar.png';
/** Shown on the floater while it's at rest (unopened) — a different pose/crop from the chat avatar. */
const NURI_REST_AVATAR_SRC = '/Nuri-2.png';

function NuriAvatar({ size = 28, src = NURI_AVATAR_SRC }: { size?: number; src?: string }) {
    return (
        <div className="rounded-full overflow-hidden shrink-0"
            style={{
                width: size, height: size,
                background: 'linear-gradient(135deg, rgba(99,102,241,0.10), rgba(139,92,246,0.10))',
                boxShadow: '0 0 0 1px rgba(99,102,241,0.12)',
            }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="Nuri" className="w-full h-full object-cover"
                style={{ objectPosition: 'top center' }} />
        </div>
    );
}

/** Three-dot typing indicator — bounces in sequence while Nuri is "thinking". */
function TypingDots() {
    return (
        <div className="flex items-center gap-[3px] px-1 py-1">
            {[0, 1, 2].map(i => (
                <motion.span key={i} className="w-[5px] h-[5px] rounded-full" style={{ background: '#a5b4fc' }}
                    animate={{ y: [0, -3.5, 0], opacity: [0.4, 1, 0.4] }}
                    transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }} />
            ))}
        </div>
    );
}

/** A hairline-thin divider with a soft gradient fade instead of a flat solid line. */
function GradientDivider({ vertical = false }: { vertical?: boolean }) {
    return (
        <div style={vertical
            ? { width: 1, background: 'linear-gradient(180deg, transparent, rgba(99,102,241,0.16), transparent)' }
            : { height: 1, background: 'linear-gradient(90deg, transparent, rgba(99,102,241,0.16), transparent)' }
        } />
    );
}

const HAIRLINE = '1px solid rgba(0,0,0,0.06)';

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
    const [mode, setMode] = useState<'chat' | 'guide'>('chat');
    const [search, setSearch] = useState('');
    const [selected, setSelected] = useState<typeof TOPICS[0] | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const [greeting] = useState(() => GREETINGS[Math.floor(Math.random() * GREETINGS.length)]);

    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [chatInput, setChatInput] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [chatError, setChatError] = useState<string | null>(null);
    const chatInputRef = useRef<HTMLInputElement>(null);
    const chatEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (open && mode === 'guide' && !selected) setTimeout(() => inputRef.current?.focus(), 150);
        if (open && mode === 'chat') setTimeout(() => chatInputRef.current?.focus(), 150);
    }, [open, selected, mode]);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages, isSending]);

    const filtered = TOPICS.filter(t =>
        !search || t.title.toLowerCase().includes(search.toLowerCase()) ||
        t.summary.toLowerCase().includes(search.toLowerCase())
    );

    const sendChat = async (text: string) => {
        const trimmed = text.trim();
        if (!trimmed || isSending) return;
        const next = [...chatMessages, { role: 'user' as const, content: trimmed }];
        setChatMessages(next);
        setChatInput('');
        setChatError(null);
        setIsSending(true);
        try {
            const res = await fetch('/api/ai/nuri', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: next }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Nuri could not answer that');
            setChatMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
        } catch (err: any) {
            setChatError(err.message || 'Something went wrong');
        } finally {
            setIsSending(false);
        }
    };

    return (
        <>
            {/* Floater button — shown only at rest; the avatar swaps once the panel is open */}
            {!open && (
                <motion.button
                    onClick={() => setOpen(true)}
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    className="fixed bottom-6 right-6 z-[999] flex items-center gap-2.5 pl-1.5 pr-4 py-1.5 rounded-full text-[13px] font-[600] transition-all hover:-translate-y-0.5 active:scale-95"
                    style={{
                        background: 'rgba(255,255,255,0.92)',
                        backdropFilter: 'blur(16px)',
                        border: '1px solid rgba(99,102,241,0.14)',
                        boxShadow: '0 10px 30px rgba(99,102,241,0.16), 0 2px 8px rgba(17,24,39,0.05)',
                        color: '#4338ca',
                    }}
                >
                    <span className="relative shrink-0">
                        <NuriAvatar size={36} src={NURI_REST_AVATAR_SRC} />
                        <span className="absolute -bottom-[1px] -right-[1px] w-[10px] h-[10px] rounded-full"
                            style={{ background: '#34d399', border: '2px solid white' }} />
                    </span>
                    Nuri
                </motion.button>
            )}

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
                            className="fixed bottom-20 right-6 z-[999] w-[380px] rounded-2xl overflow-hidden flex flex-col"
                            style={{
                                height: '600px', maxHeight: 'calc(100vh - 120px)',
                                background: 'radial-gradient(circle at 100% 0%, rgba(99,102,241,0.05), white 45%)',
                                boxShadow: '0 24px 60px rgba(17,24,39,0.12), 0 0 0 1px rgba(99,102,241,0.08)',
                            }}
                            initial={{ opacity: 0, y: 16, scale: 0.96 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 16, scale: 0.96 }}
                            transition={{ duration: 0.18 }}
                        >
                            {/* Header */}
                            <div className="px-5 py-4 shrink-0">
                                <div className="flex items-center justify-between mb-3.5">
                                    <div className="flex items-center gap-2.5">
                                        <NuriAvatar size={32} />
                                        <div>
                                            <p className="text-[13px] font-[700] text-gray-900 leading-tight">Nuri</p>
                                            <p className="text-[10px] text-emerald-500 font-[500] flex items-center gap-1 mt-[1px]">
                                                <span className="relative flex w-[6px] h-[6px]">
                                                    <span className="absolute inline-flex w-full h-full rounded-full bg-emerald-400 opacity-60 animate-ping" />
                                                    <span className="relative inline-flex w-[6px] h-[6px] rounded-full bg-emerald-500" />
                                                </span>
                                                Online
                                            </p>
                                        </div>
                                    </div>
                                    <button onClick={() => { setOpen(false); setSelected(null); setSearch(''); }}
                                        className="w-[26px] h-[26px] flex items-center justify-center rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
                                        <PiX className="text-[14px]" />
                                    </button>
                                </div>

                                <div className="flex items-center gap-5 mb-3.5" style={{ borderBottom: HAIRLINE }}>
                                    {([
                                        { id: 'chat' as const, label: 'Ask Nuri', icon: PiSparkle },
                                        { id: 'guide' as const, label: 'Guide', icon: PiBooks },
                                    ]).map(tab => (
                                        <button key={tab.id} onClick={() => setMode(tab.id)}
                                            className="relative flex items-center gap-1.5 pb-2.5 text-[12px] font-[600] transition-colors"
                                            style={{ color: mode === tab.id ? '#6366F1' : '#9ca3af' }}>
                                            <tab.icon className="text-[13px]" /> {tab.label}
                                            {mode === tab.id && (
                                                <motion.div layoutId="nuri-tab-underline"
                                                    className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full"
                                                    style={{ background: 'linear-gradient(90deg, #6366F1, #8b5cf6)' }}
                                                    transition={{ type: 'spring', stiffness: 500, damping: 35 }} />
                                            )}
                                        </button>
                                    ))}
                                </div>

                                {mode === 'guide' && !selected && (
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
                            <GradientDivider />

                            {/* Body */}
                            {mode === 'guide' ? (
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

                                            <button onClick={() => setMode('chat')}
                                                className="w-full mt-5 pt-4 rounded-[10px] p-3.5 text-center transition-colors hover:bg-indigo-50/40"
                                                style={{ background: 'rgba(99,102,241,0.04)', border: '1px dashed rgba(99,102,241,0.2)' }}>
                                                <PiSparkle className="text-[#6366F1] text-[16px] mx-auto mb-1" />
                                                <p className="text-[11px] text-gray-400">Have a live data question instead? <span className="text-[#6366F1] font-[600]">Ask Nuri</span></p>
                                            </button>
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
                            ) : (
                            <>
                                {/* Chat */}
                                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
                                    style={{ background: 'radial-gradient(circle at 0% 100%, rgba(139,92,246,0.035), transparent 55%)' }}>
                                    {chatMessages.length === 0 && (
                                        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                                            <div className="flex gap-2.5">
                                                <NuriAvatar size={26} />
                                                <div className="rounded-[12px] rounded-tl-none px-3.5 py-2.5 text-[12.5px] text-gray-700 max-w-[85%]"
                                                    style={{ background: 'linear-gradient(135deg, rgba(249,250,251,0.9), rgba(243,244,246,0.7))', border: HAIRLINE }}>
                                                    {greeting}
                                                </div>
                                            </div>
                                            <div className="flex flex-col gap-1.5 pl-[34px]">
                                                {SUGGESTED_PROMPTS.map(p => (
                                                    <button key={p} onClick={() => sendChat(p)}
                                                        className="text-left px-3 py-2 rounded-[10px] text-[11.5px] text-gray-600 hover:text-[#6366F1] transition-colors"
                                                        style={{ border: HAIRLINE, background: 'rgba(250,250,252,0.6)' }}>
                                                        {p}
                                                    </button>
                                                ))}
                                            </div>
                                        </motion.div>
                                    )}

                                    {chatMessages.map((m, i) => (
                                        <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                                            transition={{ duration: 0.18 }}
                                            className={cn('flex gap-2.5', m.role === 'user' && 'flex-row-reverse')}>
                                            {m.role === 'assistant' && <NuriAvatar size={26} />}
                                            <div className={cn(
                                                'rounded-[12px] px-3.5 py-2.5 text-[12.5px] leading-relaxed max-w-[85%] whitespace-pre-wrap',
                                                m.role === 'user' ? 'text-white rounded-tr-none' : 'text-gray-700 rounded-tl-none'
                                            )}
                                                style={m.role === 'user'
                                                    ? { background: 'linear-gradient(135deg, #6366F1, #7c6ef0)', boxShadow: '0 4px 14px rgba(99,102,241,0.25)' }
                                                    : { background: 'linear-gradient(135deg, rgba(249,250,251,0.9), rgba(243,244,246,0.7))', border: HAIRLINE }}>
                                                {m.content}
                                            </div>
                                        </motion.div>
                                    ))}

                                    {isSending && (
                                        <div className="flex gap-2.5">
                                            <NuriAvatar size={26} />
                                            <div className="rounded-[12px] rounded-tl-none" style={{ background: 'linear-gradient(135deg, rgba(249,250,251,0.9), rgba(243,244,246,0.7))', border: HAIRLINE }}>
                                                <TypingDots />
                                            </div>
                                        </div>
                                    )}

                                    {chatError && (
                                        <div className="px-3.5 py-2.5 rounded-[8px] text-[11.5px] text-rose-600 bg-rose-50" style={{ border: '1px solid rgba(225,29,72,0.2)' }}>
                                            {chatError}
                                        </div>
                                    )}
                                    <div ref={chatEndRef} />
                                </div>

                                {/* Chat input */}
                                <GradientDivider />
                                <div className="px-4 py-3 shrink-0">
                                    <div className="flex items-center gap-2">
                                        <input
                                            ref={chatInputRef}
                                            value={chatInput}
                                            onChange={e => setChatInput(e.target.value)}
                                            onKeyDown={e => { if (e.key === 'Enter') sendChat(chatInput); }}
                                            placeholder="Ask about balances, payments, invoices…"
                                            disabled={isSending}
                                            className="flex-1 rounded-full pl-4 pr-4 py-2.5 text-[12.5px] text-gray-900 outline-none focus:ring-2 focus:ring-[#6366F1]/15 disabled:opacity-60 transition-shadow"
                                            style={{ border: HAIRLINE, background: 'rgba(250,250,252,0.7)' }}
                                        />
                                        <button onClick={() => sendChat(chatInput)} disabled={isSending || !chatInput.trim()}
                                            className="w-[36px] h-[36px] rounded-full flex items-center justify-center text-white shrink-0 transition-all disabled:opacity-35 hover:scale-105 active:scale-95"
                                            style={{ background: 'linear-gradient(135deg, #6366F1, #8b5cf6)', boxShadow: '0 4px 14px rgba(99,102,241,0.3)' }}>
                                            <PiPaperPlaneTilt className="text-[14px]" />
                                        </button>
                                    </div>
                                </div>
                            </>
                            )}
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    );
}
