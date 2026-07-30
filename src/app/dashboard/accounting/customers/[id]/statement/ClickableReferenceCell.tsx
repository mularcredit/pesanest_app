'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import {
    PiFileText, PiUpload, PiX, PiCheckCircle,
    PiPencilSimple, PiCalendar, PiMoney, PiArrowUpRight,
    PiTrash, PiWarning
} from 'react-icons/pi';

interface Props {
    type: 'INVOICE' | 'PAYMENT' | 'CREDIT_NOTE';
    id: string;
    reference: string;
    saleId?: string | null;
    invoiceUrl?: string | null;
    date?: Date | string;
    description?: string;
    amount?: number;
    currency?: string;
}

const fmt = (amount: number, currency = 'KES') =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);

export function ClickableReferenceCell({
    type, id, reference, saleId,
    invoiceUrl: serverInvoiceUrl,
    date, description, amount, currency = 'KES'
}: Props) {
    const [showModal, setShowModal] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadFile, setUploadFile] = useState<File | null>(null);
    const [replacing, setReplacing] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    // Local copy of the URL — only changes on successful upload or when server sends one
    const [invoiceUrl, setInvoiceUrl] = useState<string | null>(serverInvoiceUrl ?? null);
    const [mounted, setMounted] = useState(false);

    // Needed for createPortal (SSR safety)
    useEffect(() => { setMounted(true); }, []);

    // If the server sends a URL (page reload after previous upload), accept it
    useEffect(() => {
        if (serverInvoiceUrl) setInvoiceUrl(serverInvoiceUrl);
    }, [serverInvoiceUrl]);

    const linkedSaleId = type === 'INVOICE' ? id : saleId;
    const hasLinkedInvoice = !!linkedSaleId;

    const badgeColor =
        type === 'INVOICE' ? 'border-indigo-100 text-indigo-600 hover:bg-indigo-50 hover:border-indigo-300' :
        type === 'PAYMENT' && hasLinkedInvoice ? 'border-emerald-100 text-emerald-600 hover:bg-emerald-50 hover:border-emerald-300' :
        type === 'PAYMENT' ? 'border-amber-100 text-amber-600 hover:bg-amber-50 hover:border-amber-300' :
        'border-purple-100 text-purple-600 hover:bg-purple-50 hover:border-purple-300';

    const formattedDate = date
        ? new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
        : '—';

    const closeModal = () => {
        if (!uploading) {
            setShowModal(false);
            setUploadFile(null);
            setReplacing(false);
        }
    };

    const handleUpload = async () => {
        if (!uploadFile || uploading) return;
        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', uploadFile);
            formData.append('id', id);
            formData.append('type', type);
            formData.append('reference', reference);

            const res = await fetch('/api/customers/upload-invoice', { method: 'POST', body: formData });

            if (res.ok) {
                const data = await res.json();
                // Update local state immediately — no router.refresh() which resets state
                setInvoiceUrl(data.url);
                setReplacing(false);
                setUploadFile(null);
                setShowModal(false);
            } else {
                const err = await res.json().catch(() => ({ error: 'Unknown error' }));
                alert(`Upload failed: ${err.error}`);
            }
        } catch (err) {
            alert('Network error during upload. Please try again.');
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async () => {
        setDeleting(true);
        try {
            const res = await fetch('/api/customers/upload-invoice', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, type, fileUrl: invoiceUrl })
            });
            if (res.ok) {
                setInvoiceUrl(null);
                setConfirmDelete(false);
                setShowModal(false);
            } else {
                const err = await res.json().catch(() => ({ error: 'Unknown error' }));
                alert(`Delete failed: ${err.error}`);
            }
        } catch {
            alert('Network error. Please try again.');
        } finally {
            setDeleting(false);
        }
    };

    const headerBg = hasLinkedInvoice
        ? 'bg-gradient-to-r from-[#6366F1]/5 to-indigo-50'
        : 'bg-gradient-to-r from-amber-50 to-orange-50';

    const iconBg = hasLinkedInvoice ? 'bg-[#6366F1]/10' : 'bg-amber-100';
    const iconColor = hasLinkedInvoice ? 'text-[#6366F1]' : 'text-amber-500';

    const modal = mounted && showModal ? createPortal(
        /* Backdrop — rendered directly at document.body, z-index beats everything */
        <div
            style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            className="bg-black/30"
            onClick={closeModal}
        >
            <div
                style={{ position: 'relative', zIndex: 10000, border: '1px solid rgba(0,0,0,0.09)', boxShadow: '0 8px 40px rgba(0,0,0,0.12)' }}
                className="bg-white rounded-[12px] w-full max-w-md mx-4 overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className={`p-5 flex items-start justify-between ${headerBg}`}>
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconBg}`}>
                            <PiFileText className={`text-xl ${iconColor}`} />
                        </div>
                        <div>
                            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
                                {type === 'INVOICE' ? 'Invoice' : type === 'PAYMENT' ? 'Payment Reference' : 'Credit Note'}
                            </p>
                            <h3 className="font-semibold text-gray-900 font-mono text-sm">{reference}</h3>
                        </div>
                    </div>
                    <button
                        onClick={closeModal}
                        className="text-gray-400 hover:text-gray-700 p-1 hover:bg-white/70 rounded-lg transition-colors"
                    >
                        <PiX className="text-xl" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-5">
                    {/* ── If invoice doc already exists ── */}
                    {invoiceUrl && !replacing ? (
                        <>
                            {/* Details grid */}
                            <div className="grid grid-cols-2 gap-3 mb-4">
                                <div className="bg-gray-50 rounded-xl p-3">
                                    <div className="flex items-center gap-1.5 mb-1">
                                        <PiCalendar className="text-gray-400 text-xs" />
                                        <span className="text-[10px] font-semibold text-gray-400 uppercase">Date</span>
                                    </div>
                                    <p className="text-sm font-semibold text-gray-800">{formattedDate}</p>
                                </div>
                                <div className="bg-gray-50 rounded-xl p-3">
                                    <div className="flex items-center gap-1.5 mb-1">
                                        <PiMoney className="text-gray-400 text-xs" />
                                        <span className="text-[10px] font-semibold text-gray-400 uppercase">Amount</span>
                                    </div>
                                    <p className="text-sm font-semibold text-gray-900">{amount ? fmt(amount, currency) : '—'}</p>
                                </div>
                            </div>

                            {/* Document available banner */}
                            <div className="border border-emerald-100 bg-emerald-50 rounded-xl p-4 flex items-center gap-3 mb-4">
                                <PiCheckCircle className="text-emerald-500 text-2xl shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-semibold text-emerald-800">Invoice Document Available</p>
                                    <p className="text-[10px] text-emerald-600 truncate mt-0.5">{invoiceUrl.split('/').pop()}</p>
                                </div>
                                <a
                                    href={invoiceUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="shrink-0 px-3 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-1"
                                >
                                    Open <PiArrowUpRight />
                                </a>
                            </div>

                            {/* Delete confirmation inline */}
                            {confirmDelete && (
                                <div className="border border-red-100 bg-red-50 rounded-xl p-4 mb-4 flex items-start gap-3">
                                    <PiWarning className="text-red-500 text-xl shrink-0 mt-0.5" />
                                    <div className="flex-1">
                                        <p className="text-xs font-semibold text-red-800 mb-1">Delete this document?</p>
                                        <p className="text-[10px] text-red-600 mb-3">This will permanently remove the uploaded file and cannot be undone.</p>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => setConfirmDelete(false)}
                                                className="flex-1 py-1.5 text-xs border border-red-200 rounded-lg text-red-600 hover:bg-red-100 transition-colors"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={handleDelete}
                                                disabled={deleting}
                                                className="flex-1 py-1.5 text-xs font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                                            >
                                                {deleting ? <><span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Deleting…</> : <><PiTrash /> Yes, Delete</>}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Actions */}
                            <div className="flex gap-2">
                                {hasLinkedInvoice && (
                                    <Link
                                        href={`/dashboard/accounting/sales/${linkedSaleId}`}
                                        className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors"
                                        onClick={closeModal}
                                    >
                                        <PiPencilSimple /> Edit <PiArrowUpRight className="text-xs" />
                                    </Link>
                                )}
                                <button
                                    onClick={() => { setReplacing(true); setConfirmDelete(false); }}
                                    className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs border border-gray-200 rounded-xl text-gray-500 hover:bg-gray-50 transition-colors"
                                >
                                    <PiUpload className="text-sm" /> Replace
                                </button>
                                <button
                                    onClick={() => setConfirmDelete(true)}
                                    className="px-3 py-2 text-xs border border-red-100 rounded-xl text-red-500 hover:bg-red-50 transition-colors flex items-center gap-1"
                                    title="Delete document"
                                >
                                    <PiTrash />
                                </button>
                                <button
                                    onClick={closeModal}
                                    className="flex-1 py-2 text-xs font-semibold bg-[#6366F1] text-white rounded-xl hover:bg-[#6366F1]/90 transition-colors"
                                >
                                    Close
                                </button>
                            </div>
                        </>
                    ) : (
                        /* ── Upload prompt ── */
                        <>
                            {!hasLinkedInvoice && (
                                <p className="text-sm text-gray-600 mb-4">No sales invoice is linked to this payment. Upload the relevant invoice document below.</p>
                            )}
                            {hasLinkedInvoice && !replacing && (
                                <div className="grid grid-cols-2 gap-3 mb-4">
                                    <div className="bg-gray-50 rounded-xl p-3">
                                        <div className="flex items-center gap-1.5 mb-1">
                                            <PiCalendar className="text-gray-400 text-xs" />
                                            <span className="text-[10px] font-semibold text-gray-400 uppercase">Date</span>
                                        </div>
                                        <p className="text-sm font-semibold text-gray-800">{formattedDate}</p>
                                    </div>
                                    <div className="bg-gray-50 rounded-xl p-3">
                                        <div className="flex items-center gap-1.5 mb-1">
                                            <PiMoney className="text-gray-400 text-xs" />
                                            <span className="text-[10px] font-semibold text-gray-400 uppercase">Amount</span>
                                        </div>
                                        <p className="text-sm font-semibold text-gray-900">{amount ? fmt(amount, currency) : '—'}</p>
                                    </div>
                                </div>
                            )}

                            {/* Drop zone */}
                            <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-xl p-6 cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/30 transition-all mb-4">
                                <PiUpload className="text-3xl text-gray-400" />
                                <span className="text-xs font-medium text-gray-700 text-center">
                                    {uploadFile
                                        ? <><span className="text-indigo-600 font-semibold">{uploadFile.name}</span><br /><span className="text-gray-400 text-[10px]">Click to change</span></>
                                        : <><span>Click to select file</span><br /><span className="text-gray-400 text-[10px]">PDF, JPG or PNG accepted</span></>
                                    }
                                </span>
                                <input
                                    type="file"
                                    accept=".pdf,.jpg,.jpeg,.png"
                                    className="hidden"
                                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                                />
                            </label>

                            {/* Actions */}
                            <div className="flex gap-3">
                                <button
                                    onClick={closeModal}
                                    className="flex-1 py-2 text-xs border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    disabled={!uploadFile || uploading}
                                    onClick={handleUpload}
                                    className="flex-1 py-2 text-xs font-semibold bg-[#6366F1] text-white rounded-xl hover:bg-[#6366F1]/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {uploading ? (
                                        <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Uploading…</>
                                    ) : 'Upload Document'}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>,
        document.body
    ) : null;

    return (
        <>
            <button
                onClick={() => setShowModal(true)}
                title={invoiceUrl ? 'View uploaded document' : hasLinkedInvoice ? 'View Invoice' : 'No invoice — click to upload'}
            >
                <span className={`px-2 py-1 bg-white border rounded-md font-mono text-[10px] font-semibold transition-colors shadow-sm cursor-pointer select-none ${badgeColor}`}>
                    {reference}
                </span>
            </button>
            {modal}
        </>
    );
}
