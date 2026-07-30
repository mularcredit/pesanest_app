
"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
    PiX,
    PiEnvelope,
    PiPhone,
    PiIdentificationCard,
    PiGlobe,
    PiCheckCircle,
    PiSpinner,
    PiBuildings,
    PiUserCircle,
    PiPencilSimple
} from "react-icons/pi";
import { useToast } from "@/components/ui/ToastProvider";
import { CustomSelect } from "@/components/ui/CustomSelect";

const INPUT_CLS = "w-full rounded-[6px] px-3 py-[10px] text-[13px] text-gray-900 placeholder:text-gray-300 outline-none focus:ring-1 focus:ring-[#6366F1] transition-colors bg-white";
const INPUT_STYLE: React.CSSProperties = { border: '1px solid rgba(0,0,0,0.09)' };
const LABEL_CLS = "block text-[11.5px] font-[500] text-gray-400 mb-1.5";

interface EditCustomerModalProps {
    customer: any;
}

export function EditCustomerModal({ customer }: EditCustomerModalProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const router = useRouter();
    const { showToast } = useToast();

    useEffect(() => { setMounted(true); }, []);

    const [formData, setFormData] = useState({
        id: customer.id,
        name: customer.name,
        email: customer.email || "",
        phone: customer.phone || "",
        contactPerson: customer.contactPerson || "",
        address: customer.address || "",
        city: customer.city || "",
        country: customer.country || "",
        taxId: customer.taxId || "",
        currency: customer.currency || 'KES',
        isActive: customer.isActive
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const res = await fetch("/api/accounting/customers", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData)
            });

            if (!res.ok) throw new Error("Failed to update customer");

            showToast("Customer updated successfully", "success");
            setIsOpen(false);
            router.refresh();
        } catch (error) {
            showToast("Failed to update customer", "error");
        } finally {
            setIsSubmitting(false);
        }
    };

    const modal = mounted && isOpen ? createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/30" onClick={() => setIsOpen(false)} />
            <div
                className="relative bg-white w-full max-w-2xl max-h-[90vh] rounded-[12px] overflow-hidden flex flex-col"
                style={{ border: '1px solid rgba(0,0,0,0.09)', boxShadow: '0 8px 40px rgba(0,0,0,0.12)' }}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4"
                    style={{ borderBottom: '1px solid rgba(0,0,0,0.07)', background: '#FAFAFA' }}>
                    <div>
                        <h2 className="text-[15px] font-[600] text-gray-900">Edit Customer Details</h2>
                        <p className="text-[11.5px] text-gray-400 mt-0.5">Update profile information for {customer.name}</p>
                    </div>
                    <button
                        onClick={() => setIsOpen(false)}
                        className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-[6px] transition-colors"
                    >
                        <PiX className="text-[18px]" />
                    </button>
                </div>

                {/* Scrollable Body */}
                <div className="overflow-y-auto p-6 space-y-5">
                    <form id="edit-customer-form" onSubmit={handleSubmit} className="space-y-5">
                        {/* Basic Info */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2">
                                <label className={LABEL_CLS}>Company Name</label>
                                <div>
                                    <input
                                        required
                                        type="text"
                                        className={INPUT_CLS + " pl-3"}
                                        style={INPUT_STYLE}
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className={LABEL_CLS}>Email</label>
                                <div>
                                    <input
                                        type="email"
                                        className={INPUT_CLS + " pl-3"}
                                        style={INPUT_STYLE}
                                        value={formData.email}
                                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className={LABEL_CLS}>Phone</label>
                                <div>
                                    <input
                                        type="tel"
                                        className={INPUT_CLS + " pl-3"}
                                        style={INPUT_STYLE}
                                        placeholder="+211 ..."
                                        value={formData.phone}
                                        onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Address */}
                        <div className="space-y-4 pt-4" style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                            <div>
                                <label className={LABEL_CLS}>Address</label>
                                <textarea
                                    className="w-full rounded-[6px] px-3 py-[10px] text-[13px] text-gray-900 placeholder:text-gray-300 outline-none focus:ring-1 focus:ring-[#6366F1] transition-colors bg-white resize-none h-20"
                                    style={INPUT_STYLE}
                                    value={formData.address}
                                    onChange={e => setFormData({ ...formData, address: e.target.value })}
                                    placeholder="Street Address..."
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={LABEL_CLS}>City</label>
                                    <input
                                        type="text"
                                        className={INPUT_CLS}
                                        style={INPUT_STYLE}
                                        value={formData.city}
                                        onChange={e => setFormData({ ...formData, city: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className={LABEL_CLS}>Country</label>
                                    <div>
                                        <input
                                            type="text"
                                            className={INPUT_CLS + " pl-3"}
                                            style={INPUT_STYLE}
                                            value={formData.country}
                                            onChange={e => setFormData({ ...formData, country: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Additional Info */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4"
                            style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                            <div>
                                <label className={LABEL_CLS}>Contact Person</label>
                                <div>
                                    <input
                                        type="text"
                                        className={INPUT_CLS + " pl-3"}
                                        style={INPUT_STYLE}
                                        value={formData.contactPerson}
                                        onChange={e => setFormData({ ...formData, contactPerson: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className={LABEL_CLS}>Tax ID / TIN</label>
                                <div>
                                    <input
                                        type="text"
                                        className={INPUT_CLS + " pl-3"}
                                        style={INPUT_STYLE}
                                        value={formData.taxId}
                                        onChange={e => setFormData({ ...formData, taxId: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className={LABEL_CLS}>Currency</label>
                                <CustomSelect
                                    value={formData.currency}
                                    onChange={val => setFormData({ ...formData, currency: val })}
                                    options={[
                                        { value: "KES", label: "KES - Kenyan Shilling" },
                                        { value: "USD", label: "USD - US Dollar" },
                                        { value: "SSP", label: "SSP - South Sudanese Pound" },
                                    ]}
                                    className={INPUT_CLS}
                                    style={INPUT_STYLE}
                                />
                            </div>

                            <div>
                                <label className={LABEL_CLS}>Status</label>
                                <div className="flex items-center gap-3 px-3 py-[10px] rounded-[6px]"
                                    style={{ border: '1px solid rgba(0,0,0,0.09)', background: '#FAFAFA' }}>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.isActive}
                                            onChange={e => setFormData({ ...formData, isActive: e.target.checked })}
                                            className="w-4 h-4 text-[#6366F1] rounded border-gray-300 focus:ring-[#6366F1]"
                                        />
                                        <span className="text-[13px] font-[500] text-gray-900">Active Customer</span>
                                    </label>
                                </div>
                            </div>
                        </div>
                    </form>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 flex justify-end gap-3"
                    style={{ borderTop: '1px solid rgba(0,0,0,0.07)', background: '#FAFAFA' }}>
                    <button
                        onClick={() => setIsOpen(false)}
                        className="px-4 py-2 text-[12.5px] font-[500] text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-[6px] transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        form="edit-customer-form"
                        disabled={isSubmitting}
                        className="px-5 py-2 bg-[#6366F1] hover:bg-indigo-600 text-white text-[12.5px] font-[600] rounded-[6px] transition-colors disabled:opacity-50 flex items-center gap-1.5"
                    >
                        {isSubmitting ? <PiSpinner className="animate-spin" /> : <PiCheckCircle />}
                        Save Changes
                    </button>
                </div>
            </div>
        </div>,
        document.body
    ) : null;

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className="text-gray-400 hover:text-[#6366F1] transition-colors p-1.5 rounded-[6px] hover:bg-indigo-50"
                title="Edit Details"
            >
                <PiPencilSimple className="text-[15px]" />
            </button>
            {modal}
        </>
    );
}
