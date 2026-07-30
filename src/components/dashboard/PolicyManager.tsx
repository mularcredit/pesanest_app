"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Policy } from "@/generated/prisma-client";
import {
    PiShieldCheck,
    PiShieldWarning,
    PiPlus,
    PiTrash,
    PiToggleRight,
    PiToggleLeft,
    PiReceipt,
    PiClock,
    PiListBullets,
    PiStorefront,
    PiX,
    PiCheck,
    PiArrowRight
} from "react-icons/pi";
import { cn } from "@/lib/utils";
import { togglePolicy, deletePolicy, createPolicy } from "@/app/dashboard/policies/actions";
import { useToast } from "@/components/ui/ToastProvider";
import { useRouter } from "next/navigation";

interface PolicyManagerProps {
    policies: Policy[];
}

const CARD_STYLE: React.CSSProperties = { border: '1px solid rgba(0,0,0,0.09)' };

// Pre-defined policy templates
const POLICY_TEMPLATES = [
    {
        name: "Expense Receipt Required",
        description: "Require receipts for all expenses over KES 50",
        type: "RECEIPT_REQUIREMENT",
        rules: { threshold: 50 },
        icon: PiReceipt,
        color: "blue"
    },
    {
        name: "Daily Spending Limit",
        description: "Maximum KES 500 per day per employee",
        type: "SPENDING_LIMIT",
        rules: { maxAmount: 500, isBlocking: true },
        icon: PiShieldCheck,
        color: "emerald"
    },
    {
        name: "Weekend Restriction",
        description: "Block expense submissions on weekends",
        type: "TIME_LIMIT",
        rules: { blockWeekends: true, blockAfterHours: false },
        icon: PiClock,
        color: "purple"
    },
    {
        name: "High-Value Approval",
        description: "Expenses over KES 1,000 require manager approval",
        type: "SPENDING_LIMIT",
        rules: { maxAmount: 1000, isBlocking: true },
        icon: PiShieldCheck,
        color: "orange"
    },
    {
        name: "Auto-Approval Threshold",
        description: "Small expenses under KES 50 are auto-approved without manual review",
        type: "AUTO_APPROVAL",
        rules: { amountMax: 50 },
        icon: PiShieldCheck,
        color: "blue"
    },
    {
        name: "Vendor Blacklist",
        description: "Block expenses from gambling and casino vendors",
        type: "VENDOR_RESTRICTION",
        rules: { blockedVendors: ["Casino", "Gambling", "Lottery"] },
        icon: PiStorefront,
        color: "rose"
    },
    {
        name: "Prohibited Keywords",
        description: "Block expenses containing prohibited items (alcohol, luxury goods, etc.)",
        type: "KEYWORD_RESTRICTION",
        rules: { prohibitedKeywords: ["alcohol", "wine", "beer", "spa", "gym", "jewelry"] },
        icon: PiShieldWarning,
        color: "rose"
    }
];

export function PolicyManager({ policies }: PolicyManagerProps) {
    const { showToast } = useToast();
    const router = useRouter();
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState<typeof POLICY_TEMPLATES[0] | null>(null);
    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'SPENDING_LIMIT': return PiReceipt;
            case 'RECEIPT_REQUIREMENT': return PiReceipt;
            case 'TIME_LIMIT': return PiClock;
            case 'VENDOR_RESTRICTION': return PiStorefront;
            case 'KEYWORD_RESTRICTION': return PiShieldWarning;
            case 'AUTO_APPROVAL': return PiCheck;
            default: return PiListBullets;
        }
    };

    const getColorClass = (color: string) => {
        const colors: Record<string, string> = {
            blue: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
            emerald: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
            purple: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
            orange: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
            rose: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
            cyan: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20'
        };
        return colors[color] || colors.blue;
    };

    const handleToggle = async (policy: Policy) => {
        const result = await togglePolicy(policy.id, policy.isActive);
        if (result.success) {
            showToast(policy.isActive ? "Policy deactivated" : "Policy activated", "success");
            router.refresh();
        } else {
            showToast("Failed to update policy", "error");
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this policy?")) return;
        const result = await deletePolicy(id);
        if (result.success) {
            showToast("Policy deleted", "success");
            router.refresh();
        } else {
            showToast("Failed to delete policy", "error");
        }
    };

    const [configValue, setConfigValue] = useState<string>("");

    const handleActivateTemplate = async (template: typeof POLICY_TEMPLATES[0]) => {
        const formData = new FormData();
        formData.append('name', template.name);
        formData.append('description', template.description);
        formData.append('type', template.type);

        // Merge custom config value back into rules
        const finalRules = { ...template.rules };
        if (template.type === 'AUTO_APPROVAL' && configValue) {
            (finalRules as any).amountMax = parseFloat(configValue);
        } else if (template.type === 'RECEIPT_REQUIREMENT' && configValue) {
            (finalRules as any).threshold = parseFloat(configValue);
        } else if (template.type === 'SPENDING_LIMIT' && configValue) {
            (finalRules as any).maxAmount = parseFloat(configValue);
        } else if (template.type === 'KEYWORD_RESTRICTION' && configValue) {
            (finalRules as any).prohibitedKeywords = configValue.split(',').map(s => s.trim()).filter(s => s.length > 0);
        }

        formData.append('rules', JSON.stringify(finalRules));

        const result = await createPolicy(formData);
        if (result.success) {
            showToast("Policy activated successfully", "success");
            setIsCreateOpen(false);
            setSelectedTemplate(null);
            setConfigValue("");
            router.refresh();
        } else {
            showToast(result.error || "Failed to activate policy", "error");
        }
    };

    const modal = (mounted && isCreateOpen) ? createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/30" onClick={() => { setIsCreateOpen(false); setSelectedTemplate(null); }} />
            <div className="relative bg-white w-full max-w-3xl rounded-[12px] flex flex-col max-h-[90vh] overflow-hidden"
                style={{ border: '1px solid rgba(0,0,0,0.09)', boxShadow: '0 8px 40px rgba(0,0,0,0.12)' }}>

                {/* Header */}
                <div className="px-6 py-4 flex items-center justify-between shrink-0"
                    style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-[7px] bg-indigo-50 flex items-center justify-center text-[#6366F1]">
                            <PiShieldCheck className="text-[16px]" />
                        </div>
                        <div>
                            <h3 className="text-[14px] font-[600] text-gray-900">
                                {selectedTemplate ? 'Configure Policy' : 'Select Policy Template'}
                            </h3>
                            <p className="text-[11.5px] text-gray-400 mt-0.5">
                                {selectedTemplate ? 'Adjust settings before activating' : 'Choose a pre-configured policy to activate'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => { setIsCreateOpen(false); setSelectedTemplate(null); }}
                        className="p-1.5 rounded-[6px] text-gray-400 hover:bg-gray-50 hover:text-gray-700 transition-colors"
                    >
                        <PiX className="text-[16px]" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-6 py-5">
                    {!selectedTemplate ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {POLICY_TEMPLATES.map((template, idx) => {
                                const Icon = template.icon;
                                return (
                                    <button
                                        key={idx}
                                        onClick={() => {
                                            setSelectedTemplate(template);
                                            if (template.type === 'AUTO_APPROVAL') setConfigValue("50");
                                            else if (template.type === 'RECEIPT_REQUIREMENT') setConfigValue("50");
                                            else if (template.type === 'SPENDING_LIMIT') setConfigValue("500");
                                            else if (template.type === 'KEYWORD_RESTRICTION') setConfigValue((template.rules as any).prohibitedKeywords.join(', '));
                                        }}
                                        className="bg-white rounded-[8px] p-4 text-left hover:bg-gray-50 transition-colors group"
                                        style={{ border: '1px solid rgba(0,0,0,0.09)' }}
                                    >
                                        <div className="flex items-start gap-3 mb-3">
                                            <div className={`w-8 h-8 rounded-[7px] flex items-center justify-center shrink-0 ${getColorClass(template.color)}`}>
                                                <Icon className="text-[15px]" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h3 className="text-[13px] font-[600] text-gray-900 mb-0.5">{template.name}</h3>
                                                <p className="text-[11.5px] text-gray-400 leading-relaxed">{template.description}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between pt-3"
                                            style={{ borderTop: '1px solid rgba(0,0,0,0.07)' }}>
                                            <span className="text-[10px] font-[500] text-gray-400 uppercase tracking-[0.06em]">
                                                {template.type.replace(/_/g, ' ')}
                                            </span>
                                            <span className="text-[11.5px] text-[#6366F1] font-[500] flex items-center gap-1">
                                                Configure <PiArrowRight className="text-[12px]" />
                                            </span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="max-w-md mx-auto">
                            <div className="flex items-center gap-3 mb-6">
                                <div className={`w-9 h-9 rounded-[7px] flex items-center justify-center ${getColorClass(selectedTemplate.color)}`}>
                                    {(() => { const Icon = selectedTemplate.icon; return <Icon className="text-[16px]" />; })()}
                                </div>
                                <div>
                                    <h4 className="text-[13px] font-[600] text-gray-900">{selectedTemplate.name}</h4>
                                    <p className="text-[11.5px] text-gray-400">{selectedTemplate.type.replace(/_/g, ' ')}</p>
                                </div>
                            </div>

                            <div>
                                <label className="block text-[11.5px] font-[500] text-gray-400 mb-1.5">
                                    {selectedTemplate.type === 'AUTO_APPROVAL' ? 'Threshold Amount (KES)' :
                                        selectedTemplate.type === 'RECEIPT_REQUIREMENT' ? 'Threshold Amount (KES)' :
                                        selectedTemplate.type === 'SPENDING_LIMIT' ? 'Daily Limit (KES)' :
                                        selectedTemplate.type === 'KEYWORD_RESTRICTION' ? 'Prohibited Keywords' : 'Limit Value'}
                                </label>
                                <div>
                                    <input
                                        type={selectedTemplate.type === 'KEYWORD_RESTRICTION' ? 'text' : 'number'}
                                        value={configValue}
                                        onChange={(e) => setConfigValue(e.target.value)}
                                        className={`w-full px-3 py-[10px] rounded-[6px] text-[13px] text-gray-900 placeholder:text-gray-300 outline-none focus:ring-1 focus:ring-[#6366F1] transition-colors bg-white`}
                                        style={{ border: '1px solid rgba(0,0,0,0.09)' }}
                                        placeholder={selectedTemplate.type === 'KEYWORD_RESTRICTION' ? "alcohol, wine, beer..." : "0"}
                                    />
                                </div>
                                <p className="mt-1.5 text-[10.5px] text-gray-400">
                                    {selectedTemplate.type === 'AUTO_APPROVAL' ? 'Expenses below this amount will skip manager approval entirely.' :
                                        'This value will be used to enforce the policy rules.'}
                                </p>
                            </div>

                            <div className="mt-8 flex gap-3">
                                <button
                                    onClick={() => setSelectedTemplate(null)}
                                    className="flex-1 px-4 py-2 rounded-[6px] text-[12.5px] font-[500] text-gray-600 bg-white hover:bg-gray-50 transition-colors"
                                    style={{ border: '1px solid rgba(0,0,0,0.09)' }}
                                >
                                    Back
                                </button>
                                <button
                                    onClick={() => handleActivateTemplate(selectedTemplate)}
                                    className="flex-[2] px-4 py-2 rounded-[6px] text-[12.5px] font-[500] text-white bg-[#6366F1] hover:bg-indigo-600 transition-colors"
                                >
                                    Activate Policy
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 flex items-center justify-between shrink-0"
                    style={{ borderTop: '1px solid rgba(0,0,0,0.07)' }}>
                    <p className="text-[11.5px] text-gray-400">
                        You can modify or deactivate policies anytime.
                    </p>
                    <button
                        onClick={() => { setIsCreateOpen(false); setSelectedTemplate(null); }}
                        className="px-4 py-2 rounded-[6px] text-[12.5px] font-[500] text-gray-600 bg-white hover:bg-gray-50 transition-colors"
                        style={{ border: '1px solid rgba(0,0,0,0.09)' }}
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>,
        document.body
    ) : null;

    return (
        <div className="space-y-5">
            <div className="flex justify-end">
                <button
                    onClick={() => setIsCreateOpen(true)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-[6px] text-[12.5px] font-[500] bg-[#6366F1] text-white hover:bg-indigo-600 transition-colors"
                >
                    <PiPlus className="text-[14px]" />
                    Add Policy
                </button>
            </div>

            {policies.length === 0 ? (
                <div className="bg-white rounded-[8px] py-20 flex flex-col items-center" style={CARD_STYLE}>
                    <div className="w-10 h-10 rounded-[8px] bg-gray-50 flex items-center justify-center mb-3"
                        style={{ border: '1px solid rgba(0,0,0,0.07)' }}>
                        <PiShieldCheck className="text-gray-300 text-xl" />
                    </div>
                    <p className="text-[13px] font-[500] text-gray-700">No policies configured</p>
                    <p className="text-[12px] text-gray-400 mt-0.5">Add a policy template to start enforcing spend controls.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {policies.map(policy => {
                        const Icon = getTypeIcon(policy.type);
                        return (
                            <div key={policy.id} className={cn('bg-white rounded-[8px] flex flex-col', !policy.isActive && 'opacity-60')}
                                style={CARD_STYLE}>
                                {/* Card header */}
                                <div className="px-5 py-4 flex items-start justify-between gap-3"
                                    style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className={cn(
                                            'w-8 h-8 rounded-[7px] flex items-center justify-center shrink-0',
                                            policy.isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-400'
                                        )}>
                                            <Icon className="text-[15px]" />
                                        </div>
                                        <div className="min-w-0">
                                            <h3 className="text-[13px] font-[600] text-gray-900 truncate">{policy.name}</h3>
                                            <p className="text-[11.5px] text-gray-400 truncate">{policy.description}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                        <button onClick={() => handleToggle(policy)} className="text-[28px] transition-colors">
                                            {policy.isActive
                                                ? <PiToggleRight className="text-emerald-500" />
                                                : <PiToggleLeft className="text-gray-300" />
                                            }
                                        </button>
                                        <button
                                            onClick={() => handleDelete(policy.id)}
                                            className="p-1.5 hover:bg-rose-50 text-gray-300 hover:text-rose-500 rounded-[5px] transition-colors"
                                        >
                                            <PiTrash className="text-[14px]" />
                                        </button>
                                    </div>
                                </div>

                                {/* Rules preview */}
                                <div className="px-5 py-3" style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                                    <p className="text-[10px] font-[500] uppercase tracking-[0.07em] text-gray-400 mb-1.5">Rules</p>
                                    <code className="block text-[11px] bg-gray-50 px-3 py-2 rounded-[5px] font-mono text-gray-600 truncate"
                                        style={{ border: '1px solid rgba(0,0,0,0.06)' }}>
                                        {policy.rules as string}
                                    </code>
                                </div>

                                {/* Badges */}
                                <div className="px-5 py-3 flex items-center gap-2">
                                    <span className={cn(
                                        'text-[10px] font-[500] px-2 py-0.5 rounded-[4px] uppercase tracking-[0.05em]',
                                        policy.isActive ? 'text-emerald-600 bg-emerald-50' : 'text-gray-500 bg-gray-100'
                                    )} style={{ border: policy.isActive ? '1px solid rgba(16,185,129,0.2)' : '1px solid rgba(0,0,0,0.09)' }}>
                                        {policy.isActive ? 'Active' : 'Inactive'}
                                    </span>
                                    <span className="text-[10px] font-[500] px-2 py-0.5 rounded-[4px] text-blue-600 bg-blue-50 uppercase tracking-[0.05em]"
                                        style={{ border: '1px solid rgba(59,130,246,0.2)' }}>
                                        {policy.type.replace(/_/g, ' ')}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {modal}
        </div>
    );
}
