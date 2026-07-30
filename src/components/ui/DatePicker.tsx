"use client";

import { useState, useRef, useEffect } from "react";
import { format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, isToday, setMonth, setYear } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { PiCalendar, PiCaretLeft, PiCaretRight, PiCaretDown } from "react-icons/pi";

interface DatePickerProps {
    value: Date | undefined;
    onChange: (date: Date) => void;
    label?: string;
    placeholder?: string;
    className?: string;
}

type ViewMode = 'day' | 'month' | 'year';

export function DatePicker({ value, onChange, label, placeholder = "Select date", className }: DatePickerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [viewDate, setViewDate] = useState(value || new Date());
    const [viewMode, setViewMode] = useState<ViewMode>('day');
    const containerRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setViewMode('day'); // Reset view on close
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        if (value) setViewDate(value);
    }, [value]);

    const handlePrev = () => {
        if (viewMode === 'day') setViewDate(subMonths(viewDate, 1));
        if (viewMode === 'year') setViewDate(new Date(viewDate.getFullYear() - 12, 0, 1));
    };

    const handleNext = () => {
        if (viewMode === 'day') setViewDate(addMonths(viewDate, 1));
        if (viewMode === 'year') setViewDate(new Date(viewDate.getFullYear() + 12, 0, 1));
    };

    const handleDayClick = (day: Date) => {
        onChange(day);
        setIsOpen(false);
    };

    const handleMonthClick = (monthIndex: number) => {
        setViewDate(setMonth(viewDate, monthIndex));
        setViewMode('day');
    };

    const handleYearClick = (year: number) => {
        setViewDate(setYear(viewDate, year));
        setViewMode('month');
    };

    // Calendar Generation Logic
    const monthStart = startOfMonth(viewDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);
    const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });
    const weekDays = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
    const months = Array.from({ length: 12 }, (_, i) => format(new Date(0, i), "MMM"));

    // Year Grid Generation
    const currentYear = viewDate.getFullYear();
    const startYear = currentYear - 5;
    const years = Array.from({ length: 12 }, (_, i) => startYear + i);

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            {label && <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1.5 pl-1">{label}</label>}

            {/* Input Trigger */}
            <div
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center gap-3 w-full min-h-[44px] px-4 py-2.5 bg-white border border-gray-200 rounded-[10px] cursor-pointer transition-all group select-none
                    ${isOpen ? 'ring-2 ring-[#6366F1]/10 border-[#6366F1]' : 'hover:border-gray-300'}
                `}
            >
                <PiCalendar className={`text-lg transition-colors shrink-0 ${isOpen ? 'text-[#6366F1]' : 'text-gray-400 group-hover:text-indigo-500'}`} />
                <span className={`font-medium truncate ${value ? 'text-gray-900' : 'text-gray-400'} ${className?.includes('text-xs') ? 'text-xs' : 'text-sm'}`}>
                    {value ? format(value, "MMM dd, yyyy") : placeholder}
                </span>
            </div>

            {/* Dropdown Popup */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="absolute top-full left-0 mt-2 z-50 bg-white rounded-2xl border border-gray-100 p-4 w-[300px] select-none overflow-hidden"
                    >
                        {/* Header Controls */}
                        <div className="flex items-center justify-between mb-4">
                            {/* Previous Button */}
                            <button
                                type="button"
                                onClick={handlePrev}
                                className="p-1 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"
                                title="Previous"
                            >
                                <PiCaretLeft />
                            </button>

                            {/* Center Controls */}
                            <div className="flex items-center gap-1">
                                <button
                                    type="button"
                                    onClick={() => setViewMode(viewMode === 'month' ? 'day' : 'month')}
                                    className={`text-sm font-semibold px-2 py-1 rounded-lg transition-colors flex items-center gap-1
                                        ${viewMode === 'month' ? 'bg-gray-100 text-indigo-600' : 'text-gray-900 hover:bg-gray-50'}
                                    `}
                                >
                                    {format(viewDate, "MMMM")}
                                    <PiCaretDown className={`text-xs text-gray-400 transition-transform ${viewMode === 'month' ? 'rotate-180' : ''}`} />
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setViewMode(viewMode === 'year' ? 'day' : 'year')}
                                    className={`text-sm font-semibold px-2 py-1 rounded-lg transition-colors flex items-center gap-1
                                        ${viewMode === 'year' ? 'bg-gray-100 text-indigo-600' : 'text-gray-900 hover:bg-gray-50'}
                                    `}
                                >
                                    {format(viewDate, "yyyy")}
                                    <PiCaretDown className={`text-xs text-gray-400 transition-transform ${viewMode === 'year' ? 'rotate-180' : ''}`} />
                                </button>
                            </div>

                            {/* Next Button */}
                            <button
                                type="button"
                                onClick={handleNext}
                                className="p-1 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"
                                title="Next"
                            >
                                <PiCaretRight />
                            </button>
                        </div>

                        {/* VIEWS */}
                        <div className="relative h-[240px]">
                            {/* Day View */}
                            {viewMode === 'day' && (
                                <motion.div
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="absolute inset-0"
                                >
                                    <div className="grid grid-cols-7 mb-2">
                                        {weekDays.map(day => (
                                            <div key={day} className="text-center text-[10px] font-semibold text-gray-400 uppercase">
                                                {day}
                                            </div>
                                        ))}
                                    </div>
                                    <div className="grid grid-cols-7 gap-1">
                                        {calendarDays.map((day, idx) => {
                                            const isSelected = value && isSameDay(day, value);
                                            const isCurrentMonth = isSameMonth(day, viewDate);
                                            const isTodayDate = isToday(day);
                                            return (
                                                <button
                                                    type="button"
                                                    key={idx}
                                                    onClick={() => handleDayClick(day)}
                                                    className={`
                                                        h-8 w-8 rounded-lg flex items-center justify-center text-xs font-medium transition-all relative
                                                        ${!isCurrentMonth ? 'text-gray-300' : 'text-gray-700 hover:bg-gray-100'}
                                                        ${isSelected ? '!bg-indigo-600 !text-white' : ''}
                                                        ${isTodayDate && !isSelected ? 'text-indigo-600 font-semibold bg-indigo-50' : ''}
                                                    `}
                                                >
                                                    {format(day, "d")}
                                                    {isTodayDate && !isSelected && (
                                                        <div className="absolute bottom-1 w-1 h-1 rounded-full bg-indigo-600"></div>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </motion.div>
                            )}

                            {/* Month View */}
                            {viewMode === 'month' && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="grid grid-cols-3 gap-3 absolute inset-0 content-start"
                                >
                                    {months.map((month, idx) => (
                                        <button
                                            type="button"
                                            key={month}
                                            onClick={() => handleMonthClick(idx)}
                                            className={`
                                                h-12 rounded-xl text-sm font-medium transition-all border
                                                ${viewDate.getMonth() === idx ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-gray-100 text-gray-600 hover:border-gray-200'}
                                            `}
                                        >
                                            {month}
                                        </button>
                                    ))}
                                </motion.div>
                            )}

                            {/* Year View */}
                            {viewMode === 'year' && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="grid grid-cols-3 gap-3 absolute inset-0 content-start"
                                >
                                    {years.map((year) => (
                                        <button
                                            type="button"
                                            key={year}
                                            onClick={() => handleYearClick(year)}
                                            className={`
                                                h-12 rounded-xl text-sm font-medium transition-all border
                                                ${viewDate.getFullYear() === year ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-gray-100 text-gray-600 hover:border-gray-200'}
                                            `}
                                        >
                                            {year}
                                        </button>
                                    ))}
                                </motion.div>
                            )}
                        </div>

                        {/* Today Footer - Only on Day View */}
                        {viewMode === 'day' && (
                            <div className="mt-2 pt-3 border-t border-gray-100 flex justify-center">
                                <button
                                    type="button"
                                    onClick={() => { onChange(new Date()); setIsOpen(false); }}
                                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 hover:underline"
                                >
                                    Jump to Today
                                </button>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
