"use client";

import { useState, useRef, useEffect } from "react";
import { format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, isToday, setMonth, setYear, isValid } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { PiCalendar, PiCaretLeft, PiCaretRight } from "react-icons/pi";

const HAIRLINE = '1px solid rgba(0,0,0,0.07)';

interface StudioDatePickerProps {
    value: Date;
    onChange: (date: Date) => void;
    placeholder?: string;
    className?: string;
    align?: 'left' | 'right';
}

type ViewMode = 'day' | 'month' | 'year';

export function StudioDatePicker({ value, onChange, placeholder = "Select date", className, align = 'left' }: StudioDatePickerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [viewDate, setViewDate] = useState(value && isValid(value) ? value : new Date());
    const [viewMode, setViewMode] = useState<ViewMode>('day');
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setViewMode('day');
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        if (value && isValid(value)) setViewDate(value);
    }, [value]);

    const handlePrev = () => {
        if (viewMode === 'day') setViewDate(subMonths(viewDate, 1));
        if (viewMode === 'year') setViewDate(new Date(viewDate.getFullYear() - 12, 0, 1));
    };

    const handleNext = () => {
        if (viewMode === 'day') setViewDate(addMonths(viewDate, 1));
        if (viewMode === 'year') setViewDate(new Date(viewDate.getFullYear() + 12, 0, 1));
    };

    const handleDayClick = (day: Date) => { onChange(day); setIsOpen(false); };
    const handleMonthClick = (monthIndex: number) => { setViewDate(setMonth(viewDate, monthIndex)); setViewMode('day'); };
    const handleYearClick = (year: number) => { setViewDate(setYear(viewDate, year)); setViewMode('month'); };

    const monthStart = startOfMonth(viewDate);
    const calendarDays = eachDayOfInterval({ start: startOfWeek(monthStart), end: endOfWeek(endOfMonth(monthStart)) });
    const weekDays = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
    const months = Array.from({ length: 12 }, (_, i) => format(new Date(0, i), "MMM"));
    const years = Array.from({ length: 12 }, (_, i) => viewDate.getFullYear() - 5 + i);

    return (
        <div className={`relative ${className ?? ''}`} ref={containerRef}>
            <div
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center justify-between w-full h-[42px] px-3 bg-white rounded-[7px] cursor-pointer transition-all select-none group
                    ${isOpen ? 'ring-2 ring-[#6366F1]/15' : 'hover:bg-gray-50/50'}
                `}
                style={{ border: isOpen ? '1px solid rgba(99,102,241,0.3)' : HAIRLINE }}
            >
                <span className={`text-[12.5px] font-[500] font-mono ${value && isValid(value) ? 'text-gray-900' : 'text-gray-400'}`}>
                    {value && isValid(value) ? format(value, "dd MMM yyyy") : placeholder}
                </span>
                <PiCalendar className={`text-[14px] transition-colors ${isOpen ? 'text-[#6366F1]' : 'text-gray-400 group-hover:text-gray-600'}`} />
            </div>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.97 }}
                        transition={{ duration: 0.15 }}
                        className={`absolute top-full mt-1.5 z-[9999] bg-white rounded-[10px] shadow-lg p-4 w-[272px] select-none overflow-hidden
                            ${align === 'right' ? 'right-0' : 'left-0'}
                        `}
                        style={{ border: HAIRLINE, boxShadow: '0 8px 24px -4px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.06)' }}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between mb-3">
                            <button type="button" onClick={handlePrev}
                                className="w-[26px] h-[26px] flex items-center justify-center rounded-[5px] text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
                                <PiCaretLeft className="text-[13px]" />
                            </button>
                            <div className="flex items-center gap-1">
                                <button type="button"
                                    onClick={() => setViewMode(viewMode === 'month' ? 'day' : 'month')}
                                    className={`text-[11.5px] font-[600] px-2 py-1 rounded-[5px] transition-colors
                                        ${viewMode === 'month' ? 'bg-[#6366F1] text-white' : 'text-gray-700 hover:bg-gray-100'}
                                    `}>
                                    {format(viewDate, "MMMM")}
                                </button>
                                <button type="button"
                                    onClick={() => setViewMode(viewMode === 'year' ? 'day' : 'year')}
                                    className={`text-[11.5px] font-[600] px-2 py-1 rounded-[5px] transition-colors
                                        ${viewMode === 'year' ? 'bg-[#6366F1] text-white' : 'text-gray-700 hover:bg-gray-100'}
                                    `}>
                                    {format(viewDate, "yyyy")}
                                </button>
                            </div>
                            <button type="button" onClick={handleNext}
                                className="w-[26px] h-[26px] flex items-center justify-center rounded-[5px] text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
                                <PiCaretRight className="text-[13px]" />
                            </button>
                        </div>

                        <div className="relative h-[212px]">
                            {viewMode === 'day' && (
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0">
                                    <div className="grid grid-cols-7 mb-2">
                                        {weekDays.map(day => (
                                            <div key={day} className="text-center text-[9.5px] font-[700] uppercase tracking-[0.06em] text-gray-400">{day}</div>
                                        ))}
                                    </div>
                                    <div className="grid grid-cols-7 gap-0.5">
                                        {calendarDays.map((day, idx) => {
                                            const isSelected = value && isSameDay(day, value);
                                            const isCurrentMonth = isSameMonth(day, viewDate);
                                            const isTodayDate = isToday(day);
                                            return (
                                                <button type="button" key={idx} onClick={() => handleDayClick(day)}
                                                    className={`h-7 w-7 rounded-[5px] flex items-center justify-center text-[11.5px] font-[500] transition-all mx-auto
                                                        ${!isCurrentMonth ? 'text-gray-300' : 'text-gray-700 hover:bg-gray-100'}
                                                        ${isSelected ? '!bg-[#6366F1] !text-white shadow-sm' : ''}
                                                        ${isTodayDate && !isSelected ? '!text-[#6366F1] font-[700] bg-indigo-50' : ''}
                                                    `}>
                                                    {format(day, "d")}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </motion.div>
                            )}

                            {viewMode === 'month' && (
                                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                                    className="grid grid-cols-3 gap-1.5 absolute inset-0 content-start">
                                    {months.map((month, idx) => (
                                        <button type="button" key={month} onClick={() => handleMonthClick(idx)}
                                            className={`h-9 rounded-[6px] text-[11.5px] font-[500] transition-all
                                                ${viewDate.getMonth() === idx ? 'bg-[#6366F1] text-white' : 'text-gray-600 hover:bg-gray-100'}
                                            `}>
                                            {month}
                                        </button>
                                    ))}
                                </motion.div>
                            )}

                            {viewMode === 'year' && (
                                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                                    className="grid grid-cols-3 gap-1.5 absolute inset-0 content-start">
                                    {years.map((year) => (
                                        <button type="button" key={year} onClick={() => handleYearClick(year)}
                                            className={`h-9 rounded-[6px] text-[11.5px] font-[500] transition-all
                                                ${viewDate.getFullYear() === year ? 'bg-[#6366F1] text-white' : 'text-gray-600 hover:bg-gray-100'}
                                            `}>
                                            {year}
                                        </button>
                                    ))}
                                </motion.div>
                            )}
                        </div>

                        <div className="mt-2 pt-3 flex justify-center" style={{ borderTop: HAIRLINE }}>
                            <button type="button"
                                onClick={() => { onChange(new Date()); setIsOpen(false); }}
                                className="text-[10.5px] font-[600] text-[#6366F1] hover:text-indigo-800 uppercase tracking-[0.07em]">
                                Today
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
