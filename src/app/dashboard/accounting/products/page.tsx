"use client";

import { useState } from "react";
import { PiSealCheck, PiPackage, PiSpinnerGap } from "react-icons/pi";

type RegisterResult = { success: boolean; itemCd?: string; itemClsCd?: string; taxTyCd?: string; error?: string };

export default function ProductsPage() {
    const [name, setName] = useState("");
    const [unitPrice, setUnitPrice] = useState("");
    const [taxTyCd, setTaxTyCd] = useState("B");
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState<RegisterResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setError(null);
        setResult(null);
        try {
            const res = await fetch("/api/accounting/products", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, unitPrice: Number(unitPrice), taxTyCd }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                setError(data.error || "Item registration failed");
            } else {
                setResult(data);
            }
        } catch (err: any) {
            setError(err.message || "Something went wrong");
        } finally {
            setSubmitting(false);
        }
    };

    const taxLabel: Record<string, string> = { B: "16% VAT (B)", C: "Zero-rated (C)", D: "Exempt / Non-VAT (D)" };

    return (
        <div className="space-y-6 pb-24 max-w-3xl">
            <div>
                <div className="flex items-center gap-2.5">
                    <PiPackage className="text-[20px] text-gray-700" />
                    <h1 className="text-[20px] font-[600] text-gray-900 tracking-tight">Products &amp; Items</h1>
                </div>
                <p className="text-[12.5px] text-gray-400 mt-0.5">Register an item with KRA eTIMS before selling it</p>
            </div>

            {result && result.success && (
                <div className="rounded-[10px] border border-emerald-200 bg-emerald-50/60 p-5">
                    <div className="flex items-center gap-1.5 text-emerald-700">
                        <PiSealCheck className="text-[16px]" />
                        <span className="text-[12px] font-[600] tracking-wide uppercase">Item Registered with KRA eTIMS</span>
                    </div>
                    <dl className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1.5 text-[12.5px]">
                        <div className="flex justify-between gap-4"><dt className="text-gray-500">Item Name</dt><dd className="text-gray-900">{name}</dd></div>
                        <div className="flex justify-between gap-4"><dt className="text-gray-500">KRA Item Code</dt><dd className="font-mono text-gray-900">{result.itemCd}</dd></div>
                        <div className="flex justify-between gap-4"><dt className="text-gray-500">Classification Code</dt><dd className="font-mono text-gray-900">{result.itemClsCd}</dd></div>
                        <div className="flex justify-between gap-4"><dt className="text-gray-500">Tax Type</dt><dd className="text-gray-900">{taxLabel[result.taxTyCd || "B"]}</dd></div>
                        <div className="flex justify-between gap-4"><dt className="text-gray-500">Unit Price</dt><dd className="font-mono text-gray-900">KES {Number(unitPrice).toLocaleString()}</dd></div>
                        <div className="flex justify-between gap-4"><dt className="text-gray-500">Status</dt><dd className="text-emerald-700 font-[600]">REGISTERED</dd></div>
                    </dl>
                </div>
            )}

            {error && (
                <div className="rounded-[10px] border border-red-200 bg-red-50/60 p-4 text-[12.5px] text-red-700">
                    {error}
                </div>
            )}

            <form onSubmit={submit} className="rounded-[10px] border border-gray-200 bg-white p-6 space-y-5">
                <div>
                    <label className="block text-[12px] font-[600] text-gray-600 mb-1.5">Item / Product Name</label>
                    <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Consulting Service"
                        required
                        className="w-full rounded-[8px] border border-gray-200 px-3 py-2.5 text-[13px] text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                        <label className="block text-[12px] font-[600] text-gray-600 mb-1.5">Unit Price (KES)</label>
                        <input
                            type="number"
                            min="1"
                            step="0.01"
                            value={unitPrice}
                            onChange={(e) => setUnitPrice(e.target.value)}
                            placeholder="e.g. 2000"
                            required
                            className="w-full rounded-[8px] border border-gray-200 px-3 py-2.5 text-[13px] text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        />
                    </div>
                    <div>
                        <label className="block text-[12px] font-[600] text-gray-600 mb-1.5">Tax Type</label>
                        <select
                            value={taxTyCd}
                            onChange={(e) => setTaxTyCd(e.target.value)}
                            className="w-full rounded-[8px] border border-gray-200 px-3 py-2.5 text-[13px] text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        >
                            <option value="B">16% VAT (B)</option>
                            <option value="C">Zero-rated (C)</option>
                            <option value="D">Exempt / Non-VAT (D)</option>
                        </select>
                    </div>
                </div>
                <div className="pt-2">
                    <button
                        type="submit"
                        disabled={submitting}
                        className="inline-flex items-center gap-2 rounded-[8px] bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-[13px] font-[600] px-5 py-2.5 transition-colors"
                    >
                        {submitting ? <><PiSpinnerGap className="animate-spin text-[15px]" /> Registering with KRA…</> : <>Register Item with KRA</>}
                    </button>
                </div>
            </form>
        </div>
    );
}
