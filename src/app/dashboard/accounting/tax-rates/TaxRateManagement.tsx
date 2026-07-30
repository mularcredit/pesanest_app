'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
    PiPlus, PiPercent, PiToggleLeft, PiToggleRight,
    PiPencil, PiX, PiWarning, PiCheckCircle
} from 'react-icons/pi';
import { createTaxRate, updateTaxRate, toggleTaxRateStatus } from './actions';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { CustomSelect } from '@/components/ui/CustomSelect';

const CARD_STYLE: React.CSSProperties = { border: '1px solid rgba(0,0,0,0.09)' };
const INPUT_CLS = "w-full rounded-[6px] px-3 py-[10px] text-[13px] text-gray-900 placeholder:text-gray-300 outline-none focus:ring-1 focus:ring-[#6366F1] transition-colors bg-white";
const INPUT_STYLE: React.CSSProperties = { border: '1px solid rgba(0,0,0,0.09)' };
const LABEL_CLS = "block text-[11.5px] font-[500] text-gray-400 mb-1.5";

const TYPE_META: Record<string, { cls: string; border: string }> = {
    VAT:         { cls: 'text-blue-600 bg-blue-50',    border: 'rgba(59,130,246,0.2)' },
    SALES_TAX:   { cls: 'text-emerald-600 bg-emerald-50', border: 'rgba(16,185,129,0.2)' },
    WITHHOLDING: { cls: 'text-[#6366F1] bg-indigo-50', border: 'rgba(99,102,241,0.2)' },
    EXCISE:      { cls: 'text-amber-600 bg-amber-50',  border: 'rgba(245,158,11,0.2)' },
};

const TaxRateSchema = z.object({
    id: z.string().optional(),
    name: z.string().min(1, "Name is required"),
    code: z.string().min(1, "Code is required"),
    rate: z.number().min(0, "Rate must be positive"),
    type: z.enum(["VAT", "SALES_TAX", "WITHHOLDING", "EXCISE"]),
    description: z.string().optional(),
    effectiveFrom: z.string().optional(),
    effectiveTo: z.string().optional(),
});

type TaxRateFormValues = z.infer<typeof TaxRateSchema>;

export function TaxRateManagement({ taxRates }: { taxRates: any[] }) {
    const router = useRouter();
    const [mounted, setMounted] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRate, setEditingRate] = useState<any | null>(null);
    const [deactivatingRate, setDeactivatingRate] = useState<any | null>(null);
    const [activatingRate, setActivatingRate] = useState<any | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => { setMounted(true); }, []);

    const activeTaxRates = taxRates.filter((r: any) => r.isActive);
    const inactiveTaxRates = taxRates.filter((r: any) => !r.isActive);

    const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<TaxRateFormValues>({
        resolver: zodResolver(TaxRateSchema),
        defaultValues: { type: 'VAT', rate: 0 }
    });

    const handleOpenCreate = () => {
        setEditingRate(null);
        reset({
            name: '', code: '', rate: 0, type: 'VAT', description: '',
            effectiveFrom: new Date().toISOString().split('T')[0],
        });
        setIsModalOpen(true);
    };

    const handleOpenEdit = (rate: any) => {
        setEditingRate(rate);
        reset({
            id: rate.id,
            name: rate.name,
            code: rate.code,
            rate: rate.rate,
            type: rate.type,
            description: rate.description || '',
            effectiveFrom: rate.effectiveFrom ? new Date(rate.effectiveFrom).toISOString().split('T')[0] : '',
            effectiveTo: rate.effectiveTo ? new Date(rate.effectiveTo).toISOString().split('T')[0] : '',
        });
        setIsModalOpen(true);
    };

    const onSubmit = async (data: TaxRateFormValues) => {
        setIsLoading(true);
        try {
            const payload = {
                ...data,
                effectiveFrom: data.effectiveFrom ? new Date(data.effectiveFrom) : undefined,
                effectiveTo: data.effectiveTo ? new Date(data.effectiveTo) : undefined,
            };
            const result = editingRate
                ? await updateTaxRate({ ...payload, id: editingRate.id })
                : await createTaxRate(payload);
            if (result.success) { setIsModalOpen(false); router.refresh(); }
            else alert(result.error);
        } catch (error) {
            console.error(error);
            alert("An unexpected error occurred");
        } finally { setIsLoading(false); }
    };

    const handleToggleStatus = async (rate: any, isActive: boolean) => {
        setIsLoading(true);
        try {
            const result = await toggleTaxRateStatus(rate.id, isActive);
            if (result.success) {
                setDeactivatingRate(null);
                setActivatingRate(null);
                router.refresh();
            } else alert(result.error);
        } catch (error) { console.error(error); }
        finally { setIsLoading(false); }
    };

    const fmt = (date: Date) =>
        new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

    // ── Create / Edit Modal ──
    const formModal = (mounted && isModalOpen) ? createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/30" onClick={() => !isLoading && setIsModalOpen(false)} />
            <div className="relative bg-white w-full max-w-lg rounded-[12px] overflow-hidden"
                style={{ border: '1px solid rgba(0,0,0,0.09)', boxShadow: '0 8px 40px rgba(0,0,0,0.12)' }}>
                <div className="px-6 py-4 flex items-center justify-between"
                    style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-[7px] bg-indigo-50 flex items-center justify-center shrink-0">
                            <PiPercent className="text-[#6366F1] text-[15px]" />
                        </div>
                        <div>
                            <h2 className="text-[14px] font-[600] text-gray-900">
                                {editingRate ? 'Edit Tax Rate' : 'Add Tax Rate'}
                            </h2>
                            <p className="text-[11.5px] text-gray-400 mt-0.5">
                                {editingRate ? 'Update tax rate details' : 'Configure a new tax rate'}
                            </p>
                        </div>
                    </div>
                    <button onClick={() => setIsModalOpen(false)}
                        className="p-1.5 rounded-[6px] text-gray-400 hover:bg-gray-50 hover:text-gray-700 transition-colors">
                        <PiX className="text-[16px]" />
                    </button>
                </div>

                <form id="tax-rate-form" onSubmit={handleSubmit(onSubmit)} className="px-6 py-5 space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className={LABEL_CLS}>Tax Name</label>
                            <input {...register("name")} placeholder="e.g. Standard VAT"
                                className={INPUT_CLS} style={INPUT_STYLE} />
                            {errors.name && <p className="text-[11px] text-rose-500 mt-1">{errors.name.message}</p>}
                        </div>
                        <div>
                            <label className={LABEL_CLS}>Tax Code</label>
                            <input {...register("code")} placeholder="e.g. VAT-16"
                                className={INPUT_CLS + " font-mono"} style={INPUT_STYLE} />
                            {errors.code && <p className="text-[11px] text-rose-500 mt-1">{errors.code.message}</p>}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className={LABEL_CLS}>Tax Type</label>
                            <CustomSelect
                                value={watch("type") ?? "VAT"}
                                onChange={val => setValue("type", val as TaxRateFormValues["type"])}
                                options={[
                                    { value: "VAT", label: "Value Added Tax (VAT)" },
                                    { value: "SALES_TAX", label: "Sales Tax" },
                                    { value: "WITHHOLDING", label: "Withholding Tax" },
                                    { value: "EXCISE", label: "Excise Duty" },
                                ]}
                                className={INPUT_CLS}
                                style={INPUT_STYLE}
                            />
                        </div>
                        <div>
                            <label className={LABEL_CLS}>Rate (%)</label>
                            <input type="number" step="0.01" {...register("rate", { valueAsNumber: true })} placeholder="0.00"
                                className={INPUT_CLS} style={INPUT_STYLE} />
                            {errors.rate && <p className="text-[11px] text-rose-500 mt-1">{errors.rate.message}</p>}
                        </div>
                    </div>

                    <div>
                        <label className={LABEL_CLS}>Description <span className="text-gray-300">(optional)</span></label>
                        <input {...register("description")} placeholder="e.g. Standard VAT rate per Finance Act 2024"
                            className={INPUT_CLS} style={INPUT_STYLE} />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className={LABEL_CLS}>Effective From</label>
                            <input type="date" {...register("effectiveFrom")}
                                className={INPUT_CLS} style={INPUT_STYLE} />
                        </div>
                        <div>
                            <label className={LABEL_CLS}>Effective To <span className="text-gray-300">(optional)</span></label>
                            <input type="date" {...register("effectiveTo")}
                                className={INPUT_CLS} style={INPUT_STYLE} />
                        </div>
                    </div>
                </form>

                <div className="px-6 py-4 flex gap-3" style={{ borderTop: '1px solid rgba(0,0,0,0.07)' }}>
                    <button type="button" onClick={() => setIsModalOpen(false)} disabled={isLoading}
                        className="flex-1 px-4 py-2 rounded-[6px] text-[12.5px] font-[500] text-gray-600 bg-white hover:bg-gray-50 transition-colors"
                        style={CARD_STYLE}>
                        Cancel
                    </button>
                    <button type="submit" form="tax-rate-form" disabled={isLoading}
                        className="flex-1 px-4 py-2 rounded-[6px] text-[12.5px] font-[500] text-white bg-[#6366F1] hover:bg-indigo-600 transition-colors disabled:opacity-60">
                        {isLoading ? 'Saving...' : 'Save Tax Rate'}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    ) : null;

    // ── Deactivate Confirm Modal ──
    const deactivateModal = (mounted && !!deactivatingRate) ? createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/30" onClick={() => !isLoading && setDeactivatingRate(null)} />
            <div className="relative bg-white w-full max-w-sm rounded-[12px] overflow-hidden"
                style={{ border: '1px solid rgba(0,0,0,0.09)', boxShadow: '0 8px 40px rgba(0,0,0,0.12)' }}>
                <div className="px-6 py-5">
                    <div className="w-10 h-10 rounded-[8px] bg-amber-50 flex items-center justify-center mb-4"
                        style={{ border: '1px solid rgba(245,158,11,0.2)' }}>
                        <PiWarning className="text-amber-500 text-[18px]" />
                    </div>
                    <h3 className="text-[14px] font-[600] text-gray-900 mb-1">Deactivate Tax Rate</h3>
                    <p className="text-[12.5px] text-gray-500 leading-relaxed">
                        Deactivate <strong className="text-gray-700">{deactivatingRate?.name}</strong>?
                        It will no longer be available for new transactions.
                    </p>
                </div>
                <div className="px-6 py-4 flex gap-3" style={{ borderTop: '1px solid rgba(0,0,0,0.07)' }}>
                    <button onClick={() => setDeactivatingRate(null)} disabled={isLoading}
                        className="flex-1 px-4 py-2 rounded-[6px] text-[12.5px] font-[500] text-gray-600 bg-white hover:bg-gray-50 transition-colors"
                        style={CARD_STYLE}>
                        Cancel
                    </button>
                    <button onClick={() => handleToggleStatus(deactivatingRate, false)} disabled={isLoading}
                        className="flex-1 px-4 py-2 rounded-[6px] text-[12.5px] font-[500] text-white bg-amber-500 hover:bg-amber-600 transition-colors disabled:opacity-60">
                        {isLoading ? 'Deactivating...' : 'Deactivate'}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    ) : null;

    // ── Activate Confirm Modal ──
    const activateModal = (mounted && !!activatingRate) ? createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/30" onClick={() => !isLoading && setActivatingRate(null)} />
            <div className="relative bg-white w-full max-w-sm rounded-[12px] overflow-hidden"
                style={{ border: '1px solid rgba(0,0,0,0.09)', boxShadow: '0 8px 40px rgba(0,0,0,0.12)' }}>
                <div className="px-6 py-5">
                    <div className="w-10 h-10 rounded-[8px] bg-emerald-50 flex items-center justify-center mb-4"
                        style={{ border: '1px solid rgba(16,185,129,0.2)' }}>
                        <PiCheckCircle className="text-emerald-500 text-[18px]" />
                    </div>
                    <h3 className="text-[14px] font-[600] text-gray-900 mb-1">Activate Tax Rate</h3>
                    <p className="text-[12.5px] text-gray-500 leading-relaxed">
                        Activate <strong className="text-gray-700">{activatingRate?.name}</strong>?
                        It will become available for use in transactions.
                    </p>
                </div>
                <div className="px-6 py-4 flex gap-3" style={{ borderTop: '1px solid rgba(0,0,0,0.07)' }}>
                    <button onClick={() => setActivatingRate(null)} disabled={isLoading}
                        className="flex-1 px-4 py-2 rounded-[6px] text-[12.5px] font-[500] text-gray-600 bg-white hover:bg-gray-50 transition-colors"
                        style={CARD_STYLE}>
                        Cancel
                    </button>
                    <button onClick={() => handleToggleStatus(activatingRate, true)} disabled={isLoading}
                        className="flex-1 px-4 py-2 rounded-[6px] text-[12.5px] font-[500] text-white bg-emerald-500 hover:bg-emerald-600 transition-colors disabled:opacity-60">
                        {isLoading ? 'Activating...' : 'Activate'}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    ) : null;

    const rateRow = (rate: any, idx: number, arr: any[], showFull = true) => {
        const meta = TYPE_META[rate.type] || { cls: 'text-gray-600 bg-gray-50', border: 'rgba(0,0,0,0.09)' };
        return (
            <tr key={rate.id}
                className="hover:bg-gray-50 transition-colors group"
                style={idx < arr.length - 1 ? { borderBottom: '1px solid rgba(0,0,0,0.06)' } : {}}>
                <td className="px-5 py-3.5 font-mono text-[12.5px] font-[600] text-gray-400 group-hover:text-[#6366F1] transition-colors">
                    {rate.code}
                </td>
                <td className="px-5 py-3.5">
                    <p className="text-[13px] font-[500] text-gray-900">{rate.name}</p>
                    {rate.description && (
                        <p className="text-[11.5px] text-gray-400 mt-0.5">{rate.description}</p>
                    )}
                </td>
                <td className="px-5 py-3.5">
                    <span className={cn('text-[10px] font-[500] px-2 py-0.5 rounded-[4px] tracking-wider uppercase', meta.cls)}
                        style={{ border: `1px solid ${meta.border}` }}>
                        {rate.type.replace('_', ' ')}
                    </span>
                </td>
                <td className="px-5 py-3.5 text-right">
                    <span className="text-[15px] font-[600] text-gray-900 font-mono">{rate.rate}%</span>
                </td>
                {showFull && (
                    <>
                        <td className="px-5 py-3.5 text-[12.5px] text-gray-500">
                            {rate.effectiveFrom ? fmt(rate.effectiveFrom) : '—'}
                        </td>
                        <td className="px-5 py-3.5 text-[12.5px] text-gray-500">
                            {rate.effectiveTo ? fmt(rate.effectiveTo) : 'Ongoing'}
                        </td>
                    </>
                )}
                <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                        {showFull && (
                            <button onClick={() => handleOpenEdit(rate)}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-[6px] text-[11.5px] font-[500] text-gray-600 bg-white hover:bg-gray-50 transition-colors"
                                style={CARD_STYLE}>
                                <PiPencil className="text-[12px]" /> Edit
                            </button>
                        )}
                        {rate.isActive ? (
                            <button onClick={() => setDeactivatingRate(rate)}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-[6px] text-[11.5px] font-[500] text-rose-600 bg-white hover:bg-rose-50 transition-colors"
                                style={{ border: '1px solid rgba(239,68,68,0.2)' }}>
                                <PiToggleLeft className="text-[13px]" /> Deactivate
                            </button>
                        ) : (
                            <button onClick={() => setActivatingRate(rate)}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-[6px] text-[11.5px] font-[500] text-emerald-600 bg-white hover:bg-emerald-50 transition-colors"
                                style={{ border: '1px solid rgba(16,185,129,0.2)' }}>
                                <PiToggleRight className="text-[13px]" /> Activate
                            </button>
                        )}
                    </div>
                </td>
            </tr>
        );
    };

    return (
        <div className="space-y-6 pb-24">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-[20px] font-[600] text-gray-900 tracking-tight">Tax Rate Management</h1>
                    <p className="text-[12.5px] text-gray-400 mt-0.5">Configure and manage tax rates for compliance</p>
                </div>
                <button onClick={handleOpenCreate}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-[6px] text-[12.5px] font-[500] text-white bg-[#6366F1] hover:bg-indigo-600 transition-colors">
                    <PiPlus className="text-[14px]" /> Add Tax Rate
                </button>
            </div>

            {/* Info banner */}
            <div className="bg-white rounded-[8px] p-5 flex items-start gap-4" style={CARD_STYLE}>
                <div className="w-8 h-8 rounded-[7px] bg-blue-50 flex items-center justify-center shrink-0">
                    <PiPercent className="text-blue-500 text-[15px]" />
                </div>
                <div>
                    <p className="text-[13px] font-[600] text-gray-900 mb-1">About Tax Management</p>
                    <p className="text-[12.5px] text-gray-500 mb-3 leading-relaxed">
                        Tax rates are used to calculate taxes on sales, purchases, and other transactions.
                        Define multiple rates with different types and effective dates.
                    </p>
                    <ul className="space-y-1">
                        {[
                            'Define tax rates (e.g., VAT 16%, Withholding Tax 5%)',
                            'Set effective dates for rate changes over time',
                            'Support multiple types: VAT, Sales Tax, Withholding, Excise',
                            'Activate or deactivate rates without losing history',
                        ].map(item => (
                            <li key={item} className="flex items-start gap-2 text-[12px] text-gray-400">
                                <span className="w-1 h-1 rounded-full bg-gray-300 mt-1.5 shrink-0" />
                                {item}
                            </li>
                        ))}
                    </ul>
                </div>
            </div>

            {/* Active Tax Rates */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-[13px] font-[600] text-gray-900">Active Tax Rates</h2>
                    <span className="text-[11.5px] text-gray-400">{activeTaxRates.length} active</span>
                </div>

                {activeTaxRates.length === 0 ? (
                    <div className="bg-white rounded-[8px] py-16 flex flex-col items-center" style={CARD_STYLE}>
                        <div className="w-10 h-10 rounded-[8px] bg-gray-50 flex items-center justify-center mb-3"
                            style={{ border: '1px solid rgba(0,0,0,0.07)' }}>
                            <PiPercent className="text-gray-300 text-[20px]" />
                        </div>
                        <p className="text-[13px] font-[500] text-gray-700 mb-0.5">No Active Tax Rates</p>
                        <p className="text-[12px] text-gray-400 mb-5">Add your first tax rate to start tracking taxes</p>
                        <button onClick={handleOpenCreate}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-[6px] text-[12.5px] font-[500] text-white bg-[#6366F1] hover:bg-indigo-600 transition-colors">
                            <PiPlus className="text-[14px]" /> Add Tax Rate
                        </button>
                    </div>
                ) : (
                    <div className="bg-white rounded-[8px] overflow-hidden" style={CARD_STYLE}>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead style={{ borderBottom: '1px solid rgba(0,0,0,0.07)', background: '#FAFAFA' }}>
                                    <tr>
                                        {['Code', 'Name', 'Type', 'Rate', 'Effective From', 'Effective To', ''].map((h, i) => (
                                            <th key={i}
                                                className={`px-5 py-3 text-[10.5px] font-[500] text-gray-400 uppercase tracking-[0.06em] ${i === 3 || i === 6 ? 'text-right' : 'text-left'}`}>
                                                {h}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {activeTaxRates.map((rate: any, idx: number) =>
                                        rateRow(rate, idx, activeTaxRates, true)
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* Inactive Tax Rates */}
            {inactiveTaxRates.length > 0 && (
                <div>
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-[13px] font-[600] text-gray-500">Inactive Tax Rates</h2>
                        <span className="text-[11.5px] text-gray-400">{inactiveTaxRates.length} inactive</span>
                    </div>
                    <div className="bg-white rounded-[8px] overflow-hidden opacity-60" style={CARD_STYLE}>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead style={{ borderBottom: '1px solid rgba(0,0,0,0.07)', background: '#FAFAFA' }}>
                                    <tr>
                                        {['Code', 'Name', 'Type', 'Rate', ''].map((h, i) => (
                                            <th key={i}
                                                className={`px-5 py-3 text-[10.5px] font-[500] text-gray-400 uppercase tracking-[0.06em] ${i === 3 || i === 4 ? 'text-right' : 'text-left'}`}>
                                                {h}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {inactiveTaxRates.map((rate: any, idx: number) =>
                                        rateRow(rate, idx, inactiveTaxRates, false)
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: 'Total Tax Rates', value: taxRates.length, cls: 'text-gray-900' },
                    { label: 'Active Rates', value: activeTaxRates.length, cls: 'text-emerald-600' },
                    { label: 'Tax Types', value: new Set(taxRates.map((r: any) => r.type)).size, cls: 'text-gray-900' },
                    {
                        label: 'Average Rate',
                        value: activeTaxRates.length > 0
                            ? `${(activeTaxRates.reduce((s: number, r: any) => s + r.rate, 0) / activeTaxRates.length).toFixed(1)}%`
                            : '0%',
                        cls: 'text-gray-900'
                    },
                ].map(stat => (
                    <div key={stat.label} className="bg-white rounded-[8px] px-5 py-4" style={CARD_STYLE}>
                        <p className="text-[10.5px] font-[500] text-gray-400 uppercase tracking-[0.06em] mb-1">{stat.label}</p>
                        <p className={`text-[24px] font-[600] ${stat.cls}`}>{stat.value}</p>
                    </div>
                ))}
            </div>

            {/* Reference card */}
            <div className="bg-white rounded-[8px] p-5" style={{ ...CARD_STYLE, background: '#FAFAFA' }}>
                <p className="text-[12px] font-[600] text-gray-600 uppercase tracking-[0.06em] mb-4">Common Tax Rates Reference</p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                        { type: 'VAT', label: 'Value Added Tax', range: 'Standard: 15–25%' },
                        { type: 'SALES_TAX', label: 'Sales Tax', range: 'Typical: 5–10%' },
                        { type: 'WITHHOLDING', label: 'Withholding Tax', range: 'Common: 5–30%' },
                        { type: 'EXCISE', label: 'Excise Duty', range: 'Varies by product' },
                    ].map(ref => {
                        const m = TYPE_META[ref.type];
                        return (
                            <div key={ref.type} className="flex items-start gap-2.5">
                                <span className={cn('text-[9.5px] font-[600] px-1.5 py-0.5 rounded-[4px] tracking-wider uppercase mt-0.5 shrink-0', m.cls)}
                                    style={{ border: `1px solid ${m.border}` }}>
                                    {ref.type.replace('_', ' ')}
                                </span>
                                <div>
                                    <p className="text-[12.5px] font-[500] text-gray-700">{ref.label}</p>
                                    <p className="text-[11.5px] text-gray-400">{ref.range}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {formModal}
            {deactivateModal}
            {activateModal}
        </div>
    );
}
