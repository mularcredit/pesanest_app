"use client";

import { useState } from "react";
import { PiPlus, PiX, PiTag, PiTrash } from "react-icons/pi";
import { createCustomCategory, deleteCustomCategory } from "@/app/dashboard/requisitions/category-actions";

interface CustomCategoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    categories: any[];
    onCategoryCreated: () => void;
}

export function CustomCategoryModal({
    isOpen,
    onClose,
    categories,
    onCategoryCreated,
}: CustomCategoryModalProps) {
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState("");

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setIsSubmitting(true);

        const formData = new FormData();
        formData.append("name", name);
        formData.append("description", description);

        const result = await createCustomCategory(formData);

        if (result.error) {
            setError(result.error);
            setIsSubmitting(false);
        } else {
            setName("");
            setDescription("");
            setIsSubmitting(false);
            onCategoryCreated();
        }
    };

    const handleDelete = async (id: string) => {
        const result = await deleteCustomCategory(id);
        if (result.success) {
            onCategoryCreated();
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full overflow-hidden scale-100 animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="h-[88px] px-6 flex items-center justify-between bg-gradient-to-r from-green-100 to-white border-b border-gray-200 rounded-t-xl">
                    <div className="flex items-center gap-3">
                        <div>
                            <h2 className="text-base font-semibold text-gray-900">Custom Categories</h2>
                            <p className="text-xs text-gray-500 mt-1">Create and manage custom expense categories</p>
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
                <div className="p-6 max-h-[70vh] overflow-y-auto">
                    {/* Create Form */}
                    <form onSubmit={handleSubmit} className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <h3 className="text-sm font-semibold text-gray-900 mb-3">Create New Category</h3>

                        {error && (
                            <div className="mb-3 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-600">
                                {error}
                            </div>
                        )}

                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                                    Category Name <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    required
                                    className="w-full bg-white border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#6366F1]/10 focus:border-[#6366F1] transition-all"
                                    placeholder="e.g., IT Equipment"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                                    Description (Optional)
                                </label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    className="w-full bg-white border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#6366F1]/10 focus:border-[#6366F1] transition-all resize-none"
                                    rows={2}
                                    placeholder="Brief description of this category..."
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={isSubmitting || !name.trim()}
                                className="w-full px-4 py-2.5 bg-[#6366F1] text-white rounded-lg font-medium text-xs hover:bg-[#6366F1]/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                <PiPlus className="text-sm" />
                                {isSubmitting ? "Creating..." : "Create Category"}
                            </button>
                        </div>
                    </form>

                    {/* Existing Categories */}
                    <div>
                        <h3 className="text-sm font-semibold text-gray-900 mb-3">
                            Custom Categories ({categories.length})
                        </h3>

                        {categories.length === 0 ? (
                            <div className="text-center py-8 text-gray-500 text-sm">
                                No custom categories yet. Create one above!
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {categories.map((category) => (
                                    <div
                                        key={category.id}
                                        className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                                    >
                                        <div className="flex-1">
                                            <div className="font-medium text-sm text-gray-900">
                                                {category.name}
                                            </div>
                                            {category.description && (
                                                <div className="text-xs text-gray-500 mt-0.5">
                                                    {category.description}
                                                </div>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => handleDelete(category.id)}
                                            className="p-2 hover:bg-rose-50 rounded-lg transition-colors group"
                                            title="Delete category"
                                        >
                                            <PiTrash className="text-gray-400 group-hover:text-rose-500" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium text-xs hover:bg-gray-50 transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
