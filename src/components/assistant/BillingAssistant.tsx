"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import {
    PiPaperPlaneRight, PiX, PiDotsThreeOutline,
    PiTrendUp, PiWarningCircle, PiReceipt, PiChartLineUp, PiArrowClockwise,
} from "react-icons/pi";
import { AssistantResponse } from "./AssistantResponse";

const AVATAR = "/ai%20assistant.png";
const NAME = "Nuri";

interface Turn {
    role: "user" | "assistant";
    text: string;
    tools?: string[];
    error?: string;
}

/* The four cards on an empty panel. Each has to be something Nuri can actually
   answer, so they follow the tools the route exposes — overview, the approval
   queue, overdue vendor invoices and spend by category. */
const QUICK_ACTIONS = [
    { icon: PiChartLineUp, title: "Where we stand", desc: "Cash, payables, exceptions", prompt: "Give me a financial overview." },
    { icon: PiWarningCircle, title: "Overdue", desc: "Invoices past their due date", prompt: "Which vendor invoices are overdue?" },
    { icon: PiReceipt, title: "Awaiting approval", desc: "The maker-checker queue", prompt: "What payments are waiting for authorization?" },
    { icon: PiTrendUp, title: "Where it went", desc: "Spend by category", prompt: "Break down our spend by expense category." },
];

/* What the user reads while a tool runs. Keys are the function names in
   src/app/api/ai/nuri/route.ts — add a label here whenever a tool is added
   there, or the raw function name is shown instead. */
const TOOL_LABEL: Record<string, string> = {
    getFinancialOverview: "taking a snapshot",
    listBankAndPaybillAccounts: "reading account balances",
    listPendingPayments: "checking the approval queue",
    listOverdueInvoices: "finding overdue invoices",
    searchRequisitions: "searching requisitions",
    searchExpenses: "searching expense claims",
    listExpenseCategories: "grouping by category",
    getVendorInfo: "looking up the vendor",
    explainAccountBalance: "opening the ledger",
    getReconciliationStatus: "checking reconciliation",
};

export function BillingAssistant() {
    const [open, setOpen] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [turns, setTurns] = useState<Turn[]>([]);
    const [input, setInput] = useState("");
    const [busy, setBusy] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const [greetingShown, setGreetingShown] = useState(false);
    const [hovered, setHovered] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const abortRef = useRef<AbortController | null>(null);

    // A quiet greeting: appears a beat after load, then withdraws. Hovering the
    // trigger brings it back, so the invitation is repeatable without nagging.
    useEffect(() => {
        if (open) return;
        const show = setTimeout(() => setGreetingShown(true), 1400);
        const hide = setTimeout(() => setGreetingShown(false), 7600);
        return () => {
            clearTimeout(show);
            clearTimeout(hide);
        };
    }, [open]);

    // Portalled to body: the dashboard page wrapper animates with a transform,
    // which would otherwise become the containing block for our fixed panel.
    useEffect(() => setMounted(true), []);

    useEffect(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }, [turns, busy]);

    useEffect(() => () => abortRef.current?.abort(), []);

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open]);

    async function ask(question: string) {
        const q = question.trim();
        if (!q || busy) return;
        setInput("");
        setBusy(true);
        const history = [...turns, { role: "user" as const, text: q }];
        setTurns([...history, { role: "assistant", text: "", tools: [] }]);

        const controller = new AbortController();
        abortRef.current = controller;

        try {
            /* Nuri answers in one piece rather than streaming: the route resolves
               its tools server-side and returns the finished reply. So the text
               arrives at once instead of a word at a time — the thinking
               indicator above covers the wait. */
            const res = await fetch("/api/ai/nuri", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                signal: controller.signal,
                body: JSON.stringify({ messages: history.map((t) => ({ role: t.role, content: t.text })) }),
            });

            const json = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);

            const reply = typeof json.reply === "string" ? json.reply : "";
            setTurns((prev) => {
                const next = [...prev];
                const last = next[next.length - 1];
                if (!last || last.role !== "assistant") return prev;
                next[next.length - 1] = reply
                    ? { ...last, text: reply }
                    : { ...last, error: "Nuri did not return an answer." };
                return next;
            });
        } catch (e) {
            if ((e as Error).name === "AbortError") return;
            const msg = (e as Error).message || "Something went wrong.";
            setTurns((prev) => {
                const next = [...prev];
                const last = next[next.length - 1];
                if (last && last.role === "assistant") next[next.length - 1] = { ...last, error: msg };
                return next;
            });
        } finally {
            setBusy(false);
            abortRef.current = null;
        }
    }

    if (!mounted) return null;

    /* ── collapsed: avatar with a small greeting beside it ───────── */
    if (!open) {
        return createPortal(
            <>
                <div
                    className="nu-trigger print-hide"
                    onMouseEnter={() => setHovered(true)}
                    onMouseLeave={() => setHovered(false)}
                >
                    <button
                        type="button"
                        className="nu-bubble"
                        data-show={greetingShown || hovered ? "true" : "false"}
                        onClick={() => setOpen(true)}
                        // Hidden from assistive tech: the avatar button beside it
                        // carries the accessible label, so this would be a duplicate.
                        aria-hidden="true"
                        tabIndex={-1}
                    >
                        Hi 👋 How can I help?
                    </button>
                    <button type="button" className="nu-orb" onClick={() => setOpen(true)} aria-label={`Ask ${NAME}`}>
                        <span className="nu-orb-img">
                            <Image src={AVATAR} alt="" fill sizes="120px" style={{ objectFit: "cover", objectPosition: "56% 8%" }} />
                        </span>
                    </button>
                </div>
                <AssistantStyles />
            </>,
            document.body
        );
    }

    /* ── expanded: right-side sidebar ───────────────────────────── */
    return createPortal(
        <>
            <div className="nu-scrim print-hide" onClick={() => setOpen(false)} />
            <aside className="nu-panel print-hide" role="dialog" aria-label={`${NAME}, AI assistant`}>
                <header className="nu-head">
                    <span className="nu-head-av">
                        <Image src={AVATAR} alt="" fill sizes="72px" style={{ objectFit: "cover", objectPosition: "56% 8%" }} />
                    </span>
                    <div className="nu-head-id">
                        <b>{NAME}</b>
                        <span>AI Assistant</span>
                    </div>
                    <div className="nu-head-acts">
                        <button type="button" onClick={() => setMenuOpen((v) => !v)} aria-label="More">
                            <PiDotsThreeOutline size={15} />
                        </button>
                        <button type="button" onClick={() => setOpen(false)} aria-label="Close">
                            <PiX size={15} />
                        </button>
                        {menuOpen && (
                            <div className="nu-menu">
                                <button type="button" onClick={() => { setTurns([]); setMenuOpen(false); }}>
                                    <PiArrowClockwise size={12} /> New conversation
                                </button>
                            </div>
                        )}
                    </div>
                </header>

                <div className="nu-body" ref={scrollRef}>
                    {turns.length === 0 ? (
                        <div className="nu-welcome">
                            <div className="nu-hero">
                                <Image src={AVATAR} alt="" width={230} height={240} style={{ objectFit: "contain", objectPosition: "top" }} priority />
                            </div>
                            <h2>Hi! 👋</h2>
                            <p>How can I help you today?</p>

                            <div className="nu-actions">
                                {QUICK_ACTIONS.map(({ icon: Icon, title, desc, prompt }, i) => (
                                    <button
                                        key={title}
                                        type="button"
                                        className="nu-action"
                                        style={{ animationDelay: `${80 + i * 55}ms` }}
                                        onClick={() => ask(prompt)}
                                    >
                                        <Icon size={15} />
                                        <b>{title}</b>
                                        <span>{desc}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="nu-thread">
                            {turns.map((t, i) =>
                                t.role === "user" ? (
                                    <div key={i} className="nu-user">
                                        <div>{t.text}</div>
                                    </div>
                                ) : (
                                    <div key={i} className="nu-ai">
                                        <div className="nu-ai-who">
                                            <span className="nu-ai-av">
                                                <Image src={AVATAR} alt="" fill sizes="48px" style={{ objectFit: "cover", objectPosition: "56% 8%" }} />
                                            </span>
                                            <b>{NAME}</b>
                                            {(t.tools?.length ?? 0) > 0 && (
                                                <em>{[...new Set(t.tools)].map((n) => TOOL_LABEL[n] ?? n).join(" · ")}</em>
                                            )}
                                        </div>

                                        {t.text ? (
                                            <AssistantResponse text={t.text} onAction={ask} />
                                        ) : !t.error && busy ? (
                                            <div className="nu-typing" aria-label="Thinking">
                                                <i /><i /><i />
                                            </div>
                                        ) : null}

                                        {t.error && <div className="nu-err">{t.error}</div>}
                                    </div>
                                )
                            )}
                        </div>
                    )}
                </div>

                <form
                    className="nu-composer"
                    onSubmit={(e) => {
                        e.preventDefault();
                        ask(input);
                    }}
                >
                    <input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Ask anything…"
                        disabled={busy}
                        aria-label="Message"
                    />
                    <button type="submit" className="nu-send" disabled={busy || !input.trim()} aria-label="Send">
                        {busy ? <span className="nu-spin" /> : <PiPaperPlaneRight size={14} />}
                    </button>
                </form>
            </aside>
            <AssistantStyles />
        </>,
        document.body
    );
}

/** Styles kept in one place so the collapsed and expanded states stay consistent. */
function AssistantStyles() {
    return (
        <style jsx global>{`
            /* ── collapsed trigger: greeting + avatar as one component ── */
            .nu-trigger {
                position: fixed; right: 24px; bottom: 24px; z-index: 400;
                display: flex; align-items: center; gap: 10px;
            }

            .nu-orb {
                position: relative; flex-shrink: 0;
                width: 58px; height: 58px; padding: 0; border-radius: 999px; cursor: pointer;
                border: 1px solid rgba(37, 99, 235, 0.28);
                background: #fff;
                box-shadow: 0 8px 22px rgba(15, 23, 42, 0.14), 0 0 0 6px rgba(37, 99, 235, 0.05);
                transition: transform 0.24s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 0.24s;
            }
            .nu-trigger:hover .nu-orb {
                transform: translateY(-2px) scale(1.04);
                box-shadow: 0 14px 30px rgba(15, 23, 42, 0.18), 0 0 0 8px rgba(37, 99, 235, 0.07);
            }
            .nu-orb:active { transform: translateY(0) scale(1.01); }
            .nu-orb-img {
                position: absolute; inset: 0; border-radius: 999px; overflow: hidden;
                background: linear-gradient(180deg, #F4F8FF 0%, #FFFFFF 100%);
            }

            /* Speech card. Hidden by default and revealed via data-show, so the
               same element serves both the timed greeting and the hover state. */
            .nu-bubble {
                position: relative; max-width: 224px; text-align: left; cursor: pointer;
                padding: 10px 14px; border-radius: 13px;
                border: 1px solid rgba(37, 99, 235, 0.16);
                background: linear-gradient(180deg, rgba(255,255,255,0.97) 0%, rgba(247,250,255,0.97) 100%);
                backdrop-filter: blur(6px);
                box-shadow: 0 6px 18px rgba(15, 23, 42, 0.09);
                font: inherit; font-size: 13px; font-weight: 500; line-height: 1.45; color: #1A1D24;
                opacity: 0; transform: translateX(10px); pointer-events: none;
                transition: opacity 0.28s ease, transform 0.28s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 0.24s;
            }
            .nu-bubble[data-show="true"] { opacity: 1; transform: translateX(0); pointer-events: auto; }
            .nu-trigger:hover .nu-bubble[data-show="true"] {
                transform: translateX(0) translateY(-2px);
                box-shadow: 0 10px 24px rgba(15, 23, 42, 0.12);
            }

            /* Tail: a rotated square sharing the card's border on two sides, so it
               reads as part of the card rather than a separate arrow. */
            .nu-bubble::after {
                content: ""; position: absolute; right: -5px; top: 50%;
                width: 9px; height: 9px; margin-top: -4.5px;
                background: rgba(249, 251, 255, 0.97);
                border-right: 1px solid rgba(37, 99, 235, 0.16);
                border-top: 1px solid rgba(37, 99, 235, 0.16);
                transform: rotate(45deg);
            }

            /* Not enough width to sit beside the avatar: stack it above, and turn
               the tail to point down instead of squeezing against the edge. */
            @media (max-width: 430px) {
                .nu-trigger { flex-direction: column; align-items: flex-end; gap: 8px; }
                .nu-bubble { max-width: min(200px, calc(100vw - 60px)); font-size: 12.5px; }
                .nu-bubble::after {
                    right: 20px; top: auto; bottom: -5px; margin-top: 0;
                    border-right: 1px solid rgba(37, 99, 235, 0.16);
                    border-top: none;
                    border-bottom: 1px solid rgba(37, 99, 235, 0.16);
                    transform: rotate(45deg);
                }
            }

            /* ── panel ───────────────────────────────────────────── */
            .nu-scrim {
                position: fixed; inset: 0; z-index: 399; background: rgba(15, 23, 42, 0.16);
                animation: nuFade 0.24s ease-out both;
            }
            @keyframes nuFade { from { opacity: 0 } to { opacity: 1 } }

            .nu-panel {
                position: fixed; top: 10px; right: 0; bottom: 10px; z-index: 400;
                width: min(424px, 100vw);
                display: flex; flex-direction: column;
                border: 1px solid var(--p-line); border-right: 0;
                border-radius: 20px 0 0 20px;
                background:
                    radial-gradient(120% 60% at 100% 0%, rgba(224, 235, 255, 0.55) 0%, rgba(224, 235, 255, 0) 60%),
                    linear-gradient(180deg, #FCFDFF 0%, #FFFFFF 55%, #FAFCFF 100%);
                box-shadow: -18px 0 48px rgba(15, 23, 42, 0.14);
                animation: nuSlide 0.3s cubic-bezier(0.22, 0.9, 0.24, 1) both;
                overflow: hidden;
            }
            @keyframes nuSlide { from { transform: translateX(28px); opacity: 0.4 } to { transform: none; opacity: 1 } }
            @media (max-width: 520px) { .nu-panel { top: 0; bottom: 0; border-radius: 0; } }

            /* ── header ──────────────────────────────────────────── */
            .nu-head {
                display: flex; align-items: center; gap: 11px;
                padding: 16px 18px 14px; border-bottom: 1px solid rgba(15, 23, 42, 0.06);
            }
            .nu-head-av {
                position: relative; width: 36px; height: 36px; border-radius: 999px; overflow: hidden;
                flex-shrink: 0; border: 1px solid rgba(37, 99, 235, 0.2);
                background: linear-gradient(180deg, #F4F8FF, #fff);
            }
            .nu-head-id { display: flex; flex-direction: column; line-height: 1.25; min-width: 0; }
            .nu-head-id b { font-size: 14.5px; font-weight: 700; letter-spacing: -0.01em; color: var(--t1); }
            .nu-head-id span { font-size: 10.5px; font-weight: 500; color: var(--t4); }
            .nu-head-acts { margin-left: auto; display: flex; align-items: center; gap: 4px; position: relative; }
            .nu-head-acts > button {
                width: 30px; height: 30px; display: flex; align-items: center; justify-content: center;
                border: 0; border-radius: 8px; background: transparent; color: var(--t4); cursor: pointer;
                transition: background 0.15s, color 0.15s;
            }
            .nu-head-acts > button:hover { background: rgba(15, 23, 42, 0.05); color: var(--t2); }
            .nu-menu {
                position: absolute; top: 34px; right: 0; min-width: 176px; z-index: 5;
                background: #fff; border: 1px solid var(--p-line); border-radius: 11px;
                box-shadow: 0 12px 28px rgba(15, 23, 42, 0.12); padding: 5px; overflow: hidden;
            }
            .nu-menu button {
                width: 100%; display: flex; align-items: center; gap: 8px; padding: 8px 10px;
                border: 0; border-radius: 7px; background: transparent; cursor: pointer;
                font: inherit; font-size: 12px; font-weight: 500; color: var(--t2); text-align: left;
            }
            .nu-menu button:hover { background: rgba(37, 99, 235, 0.06); color: var(--p); }

            /* ── body ────────────────────────────────────────────── */
            .nu-body { flex: 1; overflow-y: auto; overflow-x: hidden; padding: 0 18px; }
            .nu-body::-webkit-scrollbar { width: 8px; }
            .nu-body::-webkit-scrollbar-thumb { background: rgba(15, 23, 42, 0.13); border-radius: 99px; }

            /* welcome — the figure blends in, no photo frame */
            .nu-welcome { padding: 6px 0 22px; text-align: center; }
            .nu-hero {
                display: flex; justify-content: center; margin: 2px 0 -6px;
                animation: nuRise 0.5s cubic-bezier(0.2, 0.8, 0.2, 1) both;
            }
            /* She dissolves into the panel rather than ending on a cut edge.
               The mask fades the lower third out; the drop shadow has to go with
               it, or a hard shadow would still trace the outline it left behind. */
            .nu-hero img {
                -webkit-mask-image: linear-gradient(to bottom, #000 52%, rgba(0,0,0,0.55) 76%, transparent 97%);
                mask-image: linear-gradient(to bottom, #000 52%, rgba(0,0,0,0.55) 76%, transparent 97%);
            }
            @keyframes nuRise { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: none } }
            .nu-welcome h2 { font-size: 21px; font-weight: 700; letter-spacing: -0.02em; color: var(--t1); }
            .nu-welcome > p { font-size: 13px; color: var(--t3); margin-top: 3px; }

            /* quick actions — 2 columns of small cards */
            .nu-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 9px; margin-top: 22px; text-align: left; }
            .nu-action {
                display: flex; flex-direction: column; gap: 3px; padding: 13px 13px 14px; cursor: pointer;
                border: 1px solid var(--p-line); border-radius: 14px;
                background: rgba(255, 255, 255, 0.72); color: var(--t2);
                transition: transform 0.18s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 0.18s, border-color 0.18s;
                animation: nuRise 0.4s cubic-bezier(0.2, 0.8, 0.2, 1) both;
            }
            .nu-action svg { color: var(--p); opacity: 0.85; margin-bottom: 3px; }
            .nu-action b { font-size: 12px; font-weight: 700; color: var(--t1); }
            .nu-action span { font-size: 10.5px; line-height: 1.45; color: var(--t4); }
            .nu-action:hover {
                transform: translateY(-2px); border-color: rgba(37, 99, 235, 0.3);
                box-shadow: 0 8px 18px rgba(15, 23, 42, 0.07);
            }
            .nu-action:active { transform: translateY(0); }

            /* thread */
            .nu-thread { display: flex; flex-direction: column; gap: 22px; padding: 18px 0 26px; }
            .nu-user { display: flex; justify-content: flex-end; animation: nuRise 0.3s ease-out both; }
            .nu-user div {
                max-width: 84%; padding: 9px 13px; border-radius: 14px 14px 4px 14px;
                background: rgba(37, 99, 235, 0.07); border: 1px solid rgba(37, 99, 235, 0.14);
                font-size: 12.5px; line-height: 1.6; color: var(--t1); white-space: pre-wrap;
            }
            /* Assistant replies sit on the surface, not in a bubble. */
            .nu-ai { animation: nuRise 0.3s ease-out both; }
            .nu-ai-who { display: flex; align-items: center; gap: 7px; margin-bottom: 8px; }
            .nu-ai-av {
                position: relative; width: 22px; height: 22px; border-radius: 999px; overflow: hidden;
                flex-shrink: 0; border: 1px solid rgba(37, 99, 235, 0.18);
            }
            .nu-ai-who b { font-size: 11.5px; font-weight: 700; color: var(--t1); }
            .nu-ai-who em {
                font-style: normal; font-size: 10px; font-weight: 500; color: var(--t4);
                padding-left: 7px; border-left: 1px solid var(--p-line);
            }

            .nu-typing { display: inline-flex; gap: 4px; padding: 4px 0 2px; }
            .nu-typing i {
                width: 5px; height: 5px; border-radius: 999px; background: var(--p); opacity: 0.35;
                animation: nuBlink 1.25s ease-in-out infinite;
            }
            .nu-typing i:nth-child(2) { animation-delay: 0.16s; }
            .nu-typing i:nth-child(3) { animation-delay: 0.32s; }
            @keyframes nuBlink { 0%, 60%, 100% { opacity: 0.22 } 30% { opacity: 0.8 } }

            .nu-err {
                font-size: 11.5px; color: #991B1B; background: rgba(220, 38, 38, 0.06);
                border: 1px solid rgba(220, 38, 38, 0.18); border-radius: 10px; padding: 9px 12px;
            }

            /* ── composer ────────────────────────────────────────── */
            .nu-composer {
                display: flex; align-items: center; gap: 8px; margin: 0 14px 14px;
                padding: 7px 8px 7px 10px; border-radius: 999px;
                border: 1px solid var(--p-line); background: rgba(248, 250, 253, 0.9);
                box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);
            }
            .nu-composer:focus-within { border-color: rgba(37, 99, 235, 0.4); background: #fff; }
            .nu-attach {
                width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;
                border: 0; border-radius: 999px; background: transparent; color: var(--t4);
                flex-shrink: 0; cursor: pointer; transition: color .15s, background .15s;
            }
            .nu-attach.live:hover:not(:disabled) { color: var(--p); background: rgba(37,99,235,0.07); }
            .nu-attach:disabled { opacity: 0.45; cursor: default; }
            .nu-spin.dark { border-color: rgba(37,99,235,0.3); border-top-color: var(--p); }
            /* Global input rules are (0,2,1) with !important — repeat the :not()
               pair so these actually win. */
            .nu-composer input:not([type="checkbox"]):not([type="radio"]),
            .nu-composer input:not([type="checkbox"]):not([type="radio"]):hover,
            .nu-composer input:not([type="checkbox"]):not([type="radio"]):focus {
                flex: 1; min-width: 0;
                border: 0 !important; border-radius: 0 !important; outline: none !important;
                background: transparent !important; box-shadow: none !important;
                padding: 6px 2px !important; font-size: 12.5px !important; color: var(--t1) !important;
            }
            .nu-composer input::placeholder { color: var(--t4); }
            .nu-send {
                width: 34px; height: 34px; flex-shrink: 0; display: flex; align-items: center; justify-content: center;
                border: 0; border-radius: 999px; background: var(--p); color: #fff; cursor: pointer;
                transition: transform 0.15s, filter 0.15s;
            }
            .nu-send:hover:not(:disabled) { filter: brightness(1.07); }
            .nu-send:active:not(:disabled) { transform: scale(0.94); }
            .nu-send:disabled { opacity: 0.4; cursor: default; }
            .nu-spin {
                width: 13px; height: 13px; border-radius: 999px;
                border: 2px solid rgba(255, 255, 255, 0.4); border-top-color: #fff;
                animation: nuSpin 0.7s linear infinite;
            }
            @keyframes nuSpin { to { transform: rotate(360deg) } }

            @media (prefers-reduced-motion: reduce) {
                .nu-panel, .nu-scrim, .nu-hero, .nu-action, .nu-user, .nu-ai { animation: none !important; }
                .nu-orb, .nu-bubble { transition: opacity 0.2s ease; }
                .nu-bubble { transform: none !important; }
            }
        `}</style>
    );
}
