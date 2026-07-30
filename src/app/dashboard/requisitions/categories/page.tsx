"use client";

import { useState, useEffect } from"react";
import Link from"next/link";
import { PiCaretLeft, PiTag } from"react-icons/pi";
import { CustomCategoryModal } from"@/components/requisitions/CustomCategoryModal";
import { getCustomCategories } from"../category-actions";

export default function CategoriesPage() {
 const [isModalOpen, setIsModalOpen] = useState(true);
 const [categories, setCategories] = useState<any[]>([]);

 const loadCategories = async () => {
 const data = await getCustomCategories();
 setCategories(data);
 };

 useEffect(() => {
 loadCategories();
 }, []);

 const handleClose = () => {
 setIsModalOpen(false);
 // Navigate back after a short delay
 setTimeout(() => {
 window.location.href ="/dashboard/requisitions";
 }, 200);
 };

 return (
 <div className="pb-24">
 <div className="flex items-center gap-4 py-8 border-b border-gray-200">
 <Link href="/dashboard/requisitions"className="p-2 rounded-lg hover:bg-gray-50 text-gray-400 hover:text-gray-900 transition-all">
 <PiCaretLeft className="text-xl"/>
 </Link>
 <div className="flex items-center gap-3">
 <div className="w-12 h-12 bg-[#6366F1]/10 rounded-lg flex items-center justify-center">
 <PiTag className="text-[#6366F1] text-xl"/>
 </div>
 <div>
 <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Custom Categories</h1>
 <p className="text-gray-500 text-sm mt-1">Manage your custom expense categories</p>
 </div>
 </div>
 </div>

 <CustomCategoryModal
 isOpen={isModalOpen}
 onClose={handleClose}
 categories={categories}
 onCategoryCreated={loadCategories}
 />
 </div>
 );
}
