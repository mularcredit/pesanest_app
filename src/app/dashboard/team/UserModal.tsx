'use client';

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
    PiX,
    PiCheckCircle,
    PiUserPlus,
    PiSpinner,
    PiUser,
    PiEnvelope,
    PiBriefcase,
    PiLock,
    PiArrowsClockwise,
    PiMapPin,
    PiBuildings,
    PiMagnifyingGlass,
    PiCaretDown,
} from 'react-icons/pi';
import { useToast } from "@/components/ui/ToastProvider";
import { CustomSelect } from "@/components/ui/CustomSelect";
import { createUser, updateUser } from "./actions";
import { useRouter } from "next/navigation";

interface UserModalProps {
    isOpen: boolean;
    onClose: () => void;
    user?: any;
}

const STANDARD_ROLES = [
    { value: 'EMPLOYEE', label: 'Employee' },
    { value: 'MANAGER', label: 'Manager' },
    { value: 'TEAM_LEADER', label: 'Branch Manager' },
    { value: 'REGIONAL_MANAGER', label: 'Regional Manager' },
    { value: 'FINANCE_WRITER', label: 'Finance Writer' },
    { value: 'FINANCE_APPROVER', label: 'Finance Approver' },
    { value: 'SYSTEM_ADMIN', label: 'System Admin' },
];

const STANDARD_DEPARTMENTS = [
    'Administration',
    'Customer Service',
    'Engineering & IT',
    'Finance & Accounting',
    'Human Resources (HR)',
    'Legal & Compliance',
    'Logistics & Supply Chain',
    'Marketing',
    'Operations',
    'Product Management',
    'Sales',
    'Other'
];

export function UserModal({ isOpen, onClose, user }: UserModalProps) {
    const { showToast } = useToast();
    const router = useRouter();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [mounted, setMounted] = useState(false);

    const [roles, setRoles] = useState<any[]>([]);
    const [branches, setBranches] = useState<any[]>([]);
    const [regions, setRegions] = useState<any[]>([]);

    const [selectedRole, setSelectedRole] = useState<string>(
        user?.customRoleId ? `custom:${user.customRoleId}` : (user?.role || 'EMPLOYEE')
    );

    useEffect(() => {
        setMounted(true);
        // Fetch custom roles
        fetch('/api/roles')
            .then(res => res.json())
            .then(data => { if (data.roles) setRoles(data.roles); })
            .catch(err => console.error("Failed to fetch roles", err));

        // Fetch branches
        fetch('/api/branches')
            .then(res => res.json())
            .then(data => { if (data.branches) setBranches(data.branches); })
            .catch(err => console.error("Failed to fetch branches", err));

        // Fetch regions
        fetch('/api/regions')
            .then(res => res.json())
            .then(data => { if (data.regions) setRegions(data.regions); })
            .catch(err => console.error("Failed to fetch regions", err));
    }, []);

    // Reset role when user prop changes
    useEffect(() => {
        setSelectedRole(user?.customRoleId ? `custom:${user.customRoleId}` : (user?.role || 'EMPLOYEE'));
    }, [user]);

    const [password, setPassword] = useState("");
    const [showResetPassword, setShowResetPassword] = useState(false);
    const [newPassword, setNewPassword] = useState("");
    const [selectedBranchId, setSelectedBranchId] = useState<string>(user?.branchId || '');
    const [selectedRegionId, setSelectedRegionId] = useState<string>(user?.regionId || '');
    const [selectedDepartment, setSelectedDepartment] = useState<string>(user?.department || '');
    const [branchSearch, setBranchSearch] = useState("");
    const [regionSearch, setRegionSearch] = useState("");
    const [departmentSearch, setDepartmentSearch] = useState("");
    const [isBranchDropdownOpen, setIsBranchDropdownOpen] = useState(false);
    const [isRegionDropdownOpen, setIsRegionDropdownOpen] = useState(false);
    const [isDepartmentDropdownOpen, setIsDepartmentDropdownOpen] = useState(false);

    const filteredBranches = branches.filter(b => 
        b.name.toLowerCase().includes(branchSearch.toLowerCase()) || 
        b.code.toLowerCase().includes(branchSearch.toLowerCase())
    );

    const filteredRegions = regions.filter(r => 
        r.name.toLowerCase().includes(regionSearch.toLowerCase())
    );

    const filteredDepartments = STANDARD_DEPARTMENTS.filter(d => 
        d.toLowerCase().includes(departmentSearch.toLowerCase())
    );

    const generatePassword = () => {
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
        let pw = "";
        for (let i = 0; i < 12; i++) pw += chars.charAt(Math.floor(Math.random() * chars.length));
        if (user) setNewPassword(pw);
        else setPassword(pw);
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const formData = new FormData(e.currentTarget);

            // Handle Custom Roles logic
            const rawRole = formData.get('role') as string;
            if (rawRole.startsWith('custom:')) {
                const customId = rawRole.split(':')[1];
                formData.set('role', 'CUSTOM');
                formData.set('customRoleId', customId);
            } else {
                formData.delete('customRoleId');
            }

            let res;
            if (user) {
                res = await updateUser(user.id, formData);
            } else {
                res = await createUser(formData);
            }

            if (res.success) {
                showToast(`User ${user ? 'updated' : 'created'} successfully`, "success");
                router.refresh();
                onClose();
            } else {
                showToast(res.error || "Operation failed", "error");
            }
        } catch (error) {
            showToast("An error occurred", "error");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!mounted || !isOpen) return null;

    const showBranchSelector = selectedRole === 'TEAM_LEADER';
    const showRegionSelector = selectedRole === 'REGIONAL_MANAGER';

    const INPUT_CLS = "w-full rounded-[6px] px-3 py-[10px] text-[13px] text-gray-900 placeholder:text-gray-300 outline-none focus:ring-1 focus:ring-[#6366F1] transition-colors bg-white";
    const INPUT_STYLE: React.CSSProperties = { border: '1px solid rgba(0,0,0,0.09)' };
    const LABEL_CLS = "block text-[11.5px] font-[500] text-gray-400 mb-1.5";

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/30" onClick={onClose} />
            <div className="relative bg-white w-full max-w-xl rounded-[12px] flex flex-col max-h-[90vh] overflow-hidden"
                style={{ border: '1px solid rgba(0,0,0,0.09)', boxShadow: '0 8px 40px rgba(0,0,0,0.12)' }}>

                {/* Header */}
                <div className="px-6 py-4 flex items-center justify-between shrink-0"
                    style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-[7px] bg-indigo-50 flex items-center justify-center text-[#6366F1]">
                            <PiUserPlus className="text-[16px]" />
                        </div>
                        <div>
                            <h3 className="text-[14px] font-[600] text-gray-900">
                                {user ? 'Edit Team Member' : 'Create User Account'}
                            </h3>
                            <p className="text-[11.5px] text-gray-400 mt-0.5">
                                {user ? 'Update user details and permissions' : 'Create a new account and set login credentials'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-[6px] text-gray-400 hover:bg-gray-50 hover:text-gray-700 transition-colors"
                    >
                        <PiX className="text-[16px]" />
                    </button>
                </div>

                {/* Scrollable Body */}
                <form id="user-modal-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

                    <div>
                        <label className={LABEL_CLS}>Full Name *</label>
                        <div>
                            <input
                                name="name"
                                defaultValue={user?.name}
                                required
                                className={`${INPUT_CLS} pl-3`}
                                style={INPUT_STYLE}
                                placeholder="e.g. Jane Doe"
                            />
                        </div>
                    </div>

                    <div>
                        <label className={LABEL_CLS}>Email address *</label>
                        <div>
                            <input
                                name="email"
                                type="email"
                                defaultValue={user?.email}
                                required
                                className={`${INPUT_CLS} pl-3`}
                                style={INPUT_STYLE}
                                placeholder="jane@company.com"
                            />
                        </div>
                    </div>

                    {!user && (
                        <div>
                            <label className={`${LABEL_CLS} flex justify-between`}>
                                <span>Initial Password *</span>
                                <button
                                    type="button"
                                    onClick={generatePassword}
                                    className="text-[#6366F1] hover:underline flex items-center gap-1 normal-case text-[11px] font-[400]"
                                >
                                    <PiArrowsClockwise /> Generate
                                </button>
                            </label>
                            <div>
                                <input
                                    name="password"
                                    type="text"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className={`${INPUT_CLS} pl-3 font-mono`}
                                    style={INPUT_STYLE}
                                    placeholder="Click generate or type a password..."
                                />
                            </div>
                            <p className="text-[10.5px] text-gray-400 mt-1">
                                Min 8 characters. Share with the user securely.
                            </p>
                        </div>
                    )}

                    {user && (
                        <div className="rounded-[10px] overflow-hidden" style={{ border: '1px solid rgba(0,0,0,0.08)' }}>
                            <button
                                type="button"
                                onClick={() => { setShowResetPassword(v => !v); setNewPassword(""); }}
                                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                            >
                                <span className="flex items-center gap-2 text-[13px] font-[500] text-gray-700">
                                    <PiLock className="text-[#6366F1]" />
                                    Reset Password
                                </span>
                                <span className="text-[11px] text-gray-400">{showResetPassword ? 'Cancel' : 'Click to set a new password'}</span>
                            </button>
                            {showResetPassword && (
                                <div className="px-4 pb-4 space-y-2" style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                                    <label className={`${LABEL_CLS} flex justify-between pt-3`}>
                                        <span>New Password</span>
                                        <button type="button" onClick={generatePassword}
                                            className="text-[#6366F1] hover:underline flex items-center gap-1 normal-case text-[11px] font-[400]">
                                            <PiArrowsClockwise /> Generate
                                        </button>
                                    </label>
                                    <input
                                        name="newPassword"
                                        type="text"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        className={`${INPUT_CLS} pl-3 font-mono`}
                                        style={INPUT_STYLE}
                                        placeholder="Type or generate a new password..."
                                    />
                                    <p className="text-[10.5px] text-gray-400">Min 8 characters. Share with the user securely after saving.</p>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={LABEL_CLS}>Role *</label>
                            <input type="hidden" name="role" value={selectedRole} />
                            <CustomSelect
                                value={selectedRole}
                                onChange={val => setSelectedRole(val)}
                                options={[
                                    ...STANDARD_ROLES,
                                    ...roles.map(role => ({ value: `custom:${role.id}`, label: role.name })),
                                ]}
                                placeholder="Select role"
                                className={INPUT_CLS}
                                style={INPUT_STYLE}
                            />
                        </div>

                        <div>
                            <label className={LABEL_CLS}>Department</label>
                            <div className="relative">
                                <input type="hidden" name="department" value={selectedDepartment} />
                                <button
                                    type="button"
                                    onClick={() => setIsDepartmentDropdownOpen(!isDepartmentDropdownOpen)}
                                    className="w-full rounded-[6px] px-3 py-[10px] text-[13px] text-gray-900 outline-none bg-white flex justify-between items-center text-left"
                                    style={INPUT_STYLE}
                                >
                                    <div className="flex items-center gap-2 min-w-0">
                                        <PiBriefcase className="text-gray-300 shrink-0 text-[14px]" />
                                        <span className="truncate text-[13px]">{selectedDepartment || <span className="text-gray-300">Select department</span>}</span>
                                    </div>
                                    <PiCaretDown className={`text-gray-300 shrink-0 transition-transform ${isDepartmentDropdownOpen ? 'rotate-180' : ''}`} />
                                </button>

                                {isDepartmentDropdownOpen && (
                                    <div className="absolute z-20 w-full mt-1 bg-white rounded-[8px] overflow-hidden"
                                        style={{ border: '1px solid rgba(0,0,0,0.09)', boxShadow: '0 4px 16px rgba(0,0,0,0.10)' }}>
                                        <div className="p-2" style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                                            <input
                                                type="text"
                                                placeholder="Search..."
                                                value={departmentSearch}
                                                onChange={(e) => setDepartmentSearch(e.target.value)}
                                                className="w-full pl-3 pr-3 py-1.5 text-[12px] bg-gray-50 rounded-[5px] outline-none focus:ring-1 focus:ring-[#6366F1]"
                                                style={{ border: '1px solid rgba(0,0,0,0.07)' }}
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                        </div>
                                        <div className="max-h-52 overflow-y-auto">
                                            {filteredDepartments.length > 0 ? filteredDepartments.map((dept) => (
                                                <button
                                                    key={dept}
                                                    type="button"
                                                    onClick={() => { setSelectedDepartment(dept); setIsDepartmentDropdownOpen(false); setDepartmentSearch(""); }}
                                                    className={`w-full text-left px-4 py-2.5 text-[13px] transition-colors ${selectedDepartment === dept ? 'bg-indigo-50 text-[#6366F1] font-[500]' : 'text-gray-700 hover:bg-gray-50'}`}
                                                >
                                                    {dept}
                                                </button>
                                            )) : (
                                                <div className="p-4 text-center text-[12px] text-gray-400">No departments found.</div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Branch selector */}
                    {showBranchSelector && (
                        <div>
                            <label className="block text-[11.5px] font-[500] text-[#6366F1] mb-1.5 flex items-center gap-1">
                                <PiBuildings className="text-[13px]" /> Assign to Branch *
                            </label>
                            <div className="relative">
                                <input type="hidden" name="branchId" value={selectedBranchId} required />
                                <button
                                    type="button"
                                    onClick={() => setIsBranchDropdownOpen(!isBranchDropdownOpen)}
                                    className="w-full rounded-[6px] px-3 py-[10px] text-[13px] text-gray-900 outline-none bg-white flex justify-between items-center text-left"
                                    style={{ border: '1px solid rgba(99,102,241,0.3)' }}
                                >
                                    <span className="truncate">
                                        {selectedBranchId
                                            ? (() => { const b = branches.find(br => br.id === selectedBranchId); return b ? `${b.name} (${b.code}) — ${b.region?.name}` : '— Select a branch —'; })()
                                            : '— Select a branch —'}
                                    </span>
                                    <PiCaretDown className={`text-gray-300 shrink-0 transition-transform ${isBranchDropdownOpen ? 'rotate-180' : ''}`} />
                                </button>

                                {isBranchDropdownOpen && (
                                    <div className="absolute z-20 w-full mt-1 bg-white rounded-[8px] overflow-hidden"
                                        style={{ border: '1px solid rgba(0,0,0,0.09)', boxShadow: '0 4px 16px rgba(0,0,0,0.10)' }}>
                                        <div className="p-2" style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                                            <input
                                                type="text"
                                                placeholder="Search branches..."
                                                value={branchSearch}
                                                onChange={(e) => setBranchSearch(e.target.value)}
                                                className="w-full pl-3 pr-3 py-1.5 text-[12px] bg-gray-50 rounded-[5px] outline-none focus:ring-1 focus:ring-[#6366F1]"
                                                style={{ border: '1px solid rgba(0,0,0,0.07)' }}
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                        </div>
                                        <div className="max-h-60 overflow-y-auto">
                                            {filteredBranches.length > 0 ? filteredBranches.map((b) => (
                                                <button
                                                    key={b.id}
                                                    type="button"
                                                    onClick={() => { setSelectedBranchId(b.id); setIsBranchDropdownOpen(false); setBranchSearch(""); }}
                                                    className={`w-full text-left px-4 py-2.5 text-[13px] transition-colors ${selectedBranchId === b.id ? 'bg-indigo-50 text-[#6366F1] font-[500]' : 'text-gray-700 hover:bg-gray-50'}`}
                                                >
                                                    {b.name} ({b.code}) — {b.region?.name}
                                                </button>
                                            )) : (
                                                <div className="p-4 text-center text-[12px] text-gray-400">No branches found.</div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                            <p className="text-[10.5px] text-[#6366F1]/70 mt-1">
                                This user will be set as the team leader of the selected branch.
                            </p>
                        </div>
                    )}

                    {/* Region selector */}
                    {showRegionSelector && (
                        <div>
                            <label className="block text-[11.5px] font-[500] text-[#6366F1] mb-1.5 flex items-center gap-1">
                                <PiMapPin className="text-[13px]" /> Assign to Region *
                            </label>
                            <div className="relative">
                                <input type="hidden" name="regionId" value={selectedRegionId} required />
                                <button
                                    type="button"
                                    onClick={() => setIsRegionDropdownOpen(!isRegionDropdownOpen)}
                                    className="w-full rounded-[6px] px-3 py-[10px] text-[13px] text-gray-900 outline-none bg-white flex justify-between items-center text-left"
                                    style={{ border: '1px solid rgba(99,102,241,0.3)' }}
                                >
                                    <span className="truncate">
                                        {selectedRegionId
                                            ? (() => { const r = regions.find(reg => reg.id === selectedRegionId); return r ? r.name : '— Select a region —'; })()
                                            : '— Select a region —'}
                                    </span>
                                    <PiCaretDown className={`text-gray-300 shrink-0 transition-transform ${isRegionDropdownOpen ? 'rotate-180' : ''}`} />
                                </button>

                                {isRegionDropdownOpen && (
                                    <div className="absolute z-20 w-full mt-1 bg-white rounded-[8px] overflow-hidden"
                                        style={{ border: '1px solid rgba(0,0,0,0.09)', boxShadow: '0 4px 16px rgba(0,0,0,0.10)' }}>
                                        <div className="p-2" style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                                            <input
                                                type="text"
                                                placeholder="Search regions..."
                                                value={regionSearch}
                                                onChange={(e) => setRegionSearch(e.target.value)}
                                                className="w-full pl-3 pr-3 py-1.5 text-[12px] bg-gray-50 rounded-[5px] outline-none focus:ring-1 focus:ring-[#6366F1]"
                                                style={{ border: '1px solid rgba(0,0,0,0.07)' }}
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                        </div>
                                        <div className="max-h-60 overflow-y-auto">
                                            {filteredRegions.length > 0 ? filteredRegions.map((r) => (
                                                <button
                                                    key={r.id}
                                                    type="button"
                                                    onClick={() => { setSelectedRegionId(r.id); setIsRegionDropdownOpen(false); setRegionSearch(""); }}
                                                    className={`w-full text-left px-4 py-2.5 text-[13px] transition-colors ${selectedRegionId === r.id ? 'bg-indigo-50 text-[#6366F1] font-[500]' : 'text-gray-700 hover:bg-gray-50'}`}
                                                >
                                                    {r.name} <span className="text-gray-400 text-[11.5px] ml-1">({r.branches?.length ?? 0} branches)</span>
                                                </button>
                                            )) : (
                                                <div className="p-4 text-center text-[12px] text-gray-400">No regions found.</div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                            <p className="text-[10.5px] text-[#6366F1]/70 mt-1">
                                This user will be designated as the manager of the selected region.
                            </p>
                        </div>
                    )}

                    <div>
                        <label className={LABEL_CLS}>Position</label>
                        <input
                            name="position"
                            defaultValue={user?.position}
                            className={INPUT_CLS}
                            style={INPUT_STYLE}
                            placeholder="e.g. Regional Manager"
                        />
                    </div>

                </form>

                {/* Footer — outside scroll area */}
                <div className="px-6 py-4 flex justify-end gap-3 shrink-0"
                    style={{ borderTop: '1px solid rgba(0,0,0,0.07)' }}>
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-[6px] text-[12.5px] font-[500] text-gray-600 bg-white hover:bg-gray-50 transition-colors"
                        style={{ border: '1px solid rgba(0,0,0,0.09)' }}
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        form="user-modal-form"
                        disabled={isSubmitting}
                        className="px-5 py-2 rounded-[6px] text-[12.5px] font-[500] text-white bg-[#6366F1] hover:bg-indigo-600 transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                        {isSubmitting ? <PiSpinner className="animate-spin text-[14px]" /> : <PiCheckCircle className="text-[14px]" />}
                        {user ? 'Save Changes' : 'Create Account'}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
