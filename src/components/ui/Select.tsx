"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { PiCaretDown, PiMagnifyingGlass, PiCheck } from "react-icons/pi";
import { cn } from "@/lib/utils";

interface Option {
    value: string;
    label: string | React.ReactNode;
}

interface OptionGroup {
    label: string;
    options: Option[];
}

interface SelectProps {
    value?: string;
    onChange: (value: string) => void;
    options?: Option[];
    groups?: OptionGroup[];
    placeholder?: string;
    searchable?: boolean;
    className?: string;
    icon?: React.ReactNode;
}

export function Select({
    value,
    onChange,
    options = [],
    groups,
    placeholder = "Select...",
    searchable = false,
    className = "",
    icon
}: SelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });
    const containerRef = useRef<HTMLDivElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Flat list of all options for lookup and searching
    const allOptions = groups 
        ? groups.flatMap(g => g.options) 
        : options;

    const selectedOption = allOptions.find(o => o.value === value);

    const filteredOptions = searchable && search
        ? allOptions.filter(o => {
            const labelStr = typeof o.label === 'string' ? o.label : '';
            return labelStr.toLowerCase().includes(search.toLowerCase());
        })
        : null;

    // Handle groups filtering
    const filteredGroups = groups && searchable && search
        ? groups.map(g => ({
            ...g,
            options: g.options.filter(o => {
                const labelStr = typeof o.label === 'string' ? o.label : '';
                return labelStr.toLowerCase().includes(search.toLowerCase());
            })
        })).filter(g => g.options.length > 0)
        : groups;

    // Handle click outside — the dropdown itself renders in a portal on document.body,
    // so it's not a DOM descendant of containerRef and must be checked separately,
    // otherwise every click on an option is misread as an outside click and closes
    // the menu on mousedown before the option's own click handler can fire.
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            if (
                containerRef.current && !containerRef.current.contains(target) &&
                dropdownRef.current && !dropdownRef.current.contains(target)
            ) {
                setIsOpen(false);
            }
        };
        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isOpen]);

    // Update position when opening
    useEffect(() => {
        if (isOpen && containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            setCoords({
                top: rect.bottom + window.scrollY,
                left: rect.left + window.scrollX,
                width: rect.width
            });
        }
    }, [isOpen]);

    const handleSelect = (optionValue: string) => {
        onChange(optionValue);
        setIsOpen(false);
        setSearch("");
    };

    const renderOption = (option: Option) => (
        <button
            key={option.value}
            onClick={() => handleSelect(option.value)}
            className={cn(
                "w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-center justify-between group",
                value === option.value
                    ? 'bg-[var(--p)]/10 text-[var(--p)] font-bold'
                    : 'text-[var(--t2)] hover:bg-[var(--glass)] hover:text-[var(--p)] font-medium'
            )}
            type="button"
        >
            <span className="truncate">{option.label}</span>
            {value === option.value && <PiCheck className="text-[var(--p)] text-sm shrink-0" />}
        </button>
    );

    return (
        <div className="relative" ref={containerRef}>
            <div
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "w-full px-4 py-2.5 bg-[var(--sidebar)] border border-[var(--p-line)] rounded-[5px] flex items-center justify-between cursor-pointer transition-all group select-none relative",
                    isOpen ? 'ring-1 ring-[var(--p)] border-[var(--p)]' : 'hover:border-[var(--p)]/50',
                    icon ? "!pl-11" : "",
                    className
                )}
            >
                {icon && (
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--t-muted)] group-hover:text-[var(--p)]/80 transition-colors pointer-events-none">
                        {icon}
                    </div>
                )}
                <div className={cn(
                    "font-medium text-sm truncate flex items-center gap-2",
                    selectedOption ? "text-[var(--t1)]" : "text-[var(--t-muted)]"
                )}>
                    {selectedOption ? selectedOption.label : placeholder}
                </div>
                <PiCaretDown className={cn(
                    "text-[var(--t-muted)] text-xs transition-transform duration-200",
                    isOpen ? 'rotate-180 text-[var(--p)]' : ''
                )} />
            </div>

            {isOpen && typeof document !== 'undefined' && createPortal(
                <div
                    ref={dropdownRef}
                    style={{
                        position: 'absolute',
                        top: coords.top + 8,
                        left: coords.left,
                        width: coords.width,
                        zIndex: 9999
                    }}
                    className="bg-[var(--sidebar)] border border-[var(--p-line)] rounded-lg shadow-[var(--shadow-dropdown)] p-2 animate-in fade-in zoom-in-95 duration-100"
                >
                    {searchable && (
                        <div className="mb-2 px-1">
                            <input
                                autoFocus
                                className="w-full pl-3 pr-2 py-2 bg-[var(--glass)] border border-[var(--p-line)] rounded-md text-sm focus:ring-1 focus:ring-[var(--p)]/30 placeholder:text-[var(--t-muted)] text-[var(--t1)] focus:outline-none"
                                placeholder="Search..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                onClick={e => e.stopPropagation()}
                            />
                        </div>
                    )}

                    <div className="max-h-64 overflow-y-auto custom-scrollbar space-y-0.5">
                        {filteredGroups ? (
                            filteredGroups.length > 0 ? (
                                filteredGroups.map(group => (
                                    <div key={group.label} className="mb-2 last:mb-0">
                                        <div className="px-3 py-1.5 text-[10px] font-bold text-[var(--t4)] uppercase tracking-widest bg-[var(--glass)] rounded-md mb-0.5">
                                            {group.label}
                                        </div>
                                        <div className="space-y-0.5 pl-1">
                                            {group.options.map(renderOption)}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="px-2 py-4 text-xs text-center text-[var(--t-muted)]">No results found</div>
                            )
                        ) : filteredOptions ? (
                            filteredOptions.length > 0 ? (
                                filteredOptions.map(renderOption)
                            ) : (
                                <div className="px-2 py-4 text-xs text-center text-[var(--t-muted)]">No results found</div>
                            )
                        ) : (
                            allOptions.map(renderOption)
                        )}
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
