'use client';

import { useState, useRef, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { PiSparkle, PiX, PiPaperPlaneTilt, PiWallet, PiClockCountdown, PiWarningCircle, PiArrowUpRight } from 'react-icons/pi';

interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
}

const SUGGESTED_PROMPTS = [
    { icon: PiWallet, text: "What's our total cash and bank balance?" },
    { icon: PiClockCountdown, text: 'List payments pending authorization' },
    { icon: PiWarningCircle, text: 'Which invoices are overdue?' },
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

/** Premium easing curve — a soft, decisive ease-out. Used for panel open/close and message entry. */
const EASE = [0.16, 1, 0.3, 1] as const;

/** Nuri's replies come back with light markdown (**bold**, "- " bullets) — render it instead of showing raw asterisks. */
function renderMarkdown(content: string) {
    const renderInline = (text: string) =>
        text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((chunk, i) => {
            if (chunk.startsWith('**') && chunk.endsWith('**')) {
                return <strong key={i} className="font-[600] text-gray-800">{chunk.slice(2, -2)}</strong>;
            }
            if (chunk.startsWith('`') && chunk.endsWith('`')) {
                return (
                    <code key={i} className="px-1 py-0.5 rounded-[4px] text-[11.5px] font-mono"
                        style={{ background: 'rgba(17,24,39,0.055)' }}>
                        {chunk.slice(1, -1)}
                    </code>
                );
            }
            return chunk;
        });

    const lines = content.split('\n');
    const blocks: React.ReactNode[] = [];
    let bullets: string[] = [];
    const flushBullets = () => {
        if (bullets.length) {
            blocks.push(
                <ul key={`ul-${blocks.length}`} className="pl-4 space-y-0.5 list-disc">
                    {bullets.map((b, i) => <li key={i}>{renderInline(b)}</li>)}
                </ul>
            );
            bullets = [];
        }
    };

    lines.forEach((line, i) => {
        const bullet = line.match(/^\s*-\s+(.*)/);
        if (bullet) {
            bullets.push(bullet[1]);
            return;
        }
        flushBullets();
        if (line.trim()) blocks.push(<p key={i}>{renderInline(line)}</p>);
        else blocks.push(<div key={i} className="h-2" />);
    });
    flushBullets();

    return blocks;
}

function NuriAvatar({ size = 28, src = NURI_AVATAR_SRC }: { size?: number; src?: string }) {
    return (
        <div className="rounded-full overflow-hidden shrink-0"
            style={{
                width: size, height: size,
                background: 'linear-gradient(135deg, rgba(139,110,255,0.14), rgba(52,211,153,0.10))',
                boxShadow: '0 0 0 1px rgba(139,110,255,0.14)',
            }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="Nuri" className="w-full h-full object-cover"
                style={{ objectPosition: 'top center' }} />
        </div>
    );
}

/**
 * Three-dot typing indicator — bounces in sequence while Nuri is "thinking".
 * Left exactly as it was: this is the loader the redesign was told not to touch.
 */
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
    return <div className="shrink-0" style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(139,110,255,0.14), transparent)' }} />;
}

/** The ambient purple/mint glow that floats behind the panel and the launcher — never clipped by rounded corners. */
function AmbientGlow() {
    return (
        <>
            <div className="absolute -top-8 -left-10 w-[130px] h-[130px] rounded-full pointer-events-none"
                style={{ background: '#a78bfa', opacity: 0.14, filter: 'blur(46px)' }} />
            <div className="absolute -bottom-10 -right-8 w-[130px] h-[130px] rounded-full pointer-events-none"
                style={{ background: '#34d399', opacity: 0.10, filter: 'blur(46px)' }} />
        </>
    );
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
        if (open) setTimeout(() => chatInputRef.current?.focus(), 200);
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
            {/* Floater — a plain circular avatar with an idle breathing pulse and soft ambient glow. */}
            {!open && (
                <div className="fixed bottom-6 right-6 z-[999]">
                    <AmbientGlow />
                    <motion.button
                        onClick={() => setOpen(true)}
                        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0, scale: [1, 1.035, 1] }}
                        transition={{ opacity: { duration: 0.3 }, y: { duration: 0.3 }, scale: { duration: 3.2, repeat: Infinity, ease: 'easeInOut' } }}
                        whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }}
                        className="relative w-[58px] h-[58px] rounded-full flex items-center justify-center"
                        style={{
                            background: 'rgba(255,255,255,0.9)',
                            backdropFilter: 'blur(16px)',
                            border: '1px solid rgba(139,110,255,0.16)',
                            boxShadow: '0 10px 30px rgba(139,110,255,0.18), 0 2px 10px rgba(17,24,39,0.06)',
                        }}
                    >
                        <NuriAvatar size={50} src={NURI_REST_AVATAR_SRC} />
                        <span className="absolute bottom-0 right-0 w-[13px] h-[13px] rounded-full"
                            style={{ background: '#34d399', border: '2.5px solid white' }} />
                    </motion.button>
                </div>
            )}

            {/* Panel */}
            <AnimatePresence>
                {open && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            className="fixed inset-0 z-[998]"
                            style={{ background: 'rgba(17,24,39,0.18)' }}
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            onClick={() => setOpen(false)}
                        />

                        {/* Positioning wrapper — kept separate from the panel so the ambient glow isn't clipped by its rounded corners */}
                        <div className={cn(
                            'fixed z-[999]',
                            'inset-x-3 top-[max(16px,env(safe-area-inset-top))] bottom-[max(12px,env(safe-area-inset-bottom))]',
                            'sm:inset-auto sm:top-auto sm:bottom-6 sm:right-6 sm:w-[410px] sm:h-[640px]'
                        )}>
                            <AmbientGlow />
                            <motion.div
                                className="relative w-full h-full rounded-[26px] overflow-hidden flex flex-col"
                                style={{
                                    background: 'linear-gradient(160deg, rgba(167,139,250,0.05) 0%, rgba(255,255,255,0.97) 42%, rgba(255,255,255,0.97) 62%, rgba(52,211,153,0.045) 100%)',
                                    backdropFilter: 'blur(20px) saturate(160%)',
                                    boxShadow: 'inset 0 0 0 1px rgba(139,110,255,0.10), 0 30px 70px rgba(17,24,39,0.14)',
                                }}
                                initial={{ opacity: 0, y: 14, scale: 0.96 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 14, scale: 0.96 }}
                                transition={{ duration: 0.3, ease: EASE }}
                            >
                                {/* Header */}
                                <div className="px-5 pt-5 pb-4 shrink-0 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <NuriAvatar size={36} />
                                        <div>
                                            <p className="text-[13.5px] font-[600] text-gray-900 leading-tight">Nuri</p>
                                            <p className="text-[10.5px] text-gray-400 font-[500] flex items-center gap-1.5 mt-[2px]">
                                                <span className="relative flex w-[6px] h-[6px]">
                                                    <span className="absolute inline-flex w-full h-full rounded-full bg-emerald-400 opacity-60 animate-ping" />
                                                    <span className="relative inline-flex w-[6px] h-[6px] rounded-full bg-emerald-400" />
                                                </span>
                                                Online
                                            </p>
                                        </div>
                                    </div>
                                    <motion.button onClick={() => setOpen(false)}
                                        whileHover={{ background: 'rgba(17,24,39,0.05)' }} whileTap={{ scale: 0.92 }}
                                        className="w-[30px] h-[30px] flex items-center justify-center rounded-full text-gray-400 transition-colors">
                                        <PiX className="text-[15px]" />
                                    </motion.button>
                                </div>
                                <GradientDivider />

                                {/* Chat */}
                                <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
                                    {chatMessages.length === 0 && (
                                        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                                            transition={{ duration: 0.3, ease: EASE }}
                                            className="flex flex-col items-center text-center pt-4 pb-2">
                                            <NuriAvatar size={56} />
                                            <p className="text-[16px] font-[600] text-gray-900 mt-4">Hi, I'm Nuri</p>
                                            <p className="text-[12.5px] text-gray-400 mt-1 max-w-[260px] leading-relaxed">
                                                {greeting}
                                            </p>

                                            <div className="w-full flex flex-col gap-2 mt-6">
                                                {SUGGESTED_PROMPTS.map((p, i) => (
                                                    <motion.button key={p.text} onClick={() => sendChat(p.text)}
                                                        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                                                        transition={{ duration: 0.25, delay: 0.08 + i * 0.05, ease: EASE }}
                                                        whileHover={{ y: -1, background: 'rgba(139,110,255,0.045)' }}
                                                        className="w-full flex items-center gap-2.5 px-3.5 py-3 rounded-[14px] text-left transition-colors"
                                                        style={{ border: '1px solid rgba(17,24,39,0.06)', background: 'rgba(255,255,255,0.5)' }}>
                                                        <span className="w-[26px] h-[26px] rounded-full flex items-center justify-center shrink-0"
                                                            style={{ background: 'rgba(139,110,255,0.08)' }}>
                                                            <p.icon className="text-[12px]" style={{ color: '#7c6ef0' }} />
                                                        </span>
                                                        <span className="flex-1 text-[12px] font-[500] text-gray-600">{p.text}</span>
                                                        <PiArrowUpRight className="text-[12px] text-gray-300 shrink-0" />
                                                    </motion.button>
                                                ))}
                                            </div>
                                        </motion.div>
                                    )}

                                    {chatMessages.map((m, i) => (
                                        <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                                            transition={{ duration: 0.28, ease: EASE }}
                                            className={cn('flex gap-2.5', m.role === 'user' && 'flex-row-reverse')}>
                                            {m.role === 'assistant' && <NuriAvatar size={26} />}
                                            <div className={cn(
                                                'rounded-[16px] px-4 py-3 text-[12.5px] leading-[1.6] max-w-[82%] space-y-1',
                                                m.role === 'user' ? 'text-[#372f8f]' : 'text-gray-600'
                                            )}
                                                style={m.role === 'user'
                                                    ? { background: 'linear-gradient(135deg, rgba(139,110,255,0.14), rgba(139,110,255,0.08))', border: '1px solid rgba(139,110,255,0.16)' }
                                                    : { background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(17,24,39,0.055)' }}>
                                                {m.role === 'assistant' ? renderMarkdown(m.content) : m.content}
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
                                        <div className="px-3.5 py-2.5 rounded-[12px] text-[11.5px] text-rose-500"
                                            style={{ border: '1px solid rgba(244,63,94,0.16)', background: 'rgba(244,63,94,0.04)' }}>
                                            {chatError}
                                        </div>
                                    )}
                                    <div ref={chatEndRef} />
                                </div>

                                {/* Composer */}
                                <div className="px-4 pb-4 pt-1 shrink-0">
                                    <div className="flex items-center gap-2 rounded-[22px] pl-4 pr-1.5 py-1.5"
                                        style={{
                                            background: 'rgba(255,255,255,0.65)',
                                            backdropFilter: 'blur(10px)',
                                            border: '1px solid rgba(17,24,39,0.07)',
                                            boxShadow: '0 8px 24px rgba(17,24,39,0.05)',
                                        }}>
                                        <PiSparkle className="text-[13px] shrink-0" style={{ color: '#a78bfa' }} />
                                        <input
                                            ref={chatInputRef}
                                            value={chatInput}
                                            onChange={e => setChatInput(e.target.value)}
                                            onKeyDown={e => { if (e.key === 'Enter') sendChat(chatInput); }}
                                            placeholder="Ask Nuri anything…"
                                            disabled={isSending}
                                            className="flex-1 bg-transparent py-2 text-[12.5px] text-gray-800 placeholder:text-gray-400 outline-none disabled:opacity-60"
                                        />
                                        <motion.button onClick={() => sendChat(chatInput)} disabled={isSending || !chatInput.trim()}
                                            whileHover={chatInput.trim() ? { scale: 1.06 } : {}} whileTap={{ scale: 0.92 }}
                                            className="w-[34px] h-[34px] rounded-full flex items-center justify-center text-white shrink-0 transition-all disabled:opacity-30"
                                            style={{
                                                background: 'linear-gradient(135deg, #8b6ef0, #6366F1)',
                                                boxShadow: chatInput.trim() ? '0 4px 16px rgba(139,110,255,0.45)' : 'none',
                                            }}>
                                            <PiPaperPlaneTilt className="text-[13px]" />
                                        </motion.button>
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    </>
                )}
            </AnimatePresence>
        </>
    );
}
