"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
    PiPaperclip, PiX, PiUploadSimple, PiFilePdf, PiImage,
    PiCheckCircle, PiTrashSimple,
} from "react-icons/pi";
import { attachRequisitionReceipt } from "@/app/dashboard/requisitions/actions";
import { useToast } from "@/components/ui/ToastProvider";
import { EtrReceiptInput } from "@/components/accounting/EtrReceiptInput";
import { getReceiptViewerUrl } from "@/lib/receipt-url";

const INPUT_STYLE: React.CSSProperties = { border: '1px solid rgba(0,0,0,0.09)' };
const LABEL_CLASS = "block text-[11.5px] font-[500] text-gray-400 mb-1.5";

const ACCEPTED = "image/jpeg,image/png,image/jpg,application/pdf";
const MAX_BYTES = 10 * 1024 * 1024;

export function AttachReceiptButton({
    requisitionId,
    requisitionTitle,
    currentReceiptUrl,
    currentEtrNumber,
    variant = "icon",
}: {
    requisitionId: string;
    requisitionTitle?: string;
    currentReceiptUrl?: string | null;
    currentEtrNumber?: string | null;
    variant?: "icon" | "full";
}) {
    const router = useRouter();
    const { showToast } = useToast();
    const fileRef = useRef<HTMLInputElement>(null);

    const [isOpen, setIsOpen] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
    const [fileName, setFileName] = useState<string>("");
    const [fileType, setFileType] = useState<string>("");
    const [etrNumber, setEtrNumber] = useState("");
    const [etrVerified, setEtrVerified] = useState(false);

    useEffect(() => setMounted(true), []);

    const isReplacing = !!currentReceiptUrl;

    const open = () => {
        setUploadedUrl(null);
        setFileName("");
        setFileType("");
        setEtrNumber(currentEtrNumber || "");
        setEtrVerified(false);
        setIsOpen(true);
    };

    const close = () => {
        if (isUploading || isSaving) return;
        setIsOpen(false);
    };

    const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!ACCEPTED.split(",").includes(file.type)) {
            showToast("Only JPG, PNG or PDF files are accepted", "error");
            if (fileRef.current) fileRef.current.value = "";
            return;
        }
        if (file.size > MAX_BYTES) {
            showToast("That file is larger than 10MB", "error");
            if (fileRef.current) fileRef.current.value = "";
            return;
        }

        setIsUploading(true);
        try {
            const fd = new FormData();
            fd.append("file", file);
            const res = await fetch("/api/upload", { method: "POST", body: fd });
            const data = await res.json();
            if (!res.ok || !data.url) {
                showToast(data.error || "Upload failed", "error");
                return;
            }
            setUploadedUrl(data.url);
            setFileName(file.name);
            setFileType(file.type);
        } catch {
            showToast("Could not reach the server — upload failed", "error");
        } finally {
            setIsUploading(false);
            if (fileRef.current) fileRef.current.value = "";
        }
    };

    const save = async () => {
        if (!uploadedUrl) return;
        setIsSaving(true);
        try {
            const fd = new FormData();
            fd.append("requisitionId", requisitionId);
            fd.append("receiptUrl", uploadedUrl);
            if (etrNumber.trim()) {
                fd.append("etrNumber", etrNumber.trim());
                fd.append("etrVerified", String(etrVerified));
            }
            const result = await attachRequisitionReceipt(fd);
            if (result?.success) {
                showToast(result.message || "Receipt attached", "success");
                setIsOpen(false);
                router.refresh();
            } else {
                showToast(result?.message || "Could not attach receipt", "error");
            }
        } catch {
            showToast("Something went wrong attaching the receipt", "error");
        } finally {
            setIsSaving(false);
        }
    };

    const trigger = variant === "icon" ? (
        <button
            onClick={open}
            className="p-1.5 rounded-md hover:bg-indigo-50 text-slate-400 hover:text-[#6366F1] transition-all"
            title={isReplacing ? "Replace receipt" : "Attach receipt"}
        >
            <PiPaperclip className="text-base" />
        </button>
    ) : (
        <button
            onClick={open}
            className="inline-flex items-center gap-1.5 px-3 py-[7px] rounded-[6px] text-[12.5px] font-[500] text-[#6366F1] bg-white hover:bg-indigo-50 transition-colors"
            style={{ border: '1px solid rgba(99,102,241,0.25)' }}
        >
            <PiPaperclip className="text-[13px]" />
            {isReplacing ? "Replace receipt" : "Attach receipt"}
        </button>
    );

    const modal = mounted && isOpen ? createPortal(
        <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4"
            style={{ background: 'rgba(15,23,42,0.35)', backdropFilter: 'blur(2px)' }}
            onClick={close}>
            <div className="w-full max-w-[460px] bg-white rounded-[10px] overflow-hidden"
                style={{ boxShadow: '0 20px 50px rgba(0,0,0,0.18)' }}
                onClick={e => e.stopPropagation()}>

                <div className="px-5 py-4 flex items-start justify-between" style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                    <div className="min-w-0">
                        <h2 className="text-[14px] font-[600] text-gray-900 leading-none">
                            {isReplacing ? "Replace receipt" : "Attach receipt"}
                        </h2>
                        <p className="text-[12px] text-gray-400 mt-1 truncate">
                            {requisitionTitle || "This expense"}
                        </p>
                    </div>
                    <button onClick={close} className="p-1 text-gray-300 hover:text-gray-500 rounded-[5px] transition-colors shrink-0">
                        <PiX className="text-[15px]" />
                    </button>
                </div>

                <div className="px-5 py-5 space-y-4">
                    {isReplacing && !uploadedUrl && (
                        <div className="rounded-[7px] px-3 py-2.5 bg-amber-50/60 flex items-start gap-2"
                            style={{ border: '1px solid rgba(245,158,11,0.22)' }}>
                            <PiCheckCircle className="text-amber-600 text-[13px] mt-[1px] shrink-0" />
                            <p className="text-[11.5px] text-gray-600 leading-snug">
                                A receipt is already attached.{" "}
                                <a href={getReceiptViewerUrl(currentReceiptUrl!)} target="_blank" rel="noopener noreferrer"
                                    className="text-[#6366F1] font-[500] hover:underline">View it</a>
                                {" "}— uploading a new one replaces it.
                            </p>
                        </div>
                    )}

                    <input ref={fileRef} type="file" accept={ACCEPTED} className="hidden"
                        id={`receipt-input-${requisitionId}`} onChange={handleFile} />

                    {!uploadedUrl ? (
                        <label htmlFor={`receipt-input-${requisitionId}`}
                            className={cn(
                                "flex items-center gap-3.5 p-4 rounded-[7px] border border-dashed transition-colors group",
                                isUploading ? "cursor-wait opacity-70" : "cursor-pointer hover:bg-indigo-50/40"
                            )}
                            style={{ borderColor: 'rgba(99,102,241,0.28)' }}>
                            <div className="w-9 h-9 rounded-[6px] bg-indigo-50 flex items-center justify-center shrink-0 group-hover:bg-indigo-100 transition-colors">
                                <PiUploadSimple className="text-[#6366F1] text-lg" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[13px] font-[500] text-gray-700">
                                    {isUploading ? "Uploading…" : "Choose a receipt to upload"}
                                </p>
                                <p className="text-[11.5px] text-gray-400 mt-0.5">JPG, PNG or PDF — up to 10MB</p>
                            </div>
                        </label>
                    ) : (
                        <div className="flex items-center gap-3 p-3 rounded-[7px] bg-emerald-50/50"
                            style={{ border: '1px solid rgba(16,185,129,0.22)' }}>
                            <div className="w-9 h-9 rounded-[6px] bg-white flex items-center justify-center shrink-0"
                                style={INPUT_STYLE}>
                                {fileType === "application/pdf"
                                    ? <PiFilePdf className="text-rose-500 text-lg" />
                                    : <PiImage className="text-[#6366F1] text-lg" />}
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-[12.5px] font-[500] text-gray-800 truncate">{fileName}</p>
                                <p className="text-[11.5px] text-emerald-600 mt-0.5">Uploaded — not saved yet</p>
                            </div>
                            <a href={getReceiptViewerUrl(uploadedUrl)} target="_blank" rel="noopener noreferrer"
                                className="text-[11.5px] text-[#6366F1] font-[500] hover:underline shrink-0">
                                Preview
                            </a>
                            <button onClick={() => { setUploadedUrl(null); setFileName(""); setFileType(""); }}
                                title="Remove"
                                className="p-1 text-gray-300 hover:text-rose-500 rounded-[5px] transition-colors shrink-0">
                                <PiTrashSimple className="text-[13px]" />
                            </button>
                        </div>
                    )}

                    <div>
                        <label className={LABEL_CLASS}>
                            ETR / eTIMS number <span className="text-gray-300 font-[400]">(optional)</span>
                        </label>
                        <EtrReceiptInput
                            value={etrNumber}
                            onChange={setEtrNumber}
                            onVerified={(verified) => setEtrVerified(verified)}
                            expenseId={requisitionId}
                        />
                    </div>
                </div>

                <div className="px-5 py-3.5 flex items-center justify-end gap-2 bg-gray-50/60"
                    style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                    <button onClick={close} disabled={isUploading || isSaving}
                        className="px-3 py-[7px] rounded-[6px] text-[12.5px] font-[500] text-gray-500 hover:bg-gray-100 transition-colors disabled:opacity-50">
                        Cancel
                    </button>
                    <button onClick={save} disabled={!uploadedUrl || isUploading || isSaving}
                        className="px-3.5 py-[7px] rounded-[6px] text-[12.5px] font-[500] text-white bg-[#6366F1] hover:bg-[#5457E5] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                        {isSaving ? "Saving…" : isReplacing ? "Replace receipt" : "Attach receipt"}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    ) : null;

    return <>{trigger}{modal}</>;
}
