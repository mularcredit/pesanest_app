"use client";

import { useState } from "react";
import { User } from "@/generated/prisma-client";
import {
    PiUserCircle,
    PiBuilding,
    PiGlobe,
    PiShieldCheck,
    PiBell,
    PiLockKey,
    PiFloppyDisk,
    PiStorefront,
    PiBuildings,
    PiCheck,
    PiToggleRight,
    PiToggleLeft,
    PiCircleNotch,
    PiArrowsClockwise,
    PiLink
} from "react-icons/pi";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/ToastProvider";
import { updateSettings } from "./actions";
import { signOut } from "next-auth/react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { PhoneInput } from "@/components/ui/PhoneInput";
import QuickBooksMapping from "@/components/integrations/QuickBooksMapping";
import { CustomSelect } from "@/components/ui/CustomSelect";

const CARD_STYLE: React.CSSProperties = { border: '1px solid rgba(0,0,0,0.09)' };
const INPUT_CLS = "w-full rounded-[6px] px-3 py-[10px] text-[13px] text-gray-900 placeholder:text-gray-300 outline-none focus:ring-1 focus:ring-[#6366F1] transition-colors bg-white";
const INPUT_STYLE: React.CSSProperties = { border: '1px solid rgba(0,0,0,0.09)' };
const LABEL_CLS = "block text-[11.5px] font-[500] text-gray-400 mb-1.5";

interface SettingsClientProps {
    user: Pick<User, "id" | "name" | "email" | "role" | "department" | "position" | "phoneNumber">;
    organizationSettings?: {
        companyName?: string;
        registrationNumber?: string;
        headquartersAddress?: string;
        enforceRequestClosure?: boolean;
    };
}

export function SettingsClient({ user, organizationSettings }: SettingsClientProps) {
    const { showToast } = useToast();
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const isAdmin = ['SYSTEM_ADMIN', 'FINANCE_APPROVER', 'SUPER_ADMIN', 'ADMIN'].includes(user.role);
    const activeTab = searchParams.get('tab') || (isAdmin ? 'organization' : 'profile');

    const [isSaving, setIsSaving] = useState(false);
    const [timezone, setTimezone] = useState("Africa/Nairobi (EAT) GMT+3");
    const [dateFormat, setDateFormat] = useState("DD/MM/YYYY (24/01/2026)");
    const [currency, setCurrency] = useState("KES - Kenyan Shilling");

    const [formData, setFormData] = useState({
        name: user.name || '',
        phoneNumber: user.phoneNumber || '',
        language: 'English (UK)',
        companyName: organizationSettings?.companyName || (process.env.NEXT_PUBLIC_APP_NAME === "Pesanest" ? 'Pesanest Finance' : 'CapitalPay East Africa Ltd.'),
        registrationNumber: organizationSettings?.registrationNumber || (process.env.NEXT_PUBLIC_APP_NAME === "Pesanest" ? 'PS/2026/001' : 'PVT/2026/009988X'),
        headquartersAddress: organizationSettings?.headquartersAddress || (process.env.NEXT_PUBLIC_APP_NAME === "Pesanest" ? 'Pesanest HQ, Kigali, Rwanda' : 'Prism Towers, 3rd Avenue, Upper Hill, Nairobi, Kenya'),
        notifications: {
            emailAlerts: true,
            pushNotifications: true,
            marketing: false,
            securityAlerts: true
        },
        enforceRequestClosure: organizationSettings?.enforceRequestClosure || false
    });

    const handleInputChange = (field: string, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleNotificationToggle = (key: keyof typeof formData.notifications) => {
        setFormData(prev => ({
            ...prev,
            notifications: { ...prev.notifications, [key]: !prev.notifications[key] }
        }));
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const data = new FormData();
            data.append('name', formData.name);
            data.append('phoneNumber', formData.phoneNumber);
            data.append('language', formData.language);
            if (isAdmin) {
                data.append('companyName', formData.companyName);
                data.append('registrationNumber', formData.registrationNumber);
                data.append('headquartersAddress', formData.headquartersAddress);
                data.append('enforceRequestClosure', String(formData.enforceRequestClosure));
            }
            const result = await updateSettings(data);
            if (result.success) {
                showToast("Settings saved successfully", "success");
            } else {
                showToast(result.error || "Failed to save settings", "error");
            }
        } catch {
            showToast("An unexpected error occurred", "error");
        } finally {
            setIsSaving(false);
        }
    };

    const setActiveTab = (tab: string) => {
        const params = new URLSearchParams(searchParams);
        params.set('tab', tab);
        router.push(`${pathname}?${params.toString()}`, { scroll: false });
    };

    const navBtnCls = (tab: string) => cn(
        'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-[7px] text-[13px] font-[500] transition-all text-left',
        activeTab === tab ? 'bg-indigo-50 text-[#6366F1]' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
    );

    const initials = (user.name || 'U').split(/\s+/).map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();

    const qboConnected = searchParams.get('qbo') === 'connected';

    return (
        <div className="space-y-6 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-[20px] font-[600] text-gray-900 tracking-tight">
                        {isAdmin ? 'System Configuration' : 'Account Settings'}
                    </h1>
                    <p className="text-[12.5px] text-gray-400 mt-0.5">
                        {isAdmin ? 'Manage organization profile and global preferences' : 'Manage your personal profile and security'}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => signOut({ callbackUrl: "/login" })}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-[6px] text-[12.5px] font-[500] text-rose-600 bg-white hover:bg-rose-50 transition-colors"
                        style={{ border: '1px solid rgba(239,68,68,0.2)' }}
                    >
                        <PiLockKey className="text-[14px]" />
                        Sign Out
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-[6px] text-[12.5px] font-[500] text-white bg-[#6366F1] hover:bg-indigo-600 transition-colors disabled:opacity-60"
                    >
                        {isSaving
                            ? <PiCircleNotch className="animate-spin text-[14px]" />
                            : <PiFloppyDisk className="text-[14px]" />
                        }
                        {isSaving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Sidebar */}
                <div className="lg:col-span-3 space-y-3">
                    <div className="bg-white rounded-[8px] p-2 space-y-0.5" style={CARD_STYLE}>
                        <p className="px-3 pt-2 pb-1 text-[10px] font-[500] text-gray-400 uppercase tracking-[0.07em]">Settings</p>

                        {isAdmin && (
                            <button onClick={() => setActiveTab('organization')} className={navBtnCls('organization')}>
                                <PiBuilding className="text-[15px] shrink-0" />
                                Organization
                            </button>
                        )}
                        <button onClick={() => setActiveTab('profile')} className={navBtnCls('profile')}>
                            <PiUserCircle className="text-[15px] shrink-0" />
                            My Profile
                        </button>
                        <button onClick={() => setActiveTab('notifications')} className={navBtnCls('notifications')}>
                            <PiBell className="text-[15px] shrink-0" />
                            Notifications
                        </button>
                        <button onClick={() => setActiveTab('regional')} className={navBtnCls('regional')}>
                            <PiGlobe className="text-[15px] shrink-0" />
                            Regional
                        </button>
                        {isAdmin && (
                            <button onClick={() => setActiveTab('integrations')} className={navBtnCls('integrations')}>
                                <PiLink className="text-[15px] shrink-0" />
                                Integrations
                            </button>
                        )}
                    </div>

                    {/* Plan info */}
                    <div className="bg-white rounded-[8px] p-4" style={CARD_STYLE}>
                        <div className="w-8 h-8 rounded-[7px] bg-indigo-50 flex items-center justify-center mb-3">
                            <PiShieldCheck className="text-[#6366F1] text-[15px]" />
                        </div>
                        <h3 className="text-[13px] font-[600] text-gray-900 mb-0.5">Enterprise Plan</h3>
                        <p className="text-[11.5px] text-gray-400 mb-3">Advanced security features and priority support.</p>
                        <button className="text-[11.5px] font-[500] text-[#6366F1] hover:underline transition-colors">
                            View License
                        </button>
                    </div>
                </div>

                {/* Main content */}
                <div className="lg:col-span-9 space-y-4">

                    {/* Organization Tab */}
                    {activeTab === 'organization' && isAdmin && (
                        <div className="bg-white rounded-[8px] overflow-hidden" style={CARD_STYLE}>
                            <div className="px-6 py-4 flex items-center justify-between"
                                style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-[7px] bg-indigo-50 flex items-center justify-center">
                                        <PiStorefront className="text-[#6366F1] text-[15px]" />
                                    </div>
                                    <div>
                                        <h2 className="text-[13px] font-[600] text-gray-900">Organization Profile</h2>
                                        <p className="text-[11.5px] text-gray-400">Manage your company's public information</p>
                                    </div>
                                </div>
                                <span className="text-[10px] font-[500] px-2 py-0.5 rounded-[4px] text-emerald-600 bg-emerald-50"
                                    style={{ border: '1px solid rgba(16,185,129,0.2)' }}>
                                    Verified Entity
                                </span>
                            </div>

                            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div>
                                    <label className={LABEL_CLS}>Company Name</label>
                                    <input type="text" value={formData.companyName}
                                        onChange={(e) => handleInputChange('companyName', e.target.value)}
                                        className={INPUT_CLS} style={INPUT_STYLE} />
                                </div>
                                <div>
                                    <label className={LABEL_CLS}>Registration Number</label>
                                    <input type="text" value={formData.registrationNumber}
                                        onChange={(e) => handleInputChange('registrationNumber', e.target.value)}
                                        className={INPUT_CLS} style={INPUT_STYLE} />
                                </div>
                                <div>
                                    <label className={LABEL_CLS}>Primary Currency</label>
                                    <CustomSelect
                                        value={currency}
                                        onChange={val => setCurrency(val)}
                                        options={[
                                            { value: "KES - Kenyan Shilling", label: "KES - Kenyan Shilling" },
                                            { value: "USD - US Dollar", label: "USD - US Dollar" },
                                            { value: "SSP - South Sudanese Pound", label: "SSP - South Sudanese Pound" },
                                        ]}
                                        className={INPUT_CLS}
                                        style={INPUT_STYLE}
                                    />
                                </div>
                                <div>
                                    <label className={LABEL_CLS}>Fiscal Year End</label>
                                    <input type="date" defaultValue="2026-12-31"
                                        className={INPUT_CLS} style={INPUT_STYLE} />
                                </div>
                                <div className="md:col-span-2">
                                    <label className={LABEL_CLS}>Headquarters Address</label>
                                    <textarea rows={2} value={formData.headquartersAddress}
                                        onChange={(e) => handleInputChange('headquartersAddress', e.target.value)}
                                        className={INPUT_CLS + " resize-none"} style={INPUT_STYLE} />
                                </div>
                                <div className="md:col-span-2 pt-4" style={{ borderTop: '1px solid rgba(0,0,0,0.07)' }}>
                                    <div className="flex items-center justify-between gap-4">
                                        <div>
                                            <p className="text-[13px] font-[500] text-gray-900">Enforce Request Closure</p>
                                            <p className="text-[11.5px] text-gray-400 mt-0.5">
                                                Prevent users from submitting new expenses if they have active unclosed requests.
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => handleInputChange('enforceRequestClosure', !formData.enforceRequestClosure)}
                                            className="text-[28px] transition-colors shrink-0"
                                        >
                                            {formData.enforceRequestClosure
                                                ? <PiToggleRight className="text-[#6366F1]" />
                                                : <PiToggleLeft className="text-gray-300" />
                                            }
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Profile Tab */}
                    {activeTab === 'profile' && (
                        <div className="bg-white rounded-[8px] overflow-hidden" style={CARD_STYLE}>
                            <div className="px-6 py-4 flex items-center gap-3"
                                style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                                <div className="w-8 h-8 rounded-[7px] bg-indigo-50 flex items-center justify-center">
                                    <PiUserCircle className="text-[#6366F1] text-[15px]" />
                                </div>
                                <div>
                                    <h2 className="text-[13px] font-[600] text-gray-900">Personal Profile</h2>
                                    <p className="text-[11.5px] text-gray-400">Your account details and preferences</p>
                                </div>
                            </div>

                            <div className="p-6">
                                <div className="flex items-center gap-4 mb-6">
                                    <div className="w-12 h-12 rounded-[7px] bg-indigo-50 flex items-center justify-center text-[18px] font-[700] text-[#6366F1] shrink-0">
                                        {initials}
                                    </div>
                                    <div>
                                        <h3 className="text-[14px] font-[600] text-gray-900">{user.name}</h3>
                                        <p className="text-[12px] text-gray-400">{user.position} &bull; {user.department}</p>
                                        <span className="inline-flex items-center mt-1 text-[10px] font-[500] px-2 py-0.5 rounded-[4px] text-purple-600 bg-purple-50"
                                            style={{ border: '1px solid rgba(147,51,234,0.2)' }}>
                                            {user.role.replace(/_/g, ' ')}
                                        </span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <div>
                                        <label className={LABEL_CLS}>Full Name</label>
                                        <input type="text" value={formData.name}
                                            onChange={(e) => handleInputChange('name', e.target.value)}
                                            className={INPUT_CLS} style={INPUT_STYLE} />
                                    </div>
                                    <div>
                                        <label className={LABEL_CLS}>Email Address</label>
                                        <input type="email" defaultValue={user.email || ''} disabled
                                            className="w-full rounded-[6px] px-3 py-[10px] text-[13px] text-gray-400 outline-none bg-gray-50 cursor-not-allowed"
                                            style={{ border: '1px solid rgba(0,0,0,0.07)' }} />
                                    </div>
                                    <div>
                                        <label className={LABEL_CLS}>Phone Number</label>
                                        <PhoneInput
                                            value={formData.phoneNumber}
                                            onChange={(value) => handleInputChange('phoneNumber', value)}
                                        />
                                    </div>
                                    <div>
                                        <label className={LABEL_CLS}>Language</label>
                                        <CustomSelect
                                            value={formData.language}
                                            onChange={val => handleInputChange('language', val)}
                                            options={[
                                                { value: "English (UK)", label: "English (UK)" },
                                                { value: "Swahili", label: "Swahili" },
                                                { value: "French", label: "French" },
                                            ]}
                                            className={INPUT_CLS}
                                            style={INPUT_STYLE}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Notifications Tab */}
                    {activeTab === 'notifications' && (
                        <div className="bg-white rounded-[8px] overflow-hidden" style={CARD_STYLE}>
                            <div className="px-6 py-4 flex items-center gap-3"
                                style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                                <div className="w-8 h-8 rounded-[7px] bg-amber-50 flex items-center justify-center">
                                    <PiBell className="text-amber-500 text-[15px]" />
                                </div>
                                <div>
                                    <h2 className="text-[13px] font-[600] text-gray-900">Notification Preferences</h2>
                                    <p className="text-[11.5px] text-gray-400">Control when and how you receive alerts</p>
                                </div>
                            </div>

                            <div>
                                {Object.entries(formData.notifications).map(([key, value], idx) => (
                                    <div key={key} className="px-6 py-4 flex items-center justify-between"
                                        style={idx > 0 ? { borderTop: '1px solid rgba(0,0,0,0.07)' } : {}}>
                                        <div>
                                            <p className="text-[13px] font-[500] text-gray-900 capitalize">
                                                {key.replace(/([A-Z])/g, ' $1').trim()}
                                            </p>
                                            <p className="text-[11.5px] text-gray-400">
                                                Receive notifications for {key.replace(/([A-Z])/g, ' $1').toLowerCase()}
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => handleNotificationToggle(key as keyof typeof formData.notifications)}
                                            className="text-[28px] transition-colors ml-4 shrink-0"
                                        >
                                            {value
                                                ? <PiToggleRight className="text-[#6366F1]" />
                                                : <PiToggleLeft className="text-gray-300" />
                                            }
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Regional Tab */}
                    {activeTab === 'regional' && (
                        <div className="bg-white rounded-[8px] overflow-hidden" style={CARD_STYLE}>
                            <div className="px-6 py-4 flex items-center gap-3"
                                style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                                <div className="w-8 h-8 rounded-[7px] bg-blue-50 flex items-center justify-center">
                                    <PiGlobe className="text-blue-500 text-[15px]" />
                                </div>
                                <div>
                                    <h2 className="text-[13px] font-[600] text-gray-900">Regional Settings</h2>
                                    <p className="text-[11.5px] text-gray-400">Timezone, currency and localization dates</p>
                                </div>
                            </div>

                            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div>
                                    <label className={LABEL_CLS}>Time Zone</label>
                                    <CustomSelect
                                        value={timezone}
                                        onChange={val => setTimezone(val)}
                                        options={[
                                            { value: "Africa/Nairobi (EAT) GMT+3", label: "Africa/Nairobi (EAT) GMT+3" },
                                            { value: "Africa/Juba (CAT) GMT+2", label: "Africa/Juba (CAT) GMT+2" },
                                        ]}
                                        className={INPUT_CLS}
                                        style={INPUT_STYLE}
                                    />
                                </div>
                                <div>
                                    <label className={LABEL_CLS}>Date Format</label>
                                    <CustomSelect
                                        value={dateFormat}
                                        onChange={val => setDateFormat(val)}
                                        options={[
                                            { value: "DD/MM/YYYY (24/01/2026)", label: "DD/MM/YYYY (24/01/2026)" },
                                            { value: "MM/DD/YYYY (01/24/2026)", label: "MM/DD/YYYY (01/24/2026)" },
                                            { value: "YYYY-MM-DD (2026-01-24)", label: "YYYY-MM-DD (2026-01-24)" },
                                        ]}
                                        className={INPUT_CLS}
                                        style={INPUT_STYLE}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Integrations Tab */}
                    {activeTab === 'integrations' && isAdmin && (
                        <div className="space-y-4">
                            <div className="bg-white rounded-[8px] overflow-hidden" style={CARD_STYLE}>
                                <div className="px-6 py-4 flex items-center gap-3"
                                    style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                                    <div className="w-8 h-8 rounded-[7px] bg-indigo-50 flex items-center justify-center">
                                        <PiLink className="text-[#6366F1] text-[15px]" />
                                    </div>
                                    <div>
                                        <h2 className="text-[13px] font-[600] text-gray-900">External Integrations</h2>
                                        <p className="text-[11.5px] text-gray-400">Connect your financial data to external platforms</p>
                                    </div>
                                </div>

                                <div className="p-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {/* QuickBooks */}
                                        <div className="rounded-[8px] p-5 bg-white" style={CARD_STYLE}>
                                            <div className="flex items-start justify-between mb-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 rounded-[7px] bg-[#2ca01c]/10 flex items-center justify-center">
                                                        <img src="/quickbooks-logo.svg" className="max-w-[70%] max-h-[70%] object-contain" alt="QuickBooks" />
                                                    </div>
                                                    <div>
                                                        <h3 className="text-[13px] font-[600] text-gray-900">QuickBooks Online</h3>
                                                        <p className="text-[11px] text-gray-400">Accounting Sync</p>
                                                    </div>
                                                </div>
                                                <span className={cn(
                                                    "text-[10px] font-[500] px-2 py-0.5 rounded-[4px] shrink-0",
                                                    qboConnected ? 'text-emerald-600 bg-emerald-50' : 'text-gray-400 bg-gray-100'
                                                )} style={{ border: qboConnected ? '1px solid rgba(16,185,129,0.2)' : '1px solid rgba(0,0,0,0.09)' }}>
                                                    {qboConnected ? 'Connected' : 'Not Linked'}
                                                </span>
                                            </div>
                                            <p className="text-[11.5px] text-gray-400 mb-4 leading-relaxed">
                                                Sync journal entries, expenses, and invoices to QuickBooks Online automatically.
                                            </p>
                                            <div className="flex gap-2">
                                                <button
                                                    disabled={qboConnected}
                                                    onClick={() => window.location.href = '/api/integrations/qbo/auth'}
                                                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-[6px] text-[12px] font-[500] text-white bg-[#2ca01c] hover:bg-[#238016] transition-colors disabled:opacity-50"
                                                >
                                                    {qboConnected
                                                        ? <><PiCheck className="text-[13px]" /> Connected</>
                                                        : 'Connect Account'
                                                    }
                                                </button>
                                                {qboConnected && (
                                                    <button className="flex items-center gap-1.5 px-3 py-2 rounded-[6px] text-[12px] font-[500] text-gray-600 bg-white hover:bg-gray-50 transition-colors"
                                                        style={{ border: '1px solid rgba(0,0,0,0.09)' }}>
                                                        <PiArrowsClockwise className="text-[13px]" /> Sync Now
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Xero placeholder */}
                                        <div className="rounded-[8px] p-5 flex flex-col items-center justify-center text-center opacity-50"
                                            style={{ border: '1px dashed rgba(0,0,0,0.15)' }}>
                                            <div className="w-9 h-9 rounded-[7px] bg-gray-100 flex items-center justify-center mb-3">
                                                <PiBuildings className="text-gray-400 text-[16px]" />
                                            </div>
                                            <p className="text-[13px] font-[500] text-gray-400">Xero Integration</p>
                                            <p className="text-[10px] text-gray-400 mt-0.5 uppercase tracking-[0.07em]">Coming Soon</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {qboConnected && (
                                <div className="space-y-4">
                                    <div className="bg-white rounded-[8px] p-5"
                                        style={{ border: '1px solid rgba(44,160,28,0.2)' }}>
                                        <div className="flex items-center gap-3 mb-3">
                                            <div className="w-8 h-8 rounded-[7px] bg-[#2ca01c]/10 flex items-center justify-center">
                                                <PiArrowsClockwise className="text-[#2ca01c] text-[15px]" />
                                            </div>
                                            <div>
                                                <h3 className="text-[13px] font-[600] text-gray-900">Synchronize Ledger</h3>
                                                <p className="text-[11.5px] text-gray-400">Post pending transactions to QuickBooks</p>
                                            </div>
                                        </div>
                                        <p className="text-[11.5px] text-[#2ca01c] leading-relaxed">
                                            Your organization is linked to QuickBooks. All future authorized payments will be automatically queued for synchronization.
                                        </p>
                                    </div>

                                    <div className="bg-white rounded-[8px] overflow-hidden" style={CARD_STYLE}>
                                        <div className="px-6 py-4" style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                                            <h3 className="text-[13px] font-[600] text-gray-900">Account Mapping</h3>
                                            <p className="text-[11.5px] text-gray-400">Chart of Accounts Synchronization</p>
                                        </div>
                                        <div className="p-6">
                                            <QuickBooksMapping />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
