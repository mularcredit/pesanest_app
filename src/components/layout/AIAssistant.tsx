'use client';

import { useState, useRef, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { PiSparkle, PiX, PiPaperPlaneTilt } from 'react-icons/pi';

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

const HAIRLINE = '1px solid rgba(0,0,0,0.06)';

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

/** Three-dot typing indicator — bounces in sequence while Nuri is "thinking". No bubble around it; it reads as a live cue, not a message. */
function TypingDots() {
    return (
        <div className="flex items-center gap-[3px] h-[26px] pl-1">
            {[0, 1, 2].map(i => (
                <motion.span key={i} className="w-[5px] h-[5px] rounded-full" style={{ background: '#c7cffb' }}
                    animate={{ y: [0, -3.5, 0], opacity: [0.35, 1, 0.35] }}
                    transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }} />
            ))}
        </div>
    );
}

/** A hairline-thin divider with a soft gradient fade instead of a flat solid line. */
function GradientDivider() {
    return <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(99,102,241,0.16), transparent)' }} />;
}

export function AIAssistant() {
    const [open, setOpen] = useState(false);
    const [greeting] = useState(() => GREETINGS[Math.floor(Math.random() * GREETINGS.length)]);

    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [chatInput, setChatInput] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [chatError, setChatError] = useState<string | null>(null);
    const chatInputRef = useRef<HTMLInputElement>(null);
    const chatEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (open) setTimeout(() => chatInputRef.current?.focus(), 150);
    }, [open]);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages, isSending]);

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
                            onClick={() => setOpen(false)}
                        />

                        <motion.div
                            className="fixed bottom-20 right-6 z-[999] w-[380px] rounded-2xl overflow-hidden flex flex-col"
                            style={{
                                height: '560px', maxHeight: 'calc(100vh - 120px)',
                                background: 'radial-gradient(circle at 100% 0%, rgba(99,102,241,0.05), white 45%)',
                                boxShadow: '0 24px 60px rgba(17,24,39,0.12), 0 0 0 1px rgba(99,102,241,0.08)',
                            }}
                            initial={{ opacity: 0, y: 16, scale: 0.96 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 16, scale: 0.96 }}
                            transition={{ duration: 0.18 }}
                        >
                            {/* Header */}
                            <div className="px-5 py-4 shrink-0 flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                    <NuriAvatar size={34} />
                                    <div>
                                        <p className="text-[13px] font-[700] text-gray-900 leading-tight flex items-center gap-1">
                                            Nuri <PiSparkle className="text-[10px] text-indigo-300" />
                                        </p>
                                        <p className="text-[10px] text-emerald-500 font-[500] flex items-center gap-1 mt-[1px]">
                                            <span className="relative flex w-[6px] h-[6px]">
                                                <span className="absolute inline-flex w-full h-full rounded-full bg-emerald-400 opacity-60 animate-ping" />
                                                <span className="relative inline-flex w-[6px] h-[6px] rounded-full bg-emerald-500" />
                                            </span>
                                            Online
                                        </p>
                                    </div>
                                </div>
                                <button onClick={() => setOpen(false)}
                                    className="w-[26px] h-[26px] flex items-center justify-center rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
                                    <PiX className="text-[14px]" />
                                </button>
                            </div>
                            <GradientDivider />

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
                                    <div className="flex items-center gap-2.5">
                                        <NuriAvatar size={26} />
                                        <TypingDots />
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
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    );
}
