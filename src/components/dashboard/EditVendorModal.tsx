'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { PiX, PiCheck, PiBuildings } from 'react-icons/pi';
import { cn } from '@/lib/utils';
import { updateVendor } from '@/app/actions/vendors';
import { useToast } from '@/components/ui/ToastProvider';
import { PhoneInput } from '@/components/ui/PhoneInput';
import { CustomSelect } from "@/components/ui/CustomSelect";

interface EditVendorModalProps {
    isOpen: boolean;
    onClose: () => void;
    vendor: {
        id: string;
        name: string;
        category: string;
        email: string | null;
        phone: string | null;
        website: string | null;
        paymentTerms: string | null;
        currency: string;
        description: string | null;
    };
}

const INPUT_CLASS = "w-full rounded-[6px] px-3 py-[10px] text-[13px] text-gray-900 placeholder:text-gray-300 outline-none focus:ring-1 focus:ring-[#6366F1] transition-colors bg-white";
const INPUT_STYLE: React.CSSProperties = { border: '1px solid rgba(0,0,0,0.09)' };
const LABEL_CLASS = "block text-[11.5px] font-[500] text-gray-400 mb-1.5";

const KNOWN_TERMS = ['Due on Receipt', 'Net 7', 'Net 15', 'Net 30', 'Net 45', 'Net 60'];

export function EditVendorModal({ isOpen, onClose, vendor }: EditVendorModalProps) {
    const { showToast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [category, setCategory] = useState(vendor.category);
    const [currency, setCurrency] = useState(vendor.currency);
    const [paymentTerms, setPaymentTerms] = useState(vendor.paymentTerms || '');

    async function handleSubmit(formData: FormData) {
        setIsSubmitting(true);
        try {
            const result = await updateVendor(vendor.id, formData);
            if (result.success) { showToast(result.message, 'success'); onClose(); }
            else showToast(result.message, 'error');
        } catch { showToast('Something went wrong', 'error'); }
        finally { setIsSubmitting(false); }
    }

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            {/* Overlay */}
            <div className="fixed inset-0 bg-black/30" onClick={onClose} />

            {/* Modal */}
            <div className="relative bg-white w-full max-w-xl rounded-[12px] flex flex-col max-h-[90vh] overflow-hidden"
                style={{ border: '1px solid rgba(0,0,0,0.09)', boxShadow: '0 8px 40px rgba(0,0,0,0.12)' }}>

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 shrink-0"
                    style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-[7px] bg-indigo-50 flex items-center justify-center shrink-0">
                            <PiBuildings className="text-[#6366F1] text-[15px]" />
                        </div>
                        <div>
                            <h3 className="text-[14px] font-[600] text-gray-900 leading-none">Edit Vendor</h3>
                            <p className="text-[12px] text-gray-400 mt-0.5">Update supplier profile information</p>
                        </div>
                    </div>
                    <button onClick={onClose}
                        className="p-1.5 rounded-[6px] text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors">
                        <PiX className="text-[16px]" />
                    </button>
                </div>

                {/* Scrollable form body */}
                <div className="overflow-y-auto flex-1">
                    <form id="edit-vendor-form" action={handleSubmit} className="px-6 py-5 space-y-4">

                        <div>
                            <label className={LABEL_CLASS}>Business name <span className="text-rose-400">*</span></label>
                            <input name="name" required defaultValue={vendor.name}
                                className={INPUT_CLASS} style={INPUT_STYLE} placeholder="e.g. Acme Corp" />
                        </div>

                        <div>
                            <label className={LABEL_CLASS}>Description</label>
                            <textarea name="description" rows={2} defaultValue={vendor.description || ''}
                                className={cn(INPUT_CLASS, 'resize-none')} style={INPUT_STYLE}
                                placeholder="Brief summary of vendor services..." />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className={LABEL_CLASS}>Category <span className="text-rose-400">*</span></label>
                                <input type="hidden" name="category" value={category} />
                                <CustomSelect
                                    value={category}
                                    onChange={val => setCategory(val)}
                                    options={[
                                        { value: 'Travel', label: 'Travel' },
                                        { value: 'Accommodation', label: 'Accommodation' },
                                        { value: 'Meals & Entertainment', label: 'Meals & Entertainment' },
                                        { value: 'Logistics', label: 'Logistics' },
                                        { value: 'Communication', label: 'Communication' },
                                        { value: 'Services', label: 'Services' },
                                        { value: 'Software', label: 'Software' },
                                        { value: 'Other', label: 'Other' },
                                    ]}
                                    placeholder="Select…"
                                    className={INPUT_CLASS}
                                    style={INPUT_STYLE}
                                />
                            </div>
                            <div>
                                <label className={LABEL_CLASS}>Currency</label>
                                <input type="hidden" name="currency" value={currency} />
                                <CustomSelect
                                    value={currency}
                                    onChange={val => setCurrency(val)}
                                    options={[
                                        { value: 'KES', label: 'KES' },
                                        { value: 'USD', label: 'USD' },
                                        { value: 'SSP', label: 'SSP' },
                                        { value: 'EUR', label: 'EUR' },
                                        { value: 'GBP', label: 'GBP' },
                                    ]}
                                    className={INPUT_CLASS}
                                    style={INPUT_STYLE}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className={LABEL_CLASS}>Email</label>
                                <input name="email" type="email" defaultValue={vendor.email || ''}
                                    className={INPUT_CLASS} style={INPUT_STYLE} placeholder="contact@vendor.com" />
                            </div>
                            <div>
                                <label className={LABEL_CLASS}>Phone</label>
                                <PhoneInput name="phone" defaultValue={vendor.phone || ''} placeholder="+254…" />
                            </div>
                        </div>

                        <div>
                            <label className={LABEL_CLASS}>Website</label>
                            <input name="website" type="url" defaultValue={vendor.website || ''}
                                className={INPUT_CLASS} style={INPUT_STYLE} placeholder="https://…" />
                        </div>

                        <div>
                            <label className={LABEL_CLASS}>Payment terms</label>
                            <input type="hidden" name="paymentTerms" value={paymentTerms} />
                            <CustomSelect
                                value={paymentTerms}
                                onChange={val => setPaymentTerms(val)}
                                options={[
                                    { value: 'Due on Receipt', label: 'Due on Receipt' },
                                    { value: 'Net 7', label: 'Net 7' },
                                    { value: 'Net 15', label: 'Net 15' },
                                    { value: 'Net 30', label: 'Net 30' },
                                    { value: 'Net 45', label: 'Net 45' },
                                    { value: 'Net 60', label: 'Net 60' },
                                    ...(vendor.paymentTerms && !KNOWN_TERMS.includes(vendor.paymentTerms)
                                        ? [{ value: vendor.paymentTerms, label: vendor.paymentTerms }]
                                        : []),
                                ]}
                                placeholder="Select…"
                                className={INPUT_CLASS}
                                style={INPUT_STYLE}
                            />
                        </div>

                        <div className="h-2" />
                    </form>
                </div>

                {/* Footer — outside the scroll area */}
                <div className="flex items-center justify-end gap-2.5 px-6 py-4 shrink-0"
                    style={{ borderTop: '1px solid rgba(0,0,0,0.07)' }}>
                    <button type="button" onClick={onClose}
                        className="px-4 py-2 rounded-[6px] text-[12.5px] font-[500] text-gray-500 hover:bg-gray-50 transition-colors"
                        style={{ border: '1px solid rgba(0,0,0,0.09)' }}>
                        Cancel
                    </button>
                    <button type="submit" form="edit-vendor-form" disabled={isSubmitting}
                        className="flex items-center gap-2 px-5 py-2 rounded-[6px] bg-[#6366F1] hover:bg-indigo-600 text-white text-[12.5px] font-[500] transition-colors disabled:opacity-60">
                        <PiCheck className="text-[14px]" />
                        {isSubmitting ? 'Updating…' : 'Update Vendor'}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
