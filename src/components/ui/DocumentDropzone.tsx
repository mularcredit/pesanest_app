import React, { useState } from 'react';
import { PiCheckCircle, PiUpload, PiTrash, PiFileText, PiArrowUpRight } from 'react-icons/pi';

interface DocumentDropzoneProps {
    file: File | string | null;
    onFileChange: (file: File | null) => void;
    label?: string;
    description?: string;
    isUploading?: boolean;
}

export function DocumentDropzone({ 
    file, 
    onFileChange, 
    label = "Document", 
    description = "PDF, JPG or PNG accepted",
    isUploading = false 
}: DocumentDropzoneProps) {
    // If file is a string, we treat it as an existing uploaded URL
    const isUrl = typeof file === 'string';
    const fileName = isUrl ? file.split('/').pop() : file?.name;

    if (file) {
        return (
            <div className="border border-emerald-100 bg-emerald-50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                        <PiCheckCircle className="text-emerald-500 text-2xl shrink-0" />
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-emerald-800">{label} attached</p>
                            <p className="text-[10px] text-emerald-600 truncate mt-0.5">{fileName}</p>
                        </div>
                    </div>
                    {isUrl && (
                        <a
                            href={file}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0 px-3 py-1.5 bg-emerald-600 text-white text-xs font-medium rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-1"
                        >
                            Open <PiArrowUpRight />
                        </a>
                    )}
                </div>
                {/* Actions */}
                <div className="flex gap-2">
                    <label className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs border border-emerald-200 bg-[var(--sidebar)] rounded-xl text-emerald-700 hover:bg-emerald-50 cursor-pointer transition-colors ">
                        <PiUpload className="text-sm" /> Replace
                        <input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            className="hidden"
                            onChange={(e) => {
                                if (e.target.files?.[0]) onFileChange(e.target.files[0]);
                            }}
                        />
                    </label>
                    <button
                        type="button"
                        onClick={() => onFileChange(null)}
                        className="px-3 py-2 text-xs border border-rose-100 bg-[var(--sidebar)] rounded-xl text-rose-500 hover:bg-rose-50 transition-colors flex items-center gap-1 "
                        title="Remove document"
                    >
                        <PiTrash /> Remove
                    </button>
                </div>
            </div>
        );
    }

    return (
        <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-[var(--p-line)] rounded-xl p-6 cursor-pointer hover:border-[var(--p)] hover:bg-[var(--p)]/5 transition-all w-full">
            <PiUpload className="text-3xl text-[var(--t-muted)]" />
            <span className="text-xs font-medium text-[var(--t2)] text-center">
                <span>Click to upload {label.toLowerCase()}</span><br />
                <span className="text-[var(--t-muted)] text-[10px]">{description}</span>
            </span>
            <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                className="hidden"
                onChange={(e) => {
                    if (e.target.files?.[0]) onFileChange(e.target.files[0]);
                }}
                disabled={isUploading}
            />
            {isUploading && (
                <div className="flex items-center gap-2 text-xs text-[var(--p)] font-medium mt-2">
                    <span className="w-3.5 h-3.5 border-2 border-[var(--p)]/30 border-t-[var(--p)] rounded-full animate-spin" /> Uploading...
                </div>
            )}
        </label>
    );
}
