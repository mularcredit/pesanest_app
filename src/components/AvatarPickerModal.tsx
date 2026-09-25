"use client";

import { useState } from "react";
import { PiX } from "react-icons/pi";
import NiceAvatar, { genConfig } from "react-nice-avatar";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/ToastProvider";
import { updateAvatar } from "@/app/dashboard/settings/actions";
import { AVATAR_PRESET_SEEDS } from "@/lib/avatar-presets";

const CARD_STYLE: React.CSSProperties = { border: '1px solid rgba(0,0,0,0.09)' };

export function AvatarPickerModal({
    currentSeed,
    onClose,
    onSaved,
}: {
    currentSeed: string;
    onClose: () => void;
    onSaved: (seed: string) => void;
}) {
    const { showToast } = useToast();
    const [selected, setSelected] = useState(currentSeed);
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const result = await updateAvatar(selected);
            if (result.success) {
                onSaved(selected);
                showToast("Avatar updated", "success");
                onClose();
            } else {
                showToast(result.error || "Failed to update avatar", "error");
            }
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={onClose}>
            <div className="bg-white rounded-[10px] w-full max-w-md" style={CARD_STYLE} onClick={(e) => e.stopPropagation()}>
                <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                    <div>
                        <h2 className="text-[13px] font-[600] text-gray-900">Choose your avatar</h2>
                        <p className="text-[11.5px] text-gray-400 mt-0.5">Pick a look that's just for you</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <PiX className="text-[18px]" />
                    </button>
                </div>
                <div className="p-5 grid grid-cols-4 gap-3">
                    {AVATAR_PRESET_SEEDS.map((seed) => (
                        <button
                            key={seed}
                            onClick={() => setSelected(seed)}
                            className={cn(
                                "rounded-[8px] p-1.5 transition-all",
                                selected === seed ? "ring-2 ring-[#6366F1]" : "ring-1 ring-transparent hover:ring-gray-200"
                            )}
                        >
                            <NiceAvatar style={{ width: '100%', aspectRatio: '1/1', borderRadius: '50%' }} {...genConfig(seed)} />
                        </button>
                    ))}
                </div>
                <div className="px-5 py-4 flex justify-end gap-2" style={{ borderTop: '1px solid rgba(0,0,0,0.07)' }}>
                    <button onClick={onClose} className="px-4 py-2 rounded-[6px] text-[12.5px] font-[500] text-gray-600 bg-white hover:bg-gray-50 transition-colors" style={{ border: '1px solid rgba(0,0,0,0.09)' }}>
                        Cancel
                    </button>
                    <button onClick={handleSave} disabled={isSaving}
                        className="px-4 py-2 rounded-[6px] text-[12.5px] font-[500] text-white bg-[#6366F1] hover:bg-indigo-600 transition-colors disabled:opacity-50">
                        {isSaving ? 'Saving…' : 'Save avatar'}
                    </button>
                </div>
            </div>
        </div>
    );
}
