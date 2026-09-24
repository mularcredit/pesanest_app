"use client";

import { useState } from "react";

/**
 * Minimal renderer for the assistant's replies.
 *
 * The model answers in light markdown — tables, bold, bullets. A full markdown
 * library would be overkill and would fight the sidebar's typography, so this
 * handles just those three and renders tables in a form that suits a 420px
 * column: soft tinted header, horizontal rules only, no vertical grid.
 */

interface TableBlock {
    kind: "table";
    head: string[];
    rows: string[][];
}
interface TextBlock {
    kind: "text";
    lines: string[];
}
type Block = TableBlock | TextBlock;

const isDivider = (line: string) => /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(line) && line.includes("-");
const cells = (line: string) =>
    line.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|").map((c) => c.trim());

function parse(text: string): Block[] {
    const lines = text.split("\n");
    const blocks: Block[] = [];
    let buffer: string[] = [];

    const flush = () => {
        if (buffer.length) {
            blocks.push({ kind: "text", lines: buffer });
            buffer = [];
        }
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const next = lines[i + 1];
        // A table is a pipe row followed by a --- divider row.
        if (line.trim().startsWith("|") && next && isDivider(next)) {
            flush();
            const head = cells(line);
            const rows: string[][] = [];
            i += 2;
            while (i < lines.length && lines[i].trim().startsWith("|")) {
                rows.push(cells(lines[i]));
                i++;
            }
            i--;
            blocks.push({ kind: "table", head, rows });
            continue;
        }
        buffer.push(line);
    }
    flush();
    return blocks;
}

/** **bold** and `code`, nothing more — keeps the type clean. */
function inline(text: string, keyPrefix: string) {
    const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);
    return parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
            return <b key={`${keyPrefix}-${i}`}>{part.slice(2, -2)}</b>;
        }
        if (part.startsWith("`") && part.endsWith("`")) {
            return <code key={`${keyPrefix}-${i}`}>{part.slice(1, -1)}</code>;
        }
        return <span key={`${keyPrefix}-${i}`}>{part}</span>;
    });
}

/** Values that read as a state get a pill rather than plain text. */
const STATUS_TONE: Record<string, string> = {
    paid: "ok", "fully paid": "ok", settled: "ok", active: "ok", complete: "ok", completed: "ok",
    partial: "warn", "partially paid": "warn", pending: "warn",
    unpaid: "bad", outstanding: "bad", overdue: "bad", rejected: "bad",
};
const toneFor = (v: string) => STATUS_TONE[v.trim().toLowerCase().replace(/\*\*/g, "")];

const ROWS_SHOWN = 4;
/** Beyond this, the sidebar cannot show every column legibly. */
const COLS_SHOWN = 3;

function Table({ block }: { block: TableBlock }) {
    const [expanded, setExpanded] = useState(false);
    const narrow = block.head.length > COLS_SHOWN && !expanded;
    const head = narrow ? block.head.slice(0, COLS_SHOWN) : block.head;
    const rows = expanded ? block.rows : block.rows.slice(0, ROWS_SHOWN);
    const hiddenRows = block.rows.length - rows.length;
    const hiddenCols = block.head.length - head.length;
    const more = hiddenRows > 0 || hiddenCols > 0;

    // Right-align anything that looks like money or a number.
    const numeric = head.map((_, c) =>
        block.rows.some((r) => /^[$€£]?\s?[\d,]+(\.\d+)?%?$/.test((r[c] ?? "").replace(/\*\*/g, "").trim()))
    );

    return (
        <div className="nu-tbl-wrap">
            <table className="nu-tbl">
                <thead>
                    <tr>
                        {head.map((h, i) => (
                            <th key={i} style={{ textAlign: numeric[i] ? "right" : "left" }}>
                                {h.replace(/\*\*/g, "")}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((r, ri) => (
                        <tr key={ri}>
                            {head.map((_, ci) => {
                                const raw = (r[ci] ?? "").trim();
                                const tone = toneFor(raw);
                                return (
                                    <td key={ci} style={{ textAlign: numeric[ci] ? "right" : "left" }}>
                                        {tone ? (
                                            <span className={`nu-pill ${tone}`}>{raw.replace(/\*\*/g, "")}</span>
                                        ) : (
                                            inline(raw, `${ri}-${ci}`)
                                        )}
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>

            {more && (
                <button type="button" className="nu-tbl-more" onClick={() => setExpanded(true)}>
                    View all
                    {hiddenRows > 0 && ` ${block.rows.length} rows`}
                    {hiddenCols > 0 && ` · ${block.head.length} columns`}
                    <span aria-hidden> →</span>
                </button>
            )}
        </div>
    );
}

export function AssistantMarkdown({ text }: { text: string }) {
    const blocks = parse(text);

    return (
        <div className="nu-md">
            {blocks.map((block, bi) => {
                if (block.kind === "table") return <Table key={bi} block={block} />;

                return block.lines.map((line, li) => {
                    const key = `${bi}-${li}`;
                    const trimmed = line.trim();
                    if (!trimmed) return <div key={key} className="nu-gap" />;

                    // Bullets, including the model's occasional "- **Name** — detail".
                    if (/^[-*•]\s+/.test(trimmed)) {
                        return (
                            <div key={key} className="nu-li">
                                <i />
                                <span>{inline(trimmed.replace(/^[-*•]\s+/, ""), key)}</span>
                            </div>
                        );
                    }
                    if (/^\d+\.\s+/.test(trimmed)) {
                        return (
                            <div key={key} className="nu-li">
                                <em>{trimmed.match(/^\d+/)?.[0]}</em>
                                <span>{inline(trimmed.replace(/^\d+\.\s+/, ""), key)}</span>
                            </div>
                        );
                    }
                    if (/^#{1,4}\s+/.test(trimmed)) {
                        return (
                            <p key={key} className="nu-h">
                                {inline(trimmed.replace(/^#{1,4}\s+/, ""), key)}
                            </p>
                        );
                    }
                    return (
                        <p key={key} className="nu-p">
                            {inline(trimmed, key)}
                        </p>
                    );
                });
            })}

            <style jsx global>{`
                .nu-md { font-size: 13px; line-height: 1.7; color: var(--t2); }
                .nu-md .nu-p { margin: 0 0 2px; }
                .nu-md .nu-h { margin: 10px 0 4px; font-size: 12.5px; font-weight: 700; color: var(--t1); }
                .nu-md .nu-gap { height: 8px; }
                .nu-md b { font-weight: 700; color: var(--t1); }
                .nu-md code {
                    font-size: 11.5px; padding: 1px 5px; border-radius: 4px;
                    background: rgba(37, 99, 235, 0.07); color: var(--p);
                }
                .nu-li { display: flex; gap: 8px; margin: 3px 0; }
                .nu-li i {
                    width: 4px; height: 4px; border-radius: 999px; background: var(--p);
                    opacity: 0.55; margin-top: 8px; flex-shrink: 0;
                }
                .nu-li em {
                    font-style: normal; font-size: 10.5px; font-weight: 700; color: var(--p);
                    min-width: 12px; margin-top: 2px; flex-shrink: 0;
                }

                /* Table tuned for a ~420px column: no vertical rules, soft header,
                   thin separators, roomy rows. */
                .nu-tbl-wrap {
                    margin: 10px 0 4px; border: 1px solid var(--p-line); border-radius: 12px;
                    overflow: hidden; background: rgba(255, 255, 255, 0.6);
                }
                .nu-tbl { width: 100%; border-collapse: collapse; }
                .nu-tbl th {
                    font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;
                    color: var(--t4); padding: 8px 12px; background: rgba(37, 99, 235, 0.045);
                    border-bottom: 1px solid var(--p-line); white-space: nowrap;
                }
                .nu-tbl td {
                    font-size: 12px; padding: 9px 12px; color: var(--t2);
                    border-bottom: 1px solid rgba(15, 23, 42, 0.05);
                    font-variant-numeric: tabular-nums;
                }
                .nu-tbl tbody tr:last-child td { border-bottom: 0; }
                .nu-tbl tbody tr:hover td { background: rgba(37, 99, 235, 0.02); }

                .nu-pill {
                    display: inline-block; font-size: 10px; font-weight: 700;
                    padding: 2px 8px; border-radius: 999px; border: 1px solid;
                }
                .nu-pill.ok { background: rgba(5,150,105,0.10); color: #065F46; border-color: rgba(5,150,105,0.22); }
                .nu-pill.warn { background: rgba(217,119,6,0.10); color: #92400E; border-color: rgba(217,119,6,0.24); }
                .nu-pill.bad { background: rgba(220,38,38,0.08); color: #991B1B; border-color: rgba(220,38,38,0.20); }

                .nu-tbl-more {
                    width: 100%; border: 0; border-top: 1px solid var(--p-line); background: transparent;
                    padding: 8px 12px; font: inherit; font-size: 11px; font-weight: 600;
                    color: var(--p); cursor: pointer; text-align: left;
                }
                .nu-tbl-more:hover { background: rgba(37, 99, 235, 0.04); }
            `}</style>
        </div>
    );
}
