'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
    PiPlus, PiLockKey, PiLockKeyOpen, PiCalendarBlank,
    PiCalendarCheck, PiX, PiWarning
} from 'react-icons/pi';
import { createFiscalYear, closePeriod, closeFiscalYear } from './actions';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { CustomSelect } from '@/components/ui/CustomSelect';

const CARD_STYLE: React.CSSProperties = { border: '1px solid rgba(0,0,0,0.09)' };
const INPUT_CLS = "w-full rounded-[6px] px-3 py-[10px] text-[13px] text-gray-900 placeholder:text-gray-300 outline-none focus:ring-1 focus:ring-[#6366F1] transition-colors bg-white";
const INPUT_STYLE: React.CSSProperties = { border: '1px solid rgba(0,0,0,0.09)' };
const LABEL_CLS = "block text-[11.5px] font-[500] text-gray-400 mb-1.5";

const FiscalYearFormSchema = z.object({
    name: z.string().min(1, "Name is required"),
    startDate: z.string().min(1, "Start Date is required"),
    endDate: z.string().min(1, "End Date is required"),
    periodType: z.enum(["MONTHLY", "QUARTERLY", "ANNUAL"]),
});

type FiscalYearFormValues = z.infer<typeof FiscalYearFormSchema>;

interface PeriodManagementProps {
    fiscalYears: any[];
}

export function PeriodManagement({ fiscalYears }: PeriodManagementProps) {
    const router = useRouter();
    const [mounted, setMounted] = useState(false);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [closingPeriod, setClosingPeriod] = useState<any | null>(null);
    const [closingYear, setClosingYear] = useState<any | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => { setMounted(true); }, []);

    const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<FiscalYearFormValues>({
        resolver: zodResolver(FiscalYearFormSchema),
        defaultValues: {
            periodType: 'MONTHLY',
            startDate: new Date().getFullYear() + '-01-01',
            endDate: new Date().getFullYear() + '-12-31'
        }
    });

    const handleOpenCreate = () => {
        reset({
            name: `FY ${new Date().getFullYear()}`,
            periodType: 'MONTHLY',
            startDate: `${new Date().getFullYear()}-01-01`,
            endDate: `${new Date().getFullYear()}-12-31`
        });
        setIsCreateOpen(true);
    };

    const onSubmitCreate = async (data: FiscalYearFormValues) => {
        setIsLoading(true);
        try {
            const result = await createFiscalYear({
                name: data.name,
                startDate: new Date(data.startDate),
                endDate: new Date(data.endDate),
                periodType: data.periodType
            });
            if (result.success) { setIsCreateOpen(false); router.refresh(); }
            else alert(result.error);
        } catch (error) {
            console.error(error);
            alert("An unexpected error occurred");
        } finally { setIsLoading(false); }
    };

    const handleClosePeriod = async () => {
        if (!closingPeriod) return;
        setIsLoading(true);
        try {
            const result = await closePeriod(closingPeriod.id);
            if (result.success) { setClosingPeriod(null); router.refresh(); }
            else alert(result.error);
        } catch (error) { console.error(error); }
        finally { setIsLoading(false); }
    };

    const handleCloseYear = async () => {
        if (!closingYear) return;
        setIsLoading(true);
        try {
            const result = await closeFiscalYear(closingYear.id);
            if (result.success) { setClosingYear(null); router.refresh(); }
            else alert(result.error);
        } catch (error) { console.error(error); }
        finally { setIsLoading(false); }
    };

    const fmt = (date: Date) =>
        new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

    // ── Create Fiscal Year Modal ──
    const createModal = (mounted && isCreateOpen) ? createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/30" onClick={() => !isLoading && setIsCreateOpen(false)} />
            <div className="relative bg-white w-full max-w-md rounded-[12px] overflow-hidden"
                style={{ border: '1px solid rgba(0,0,0,0.09)', boxShadow: '0 8px 40px rgba(0,0,0,0.12)' }}>
                <div className="px-6 py-4 flex items-center justify-between"
                    style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-[7px] bg-indigo-50 flex items-center justify-center shrink-0">
                            <PiCalendarCheck className="text-[#6366F1] text-[15px]" />
                        </div>
                        <div>
                            <h2 className="text-[14px] font-[600] text-gray-900">Create Fiscal Year</h2>
                            <p className="text-[11.5px] text-gray-400 mt-0.5">Define a new fiscal year and generate periods</p>
                        </div>
                    </div>
                    <button onClick={() => setIsCreateOpen(false)}
                        className="p-1.5 rounded-[6px] text-gray-400 hover:bg-gray-50 hover:text-gray-700 transition-colors">
                        <PiX className="text-[16px]" />
                    </button>
                </div>

                <form id="create-fy-form" onSubmit={handleSubmit(onSubmitCreate)} className="px-6 py-5 space-y-4">
                    <div>
                        <label className={LABEL_CLS}>Fiscal Year Name</label>
                        <input {...register("name")} placeholder="e.g. FY 2026"
                            className={INPUT_CLS} style={INPUT_STYLE} />
                        {errors.name && <p className="text-[11px] text-rose-500 mt-1">{errors.name.message}</p>}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className={LABEL_CLS}>Start Date</label>
                            <input type="date" {...register("startDate")}
                                className={INPUT_CLS} style={INPUT_STYLE} />
                            {errors.startDate && <p className="text-[11px] text-rose-500 mt-1">{errors.startDate.message}</p>}
                        </div>
                        <div>
                            <label className={LABEL_CLS}>End Date</label>
                            <input type="date" {...register("endDate")}
                                className={INPUT_CLS} style={INPUT_STYLE} />
                            {errors.endDate && <p className="text-[11px] text-rose-500 mt-1">{errors.endDate.message}</p>}
                        </div>
                    </div>
                    <div>
                        <label className={LABEL_CLS}>Period Type</label>
                        <CustomSelect
                            value={watch("periodType") ?? "MONTHLY"}
                            onChange={val => setValue("periodType", val as "MONTHLY" | "QUARTERLY" | "ANNUAL")}
                            options={[
                                { value: "MONTHLY", label: "Monthly (12 Periods)" },
                                { value: "QUARTERLY", label: "Quarterly (4 Periods)" },
                                { value: "ANNUAL", label: "Annual (1 Period)" },
                            ]}
                            className={INPUT_CLS}
                            style={INPUT_STYLE}
                        />
                    </div>
                </form>

                <div className="px-6 py-4 flex gap-3" style={{ borderTop: '1px solid rgba(0,0,0,0.07)' }}>
                    <button type="button" onClick={() => setIsCreateOpen(false)} disabled={isLoading}
                        className="flex-1 px-4 py-2 rounded-[6px] text-[12.5px] font-[500] text-gray-600 bg-white hover:bg-gray-50 transition-colors"
                        style={CARD_STYLE}>
                        Cancel
                    </button>
                    <button type="submit" form="create-fy-form" disabled={isLoading}
                        className="flex-1 px-4 py-2 rounded-[6px] text-[12.5px] font-[500] text-white bg-[#6366F1] hover:bg-indigo-600 transition-colors disabled:opacity-60">
                        {isLoading ? 'Creating...' : 'Create Fiscal Year'}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    ) : null;

    // ── Close Period Confirm Modal ──
    const closePeriodModal = (mounted && !!closingPeriod) ? createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/30" onClick={() => !isLoading && setClosingPeriod(null)} />
            <div className="relative bg-white w-full max-w-sm rounded-[12px] overflow-hidden"
                style={{ border: '1px solid rgba(0,0,0,0.09)', boxShadow: '0 8px 40px rgba(0,0,0,0.12)' }}>
                <div className="px-6 py-5">
                    <div className="w-10 h-10 rounded-[8px] bg-amber-50 flex items-center justify-center mb-4"
                        style={{ border: '1px solid rgba(245,158,11,0.2)' }}>
                        <PiWarning className="text-amber-500 text-[18px]" />
                    </div>
                    <h3 className="text-[14px] font-[600] text-gray-900 mb-1">Close Period</h3>
                    <p className="text-[12.5px] text-gray-500 leading-relaxed">
                        Close <strong className="text-gray-700">{closingPeriod?.name}</strong>? This cannot be undone —
                        all transactions for this period will be locked.
                    </p>
                </div>
                <div className="px-6 py-4 flex gap-3" style={{ borderTop: '1px solid rgba(0,0,0,0.07)' }}>
                    <button onClick={() => setClosingPeriod(null)} disabled={isLoading}
                        className="flex-1 px-4 py-2 rounded-[6px] text-[12.5px] font-[500] text-gray-600 bg-white hover:bg-gray-50 transition-colors"
                        style={CARD_STYLE}>
                        Cancel
                    </button>
                    <button onClick={handleClosePeriod} disabled={isLoading}
                        className="flex-1 px-4 py-2 rounded-[6px] text-[12.5px] font-[500] text-white bg-amber-500 hover:bg-amber-600 transition-colors disabled:opacity-60">
                        {isLoading ? 'Closing...' : 'Close Period'}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    ) : null;

    // ── Close Year Confirm Modal ──
    const closeYearModal = (mounted && !!closingYear) ? createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/30" onClick={() => !isLoading && setClosingYear(null)} />
            <div className="relative bg-white w-full max-w-sm rounded-[12px] overflow-hidden"
                style={{ border: '1px solid rgba(0,0,0,0.09)', boxShadow: '0 8px 40px rgba(0,0,0,0.12)' }}>
                <div className="px-6 py-5">
                    <div className="w-10 h-10 rounded-[8px] bg-rose-50 flex items-center justify-center mb-4"
                        style={{ border: '1px solid rgba(239,68,68,0.2)' }}>
                        <PiLockKey className="text-rose-500 text-[18px]" />
                    </div>
                    <h3 className="text-[14px] font-[600] text-gray-900 mb-1">Close Fiscal Year</h3>
                    <p className="text-[12.5px] text-gray-500 leading-relaxed">
                        Close <strong className="text-gray-700">{closingYear?.name}</strong>?
                        The year will be marked as closed and its status updated accordingly.
                    </p>
                </div>
                <div className="px-6 py-4 flex gap-3" style={{ borderTop: '1px solid rgba(0,0,0,0.07)' }}>
                    <button onClick={() => setClosingYear(null)} disabled={isLoading}
                        className="flex-1 px-4 py-2 rounded-[6px] text-[12.5px] font-[500] text-gray-600 bg-white hover:bg-gray-50 transition-colors"
                        style={CARD_STYLE}>
                        Cancel
                    </button>
                    <button onClick={handleCloseYear} disabled={isLoading}
                        className="flex-1 px-4 py-2 rounded-[6px] text-[12.5px] font-[500] text-white bg-rose-500 hover:bg-rose-600 transition-colors disabled:opacity-60">
                        {isLoading ? 'Closing...' : 'Close Year'}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    ) : null;

    return (
        <div className="space-y-6 pb-24">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-[20px] font-[600] text-gray-900 tracking-tight">Period Management</h1>
                    <p className="text-[12.5px] text-gray-400 mt-0.5">Manage fiscal years and accounting periods</p>
                </div>
                <button onClick={handleOpenCreate}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-[6px] text-[12.5px] font-[500] text-white bg-[#6366F1] hover:bg-indigo-600 transition-colors">
                    <PiPlus className="text-[14px]" /> Create Fiscal Year
                </button>
            </div>

            {/* Info banner */}
            <div className="bg-white rounded-[8px] p-5 flex items-start gap-4" style={CARD_STYLE}>
                <div className="w-8 h-8 rounded-[7px] bg-blue-50 flex items-center justify-center shrink-0">
                    <PiCalendarBlank className="text-blue-500 text-[15px]" />
                </div>
                <div>
                    <p className="text-[13px] font-[600] text-gray-900 mb-1">About Period Management</p>
                    <p className="text-[12.5px] text-gray-500 mb-3 leading-relaxed">
                        Organize your accounting into fiscal years and periods. Closing a period prevents backdating and ensures data integrity for financial reporting.
                    </p>
                    <ul className="space-y-1">
                        {[
                            'Create fiscal years (e.g., FY 2026: Jan 1 – Dec 31)',
                            'Define accounting periods (monthly or quarterly)',
                            'Close periods to lock transactions and prevent changes',
                            'Track who closed periods and when',
                        ].map(item => (
                            <li key={item} className="flex items-start gap-2 text-[12px] text-gray-400">
                                <span className="w-1 h-1 rounded-full bg-gray-300 mt-1.5 shrink-0" />
                                {item}
                            </li>
                        ))}
                    </ul>
                </div>
            </div>

            {/* Fiscal Years */}
            {fiscalYears.length === 0 ? (
                <div className="bg-white rounded-[8px] py-20 flex flex-col items-center" style={CARD_STYLE}>
                    <div className="w-10 h-10 rounded-[8px] bg-gray-50 flex items-center justify-center mb-3"
                        style={{ border: '1px solid rgba(0,0,0,0.07)' }}>
                        <PiCalendarBlank className="text-gray-300 text-[20px]" />
                    </div>
                    <p className="text-[13px] font-[500] text-gray-700 mb-0.5">No Fiscal Years Defined</p>
                    <p className="text-[12px] text-gray-400 mb-5">Create your first fiscal year to start managing accounting periods</p>
                    <button onClick={handleOpenCreate}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-[6px] text-[12.5px] font-[500] text-white bg-[#6366F1] hover:bg-indigo-600 transition-colors">
                        <PiPlus className="text-[14px]" /> Create Fiscal Year
                    </button>
                </div>
            ) : (
                <div className="space-y-4">
                    {fiscalYears.map((fy: any) => (
                        <div key={fy.id} className="bg-white rounded-[8px] overflow-hidden" style={CARD_STYLE}>
                            {/* FY header */}
                            <div className="px-6 py-4 flex items-center justify-between"
                                style={{ borderBottom: '1px solid rgba(0,0,0,0.07)', background: '#FAFAFA' }}>
                                <div>
                                    <div className="flex items-center gap-2.5 mb-1">
                                        <h2 className="text-[14px] font-[600] text-gray-900">{fy.name}</h2>
                                        {fy.isCurrent && (
                                            <span className="text-[10px] font-[500] px-2 py-0.5 rounded-[4px] text-emerald-600 bg-emerald-50"
                                                style={{ border: '1px solid rgba(16,185,129,0.2)' }}>
                                                Current
                                            </span>
                                        )}
                                        {fy.isClosed && (
                                            <span className="text-[10px] font-[500] px-2 py-0.5 rounded-[4px] text-gray-500 bg-gray-100 flex items-center gap-1"
                                                style={{ border: '1px solid rgba(0,0,0,0.09)' }}>
                                                <PiLockKey className="text-[11px]" /> Closed
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-[12px] text-gray-400">
                                        {fmt(fy.startDate)} – {fmt(fy.endDate)}
                                    </p>
                                </div>
                                {!fy.isClosed && (
                                    <button onClick={() => setClosingYear(fy)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-[12px] font-[500] text-rose-600 bg-white hover:bg-rose-50 transition-colors"
                                        style={{ border: '1px solid rgba(239,68,68,0.2)' }}>
                                        <PiLockKey className="text-[13px]" /> Close Year
                                    </button>
                                )}
                            </div>

                            {/* Periods table */}
                            <div className="p-5">
                                {fy.periods.length === 0 ? (
                                    <p className="text-[12.5px] text-gray-400 text-center py-8">
                                        No periods defined for this fiscal year
                                    </p>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead style={{ borderBottom: '1px solid rgba(0,0,0,0.07)', background: '#FAFAFA' }}>
                                                <tr>
                                                    {['Period', 'Type', 'Start Date', 'End Date', 'Status', ''].map((h, i) => (
                                                        <th key={i}
                                                            className={`px-4 py-3 text-[10.5px] font-[500] text-gray-400 uppercase tracking-[0.06em] ${i === 5 ? 'text-right' : 'text-left'}`}>
                                                            {h}
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {fy.periods.map((period: any, idx: number) => (
                                                    <tr key={period.id}
                                                        className="hover:bg-gray-50 transition-colors"
                                                        style={idx < fy.periods.length - 1 ? { borderBottom: '1px solid rgba(0,0,0,0.06)' } : {}}>
                                                        <td className="px-4 py-3 text-[13px] font-[500] text-gray-900">{period.name}</td>
                                                        <td className="px-4 py-3 text-[11px] text-gray-400 uppercase tracking-[0.05em]">{period.periodType}</td>
                                                        <td className="px-4 py-3 text-[12.5px] text-gray-600">{fmt(period.startDate)}</td>
                                                        <td className="px-4 py-3 text-[12.5px] text-gray-600">{fmt(period.endDate)}</td>
                                                        <td className="px-4 py-3">
                                                            {period.isClosed ? (
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-[10px] font-[500] px-2 py-0.5 rounded-[4px] text-gray-500 bg-gray-100 flex items-center gap-1"
                                                                        style={{ border: '1px solid rgba(0,0,0,0.09)' }}>
                                                                        <PiLockKey className="text-[11px]" /> Closed
                                                                    </span>
                                                                    {period.closedAt && (
                                                                        <span className="text-[11px] text-gray-400">{fmt(period.closedAt)}</span>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <span className="text-[10px] font-[500] px-2 py-0.5 rounded-[4px] text-emerald-600 bg-emerald-50 flex items-center gap-1 w-fit"
                                                                    style={{ border: '1px solid rgba(16,185,129,0.2)' }}>
                                                                    <PiLockKeyOpen className="text-[11px]" /> Open
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3 text-right">
                                                            {!period.isClosed && (
                                                                <button onClick={() => setClosingPeriod(period)}
                                                                    className="px-3 py-1.5 rounded-[6px] text-[11.5px] font-[500] text-gray-600 bg-white hover:bg-gray-50 transition-colors"
                                                                    style={CARD_STYLE}>
                                                                    Close Period
                                                                </button>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white rounded-[8px] px-5 py-4" style={CARD_STYLE}>
                    <p className="text-[10.5px] font-[500] text-gray-400 uppercase tracking-[0.06em] mb-1">Total Fiscal Years</p>
                    <p className="text-[24px] font-[600] text-gray-900">{fiscalYears.length}</p>
                </div>
                <div className="bg-white rounded-[8px] px-5 py-4" style={CARD_STYLE}>
                    <p className="text-[10.5px] font-[500] text-gray-400 uppercase tracking-[0.06em] mb-1">Current Fiscal Year</p>
                    <p className="text-[16px] font-[600] text-gray-900">
                        {fiscalYears.find((fy: any) => fy.isCurrent)?.name || 'None'}
                    </p>
                </div>
                <div className="bg-white rounded-[8px] px-5 py-4" style={CARD_STYLE}>
                    <p className="text-[10.5px] font-[500] text-gray-400 uppercase tracking-[0.06em] mb-1">Open Periods</p>
                    <p className="text-[24px] font-[600] text-emerald-600">
                        {fiscalYears.reduce((sum: number, fy: any) =>
                            sum + fy.periods.filter((p: any) => !p.isClosed).length, 0)}
                    </p>
                </div>
            </div>

            {createModal}
            {closePeriodModal}
            {closeYearModal}
        </div>
    );
}
