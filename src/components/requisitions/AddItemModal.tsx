"use client";

import { useState, useEffect } from "react";
import { PiPlus, PiX, PiCaretDown } from "react-icons/pi";
import { addItemToRequisition, getCategoriesAction } from "@/app/dashboard/requisitions/new/multi-item-actions";

interface AddItemModalProps {
    isOpen: boolean;
    onClose: () => void;
    requisitionId: string;
    currency: string;
    onItemAdded: () => void;
}

export function AddItemModal({
    isOpen,
    onClose,
    requisitionId,
    currency,
    onItemAdded,
}: AddItemModalProps) {
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [quantity, setQuantity] = useState("1");
    const [unitPrice, setUnitPrice] = useState("");
    const [category, setCategory] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState("");

    const formatCurrency = (amount: number, currencyCode: string = 'KES') => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currencyCode,
        }).format(amount);
    };

    const [allCategories, setAllCategories] = useState<string[]>([]);
    const [isCategoryOpen, setIsCategoryOpen] = useState(false);
    const [categorySearch, setCategorySearch] = useState("");

    useEffect(() => {
        loadCategories();
    }, []);

    const loadCategories = async () => {
        const categories = await getCategoriesAction();
        setAllCategories(categories);
    };

    const filteredCategories = allCategories.filter(c =>
        c.toLowerCase().includes(categorySearch.toLowerCase())
    );

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (!title.trim() || !category || !unitPrice || parseFloat(unitPrice) <= 0) {
            setError("Please fill in all required fields");
            return;
        }

        setIsSubmitting(true);

        const itemData = {
            title,
            description,
            quantity: parseInt(quantity) || 1,
            unitPrice: parseFloat(unitPrice),
            category,
        };

        const result = await addItemToRequisition(requisitionId, itemData);

        if (result.error) {
            setError(result.error);
            setIsSubmitting(false);
        } else {
            // Reset form
            setTitle("");
            setDescription("");
            setQuantity("1");
            setUnitPrice("");
            setCategory("");
            setIsSubmitting(false);
            onItemAdded();
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full overflow-hidden scale-100 animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="h-[88px] px-6 flex items-center justify-between bg-gradient-to-r from-green-100 to-white border-b border-gray-200 rounded-t-xl">
                    <div className="flex items-center gap-3">
                        <div>
                            <h2 className="text-base font-semibold text-gray-900">Add Item to Expense</h2>
                            <p className="text-xs text-gray-500 mt-1">Add another item to this purchase request</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/50 rounded-lg transition-colors text-gray-500 hover:text-gray-900"
                    >
                        <PiX className="text-xl" />
                    </button>
                </div>

                {/* Body */}
                <form onSubmit={handleSubmit} className="p-6">
                    {error && (
                        <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-600">
                            {error}
                        </div>
                    )}

                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1.5">
                                Item Title <span className="text-rose-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                required
                                className="w-full bg-white border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#6366F1]/10 focus:border-[#6366F1] transition-all"
                                placeholder="e.g., Laptop Computer"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1.5">Description</label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                className="w-full bg-white border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#6366F1]/10 focus:border-[#6366F1] transition-all resize-none"
                                rows={2}
                                placeholder="Optional details..."
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1.5">
                                Category <span className="text-rose-500">*</span>
                            </label>
                            <div className="relative">
                                <div
                                    onClick={() => setIsCategoryOpen(!isCategoryOpen)}
                                    className="w-full bg-white border border-gray-200 rounded-lg min-h-[42px] px-4 py-2.5 cursor-pointer flex items-center justify-between transition-colors hover:border-[#6366F1]"
                                >
                                    {category ? (
                                        <span className="text-sm text-gray-900">{category}</span>
                                    ) : (
                                        <span className="text-sm text-gray-400">Select category...</span>
                                    )}
                                    <PiCaretDown className={`text-gray-400 transition-transform ${isCategoryOpen ? 'rotate-180' : ''}`} />
                                </div>

                                {isCategoryOpen && (
                                    <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-100 rounded-xl shadow-xl z-50 p-3 animate-in fade-in zoom-in-95 duration-100">
                                        <div className="mb-3">
                                            <input
                                                type="text"
                                                autoFocus
                                                placeholder="Search categories..."
                                                value={categorySearch}
                                                onChange={(e) => setCategorySearch(e.target.value)}
                                                onClick={(e) => e.stopPropagation()}
                                                className="w-full px-3 py-2 bg-gray-50 border border-gray-100 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-[#6366F1] focus:bg-white transition-all"
                                            />
                                        </div>
                                        <div className="max-h-48 overflow-y-auto">
                                            {filteredCategories.length > 0 ? (
                                                <div className="flex flex-wrap gap-2">
                                                    {filteredCategories.map(cat => (
                                                        <button
                                                            key={cat}
                                                            type="button"
                                                            onClick={() => {
                                                                setCategory(cat);
                                                                setIsCategoryOpen(false);
                                                                setCategorySearch("");
                                                            }}
                                                            className="px-3 py-1.5 rounded-full text-xs font-medium border transition-all bg-white border-gray-300 text-gray-600 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-900"
                                                        >
                                                            {cat}
                                                        </button>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="py-2 text-center text-gray-500 text-xs">
                                                    No categories found
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                                {isCategoryOpen && (
                                    <div className="fixed inset-0 z-40" onClick={() => setIsCategoryOpen(false)} />
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                                    Quantity <span className="text-gray-400 font-normal text-[10px]">(Optional)</span>
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    value={quantity}
                                    onChange={(e) => setQuantity(e.target.value)}
                                    className="w-full bg-white border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#6366F1]/10 focus:border-[#6366F1] transition-all"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                                    Unit Price ({currency}) <span className="text-rose-500">*</span>
                                </label>
                                <div>
                                    <input
                                        type="number"
                                        step="1"
                                        min="0"
                                        value={unitPrice}
                                        onChange={(e) => setUnitPrice(e.target.value)}
                                        required
                                        className="w-full bg-white border border-gray-200 rounded-lg pl-3 pr-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#6366F1]/10 focus:border-[#6366F1] transition-all font-mono"
                                        placeholder="0"
                                    />
                                </div>
                            </div>
                        </div>

                        {quantity && unitPrice && (
                            <div className="bg-[#6366F1]/5 border border-[#6366F1]/20 rounded-lg p-3 flex items-center justify-between">
                                <span className="text-sm font-medium text-gray-700">Item Total</span>
                                <span className="text-lg font-semibold text-[#6366F1]">
                                    {formatCurrency((parseInt(quantity) || 0) * (parseFloat(unitPrice) || 0), currency)}
                                </span>
                            </div>
                        )}
                    </div>

                    <div className="flex gap-3 mt-6 pt-6 border-t border-gray-200">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium text-xs hover:bg-gray-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex-1 px-4 py-2.5 bg-[#6366F1] text-white rounded-lg font-medium text-xs hover:bg-[#6366F1]/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            <PiPlus className="text-sm" />
                            {isSubmitting ? "Adding..." : "Add Item"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
