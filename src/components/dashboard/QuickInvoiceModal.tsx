"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
    PiX, PiUploadSimple, PiCheckCircle, PiArrowRight, PiReceipt, PiFloppyDisk
} from "react-icons/pi";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/ToastProvider";
import { uploadQuickInvoice } from "@/app/dashboard/invoices/actions";

interface QuickInvoiceModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function QuickInvoiceModal({ isOpen, onClose }: QuickInvoiceModalProps) {
    const router = useRouter();
    const { showToast } = useToast();
    const [isUploading, setIsUploading] = useState(false);
    const [fileUrl, setFileUrl]         = useState("");
    const [fileName, setFileName]       = useState("");
    const [uploadError, setUploadError] = useState("");
    const [isSaving, setIsSaving]       = useState(false);
    const [mounted, setMounted]         = useState(false);

    useEffect(() => { setMounted(true); }, []);

    if (!mounted || !isOpen) return null;

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
            setFileUrl(data.url);
            setFileName(file.name);
            showToast("Invoice uploaded successfully", "success");
        } catch (error: any) {
            setUploadError(error.message);
            showToast("Failed to upload invoice", "error");
        } finally { setIsUploading(false); }
    };

    const handleContinue = () => {
        if (!fileUrl) return;
        router.push(`/dashboard/invoices/new?fileUrl=${encodeURIComponent(fileUrl)}`);
        onClose();
    };

    const handleQuickSave = async () => {
        if (!fileUrl) return;
        setIsSaving(true);
        try {
            const res = await uploadQuickInvoice(fileUrl, fileName);
            if (res.success) { showToast("Invoice stored as draft", "success"); onClose(); router.refresh(); }
            else showToast(res.error || "Failed to save", "error");
        } catch { showToast("An unexpected error occurred", "error"); }
        finally { setIsSaving(false); }
    };

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            {/* Overlay */}
            <div className="fixed inset-0 bg-black/30" onClick={onClose} />

            {/* Modal */}
            <div className="relative bg-white w-full max-w-lg rounded-[12px] flex flex-col max-h-[90vh] overflow-hidden"
                style={{ border: '1px solid rgba(0,0,0,0.09)', boxShadow: '0 8px 40px rgba(0,0,0,0.12)' }}>

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 shrink-0"
                    style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-[7px] bg-emerald-50 flex items-center justify-center shrink-0">
                            <PiReceipt className="text-emerald-600 text-[15px]" />
                        </div>
                        <div>
                            <h3 className="text-[14px] font-[600] text-gray-900 leading-none">Quick Upload</h3>
                            <p className="text-[12px] text-gray-400 mt-0.5">Upload a vendor bill to start recording</p>
                        </div>
                    </div>
                    <button onClick={onClose}
                        className="p-1.5 rounded-[6px] text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors">
                        <PiX className="text-[16px]" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-6 py-5">
                    <div className={cn(
                        "relative rounded-[8px] flex flex-col items-center justify-center h-52 text-center transition-colors group",
                        fileUrl
                            ? "bg-emerald-50"
                            : "bg-gray-50/60 hover:bg-indigo-50/40"
                    )} style={{
                        border: fileUrl
                            ? '1.5px dashed rgba(16,185,129,0.4)'
                            : '1.5px dashed rgba(0,0,0,0.13)'
                    }}>
                        {!fileUrl && (
                            <input type="file" accept=".pdf,.jpg,.jpeg,.png"
                                onChange={handleFileUpload}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                disabled={isUploading} />
                        )}

                        {isUploading ? (
                            <>
                                <div className="w-8 h-8 border-2 border-[#6366F1]/30 border-t-[#6366F1] rounded-full animate-spin mb-3" />
                                <p className="text-[13px] font-[500] text-[#6366F1]">Uploading…</p>
                            </>
                        ) : fileUrl ? (
                            <>
                                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center mb-3">
                                    <PiCheckCircle className="text-emerald-500 text-xl" />
                                </div>
                                <p className="text-[13px] font-[500] text-gray-900 truncate max-w-[240px]">{fileName}</p>
                                <p className="text-[11px] text-emerald-600 font-[500] mt-0.5">Ready to record</p>
                                <button onClick={() => { setFileUrl(""); setFileName(""); }}
                                    className="relative z-20 text-[11px] text-rose-500 font-[500] hover:underline mt-2">
                                    Remove
                                </button>
                            </>
                        ) : (
                            <>
                                <div className="w-10 h-10 rounded-[8px] bg-white flex items-center justify-center mb-3 transition-colors group-hover:bg-indigo-50"
                                    style={{ border: '1px solid rgba(0,0,0,0.09)' }}>
                                    <PiUploadSimple className="text-gray-400 text-[18px] group-hover:text-[#6366F1] transition-colors" />
                                </div>
                                <p className="text-[13px] font-[500] text-gray-700 group-hover:text-[#6366F1] transition-colors">
                                    Click to upload invoice
                                </p>
                                <p className="text-[11.5px] text-gray-400 mt-0.5">PDF, JPG or PNG — up to 10 MB</p>
                                {uploadError && <p className="text-[11px] text-rose-500 font-[500] mt-2">{uploadError}</p>}
                            </>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-2.5 px-6 py-4 shrink-0"
                    style={{ borderTop: '1px solid rgba(0,0,0,0.07)' }}>
                    <button onClick={onClose}
                        className="px-4 py-2 rounded-[6px] text-[12.5px] font-[500] text-gray-500 hover:bg-gray-50 transition-colors"
                        style={{ border: '1px solid rgba(0,0,0,0.09)' }}>
                        Cancel
                    </button>
                    <button onClick={handleQuickSave} disabled={!fileUrl || isSaving}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-[6px] text-[12.5px] font-[500] text-[#6366F1] bg-indigo-50 hover:bg-indigo-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        style={{ border: '1px solid rgba(99,102,241,0.15)' }}>
                        {isSaving
                            ? <div className="w-3 h-3 border-2 border-[#6366F1] border-t-transparent rounded-full animate-spin" />
                            : <PiFloppyDisk className="text-[14px]" />}
                        Quick Save
                    </button>
                    <button onClick={handleContinue} disabled={!fileUrl || isSaving}
                        className="flex items-center gap-1.5 px-5 py-2 rounded-[6px] text-[12.5px] font-[500] text-white bg-[#6366F1] hover:bg-indigo-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                        Record Details
                        <PiArrowRight className="text-[13px]" />
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
