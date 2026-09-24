"use client";

import { useState } from "react";
import {
    PiCheckCircle, PiCircleHalf, PiWarningCircle, PiInfo, PiFileText,
    PiReceipt, PiUser, PiCurrencyDollar, PiCalendarBlank, PiDotsThree,
    PiFilePdf, PiArrowSquareOut,
} from "react-icons/pi";

/**
 * Renders Nuri's answers as designed UI rather than markdown.
 *
 * Two paths, in order of preference:
 *
 *  1. Structured blocks. The model is asked to emit ```ui fences containing
 *     JSON ({type: "metrics" | "table" | "records" | ...}). Those map directly
 *     onto the components below, which is why the output can look designed
 *     instead of merely formatted.
 *
 *  2. Markdown fallback. Models drift, so anything that arrives as markdown is
 *     still converted — tables become tables, "- x" becomes list cards, "1. x"
 *     becomes a stepper, "Label: value" runs become a detail grid. The point is
 *     that a raw |, -, #, or * must never reach the user either way.
 */

/* ─────────────────────────── block types ─────────────────────────── */

interface Metric { value: string; label: string; tone?: string }
interface Field { label: string; value: string }
interface ListItem { title: string; detail?: string; icon?: string; status?: string }
interface Record_ { title: string; status?: string; fields?: Field[] }
interface Compare { title: string; primary?: string; fields?: Field[] }
interface Section { title: string; items: ListItem[] }
interface Action { label: string; prompt?: string; primary?: boolean }

type Block =
    | { type: "text"; text: string }
    | { type: "heading"; text: string }
    | { type: "metrics"; items: Metric[] }
    | { type: "table"; columns: string[]; rows: string[][]; caption?: string }
    | { type: "records"; items: Record_[] }
    | { type: "list"; items: ListItem[] }
    | { type: "steps"; items: ListItem[] }
    | { type: "details"; items: Field[]; title?: string }
    | { type: "comparison"; items: Compare[] }
    | { type: "sections"; items: Section[] }
    | { type: "actions"; items: Action[] }
    | { type: "document"; title: string; subtitle?: string; url: string; kind?: string; meta?: string }
    | { type: "note"; text: string };

/* ─────────────────────────── helpers ─────────────────────────── */

const STATUS_TONE: Record<string, "ok" | "warn" | "bad" | "mute"> = {
    paid: "ok", "fully paid": "ok", settled: "ok", active: "ok", complete: "ok",
    completed: "ok", approved: "ok", current: "ok", ok: "ok",
    partial: "warn", "partially paid": "warn", pending: "warn", "in progress": "warn", due: "warn",
    unpaid: "bad", outstanding: "bad", overdue: "bad", rejected: "bad", failed: "bad", "not invoiced": "bad",
    "no billing": "mute", none: "mute", "n/a": "mute", draft: "mute",
};
const toneOf = (v?: string) => (v ? STATUS_TONE[v.trim().toLowerCase()] : undefined);

/**
 * A document link is written by the model, so it is treated as data, not as a
 * destination to trust. Only our own document and studio paths are allowed to
 * render — anything else (an absolute URL, a protocol, a path traversal) is
 * dropped rather than shown to the user as something worth clicking.
 */
const DOC_PATHS = ["/finance-studio"];
function safeDocUrl(url: unknown): string | null {
    if (typeof url !== "string") return null;
    const u = url.trim();
    if (!u.startsWith("/") || u.startsWith("//") || u.includes("..")) return null;
    return DOC_PATHS.some((p) => u.startsWith(p)) ? u : null;
}

const ICONS: Record<string, React.ComponentType<{ size?: number }>> = {
    check: PiCheckCircle, half: PiCircleHalf, warn: PiWarningCircle, info: PiInfo,
    doc: PiFileText, invoice: PiReceipt, customer: PiUser, money: PiCurrencyDollar, date: PiCalendarBlank,
};

/** Strip markdown emphasis so no asterisk or backtick ever renders. */
const clean = (s: string) =>
    (s ?? "").replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*(.+?)\*/g, "$1")
        .replace(/`(.+?)`/g, "$1").replace(/^#{1,6}\s*/, "").trim();

const looksNumeric = (s: string) => /^[$€£R]?\s?-?[\d,]+(\.\d+)?\s?%?$/.test(clean(s));

function StatusPill({ value }: { value: string }) {
    const tone = toneOf(value) ?? "mute";
    return <span className={`nu-pill ${tone}`}>{clean(value)}</span>;
}

/* ─────────────────────────── parsing ─────────────────────────── */

const isDivider = (l: string) => /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(l) && l.includes("-");
const cellsOf = (l: string) => l.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|").map((c) => clean(c));

/** "Label: value" — the shape that becomes a detail grid. */
const kv = (l: string): Field | null => {
    const m = /^[-*•]?\s*([A-Za-z][\w %/&().'-]{1,32}):\s+(.+)$/.exec(l.trim());
    if (!m) return null;
    const value = clean(m[2]);
    if (!value || value.length > 60) return null;
    return { label: clean(m[1]), value };
};

function parse(raw: string): Block[] {
    const blocks: Block[] = [];

    // 1. Pull out ```ui fences first — these are authored, not inferred.
    const parts = raw.split(/```(?:ui|json)?\s*\n?/);
    const segments: { structured: boolean; body: string }[] = [];
    let inFence = false;
    for (const part of parts) {
        // Fenced content may end with a stray ``` when streaming truncates.
        const body = part.replace(/```\s*$/, "");
        segments.push({ structured: inFence, body });
        inFence = !inFence;
    }

    for (const seg of segments) {
        if (!seg.body.trim()) continue;

        if (seg.structured) {
            // One JSON object, or several separated by newlines.
            for (const chunk of seg.body.split(/\n(?=\s*\{)/)) {
                const t = chunk.trim();
                if (!t.startsWith("{")) continue;
                try {
                    const obj = JSON.parse(t);
                    if (obj && typeof obj.type === "string") blocks.push(obj as Block);
                } catch {
                    // A half-streamed object is expected; skip until it completes.
                }
            }
            continue;
        }

        blocks.push(...parseProse(seg.body));
    }

    return blocks;
}

function parseProse(text: string): Block[] {
    const out: Block[] = [];
    const lines = text.split("\n");
    let para: string[] = [];

    const flushPara = () => {
        const t = para.join(" ").trim();
        if (t) out.push({ type: "text", text: clean(t) });
        para = [];
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        if (!trimmed) { flushPara(); continue; }

        // markdown table -> table / records
        if (trimmed.startsWith("|") && lines[i + 1] && isDivider(lines[i + 1])) {
            flushPara();
            const columns = cellsOf(trimmed);
            const rows: string[][] = [];
            i += 2;
            while (i < lines.length && lines[i].trim().startsWith("|")) { rows.push(cellsOf(lines[i])); i++; }
            i--;
            out.push({ type: "table", columns, rows });
            continue;
        }

        // heading
        if (/^#{1,6}\s+/.test(trimmed)) { flushPara(); out.push({ type: "heading", text: clean(trimmed) }); continue; }

        // numbered run -> steps
        if (/^\d+[.)]\s+/.test(trimmed)) {
            flushPara();
            const items: ListItem[] = [];
            while (i < lines.length && /^\d+[.)]\s+/.test(lines[i].trim())) {
                const body = clean(lines[i].trim().replace(/^\d+[.)]\s+/, ""));
                const [head, ...rest] = body.split(/\s+[—–-]\s+/);
                items.push({ title: head, detail: rest.join(" — ") || undefined });
                i++;
            }
            i--;
            out.push({ type: "steps", items });
            continue;
        }

        // bulleted run -> details grid when every line is Label: value, else list cards
        if (/^[-*•]\s+/.test(trimmed)) {
            flushPara();
            const bullets: string[] = [];
            while (i < lines.length && /^[-*•]\s+/.test(lines[i].trim())) {
                bullets.push(lines[i].trim().replace(/^[-*•]\s+/, ""));
                i++;
            }
            i--;
            const fields = bullets.map(kv);
            if (fields.length >= 2 && fields.every(Boolean)) {
                out.push({ type: "details", items: fields as Field[] });
            } else {
                out.push({
                    type: "list",
                    items: bullets.map((b) => {
                        const body = clean(b);
                        const [head, ...rest] = body.split(/\s+[—–]\s+/);
                        return { title: head, detail: rest.join(" — ") || undefined };
                    }),
                });
            }
            continue;
        }

        // a caution line reads better as a note
        if (/^(⚠️|note:|caution:|warning:)/i.test(trimmed)) {
            flushPara();
            out.push({ type: "note", text: clean(trimmed.replace(/^(⚠️|note:|caution:|warning:)\s*/i, "")) });
            continue;
        }

        para.push(trimmed);
    }
    flushPara();
    return out;
}

/* ─────────────────────────── components ─────────────────────────── */

/** Wide datasets become one card per row rather than scrolling sideways. */
const WIDE_AT = 4;
const ROWS_SHOWN = 5;

function DataTable({ block }: { block: Extract<Block, { type: "table" }> }) {
    const [all, setAll] = useState(false);
    const wide = block.columns.length >= WIDE_AT;
    const rows = all ? block.rows : block.rows.slice(0, ROWS_SHOWN);
    const hidden = block.rows.length - rows.length;

    if (wide) {
        // Column 0 titles the card; a status-ish column becomes the pill.
        const statusIdx = block.columns.findIndex((_, c) => block.rows.some((r) => toneOf(r[c])));
        return (
            <div className="nu-stack">
                {rows.map((r, ri) => (
                    <div key={ri} className="nu-rec" style={{ animationDelay: `${ri * 40}ms` }}>
                        <div className="nu-rec-top">
                            <b>{r[0]}</b>
                            {statusIdx > 0 && r[statusIdx] && <StatusPill value={r[statusIdx]} />}
                        </div>
                        <dl>
                            {block.columns.map((c, ci) =>
                                ci === 0 || ci === statusIdx || !r[ci] ? null : (
                                    <div key={ci}>
                                        <dt>{c}</dt>
                                        <dd className={looksNumeric(r[ci]) ? "num" : ""}>{r[ci]}</dd>
                                    </div>
                                )
                            )}
                        </dl>
                    </div>
                ))}
                {hidden > 0 && (
                    <button type="button" className="nu-more" onClick={() => setAll(true)}>
                        View all {block.rows.length} records <span aria-hidden>→</span>
                    </button>
                )}
            </div>
        );
    }

    const numeric = block.columns.map((_, c) => block.rows.some((r) => looksNumeric(r[c] ?? "")));
    return (
        <div className="nu-tbl-wrap">
            <table className="nu-tbl">
                <thead>
                    <tr>{block.columns.map((c, i) => <th key={i} style={{ textAlign: numeric[i] ? "right" : "left" }}>{c}</th>)}</tr>
                </thead>
                <tbody>
                    {rows.map((r, ri) => (
                        <tr key={ri}>
                            {block.columns.map((_, ci) => {
                                const v = r[ci] ?? "";
                                return (
                                    <td key={ci} style={{ textAlign: numeric[ci] ? "right" : "left" }}>
                                        {toneOf(v) ? <StatusPill value={v} /> : v}
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
            {hidden > 0 && (
                <button type="button" className="nu-more flat" onClick={() => setAll(true)}>
                    View all {block.rows.length} rows <span aria-hidden>→</span>
                </button>
            )}
        </div>
    );
}

export function AssistantResponse({ text, onAction }: { text: string; onAction?: (prompt: string) => void }) {
    const blocks = parse(text);

    return (
        <div className="nu-resp">
            {blocks.map((b, i) => {
                switch (b.type) {
                    case "heading":
                        return <p key={i} className="nu-h">{b.text}</p>;

                    case "text":
                        return <p key={i} className="nu-p">{b.text}</p>;

                    case "note":
                        return (
                            <div key={i} className="nu-note">
                                <PiWarningCircle size={13} />
                                <span>{b.text}</span>
                            </div>
                        );

                    case "metrics":
                        return (
                            <div key={i} className="nu-metrics">
                                {b.items.map((m, mi) => (
                                    <div key={mi} className="nu-metric" style={{ animationDelay: `${mi * 45}ms` }}>
                                        <b className={toneOf(m.tone) ? `t-${toneOf(m.tone)}` : ""}>{clean(m.value)}</b>
                                        <span>{clean(m.label)}</span>
                                    </div>
                                ))}
                            </div>
                        );

                    case "table":
                        return <DataTable key={i} block={b} />;

                    case "records":
                        return (
                            <div key={i} className="nu-stack">
                                {b.items.map((r, ri) => (
                                    <div key={ri} className="nu-rec" style={{ animationDelay: `${ri * 40}ms` }}>
                                        <div className="nu-rec-top">
                                            <b>{clean(r.title)}</b>
                                            {r.status && <StatusPill value={r.status} />}
                                        </div>
                                        {r.fields && r.fields.length > 0 && (
                                            <dl>
                                                {r.fields.map((f, fi) => (
                                                    <div key={fi}>
                                                        <dt>{clean(f.label)}</dt>
                                                        <dd className={looksNumeric(f.value) ? "num" : ""}>{clean(f.value)}</dd>
                                                    </div>
                                                ))}
                                            </dl>
                                        )}
                                    </div>
                                ))}
                            </div>
                        );

                    case "list":
                        return (
                            <div key={i} className="nu-listcard">
                                {b.items.map((it, ii) => {
                                    const Icon = ICONS[it.icon ?? ""] ?? PiCheckCircle;
                                    return (
                                        <div key={ii} className="nu-listrow" style={{ animationDelay: `${ii * 35}ms` }}>
                                            <Icon size={14} />
                                            <div>
                                                <b>{clean(it.title)}</b>
                                                {it.detail && <span>{clean(it.detail)}</span>}
                                            </div>
                                            {it.status && <StatusPill value={it.status} />}
                                        </div>
                                    );
                                })}
                            </div>
                        );

                    case "steps":
                        return (
                            <ol key={i} className="nu-steps">
                                {b.items.map((s, si) => (
                                    <li key={si} style={{ animationDelay: `${si * 45}ms` }}>
                                        <span className="nu-step-n">{si + 1}</span>
                                        <div>
                                            <b>{clean(s.title)}</b>
                                            {s.detail && <span>{clean(s.detail)}</span>}
                                        </div>
                                    </li>
                                ))}
                            </ol>
                        );

                    case "details":
                        return (
                            <div key={i} className="nu-details">
                                {b.title && <p className="nu-details-t">{clean(b.title)}</p>}
                                {b.items.map((f, fi) => (
                                    <div key={fi}>
                                        <dt>{clean(f.label)}</dt>
                                        <dd>{toneOf(f.value) ? <StatusPill value={f.value} /> : <span className={looksNumeric(f.value) ? "num" : ""}>{clean(f.value)}</span>}</dd>
                                    </div>
                                ))}
                            </div>
                        );

                    case "comparison":
                        return (
                            <div key={i} className="nu-compare">
                                {b.items.map((c, ci) => (
                                    <div key={ci} className="nu-comp" style={{ animationDelay: `${ci * 50}ms` }}>
                                        <span className="nu-comp-t">{clean(c.title)}</span>
                                        {c.primary && <b>{clean(c.primary)}</b>}
                                        {c.fields?.map((f, fi) => (
                                            <p key={fi}>
                                                <em>{clean(f.label)}</em>
                                                <span className={looksNumeric(f.value) ? "num" : ""}>{clean(f.value)}</span>
                                            </p>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        );

                    case "sections":
                        return (
                            <div key={i} className="nu-sections">
                                {b.items.map((s, si) => (
                                    <section key={si}>
                                        <p className="nu-sec-t">{clean(s.title)}</p>
                                        <div className="nu-listcard">
                                            {s.items.map((it, ii) => {
                                                const Icon = ICONS[it.icon ?? ""] ?? PiCheckCircle;
                                                return (
                                                    <div key={ii} className="nu-listrow">
                                                        <Icon size={14} />
                                                        <div>
                                                            <b>{clean(it.title)}</b>
                                                            {it.detail && <span>{clean(it.detail)}</span>}
                                                        </div>
                                                        {it.status && <StatusPill value={it.status} />}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </section>
                                ))}
                            </div>
                        );

                    case "actions":
                        return (
                            <div key={i} className="nu-btnrow">
                                {b.items.map((a, ai) => (
                                    <button
                                        key={ai}
                                        type="button"
                                        className={a.primary ? "nu-btn primary" : "nu-btn"}
                                        onClick={() => a.prompt && onAction?.(a.prompt)}
                                        disabled={!a.prompt}
                                        title={a.prompt ? undefined : "No action attached"}
                                    >
                                        {clean(a.label)}
                                    </button>
                                ))}
                                <button type="button" className="nu-btn icon" disabled aria-label="More">
                                    <PiDotsThree size={14} />
                                </button>
                            </div>
                        );

                    case "document": {
                        const href = safeDocUrl(b.url);
                        if (!href) return null;
                        const Icon = b.kind === "receipt" ? PiReceipt : b.kind === "credit-note" ? PiFileText : PiFilePdf;
                        return (
                            <a key={i} href={href} target="_blank" rel="noopener noreferrer" className="nu-doc">
                                <span className="nu-doc-ic"><Icon size={17} /></span>
                                <span className="nu-doc-body">
                                    <span className="nu-doc-t">{clean(b.title)}</span>
                                    {b.subtitle && <span className="nu-doc-s">{clean(b.subtitle)}</span>}
                                    {b.meta && <span className="nu-doc-m">{clean(b.meta)}</span>}
                                </span>
                                <span className="nu-doc-go"><PiArrowSquareOut size={14} /></span>
                            </a>
                        );
                    }

                    default:
                        return null;
                }
            })}

            <style jsx global>{`
                /* Nothing may exceed the sidebar's content width — a clipped
                   component looks like a rendering fault, not an affordance. */
                .nu-resp {
                    font-size: 13px; line-height: 1.7; color: var(--t2);
                    display: flex; flex-direction: column; gap: 10px;
                    min-width: 0; max-width: 100%;
                }
                .nu-resp > * { margin: 0; min-width: 0; max-width: 100%; }
                .nu-resp p { overflow-wrap: anywhere; }

                /* A finished document reads as a thing you can pick up, not as
                   a link in a sentence. */
                .nu-doc {
                    display: flex; align-items: center; gap: 10px; padding: 11px 12px;
                    border: 1px solid var(--p-line); border-radius: 11px;
                    background: var(--card); text-decoration: none; cursor: pointer;
                    transition: border-color .16s, background .16s, transform .16s, box-shadow .16s;
                }
                .nu-doc:hover {
                    border-color: rgba(37,99,235,0.4); background: rgba(37,99,235,0.04);
                    transform: translateY(-1px); box-shadow: 0 6px 16px rgba(15,23,42,0.07);
                }
                .nu-doc-ic {
                    width: 34px; height: 34px; flex: 0 0 34px; border-radius: 9px;
                    display: flex; align-items: center; justify-content: center;
                    background: rgba(37,99,235,0.09); color: #2563EB;
                }
                .nu-doc-body { display: flex; flex-direction: column; gap: 1px; min-width: 0; flex: 1; }
                .nu-doc-t { font-size: 12.5px; font-weight: 700; color: var(--t1); overflow-wrap: anywhere; }
                .nu-doc-s { font-size: 11px; color: var(--t3); overflow-wrap: anywhere; }
                .nu-doc-m { font-size: 11px; font-weight: 600; color: #2563EB; overflow-wrap: anywhere; }
                .nu-doc-go { color: var(--t4); flex: 0 0 auto; }
                .nu-doc:hover .nu-doc-go { color: #2563EB; }
                .nu-resp .nu-p { color: var(--t2); }
                .nu-resp .nu-h { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--t4); margin-top: 4px; }
                .num { font-variant-numeric: tabular-nums; }

                @keyframes nuIn { from { opacity: 0; transform: translateY(5px) } to { opacity: 1; transform: none } }

                /* status pills */
                .nu-pill { display: inline-block; font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 999px; border: 1px solid; white-space: nowrap; }
                .nu-pill.ok   { background: rgba(5,150,105,0.10); color: #065F46; border-color: rgba(5,150,105,0.22); }
                .nu-pill.warn { background: rgba(217,119,6,0.10); color: #92400E; border-color: rgba(217,119,6,0.24); }
                .nu-pill.bad  { background: rgba(220,38,38,0.08); color: #991B1B; border-color: rgba(220,38,38,0.20); }
                .nu-pill.mute { background: rgba(15,23,42,0.04); color: var(--t4); border-color: rgba(15,23,42,0.08); }
                .t-ok { color: #065F46 !important } .t-warn { color: #92400E !important } .t-bad { color: #991B1B !important }

                /* Metric tiles wrap rather than scroll: a clipped tile at the panel
                   edge reads as broken, and horizontal scroll inside a 424px
                   sidebar is easy to miss. auto-fit gives 3 across when they fit
                   and folds to 2 when the figures are long. */
                .nu-metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(104px, 1fr)); gap: 8px; }
                .nu-metric {
                    min-width: 0; padding: 11px 12px; border: 1px solid var(--p-line);
                    border-radius: 13px; background: rgba(255,255,255,0.75); animation: nuIn .32s ease-out both;
                }
                .nu-metric b {
                    display: block; font-size: 15.5px; font-weight: 800; letter-spacing: -0.035em;
                    color: var(--t1); font-variant-numeric: tabular-nums;
                    overflow-wrap: anywhere;
                }
                .nu-metric span {
                    display: block; font-size: 10px; font-weight: 600; color: var(--t4); margin-top: 2px;
                    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
                }

                /* table */
                .nu-tbl-wrap { border: 1px solid var(--p-line); border-radius: 13px; overflow: hidden; background: rgba(255,255,255,0.7); }
                .nu-tbl { width: 100%; border-collapse: collapse; }
                /* Headers wrap instead of nowrap — a long label like
                   "OUTSTANDING (AUG)" would otherwise force the table wider than
                   the panel and clip the last column. */
                .nu-tbl th {
                    font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--t4);
                    padding: 8px 10px; background: rgba(37,99,235,0.04); border-bottom: 1px solid var(--p-line);
                    line-height: 1.3; overflow-wrap: anywhere;
                }
                .nu-tbl td {
                    font-size: 12.5px; padding: 10px; color: var(--t2);
                    border-bottom: 1px solid rgba(15,23,42,0.05); font-variant-numeric: tabular-nums;
                    overflow-wrap: anywhere;
                }
                .nu-tbl tbody tr:last-child td { border-bottom: 0; }
                .nu-tbl tbody tr:hover td { background: rgba(37,99,235,0.02); }

                /* record cards for wide data */
                .nu-stack { display: flex; flex-direction: column; gap: 8px; }
                .nu-rec {
                    border: 1px solid var(--p-line); border-radius: 14px; padding: 12px 13px;
                    background: rgba(255,255,255,0.75); animation: nuIn .32s ease-out both;
                    transition: transform .16s, box-shadow .16s;
                }
                .nu-rec:hover { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(15,23,42,0.06); }
                .nu-rec-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
                .nu-rec-top b { font-size: 12.5px; font-weight: 700; color: var(--t1); }
                .nu-rec dl { display: flex; flex-direction: column; gap: 3px; margin-top: 9px; }
                .nu-rec dl > div { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }
                .nu-rec dt { font-size: 10.5px; color: var(--t4); flex-shrink: 0; }
                .nu-rec dd { font-size: 12px; font-weight: 600; color: var(--t1); text-align: right; overflow-wrap: anywhere; }
                .nu-rec-top b { overflow-wrap: anywhere; }

                /* list cards */
                .nu-listcard { border: 1px solid var(--p-line); border-radius: 14px; overflow: hidden; background: rgba(255,255,255,0.7); }
                .nu-listrow {
                    display: flex; align-items: flex-start; gap: 9px; padding: 11px 13px;
                    border-bottom: 1px solid rgba(15,23,42,0.05); animation: nuIn .3s ease-out both;
                }
                .nu-listcard .nu-listrow:last-child { border-bottom: 0; }
                .nu-listrow > svg { color: var(--p); opacity: 0.8; flex-shrink: 0; margin-top: 2px; }
                .nu-listrow > div { flex: 1; min-width: 0; }
                .nu-listrow b { display: block; font-size: 12.5px; font-weight: 600; color: var(--t1); }
                .nu-listrow span { display: block; font-size: 11px; color: var(--t4); margin-top: 1px; }

                /* stepper */
                .nu-steps { list-style: none; padding: 2px 0; margin: 0; }
                .nu-steps li { position: relative; display: flex; gap: 11px; padding-bottom: 15px; animation: nuIn .3s ease-out both; }
                .nu-steps li:last-child { padding-bottom: 0; }
                .nu-steps li::before {
                    content: ""; position: absolute; left: 10px; top: 23px; bottom: 2px; width: 1px;
                    background: linear-gradient(180deg, var(--p-line), rgba(15,23,42,0.04));
                }
                .nu-steps li:last-child::before { display: none; }
                .nu-step-n {
                    width: 21px; height: 21px; flex-shrink: 0; border-radius: 999px; z-index: 1;
                    display: flex; align-items: center; justify-content: center;
                    font-size: 10.5px; font-weight: 700; color: var(--p);
                    background: #fff; border: 1px solid rgba(37,99,235,0.3);
                }
                .nu-steps b { display: block; font-size: 12.5px; font-weight: 600; color: var(--t1); }
                .nu-steps span { display: block; font-size: 11.5px; color: var(--t4); margin-top: 1px; }

                /* detail grid */
                .nu-details { border: 1px solid var(--p-line); border-radius: 14px; padding: 12px 13px; background: rgba(255,255,255,0.72); }
                .nu-details-t { font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: var(--t4); margin-bottom: 7px; }
                .nu-details > div { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; padding: 4px 0; }
                .nu-details dt { font-size: 11.5px; color: var(--t4); }
                .nu-details dd { font-size: 12.5px; font-weight: 600; color: var(--t1); text-align: right; }

                /* comparison */
                .nu-compare { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
                @media (max-width: 460px) { .nu-compare { grid-template-columns: 1fr; } }
                .nu-comp {
                    border: 1px solid var(--p-line); border-radius: 14px; padding: 12px; background: rgba(255,255,255,0.75);
                    animation: nuIn .32s ease-out both;
                }
                .nu-comp-t { font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: var(--t4); }
                .nu-comp b { display: block; font-size: 16px; font-weight: 800; letter-spacing: -.02em; color: var(--t1); margin: 4px 0 6px; font-variant-numeric: tabular-nums; }
                .nu-comp p { display: flex; justify-content: space-between; gap: 8px; font-size: 11.5px; padding: 2px 0; }
                .nu-comp em { font-style: normal; color: var(--t4); }
                .nu-comp p span { font-weight: 600; color: var(--t2); }

                /* titled sections */
                .nu-sections { display: flex; flex-direction: column; gap: 12px; }
                .nu-sec-t { font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--t4); margin-bottom: 6px; }

                /* note */
                .nu-note {
                    display: flex; gap: 8px; align-items: flex-start; font-size: 11.5px; line-height: 1.6;
                    color: #92400E; background: rgba(217,119,6,0.06); border: 1px solid rgba(217,119,6,0.18);
                    border-radius: 11px; padding: 9px 11px;
                }
                .nu-note svg { flex-shrink: 0; margin-top: 2px; }

                /* actions */
                .nu-btnrow { display: flex; flex-wrap: wrap; gap: 6px; padding-top: 2px; }
                .nu-btn {
                    font: inherit; font-size: 11.5px; font-weight: 600; padding: 7px 13px; cursor: pointer;
                    border-radius: 999px; border: 1px solid var(--p-line); background: transparent; color: var(--t2);
                    transition: transform .12s, background .15s, border-color .15s;
                }
                .nu-btn:hover:not(:disabled) { border-color: rgba(37,99,235,0.35); color: var(--p); background: rgba(37,99,235,0.04); }
                .nu-btn:active:not(:disabled) { transform: scale(0.97); }
                .nu-btn:disabled { opacity: 0.4; cursor: default; }
                .nu-btn.primary { background: var(--p); border-color: var(--p); color: #fff; }
                .nu-btn.primary:hover:not(:disabled) { filter: brightness(1.07); color: #fff; background: var(--p); }
                .nu-btn.icon { width: 32px; padding: 7px 0; display: inline-flex; align-items: center; justify-content: center; }

                /* view all */
                .nu-more {
                    width: 100%; border: 1px dashed var(--p-line); background: transparent; border-radius: 12px;
                    padding: 9px 12px; font: inherit; font-size: 11px; font-weight: 600; color: var(--p);
                    cursor: pointer; text-align: left;
                }
                .nu-more.flat { border: 0; border-top: 1px solid var(--p-line); border-radius: 0; }
                .nu-more:hover { background: rgba(37,99,235,0.04); }
            `}</style>
        </div>
    );
}
