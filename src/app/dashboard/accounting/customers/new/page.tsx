"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ToastProvider";
import {
    PiUser,
    PiEnvelope,
    PiPhone,
    PiMapPin,
    PiIdentificationCard,
    PiGlobe,
    PiCheckCircle,
    PiSpinner,
    PiBuildings,
    PiUserCircle,
    PiX,
} from "react-icons/pi";
import { CustomSelect } from "@/components/ui/CustomSelect";
import Link from "next/link";

const CARD_STYLE: React.CSSProperties = { border: '1px solid rgba(0,0,0,0.09)' };
const INPUT_CLS = "w-full rounded-[6px] px-3 py-[10px] text-[13px] text-gray-900 placeholder:text-gray-300 outline-none focus:ring-1 focus:ring-[#6366F1] transition-colors bg-white";
const INPUT_STYLE: React.CSSProperties = { border: '1px solid rgba(0,0,0,0.09)' };
const LABEL_CLS = "block text-[11.5px] font-[500] text-gray-400 mb-1.5";

export default function NewCustomerPage() {
    const router = useRouter();
    const { showToast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [formData, setFormData] = useState({
        name: "",
        email: "",
        phone: "",
        contactPerson: "",
        address: "",
        city: "Juba",
        country: "South Sudan",
        taxId: "",
        currency: 'KES'
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const res = await fetch("/api/accounting/customers", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData)
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Failed to create customer");
            }
            showToast("Customer added successfully", "success");
            router.push("/dashboard/accounting/customers");
            router.refresh();
        } catch (error: any) {
            showToast(error.message, "error");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="pb-12">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Main — left 2 cols */}
                <div className="lg:col-span-2 space-y-5">

                    {/* Company Details */}
                    <div className="bg-white rounded-[8px] overflow-hidden" style={CARD_STYLE}>
                        <div className="px-6 py-4" style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                            <h2 className="text-[13px] font-[600] text-gray-900">Company Details</h2>
                            <p className="text-[11.5px] text-gray-400 mt-0.5">Basic identity and contact information</p>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className={LABEL_CLS}>Customer / Company Name <span className="text-rose-400">*</span></label>
                                <div>
                                    <input
                                        required
                                        type="text"
                                        className={INPUT_CLS + " pl-3"}
                                        style={INPUT_STYLE}
                                        placeholder="e.g. Acme Corp Ltd."
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className={LABEL_CLS}>Email Address</label>
                                    <div>
                                        <input
                                            type="email"
                                            className={INPUT_CLS + " pl-3"}
                                            style={INPUT_STYLE}
                                            placeholder="billing@acme.com"
                                            value={formData.email}
                                            onChange={e => setFormData({ ...formData, email: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className={LABEL_CLS}>Phone Number</label>
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

                            <div>
                                <label className={LABEL_CLS}>Primary Contact Person</label>
                                <div>
                                    <input
                                        type="text"
                                        className={INPUT_CLS + " pl-3"}
                                        style={INPUT_STYLE}
                                        placeholder="e.g. John Doe"
                                        value={formData.contactPerson}
                                        onChange={e => setFormData({ ...formData, contactPerson: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Location */}
                    <div className="bg-white rounded-[8px] overflow-hidden" style={CARD_STYLE}>
                        <div className="px-6 py-4" style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                            <h2 className="text-[13px] font-[600] text-gray-900">Location</h2>
                            <p className="text-[11.5px] text-gray-400 mt-0.5">Billing address and region</p>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className={LABEL_CLS}>Billing Address</label>
                                <div>
                                    <textarea
                                        className="w-full rounded-[6px] pl-3 pr-3 py-[10px] text-[13px] text-gray-900 placeholder:text-gray-300 outline-none focus:ring-1 focus:ring-[#6366F1] transition-colors bg-white resize-none h-20"
                                        style={INPUT_STYLE}
                                        placeholder="Street address, PO Box..."
                                        value={formData.address}
                                        onChange={e => setFormData({ ...formData, address: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    </div>

                    {/* Financial Details */}
                    <div className="bg-white rounded-[8px] overflow-hidden" style={CARD_STYLE}>
                        <div className="px-6 py-4" style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                            <h2 className="text-[13px] font-[600] text-gray-900">Financial Details</h2>
                            <p className="text-[11.5px] text-gray-400 mt-0.5">Tax and currency preferences</p>
                        </div>
                        <div className="p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className={LABEL_CLS}>Tax ID / TIN</label>
                                    <div>
                                        <input
                                            type="text"
                                            className={INPUT_CLS + " pl-3"}
                                            style={INPUT_STYLE}
                                            placeholder="Tax Identification Number"
                                            value={formData.taxId}
                                            onChange={e => setFormData({ ...formData, taxId: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className={LABEL_CLS}>Default Currency</label>
                                    <CustomSelect
                                        value={formData.currency}
                                        onChange={val => setFormData({ ...formData, currency: val })}
                                        options={[
                                            { value: "KES", label: "KES - Kenyan Shilling" },
                                            { value: "USD", label: "USD - US Dollar" },
                                            { value: "SSP", label: "SSP - South Sudanese Pound" },
                                        ]}
                                        placeholder="Select currency"
                                        className={INPUT_CLS}
                                        style={INPUT_STYLE}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Sidebar */}
                <div className="lg:col-span-1">
                    <div className="bg-white rounded-[8px] p-5 sticky top-6" style={CARD_STYLE}>
                        <p className="text-[10.5px] font-[500] text-gray-400 uppercase tracking-[0.07em] mb-4 pb-3"
                            style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                            Actions
                        </p>

                        <div className="space-y-2.5">
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-[6px] text-[12.5px] font-[500] text-white bg-[#6366F1] hover:bg-indigo-600 transition-colors disabled:opacity-60"
                            >
                                {isSubmitting
                                    ? <PiSpinner className="animate-spin text-[14px]" />
                                    : <PiCheckCircle className="text-[14px]" />
                                }
                                {isSubmitting ? "Creating..." : "Create Customer"}
                            </button>

                            <Link href="/dashboard/accounting/customers" className="block">
                                <button
                                    type="button"
                                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-[6px] text-[12.5px] font-[500] text-gray-600 bg-white hover:bg-gray-50 transition-colors"
                                    style={CARD_STYLE}
                                >
                                    <PiX className="text-[14px]" /> Cancel
                                </button>
                            </Link>
                        </div>

                        {/* Preview chip — shows when name filled in */}
                        {formData.name && (
                            <div className="mt-5 pt-4" style={{ borderTop: '1px solid rgba(0,0,0,0.07)' }}>
                                <p className="text-[10.5px] font-[500] text-gray-400 uppercase tracking-[0.06em] mb-2">Preview</p>
                                <div className="flex items-center gap-2">
                                    <div className="w-9 h-9 rounded-[7px] bg-indigo-50 text-[#6366F1] flex items-center justify-center font-[700] text-[12px] shrink-0">
                                        {formData.name.substring(0, 2).toUpperCase()}
                                    </div>
                                    <div>
                                        <p className="text-[12.5px] font-[500] text-gray-900 leading-tight">{formData.name}</p>
                                        {(formData.city || formData.country) && (
                                            <p className="text-[11px] text-gray-400">{formData.city}{formData.city && formData.country ? ', ' : ''}{formData.country}</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </form>
    );
}
