"use client";

import { useState } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import {
    PiUploadSimple, PiTrash, PiPlus, PiFloppyDisk,
    PiReceipt, PiCheckCircle, PiSpinner, PiListBullets,
} from "react-icons/pi";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/ToastProvider";
import { CustomSelect } from "@/components/ui/CustomSelect";

interface InvoiceFormProps {
    vendors: Array<{ id: string; name: string }>;
}

interface InvoiceItem {
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
    category: string;
}

interface InvoiceFormData {
    vendorId: string;
    invoiceNumber: string;
    invoiceDate: string;
    dueDate: string;
    currency: string;
    description: string;
    fileUrl: string;
    items: InvoiceItem[];
}

const CARD_STYLE: React.CSSProperties = { border: '1px solid rgba(0,0,0,0.09)' };
const INPUT_CLASS = "w-full rounded-[6px] px-3 py-[10px] text-[13px] text-gray-900 placeholder:text-gray-300 outline-none focus:ring-1 focus:ring-[#6366F1] transition-colors bg-white";
const INPUT_STYLE: React.CSSProperties = { border: '1px solid rgba(0,0,0,0.09)' };
const LABEL_CLASS = "block text-[11.5px] font-[500] text-gray-400 mb-1.5";

const CURRENCIES: Record<string, string> = { KES: 'KES', USD: 'USD', SSP: 'SSP' };

export function InvoiceForm({ vendors }: InvoiceFormProps) {
    const router        = useRouter();
    const { showToast } = useToast();
    const searchParams  = useSearchParams();
    const initialFileUrl = searchParams.get("fileUrl") || "";

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isUploading, setIsUploading]   = useState(false);
    const [uploadError, setUploadError]   = useState("");

    const { register, control, handleSubmit, watch, setValue, formState: { errors } } = useForm<InvoiceFormData>({
        defaultValues: {
            vendorId: "", invoiceNumber: "",
            invoiceDate: new Date().toISOString().split('T')[0],
            dueDate: "", currency: 'KES', description: "",
            fileUrl: initialFileUrl,
            items: [{ description: "", quantity: 1, unitPrice: 0, total: 0, category: "" }]
        }
    });

    const { fields, append, remove } = useFieldArray({ control, name: "items" });

    const items    = watch("items");
    const currency = watch("currency");
    const fileUrl  = watch("fileUrl");
    const subtotal = items.reduce((s, item) => s + (Number(item.quantity) * Number(item.unitPrice)), 0);

    const currencyPrefix = CURRENCIES[currency] ?? currency;

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsUploading(true);
        setUploadError("");
        const formData = new FormData();
        formData.append("file", file);
        try {
            const res = await fetch("/api/upload", { method: "POST", body: formData });
            if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Upload failed"); }
            const data = await res.json();
            setValue("fileUrl", data.url);
            showToast("Receipt uploaded successfully", "success");
        } catch (error: any) {
            setUploadError(error.message);
            showToast("Failed to upload receipt", "error");
        } finally { setIsUploading(false); }
    };

    const onSubmit = async (data: InvoiceFormData) => {
        if (data.items.length === 0) { showToast("Please add at least one line item", "error"); return; }
        setIsSubmitting(true);
        try {
            const formattedItems = data.items.map(item => ({
                ...item,
                quantity: Number(item.quantity),
                unitPrice: Number(item.unitPrice),
                total: Number(item.quantity) * Number(item.unitPrice)
            }));
            const res = await fetch("/api/invoices", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...data, amount: subtotal, items: formattedItems })
            });
            if (!res.ok) { const json = await res.json(); throw new Error(json.error || "Failed to create invoice"); }
            showToast("Invoice recorded successfully!", "success");
            router.push("/dashboard/invoices");
            router.refresh();
        } catch (error: any) {
            showToast(error.message, "error");
        } finally { setIsSubmitting(false); }
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="pb-16">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* ── LEFT COLUMN ── */}
                <div className="lg:col-span-2 space-y-5">

                    {/* Invoice Details card */}
                    <div className="bg-white rounded-[8px] overflow-hidden" style={CARD_STYLE}>
                        <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                            <div className="w-7 h-7 rounded-[6px] bg-indigo-50 flex items-center justify-center shrink-0">
                                <PiReceipt className="text-[#6366F1] text-[13px]" />
                            </div>
                            <h2 className="text-[13.5px] font-[600] text-gray-900">Invoice Details</h2>
                        </div>

                        <div className="px-5 py-5 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className={LABEL_CLASS}>Vendor <span className="text-rose-400">*</span></label>
                                    <Controller
                                        name="vendorId"
                                        control={control}
                                        rules={{ required: "Vendor is required" }}
                                        render={({ field }) => (
                                            <CustomSelect
                                                value={field.value}
                                                onChange={val => field.onChange(val)}
                                                options={vendors.map(v => ({ value: v.id, label: v.name }))}
                                                placeholder="Select vendor…"
                                                className={INPUT_CLASS}
                                                style={INPUT_STYLE}
                                            />
                                        )}
                                    />
                                    {errors.vendorId && <p className="text-[11px] text-rose-500 mt-1">{errors.vendorId.message as string}</p>}
                                </div>
                                <div>
                                    <label className={LABEL_CLASS}>Invoice number <span className="text-rose-400">*</span></label>
                                    <input type="text" placeholder="INV-2024-001" className={INPUT_CLASS} style={INPUT_STYLE}
                                        {...register("invoiceNumber", { required: "Invoice number is required" })} />
                                    {errors.invoiceNumber && <p className="text-[11px] text-rose-500 mt-1">{errors.invoiceNumber.message as string}</p>}
                                </div>
                                <div>
                                    <label className={LABEL_CLASS}>Invoice date <span className="text-rose-400">*</span></label>
                                    <input type="date" className={INPUT_CLASS} style={INPUT_STYLE}
                                        {...register("invoiceDate", { required: true })} />
                                </div>
                                <div>
                                    <label className={LABEL_CLASS}>Due date <span className="text-rose-400">*</span></label>
                                    <input type="date" className={INPUT_CLASS} style={INPUT_STYLE}
                                        {...register("dueDate", { required: true })} />
                                </div>
                                <div>
                                    <label className={LABEL_CLASS}>Currency</label>
                                    <Controller
                                        name="currency"
                                        control={control}
                                        render={({ field }) => (
                                            <CustomSelect
                                                value={field.value}
                                                onChange={val => field.onChange(val)}
                                                options={[
                                                    { value: "KES", label: "KES (Kenya Shilling)" },
                                                    { value: "USD", label: "USD (US Dollar)" },
                                                    { value: "SSP", label: "SSP (South Sudan Pound)" },
                                                ]}
                                                placeholder="Select currency"
                                                className={INPUT_CLASS}
                                                style={INPUT_STYLE}
                                            />
                                        )}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className={LABEL_CLASS}>Description <span className="text-gray-300">(optional)</span></label>
                                <textarea rows={2} placeholder="Brief description of services or goods…"
                                    className={cn(INPUT_CLASS, 'resize-none')} style={INPUT_STYLE}
                                    {...register("description")} />
                            </div>
                        </div>
                    </div>

                    {/* Line Items card */}
                    <div className="bg-white rounded-[8px] overflow-hidden" style={CARD_STYLE}>
                        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                            <div className="flex items-center gap-3">
                                <div className="w-7 h-7 rounded-[6px] bg-gray-50 flex items-center justify-center shrink-0"
                                    style={{ border: '1px solid rgba(0,0,0,0.07)' }}>
                                    <PiListBullets className="text-gray-400 text-[13px]" />
                                </div>
                                <h3 className="text-[13.5px] font-[600] text-gray-900">Line Items</h3>
                            </div>
                            <button type="button"
                                onClick={() => append({ description: "", quantity: 1, unitPrice: 0, total: 0, category: "" })}
                                className="flex items-center gap-1.5 text-[12px] font-[500] text-[#6366F1] hover:bg-indigo-50 px-2.5 py-1.5 rounded-[5px] transition-colors">
                                <PiPlus className="text-[13px]" /> Add item
                            </button>
                        </div>

                        {/* Column headers */}
                        <div className="grid grid-cols-12 gap-3 px-5 py-2.5 bg-gray-50/60"
                            style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                            <div className="col-span-5 text-[10.5px] font-[500] uppercase tracking-[0.08em] text-gray-400">Description</div>
                            <div className="col-span-2 text-[10.5px] font-[500] uppercase tracking-[0.08em] text-gray-400 text-center">Qty</div>
                            <div className="col-span-3 text-[10.5px] font-[500] uppercase tracking-[0.08em] text-gray-400">Unit Price</div>
                            <div className="col-span-2 text-[10.5px] font-[500] uppercase tracking-[0.08em] text-gray-400 text-right">Total</div>
                        </div>

                        {/* Rows */}
                        <div className="px-5 py-3 space-y-3">
                            {fields.map((field, index) => (
                                <div key={field.id} className="grid grid-cols-12 gap-3 items-center">
                                    <div className="col-span-5">
                                        <input type="text" placeholder="Item description"
                                            className={INPUT_CLASS} style={INPUT_STYLE}
                                            {...register(`items.${index}.description` as const, { required: true })} />
                                    </div>
                                    <div className="col-span-2">
                                        <input type="number" min="1"
                                            className={cn(INPUT_CLASS, 'text-center')} style={INPUT_STYLE}
                                            {...register(`items.${index}.quantity` as const, { required: true })} />
                                    </div>
                                    <div className="col-span-3">
                                        <input type="number" step="0.01"
                                            className={cn(INPUT_CLASS, 'pl-3 tabular-nums')} style={INPUT_STYLE}
                                            {...register(`items.${index}.unitPrice` as const, { required: true })} />
                                    </div>
                                    <div className="col-span-2 flex items-center justify-end gap-2">
                                        <span className="font-mono text-[13px] font-[600] text-gray-900 tabular-nums">
                                            {(Number(watch(`items.${index}.quantity`)) * Number(watch(`items.${index}.unitPrice`))).toFixed(2)}
                                        </span>
                                        <button type="button" onClick={() => remove(index)}
                                            className="p-1 text-gray-300 hover:text-rose-500 hover:bg-rose-50 rounded-[4px] transition-colors shrink-0">
                                            <PiTrash className="text-[13px]" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Total footer */}
                        <div className="flex justify-between items-center px-5 py-3.5"
                            style={{ borderTop: '1px solid rgba(0,0,0,0.07)' }}>
                            <p className="text-[11px] font-[500] uppercase tracking-[0.07em] text-gray-400">Total amount</p>
                            <p className="text-[20px] font-[700] text-[#6366F1] tabular-nums">
                                {currencyPrefix} {subtotal.toFixed(2)}
                            </p>
                        </div>
                    </div>
                </div>

                {/* ── RIGHT COLUMN ── */}
                <div className="space-y-4">

                    {/* Actions card */}
                    <div className="bg-white rounded-[8px] px-5 py-4 space-y-3" style={CARD_STYLE}>
                        <p className="text-[11px] font-[600] uppercase tracking-[0.07em] text-gray-400">Actions</p>
                        <button type="submit" disabled={isSubmitting}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-[6px] bg-[#6366F1] hover:bg-indigo-600 text-white text-[13px] font-[500] transition-colors disabled:opacity-60">
                            {isSubmitting
                                ? <><PiSpinner className="animate-spin text-[15px]" /> Saving…</>
                                : <><PiFloppyDisk className="text-[15px]" /> Save Invoice</>}
                        </button>
                        <button type="button" onClick={() => router.back()}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-[6px] text-[13px] font-[500] text-gray-500 hover:bg-gray-50 transition-colors"
                            style={{ border: '1px solid rgba(0,0,0,0.09)' }}>
                            Cancel
                        </button>
                    </div>

                    {/* File upload card */}
                    <div className="bg-white rounded-[8px] overflow-hidden" style={CARD_STYLE}>
                        <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                            <p className="text-[11px] font-[600] uppercase tracking-[0.07em] text-gray-400">Invoice File</p>
                        </div>
                        <div className="px-5 py-4">
                            <div className={cn(
                                "relative rounded-[8px] flex flex-col items-center justify-center h-36 text-center transition-colors group",
                                fileUrl ? "bg-emerald-50" : "bg-gray-50/60 hover:bg-indigo-50/40"
                            )} style={{
                                border: fileUrl
                                    ? '1.5px dashed rgba(16,185,129,0.35)'
                                    : '1.5px dashed rgba(0,0,0,0.12)'
                            }}>
                                <input type="file" accept=".pdf,.jpg,.jpeg,.png"
                                    onChange={handleFileUpload}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                    disabled={isUploading} />
                                {isUploading ? (
                                    <>
                                        <PiSpinner className="animate-spin text-[#6366F1] text-xl mb-2" />
                                        <p className="text-[12px] font-[500] text-[#6366F1]">Uploading…</p>
                                    </>
                                ) : fileUrl ? (
                                    <>
                                        <PiCheckCircle className="text-emerald-500 text-2xl mb-2" />
                                        <p className="text-[12.5px] font-[500] text-emerald-600">File attached</p>
                                        <p className="text-[10.5px] text-gray-400 mt-0.5 px-3 truncate max-w-full">{fileUrl.split('/').pop()}</p>
                                        <p className="text-[10.5px] text-[#6366F1] font-[500] mt-1 relative z-20 pointer-events-none">Click to replace</p>
                                    </>
                                ) : (
                                    <>
                                        <PiUploadSimple className="text-gray-300 text-xl mb-2 group-hover:text-[#6366F1] transition-colors" />
                                        <p className="text-[12.5px] font-[500] text-gray-600 group-hover:text-[#6366F1] transition-colors">Upload invoice PDF</p>
                                        <p className="text-[11px] text-gray-400 mt-0.5">PDF, JPG or PNG</p>
                                        {uploadError && <p className="text-[10.5px] text-rose-500 font-[500] mt-1">{uploadError}</p>}
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </form>
    );
}
