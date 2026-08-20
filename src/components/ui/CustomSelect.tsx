"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { PiCaretDown } from "react-icons/pi";

export interface CustomSelectOption {
    value: string;
    label: string;
    disabled?: boolean;
}

interface CustomSelectProps {
    value: string;
    onChange: (val: string) => void;
    options: CustomSelectOption[];
    placeholder?: string;
    className?: string;
    style?: React.CSSProperties;
    disabled?: boolean;
}

export function CustomSelect({
    value,
    onChange,
    options,
    placeholder = "Select an option",
    className = "",
    style,
    disabled = false,
}: CustomSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });
    const triggerRef = useRef<HTMLButtonElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (
                listRef.current && !listRef.current.contains(e.target as Node) &&
                triggerRef.current && !triggerRef.current.contains(e.target as Node)
            ) setIsOpen(false);
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const handleToggle = () => {
        if (disabled) return;
        if (!isOpen && triggerRef.current) {
            const r = triggerRef.current.getBoundingClientRect();
            setCoords({ top: r.bottom + 4, left: r.left, width: r.width });
        }
        setIsOpen(v => !v);
    };

    const selected = options.find(o => o.value === value);

    return (
        <>
            <button
                ref={triggerRef}
                type="button"
                onClick={handleToggle}
                disabled={disabled}
                className={className}
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    width: "100%",
                    textAlign: "left",
                    cursor: disabled ? "not-allowed" : "pointer",
                    opacity: disabled ? 0.5 : 1,
                    ...style,
                }}
            >
                <span style={{ color: selected ? undefined : "#9ca3af", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {selected ? selected.label : placeholder}
                </span>
                <PiCaretDown
                    style={{
                        flexShrink: 0,
                        marginLeft: 8,
                        fontSize: 13,
                        color: "#9ca3af",
                        transition: "transform 0.15s",
                        transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                    }}
                />
            </button>
            {isOpen && typeof document !== "undefined" && createPortal(
                <div
                    ref={listRef}
                    style={{
                        position: "fixed",
                        top: coords.top,
                        left: coords.left,
                        width: coords.width,
                        zIndex: 99999,
                        background: "var(--card)",
                        borderRadius: "var(--r-input)",
                        boxShadow: "var(--card-rim), var(--shadow-dropdown)",
                        maxHeight: 220,
                        overflowY: "auto",
                        padding: 4,
                    }}
                >
                    {options.map(opt => (
                        <button
                            key={opt.value}
                            type="button"
                            disabled={opt.disabled}
                            onClick={() => {
                                if (!opt.disabled) { onChange(opt.value); setIsOpen(false); }
                            }}
                            style={{
                                display: "block",
                                width: "100%",
                                textAlign: "left",
                                padding: "10px 12px",
                                fontSize: 13,
                                borderRadius: 8,
                                color: opt.disabled ? "#9ca3af" : value === opt.value ? "var(--p)" : "#374151",
                                fontWeight: value === opt.value ? 500 : 400,
                                background: value === opt.value ? "var(--p-dim)" : "transparent",
                                border: "none",
                                cursor: opt.disabled ? "not-allowed" : "pointer",
                            }}
                            onMouseEnter={e => { if (!opt.disabled && value !== opt.value) e.currentTarget.style.background = "var(--glass-h)"; }}
                            onMouseLeave={e => { if (value !== opt.value) e.currentTarget.style.background = "transparent"; }}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>,
                document.body
            )}
        </>
    );
}
