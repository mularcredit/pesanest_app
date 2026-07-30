"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
    PiDeviceMobile, PiPaperPlaneTilt, PiPencilSimple,
    PiX, PiCheckCircle, PiWarningCircle, PiFlask, PiArrowClockwise,
    PiWifiHigh, PiWifiSlash, PiDeviceMobileCamera, PiUserCircle,
    PiStorefront, PiBriefcase, PiAddressBook,
} from "react-icons/pi";
import { normalisePhone } from "@/lib/sms/celcom";

interface Contact {
    id: string;
    name: string;
    phone: string;
    label: string;
    type: "user" | "customer" | "vendor";
}

interface SmsLogEntry {
    id: string;
    to: string;
    message: string;
    status: "SENT" | "FAILED" | "STUB";
    messageId: string | null;
    errorReason: string | null;
    event: string | null;
    createdAt: string;
}

interface Props {
    initialLogs: SmsLogEntry[];
    stats: { SENT: number; FAILED: number; STUB: number; total: number };
    config: { isStub: boolean; shortcode: string; partnerId: string };
}

const EVENT_LABELS: Record<string, string> = {
    WELCOME: "Welcome",
    PASSWORD_RESET: "Password Reset",
    APPROVAL_DECISION: "Approval Decision",
    PAYMENT_AUTHORIZED: "Payment Authorized",
    PAYMENT_REJECTED: "Payment Rejected",
    PAYMENT_DISBURSED: "Payment Disbursed",
    WALLET_TOPUP: "Wallet Top-up",
    BRANCH_FUNDED: "Branch Funded",
    APPROVAL_REQUIRED: "Approval Required",
    MANUAL: "Manual",
};

const STATUS_TABS = ["All", "SENT", "FAILED", "STUB"] as const;
type StatusTab = typeof STATUS_TABS[number];

function fmt(date: string) {
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60000) return "just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return d.toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit", hour12: true });
    return d.toLocaleDateString("en-KE", { day: "2-digit", month: "short" });
}

function fmtFull(date: string) {
    return new Date(date).toLocaleString("en-KE", {
        day: "2-digit", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit", hour12: true,
    });
}

function StatusDot({ status }: { status: string }) {
    if (status === "SENT") return <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />;
    if (status === "FAILED") return <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />;
    return <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />;
}

function ContactTypeIcon({ type }: { type: "user" | "customer" | "vendor" }) {
    if (type === "customer") return <PiStorefront className="text-[15px] text-sky-500 flex-shrink-0" />;
    if (type === "vendor") return <PiBriefcase className="text-[15px] text-violet-500 flex-shrink-0" />;
    return <PiUserCircle className="text-[15px] text-indigo-500 flex-shrink-0" />;
}

function StatusBadge({ status }: { status: string }) {
    if (status === "SENT") return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-[600] bg-emerald-50 text-emerald-700 border border-emerald-200">
            <PiCheckCircle className="text-[11px]" /> Sent
        </span>
    );
    if (status === "FAILED") return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-[600] bg-red-50 text-red-600 border border-red-200">
            <PiWarningCircle className="text-[11px]" /> Failed
        </span>
    );
    return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-[600] bg-amber-50 text-amber-700 border border-amber-200">
            <PiFlask className="text-[11px]" /> Stub
        </span>
    );
}

export function SmsPageClient({ initialLogs, stats, config }: Props) {
    const [logs, setLogs] = useState<SmsLogEntry[]>(initialLogs);
    const [statsData, setStatsData] = useState(stats);
    const [activeId, setActiveId] = useState<string>(initialLogs[0]?.id ?? "");
    const [filter, setFilter] = useState<StatusTab>("All");
    const [search, setSearch] = useState("");
    const [showCompose, setShowCompose] = useState(false);
    const [loading, setLoading] = useState(false);

    // Left panel tab: messages vs contacts
    const [leftTab, setLeftTab] = useState<"messages" | "contacts">("messages");
    const [allContacts, setAllContacts] = useState<Contact[]>([]);
    const [contactSearch, setContactSearch] = useState("");
    const [contactTypeFilter, setContactTypeFilter] = useState<"all" | "user" | "customer" | "vendor">("all");
    const [contactsLoaded, setContactsLoaded] = useState(false);
    const [contactsLoading, setContactsLoading] = useState(false);

    // Reply (send new SMS to same number)
    const [reply, setReply] = useState("");
    const [sending, setSending] = useState(false);
    const [sendResult, setSendResult] = useState<{ ok: boolean; msg: string } | null>(null);

    // Compose form
    const [compPhone, setCompPhone] = useState("");
    const [compMsg, setCompMsg] = useState("");
    const [compSending, setCompSending] = useState(false);
    const [compResult, setCompResult] = useState<{ ok: boolean; msg: string } | null>(null);

    // Contact picker
    const [contactQuery, setContactQuery] = useState("");
    const [contactResults, setContactResults] = useState<Contact[]>([]);
    const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
    const [contactLoading, setContactLoading] = useState(false);
    const contactDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    const filtered = logs.filter(l =>
        (filter === "All" || l.status === filter) &&
        (search === "" || l.to.includes(search) || l.message.toLowerCase().includes(search.toLowerCase()) || (l.event && (EVENT_LABELS[l.event] ?? l.event).toLowerCase().includes(search.toLowerCase())))
    );

    const current = filtered.find(l => l.id === activeId) ?? filtered[0] ?? null;
    const failedCount = logs.filter(l => l.status === "FAILED").length;

    useEffect(() => {
        if (filtered.length > 0 && !filtered.find(l => l.id === activeId)) {
            setActiveId(filtered[0].id);
        }
    }, [filter, search]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [current]);

    const refresh = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/sms/logs?limit=50");
            const data = await res.json();
            setLogs(data.logs ?? []);
            setStatsData({ ...data.stats, total: data.total });
        } finally {
            setLoading(false);
        }
    }, []);

    const loadContacts = useCallback(async (q = "") => {
        setContactsLoading(true);
        try {
            const params = new URLSearchParams({ browse: "true" });
            if (q) params.set("q", q);
            const res = await fetch(`/api/sms/contacts?${params}`);
            const data = await res.json();
            setAllContacts(data.contacts ?? []);
            setContactsLoaded(true);
        } finally {
            setContactsLoading(false);
        }
    }, []);

    // Load contacts when switching to contacts tab
    useEffect(() => {
        if (leftTab === "contacts" && !contactsLoaded) {
            loadContacts();
        }
    }, [leftTab, contactsLoaded, loadContacts]);

    // Debounced contact search within contacts tab
    const contactSearchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => {
        if (leftTab !== "contacts") return;
        if (contactSearchDebounce.current) clearTimeout(contactSearchDebounce.current);
        contactSearchDebounce.current = setTimeout(() => loadContacts(contactSearch), 300);
    }, [contactSearch]);

    const filteredContacts = allContacts.filter(c =>
        contactTypeFilter === "all" || c.type === contactTypeFilter
    );

    function openComposeFor(c: Contact) {
        setSelectedContact(c);
        setContactQuery(c.name);
        setCompPhone(c.phone);
        setCompMsg("");
        setCompResult(null);
        setShowCompose(true);
    }

    async function sendSms(phone: string, message: string, isReply = false) {
        const res = await fetch("/api/sms/test", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phone, message }),
        });
        const data = await res.json();
        const ok = res.ok;
        const msg = ok
            ? data.stub ? "Sent (stub mode — no real SMS dispatched)" : "Message sent successfully."
            : data.error ?? "Send failed.";
        return { ok, msg };
    }

    // Debounced contact search
    useEffect(() => {
        if (contactDebounce.current) clearTimeout(contactDebounce.current);
        if (!contactQuery.trim() || selectedContact) { setContactResults([]); return; }
        contactDebounce.current = setTimeout(async () => {
            setContactLoading(true);
            try {
                const res = await fetch(`/api/sms/contacts?q=${encodeURIComponent(contactQuery)}`);
                const data = await res.json();
                setContactResults(data.contacts ?? []);
            } finally {
                setContactLoading(false);
            }
        }, 280);
    }, [contactQuery, selectedContact]);

    function pickContact(c: Contact) {
        setSelectedContact(c);
        setCompPhone(c.phone);
        setContactQuery(c.name);
        setContactResults([]);
    }

    function clearContact() {
        setSelectedContact(null);
        setContactQuery("");
        setCompPhone("");
    }

    async function handleReply() {
        if (!reply.trim() || !current) return;
        setSending(true);
        setSendResult(null);
        try {
            const { ok, msg } = await sendSms(current.to, reply.trim(), true);
            setSendResult({ ok, msg });
            if (ok) { setReply(""); setTimeout(refresh, 600); }
        } catch {
            setSendResult({ ok: false, msg: "Network error." });
        } finally {
            setSending(false);
        }
    }

    async function handleCompose() {
        const phone = selectedContact?.phone || compPhone.trim();
        if (!phone || !compMsg.trim()) return;
        setCompSending(true);
        setCompResult(null);
        try {
            const { ok, msg } = await sendSms(phone, compMsg.trim());
            setCompResult({ ok, msg });
            if (ok) { clearContact(); setCompMsg(""); setTimeout(refresh, 600); }
        } catch {
            setCompResult({ ok: false, msg: "Network error." });
        } finally {
            setCompSending(false);
        }
    }

    return (
        // Break out of main's padding to go full-height below topbar
        <div
            className="flex flex-col overflow-hidden bg-[var(--page)]"
            style={{
                marginTop: "-22px",
                marginLeft: "-26px",
                marginRight: "-26px",
                marginBottom: "-52px",
                height: "calc(100vh - 64px)",
            }}
        >
            {/* ── Header ── */}
            <div className="flex-shrink-0 h-[60px] flex items-center justify-between px-8 border-b border-gray-100 bg-white">
                <div className="flex items-center gap-3">
                    <h1 className="text-[15px] font-[600] text-gray-900">SMS Notifications</h1>
                    {failedCount > 0 && (
                        <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-[600]">
                            {failedCount}
                        </span>
                    )}
                    {/* Live / stub */}
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-[500] border ${
                        config.isStub
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : "bg-emerald-50 text-emerald-700 border-emerald-200"
                    }`}>
                        {config.isStub ? <PiWifiSlash className="text-[12px]" /> : <PiWifiHigh className="text-[12px]" />}
                        {config.isStub ? "Stub" : "Live"}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    {/* Stats chips */}
                    <div className="hidden sm:flex items-center gap-2 mr-2">
                        <span className="text-[11.5px] text-gray-400">Total <span className="font-[600] text-gray-700">{statsData.total}</span></span>
                        <span className="text-gray-200">|</span>
                        <span className="text-[11.5px] text-emerald-600 font-[600]">{statsData.SENT} sent</span>
                        {statsData.FAILED > 0 && (
                            <><span className="text-gray-200">|</span>
                            <span className="text-[11.5px] text-red-500 font-[600]">{statsData.FAILED} failed</span></>
                        )}
                    </div>
                    <button
                        onClick={refresh}
                        disabled={loading}
                        className="p-2 rounded-[7px] hover:bg-gray-100 transition-colors text-gray-400 disabled:opacity-40"
                        title="Refresh"
                    >
                        <PiArrowClockwise className={`text-[15px] ${loading ? "animate-spin" : ""}`} />
                    </button>
                    <button
                        onClick={() => { setShowCompose(true); setCompResult(null); clearContact(); setCompMsg(""); }}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-[6px] bg-[#6366F1] text-white text-[12px] font-[500] hover:bg-indigo-700 transition-colors"
                    >
                        <PiPencilSimple size={12} strokeWidth={2} /> Compose
                    </button>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden">

                {/* ── LEFT PANEL ── */}
                <div className="w-[320px] flex-shrink-0 flex flex-col border-r border-gray-100 bg-white overflow-hidden">

                    {/* Tab switcher */}
                    <div className="flex border-b border-gray-100">
                        <button
                            onClick={() => setLeftTab("messages")}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-[12px] font-[500] border-b-2 transition-colors ${
                                leftTab === "messages"
                                    ? "border-[#6366F1] text-[#6366F1]"
                                    : "border-transparent text-gray-400 hover:text-gray-600"
                            }`}
                        >
                            <PiDeviceMobile className="text-[14px]" /> Messages
                            {logs.length > 0 && <span className="text-[10px] bg-gray-100 text-gray-500 rounded-full px-1.5 py-0.5 font-[600]">{logs.length}</span>}
                        </button>
                        <button
                            onClick={() => setLeftTab("contacts")}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-[12px] font-[500] border-b-2 transition-colors ${
                                leftTab === "contacts"
                                    ? "border-[#6366F1] text-[#6366F1]"
                                    : "border-transparent text-gray-400 hover:text-gray-600"
                            }`}
                        >
                            <PiAddressBook className="text-[14px]" /> Contacts
                        </button>
                    </div>

                    {leftTab === "messages" ? (<>
                    {/* Search messages */}
                    <div className="px-4 py-3 border-b border-gray-100">
                        <div className="flex items-center gap-2 px-3 py-2 rounded-[7px] bg-gray-50 border border-gray-200">
                            <input
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Search messages…"
                                className="flex-1 text-[12.5px] bg-transparent outline-none text-gray-800 placeholder:text-gray-400"
                            />
                            {search && (
                                <button onClick={() => setSearch("")} className="text-gray-300 hover:text-gray-500">
                                    <PiX className="text-[12px]" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Filter tabs */}
                    <div className="flex items-center gap-1 px-3 py-2 border-b border-gray-100">
                        {STATUS_TABS.map(tab => (
                            <button
                                key={tab}
                                onClick={() => setFilter(tab)}
                                className={`px-2.5 py-1 rounded-[5px] text-[11.5px] transition-colors ${
                                    filter === tab
                                        ? "bg-indigo-50 text-indigo-700 font-[500]"
                                        : "text-gray-400 hover:text-gray-600"
                                }`}
                            >
                                {tab === "All" ? "All" : tab === "SENT" ? "Sent" : tab === "FAILED" ? "Failed" : "Stub"}
                            </button>
                        ))}
                        <span className="ml-auto text-[10.5px] text-gray-300">{filtered.length}</span>
                    </div>

                    {/* Message list */}
                    <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
                        {filtered.length === 0 ? (
                            <div className="px-5 py-12 text-center">
                                <PiDeviceMobileCamera className="text-[32px] text-gray-200 mx-auto mb-2" />
                                <p className="text-[12.5px] text-gray-400">
                                    {logs.length === 0 ? "No messages sent yet." : "No results match your filter."}
                                </p>
                            </div>
                        ) : (
                            filtered.map(log => {
                                const isActive = log.id === activeId;
                                return (
                                    <button
                                        key={log.id}
                                        onClick={() => { setActiveId(log.id); setSendResult(null); setReply(""); }}
                                        className={`w-full text-left px-4 py-3.5 transition-colors flex items-start gap-3 ${
                                            isActive ? "bg-indigo-50" : "hover:bg-gray-50"
                                        }`}
                                    >
                                        {/* Avatar */}
                                        <div className="w-[34px] h-[34px] rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-[11px] font-[700] flex-shrink-0 mt-0.5">
                                            {log.to.slice(-2)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-1">
                                                <p className="text-[12.5px] font-[600] text-gray-800 font-mono truncate">{log.to}</p>
                                                <span className="text-[10px] text-gray-400 flex-shrink-0">{fmt(log.createdAt)}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                <StatusDot status={log.status} />
                                                {log.event && (
                                                    <span className="text-[10px] text-indigo-500 font-[500]">{EVENT_LABELS[log.event] ?? log.event}</span>
                                                )}
                                            </div>
                                            <p className="text-[11.5px] text-gray-400 truncate mt-0.5">{log.message}</p>
                                        </div>
                                    </button>
                                );
                            })
                        )}
                    </div>
                    </>) : (<>
                    {/* ── CONTACTS TAB ── */}
                    {/* Search + type filter */}
                    <div className="px-4 py-3 border-b border-gray-100 space-y-2">
                        <div className="flex items-center gap-2 px-3 py-2 rounded-[7px] bg-gray-50 border border-gray-200">
                            <input
                                value={contactSearch}
                                onChange={e => setContactSearch(e.target.value)}
                                placeholder="Search by name or phone…"
                                className="flex-1 text-[12.5px] bg-transparent outline-none text-gray-800 placeholder:text-gray-400"
                            />
                            {contactSearch && (
                                <button onClick={() => setContactSearch("")} className="text-gray-300 hover:text-gray-500">
                                    <PiX className="text-[12px]" />
                                </button>
                            )}
                        </div>
                        <div className="flex items-center gap-1">
                            {(["all", "user", "customer", "vendor"] as const).map(t => (
                                <button
                                    key={t}
                                    onClick={() => setContactTypeFilter(t)}
                                    className={`px-2.5 py-1 rounded-[5px] text-[11px] capitalize transition-colors ${
                                        contactTypeFilter === t
                                            ? "bg-indigo-50 text-indigo-700 font-[500]"
                                            : "text-gray-400 hover:text-gray-600"
                                    }`}
                                >
                                    {t}
                                </button>
                            ))}
                            <span className="ml-auto text-[10.5px] text-gray-300">{filteredContacts.length}</span>
                        </div>
                    </div>

                    {/* Contacts list */}
                    <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
                        {contactsLoading ? (
                            <div className="flex items-center justify-center py-12">
                                <PiArrowClockwise className="animate-spin text-[22px] text-gray-300" />
                            </div>
                        ) : filteredContacts.length === 0 ? (
                            <div className="px-5 py-12 text-center">
                                <PiAddressBook className="text-[32px] text-gray-200 mx-auto mb-2" />
                                <p className="text-[12.5px] text-gray-400">No contacts with phone numbers found.</p>
                                <p className="text-[11px] text-gray-300 mt-1">Add phone numbers to users, customers or vendors.</p>
                            </div>
                        ) : (
                            filteredContacts.map(c => (
                                <button
                                    key={c.id}
                                    onClick={() => openComposeFor(c)}
                                    className="w-full text-left px-4 py-3 hover:bg-indigo-50 transition-colors flex items-center gap-3 group"
                                >
                                    <div className={`w-[34px] h-[34px] rounded-full flex items-center justify-center text-[12px] font-[700] flex-shrink-0 ${
                                        c.type === "customer" ? "bg-sky-100 text-sky-700" :
                                        c.type === "vendor"   ? "bg-violet-100 text-violet-700" :
                                                                "bg-indigo-100 text-indigo-700"
                                    }`}>
                                        {c.name.slice(0, 2).toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[12.5px] font-[600] text-gray-800 truncate">{c.name}</p>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                            <ContactTypeIcon type={c.type} />
                                            <span className="text-[10.5px] text-gray-400 capitalize">{c.label}</span>
                                            <span className="text-gray-200">·</span>
                                            <span className="text-[10.5px] text-gray-400 font-mono">{c.phone}</span>
                                        </div>
                                    </div>
                                    <span className="text-[10.5px] text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                        Send SMS →
                                    </span>
                                </button>
                            ))
                        )}
                    </div>
                    </>)}
                </div>

                {/* ── RIGHT: Message Detail ── */}
                {current ? (
                    <div className="flex-1 flex flex-col min-w-0 bg-gray-50 overflow-hidden">
                        {/* Detail header */}
                        <div className="flex-shrink-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
                            <div>
                                <div className="flex items-center gap-2">
                                    <p className="text-[14px] font-[600] text-gray-900 font-mono">{current.to}</p>
                                    <StatusBadge status={current.status} />
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-[11.5px] text-gray-400">{fmtFull(current.createdAt)}</span>
                                    {current.event && (
                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-[4px] bg-indigo-50 text-indigo-600 text-[10px] font-[600] uppercase tracking-[0.06em] border border-indigo-100">
                                            {EVENT_LABELS[current.event] ?? current.event}
                                        </span>
                                    )}
                                    {current.messageId && (
                                        <span className="text-[10px] text-gray-300 font-mono">ID: {current.messageId.slice(0, 16)}</span>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-[11px] text-gray-400">
                                    via <span className="font-[500] text-gray-600">{config.shortcode}</span>
                                </span>
                            </div>
                        </div>

                        {/* Message bubble area */}
                        <div className="flex-1 overflow-y-auto px-6 py-6">
                            {/* Outbound bubble */}
                            <div className="flex justify-end">
                                <div className="max-w-[70%]">
                                    <div className="bg-[#6366F1] text-white rounded-[12px] rounded-tr-[3px] px-4 py-3">
                                        <p className="text-[13.5px] leading-relaxed whitespace-pre-wrap">{current.message}</p>
                                        <p className="text-[10.5px] text-indigo-200 mt-1.5 text-right">{fmtFull(current.createdAt)}</p>
                                    </div>
                                    {current.status === "FAILED" && current.errorReason && (
                                        <p className="text-[11px] text-red-500 mt-1.5 text-right">
                                            <PiWarningCircle className="inline mr-1" />
                                            {current.errorReason}
                                        </p>
                                    )}
                                    {current.status === "STUB" && (
                                        <p className="text-[10.5px] text-amber-600 mt-1.5 text-right flex items-center justify-end gap-1">
                                            <PiFlask className="inline" /> Stub — not dispatched to network
                                        </p>
                                    )}
                                </div>
                            </div>
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Reply box */}
                        <div className="flex-shrink-0 bg-white border-t border-gray-100 px-6 py-4">
                            <p className="text-[10.5px] text-gray-400 mb-2">
                                Send another notification to <span className="font-[600] text-gray-600 font-mono">{current.to}</span>
                            </p>

                            {sendResult && (
                                <div className={`flex items-center gap-2 px-3 py-2 rounded-[6px] text-[11.5px] mb-2 ${
                                    sendResult.ok
                                        ? "bg-emerald-50 border border-emerald-200 text-emerald-700"
                                        : "bg-red-50 border border-red-200 text-red-600"
                                }`}>
                                    {sendResult.ok ? <PiCheckCircle /> : <PiWarningCircle />}
                                    <span className="flex-1">{sendResult.msg}</span>
                                    <button onClick={() => setSendResult(null)}><PiX className="text-[12px]" /></button>
                                </div>
                            )}

                            <div className="border border-gray-200 rounded-[8px] overflow-hidden">
                                <textarea
                                    value={reply}
                                    onChange={e => setReply(e.target.value)}
                                    onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleReply(); }}
                                    placeholder={`Message to ${current.to}… (⌘↵ to send)`}
                                    rows={3}
                                    maxLength={480}
                                    className="w-full px-4 py-3 text-[13px] text-gray-800 placeholder:text-gray-400 resize-none outline-none"
                                />
                                <div className="flex items-center justify-between px-4 py-2 border-t border-gray-100 bg-gray-50">
                                    <span className="text-[10.5px] text-gray-400 tabular-nums">{reply.length}/480</span>
                                    <button
                                        onClick={handleReply}
                                        disabled={sending || !reply.trim()}
                                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-[6px] bg-[#6366F1] text-white text-[12px] font-[500] hover:bg-indigo-700 transition-colors disabled:opacity-40"
                                    >
                                        {sending ? (
                                            <><PiArrowClockwise className="animate-spin text-[12px]" /> Sending…</>
                                        ) : (
                                            <><PiPaperPlaneTilt className="text-[12px]" /> Send</>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center bg-gray-50">
                        <PiDeviceMobile className="text-[48px] text-gray-200 mb-3" />
                        <p className="text-[13.5px] font-[500] text-gray-400">No messages yet</p>
                        <p className="text-[11.5px] text-gray-300 mt-1">Use Compose to send your first SMS</p>
                        <button
                            onClick={() => setShowCompose(true)}
                            className="mt-4 flex items-center gap-1.5 px-4 py-2 rounded-[7px] bg-[#6366F1] text-white text-[12.5px] font-[500] hover:bg-indigo-700 transition-colors"
                        >
                            <PiPencilSimple /> Compose
                        </button>
                    </div>
                )}
            </div>

            {/* ── Compose Panel (slide from right) ── */}
            {showCompose && (
                <>
                    <div
                        className="absolute inset-0 bg-black/20 z-40"
                        onClick={() => setShowCompose(false)}
                    />
                    <div className="absolute top-0 right-0 h-full w-[400px] bg-white border-l border-gray-100 shadow-xl z-50 flex flex-col">
                        {/* Panel header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                            <div className="flex items-center gap-2">
                                <PiPencilSimple className="text-indigo-500" />
                                <h2 className="text-[14px] font-[600] text-gray-900">New Message</h2>
                            </div>
                            <button
                                onClick={() => setShowCompose(false)}
                                className="p-1.5 rounded-[5px] hover:bg-gray-100 transition-colors"
                            >
                                <PiX className="text-[14px] text-gray-400" />
                            </button>
                        </div>

                        {/* Fields */}
                        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
                            {/* Recipient picker */}
                            <div>
                                <label className="block text-[11px] font-[500] uppercase tracking-[0.07em] text-gray-400 mb-1.5">
                                    Recipient
                                </label>
                                <div className="relative">
                                    {selectedContact ? (
                                        <div className="flex items-center gap-2 px-3 py-2.5 rounded-[7px] border border-indigo-300 bg-indigo-50">
                                            <ContactTypeIcon type={selectedContact.type} />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[12.5px] font-[600] text-gray-800 truncate">{selectedContact.name}</p>
                                                <p className="text-[10.5px] text-gray-400 font-mono">{selectedContact.phone} · <span className="capitalize">{selectedContact.label}</span></p>
                                            </div>
                                            <button onClick={clearContact} className="text-gray-400 hover:text-gray-600">
                                                <PiX className="text-[13px]" />
                                            </button>
                                        </div>
                                    ) : (
                                        <div>
                                            <input
                                                value={contactQuery}
                                                onChange={e => setContactQuery(e.target.value)}
                                                placeholder="Search users, customers, vendors…"
                                                className="w-full px-3 py-2.5 rounded-[7px] border border-gray-200 text-[13px] text-gray-800 placeholder:text-gray-400 outline-none focus:border-indigo-400 transition-colors"
                                                autoComplete="off"
                                            />
                                        </div>
                                    )}
                                    {/* Dropdown */}
                                    {contactResults.length > 0 && (
                                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-[8px] shadow-lg overflow-hidden">
                                            {contactResults.map(c => (
                                                <button
                                                    key={c.id}
                                                    onClick={() => pickContact(c)}
                                                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 transition-colors text-left"
                                                >
                                                    <ContactTypeIcon type={c.type} />
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-[12.5px] font-[500] text-gray-800 truncate">{c.name}</p>
                                                        <p className="text-[10.5px] text-gray-400 font-mono truncate">{c.phone} · <span className="capitalize">{c.label}</span></p>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    {contactResults.length === 0 && contactQuery.trim().length > 1 && !contactLoading && !selectedContact && (
                                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-[8px] shadow-sm px-3 py-3">
                                            <p className="text-[11.5px] text-gray-400">No contacts found. Enter a number directly:</p>
                                            <input
                                                value={compPhone}
                                                onChange={e => setCompPhone(e.target.value)}
                                                placeholder="e.g. 0712345678"
                                                type="tel"
                                                className="mt-1.5 w-full px-3 py-2 rounded-[6px] border border-gray-200 text-[12.5px] text-gray-800 placeholder:text-gray-400 outline-none focus:border-indigo-400 transition-colors"
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div>
                                <label className="block text-[11px] font-[500] uppercase tracking-[0.07em] text-gray-400 mb-1.5">
                                    Message <span className="normal-case font-[400]">({compMsg.length}/480)</span>
                                </label>
                                <textarea
                                    value={compMsg}
                                    onChange={e => setCompMsg(e.target.value)}
                                    maxLength={480}
                                    rows={7}
                                    placeholder="Write your message…"
                                    className="w-full px-3 py-2.5 rounded-[7px] border border-gray-200 text-[13px] text-gray-800 placeholder:text-gray-400 outline-none focus:border-indigo-400 transition-colors resize-none"
                                />
                            </div>

                            {/* Normalised number preview */}
                            {(selectedContact?.phone || compPhone) && (() => {
                                const raw = selectedContact?.phone || compPhone;
                                const normalised = normalisePhone(raw);
                                const changed = normalised !== raw.replace(/\D/g, '');
                                return changed ? (
                                    <p className="text-[11px] text-indigo-500 bg-indigo-50 border border-indigo-100 rounded-[6px] px-3 py-1.5">
                                        Will send to <span className="font-[700] font-mono">{normalised}</span> (auto-converted from {raw})
                                    </p>
                                ) : (
                                    <p className="text-[11px] text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-[6px] px-3 py-1.5">
                                        Sending to <span className="font-[700] font-mono">{normalised}</span>
                                    </p>
                                );
                            })()}

                            {/* Gateway info */}
                            <div className="rounded-[8px] bg-gray-50 border border-gray-100 px-4 py-3 space-y-1.5 text-[11.5px]">
                                <div className="flex items-center justify-between">
                                    <span className="text-gray-400">Shortcode</span>
                                    <span className="font-[600] text-gray-700">{config.shortcode}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-gray-400">Provider</span>
                                    <span className="font-[500] text-gray-600">Celcom Africa</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-gray-400">Mode</span>
                                    <span className={config.isStub ? "text-amber-600 font-[600]" : "text-emerald-600 font-[600]"}>
                                        {config.isStub ? "Stub (no real SMS)" : "Live"}
                                    </span>
                                </div>
                            </div>

                            {compResult && (
                                <div className={`flex items-center gap-2 px-3 py-2.5 rounded-[7px] text-[12px] ${
                                    compResult.ok
                                        ? "bg-emerald-50 border border-emerald-200 text-emerald-700"
                                        : "bg-red-50 border border-red-200 text-red-600"
                                }`}>
                                    {compResult.ok ? <PiCheckCircle className="text-[14px] flex-shrink-0" /> : <PiWarningCircle className="text-[14px] flex-shrink-0" />}
                                    <span className="flex-1">{compResult.msg}</span>
                                    <button onClick={() => setCompResult(null)}><PiX className="text-[12px]" /></button>
                                </div>
                            )}
                        </div>

                        {/* Panel footer */}
                        <div className="flex-shrink-0 px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-2">
                            <button
                                onClick={() => setShowCompose(false)}
                                className="px-4 py-2 rounded-[6px] border border-gray-200 text-[12.5px] text-gray-500 hover:bg-gray-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCompose}
                                disabled={compSending || !(selectedContact?.phone || compPhone.trim()) || !compMsg.trim()}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-[6px] bg-[#6366F1] text-white text-[12.5px] font-[500] hover:bg-indigo-700 transition-colors disabled:opacity-40"
                            >
                                {compSending ? (
                                    <><PiArrowClockwise className="animate-spin" /> Sending…</>
                                ) : (
                                    <><PiPaperPlaneTilt size={11} /> Send Message</>
                                )}
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
