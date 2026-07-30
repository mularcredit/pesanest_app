"use client";

import React, { useRef, useState, useEffect } from 'react';

interface EditableImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
    settingKey: string;
    defaultSrc: string;
    onUploadSuccess?: (newUrl: string) => void;
}

export const EditableImage: React.FC<EditableImageProps> = ({ 
    settingKey, 
    defaultSrc, 
    onUploadSuccess,
    className,
    style,
    alt,
    ...props 
}) => {
    const [src, setSrc] = useState(defaultSrc);
    const [isHovering, setIsHovering] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Fetch the saved setting on mount
    useEffect(() => {
        const fetchSetting = async () => {
            try {
                const res = await fetch(`/api/settings?keys=${settingKey}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data[settingKey]) {
                        setSrc(data[settingKey]);
                        if (onUploadSuccess) {
                            onUploadSuccess(data[settingKey]);
                        }
                    }
                }
            } catch (error) {
                console.error("Failed to fetch image setting:", error);
            }
        };

        fetchSetting();
    }, [settingKey, onUploadSuccess]);

    const handleImageClick = () => {
        if (!isUploading) {
            fileInputRef.current?.click();
        }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);

        try {
            // 1. Upload the file
            const formData = new FormData();
            formData.append('file', file);

            const uploadRes = await fetch('/api/upload', {
                method: 'POST',
                body: formData,
            });

            if (!uploadRes.ok) {
                throw new Error("File upload failed");
            }

            const uploadData = await uploadRes.json();
            const newUrl = uploadData.url;

            // 2. Save the new URL to settings
            const settingsRes = await fetch('/api/settings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    updates: [
                        { key: settingKey, value: newUrl }
                    ]
                }),
            });

            if (!settingsRes.ok) {
                throw new Error("Failed to save setting");
            }

            // 3. Update local state
            setSrc(newUrl);
            if (onUploadSuccess) {
                onUploadSuccess(newUrl);
            }

        } catch (error) {
            console.error("Error updating image:", error);
            alert("Failed to update image. Please try again.");
        } finally {
            setIsUploading(false);
            // Reset input so the same file can be selected again if needed
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const isRemoved = src === '__REMOVE__';

    const handleRemoveClick = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm("Are you sure you want to remove this image? It will be hidden in the final document.")) {
            setIsUploading(true);
            try {
                const settingsRes = await fetch('/api/settings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        updates: [{ key: settingKey, value: '__REMOVE__' }]
                    }),
                });

                if (!settingsRes.ok) throw new Error("Failed to save setting");

                setSrc('__REMOVE__');
                if (onUploadSuccess) onUploadSuccess('__REMOVE__');
            } catch (error) {
                console.error("Error removing image:", error);
                alert("Failed to remove image.");
            } finally {
                setIsUploading(false);
            }
        }
    };

    return (
        <div 
            className={`group relative cursor-pointer print:!cursor-auto overflow-hidden transition-all duration-200 ${isRemoved ? 'border-2 border-dashed border-slate-300 rounded-lg flex items-center justify-center bg-slate-50 hover:bg-slate-100 min-h-[40px] px-4 print:hidden' : 'hover:ring-2 hover:ring-[#236A9E] rounded'} ${className || ''}`}
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
            onClick={handleImageClick}
            style={{ ...style }}
        >
            <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                accept="image/png, image/jpeg, image/jpg" 
                className="hidden" 
            />
            
            {isRemoved ? (
                <div className="flex flex-col items-center gap-1 py-2 text-slate-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    <span className="text-[10px] font-bold uppercase tracking-wider">Add Logo</span>
                </div>
            ) : (
                <img 
                    src={src} 
                    alt={alt || "Editable Graphic"} 
                    className={`w-full h-full object-contain transition-opacity duration-200 ${isUploading ? 'opacity-50' : 'opacity-100'}`}
                    {...props} 
                />
            )}

            {/* Hover Actions - hidden when printing */}
            {!isUploading && isHovering && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center gap-4 transition-opacity duration-200 print:hidden z-10">
                    {/* Change Action */}
                    <div title="Change Image" className="p-2 bg-white/20 hover:bg-white/40 rounded-full transition-colors">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                    </div>

                    {/* Remove Action */}
                    {!isRemoved && (
                        <div 
                            title="Remove Image" 
                            onClick={handleRemoveClick}
                            className="p-2 bg-rose-500/20 hover:bg-rose-500/40 rounded-full transition-colors group/trash"
                        >
                            <svg className="w-5 h-5 text-white group-hover/trash:text-rose-200" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </div>
                    )}
                </div>
            )}

            {/* Loading Spinner */}
            {isUploading && (
                <div className="absolute inset-0 flex items-center justify-center print:hidden z-10">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                </div>
            )}
        </div>
    );
};
