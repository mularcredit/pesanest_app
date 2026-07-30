"use client";

import { useState, useEffect } from"react";
import { useRouter } from"next/navigation";
import { useToast } from"@/components/ui/ToastProvider";
import {
 PiShieldCheck,
 PiCheckCircle,
 PiArrowLeft,
 PiLockKey,
 PiSpinner
} from"react-icons/pi";
import Link from"next/link";
import { cn } from"@/lib/utils";

interface Permission {
 id: string;
 resource: string;
 action: string;
 description: string | null;
}

export default function NewRolePage() {
 const router = useRouter();
 const { showToast } = useToast();

 const [name, setName] = useState("");
 const [description, setDescription] = useState("");
 const [maxApprovalLimit, setMaxApprovalLimit] = useState<string>("");
 const [permissions, setPermissions] = useState<Permission[]>([]);
 const [groupedPermissions, setGroupedPermissions] = useState<Record<string, Permission[]>>({});
 const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(new Set());
 const [isLoading, setIsLoading] = useState(true);
 const [isSaving, setIsSaving] = useState(false);

 useEffect(() => {
 fetchPermissions();
 }, []);

 const fetchPermissions = async () => {
 try {
 const response = await fetch('/api/permissions');
 const data = await response.json();
 setPermissions(data.permissions);
 setGroupedPermissions(data.grouped);
 } catch (error) {
 showToast('Failed to load permissions', 'error');
 } finally {
 setIsLoading(false);
 }
 };

 const togglePermission = (permId: string) => {
 const newSet = new Set(selectedPermissions);
 if (newSet.has(permId)) {
 newSet.delete(permId);
 } else {
 newSet.add(permId);
 }
 setSelectedPermissions(newSet);
 };

 const toggleAllInResource = (resource: string) => {
 const resourcePerms = groupedPermissions[resource] || [];
 const allSelected = resourcePerms.every(p => selectedPermissions.has(p.id));

 const newSet = new Set(selectedPermissions);
 resourcePerms.forEach(p => {
 if (allSelected) {
 newSet.delete(p.id);
 } else {
 newSet.add(p.id);
 }
 });
 setSelectedPermissions(newSet);
 };

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();

 if (!name.trim()) {
 showToast('Role name is required', 'error');
 return;
 }

 if (selectedPermissions.size === 0) {
 showToast('Please select at least one permission', 'error');
 return;
 }

 setIsSaving(true);
 try {
 const response = await fetch('/api/roles', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 name,
 description,
 maxApprovalLimit,
 permissionIds: Array.from(selectedPermissions)
 })
 });

 const data = await response.json();
 if (!response.ok) throw new Error(data.error);

 showToast('Role created successfully', 'success');
 router.push('/dashboard/roles');
 } catch (error: any) {
 showToast(error.message || 'Failed to create role', 'error');
 } finally {
 setIsSaving(false);
 }
 };

 const INPUT_CLS = "w-full rounded-[6px] px-3 py-[10px] text-[13px] text-gray-900 placeholder:text-gray-300 outline-none focus:ring-1 focus:ring-[#6366F1] transition-colors bg-white";
 const INPUT_STYLE: React.CSSProperties = { border: '1px solid rgba(0,0,0,0.09)' };
 const LABEL_CLS = "block text-[11.5px] font-[500] text-gray-400 mb-1.5";
 const CARD_STYLE: React.CSSProperties = { border: '1px solid rgba(0,0,0,0.09)' };

 if (isLoading) {
 return (
 <div className="flex items-center justify-center min-h-[60vh]">
 <div className="text-center">
 <div className="w-10 h-10 rounded-[8px] bg-indigo-50 flex items-center justify-center mx-auto mb-3">
 <PiSpinner className="text-[#6366F1] text-xl animate-spin" />
 </div>
 <p className="text-[13px] text-gray-400">Loading permissions...</p>
 </div>
 </div>
 );
 }

 return (
 <div className="space-y-6 pb-24">
 {/* Header */}
 <div className="flex items-center gap-3">
 <Link
 href="/dashboard/roles"
 className="p-1.5 rounded-[6px] text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors shrink-0"
 style={{ border: '1px solid rgba(0,0,0,0.09)' }}
 >
 <PiArrowLeft className="text-[15px]" />
 </Link>
 <div>
 <h1 className="text-[20px] font-[600] text-gray-900 tracking-tight">Create New Role</h1>
 <p className="text-[12.5px] text-gray-400 mt-0.5">Define a custom role with specific permissions</p>
 </div>
 </div>

 <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
 {/* Left Column */}
 <div className="lg:col-span-1">
 <div className="bg-white rounded-[8px] overflow-hidden sticky top-6" style={CARD_STYLE}>
 <div className="px-5 py-4 flex items-center gap-3" style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
 <div className="w-7 h-7 rounded-[6px] bg-indigo-50 flex items-center justify-center">
 <PiShieldCheck className="text-[14px] text-[#6366F1]" />
 </div>
 <h3 className="text-[13px] font-[600] text-gray-900">Role Details</h3>
 </div>

 <div className="px-5 py-5 space-y-4">
 <div>
 <label className={LABEL_CLS}>Role Name *</label>
 <input
 type="text"
 value={name}
 onChange={(e) => setName(e.target.value)}
 placeholder="e.g., Regional Manager"
 required
 className={INPUT_CLS}
 style={INPUT_STYLE}
 />
 </div>

 <div>
 <label className={LABEL_CLS}>Max Approval Limit (KES)</label>
 <input
 type="number"
 value={maxApprovalLimit}
 onChange={(e) => setMaxApprovalLimit(e.target.value)}
 placeholder="Leave empty for unlimited"
 className={INPUT_CLS}
 style={INPUT_STYLE}
 />
 <p className="text-[10.5px] text-gray-400 mt-1">
 Expenses above this amount require higher approval.
 </p>
 </div>

 <div>
 <label className={LABEL_CLS}>Description</label>
 <textarea
 value={description}
 onChange={(e) => setDescription(e.target.value)}
 placeholder="Brief description of this role's purpose..."
 rows={4}
 className="w-full rounded-[6px] px-3 py-[10px] text-[13px] text-gray-900 placeholder:text-gray-300 outline-none focus:ring-1 focus:ring-[#6366F1] transition-colors bg-white resize-none"
 style={INPUT_STYLE}
 />
 </div>

 <div className="pt-3" style={{ borderTop: '1px solid rgba(0,0,0,0.07)' }}>
 <div className="flex items-center justify-between mb-1">
 <p className="text-[11px] font-[500] text-gray-400 uppercase tracking-[0.07em]">Selected Permissions</p>
 <span className="text-[13px] font-[600] text-[#6366F1]">{selectedPermissions.size}</span>
 </div>
 <p className="text-[11.5px] text-gray-400">
 {selectedPermissions.size === 0
 ? 'No permissions selected yet'
 : `${selectedPermissions.size} permission${selectedPermissions.size !== 1 ? 's' : ''} assigned`
 }
 </p>
 </div>
 </div>

 <div className="px-5 py-4" style={{ borderTop: '1px solid rgba(0,0,0,0.07)' }}>
 <button
 type="submit"
 disabled={isSaving || !name.trim() || selectedPermissions.size === 0}
 className="w-full flex items-center justify-center gap-2 py-2 rounded-[6px] text-[12.5px] font-[500] text-white bg-[#6366F1] hover:bg-indigo-600 transition-colors disabled:opacity-50"
 >
 {isSaving ? <PiSpinner className="animate-spin text-[14px]" /> : <PiCheckCircle className="text-[14px]" />}
 {isSaving ? 'Creating...' : 'Create Role'}
 </button>
 </div>
 </div>
 </div>

 {/* Right Column */}
 <div className="lg:col-span-2 space-y-4">
 <div className="bg-white rounded-[8px] overflow-hidden" style={CARD_STYLE}>
 <div className="px-5 py-4 flex items-center gap-3" style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
 <div className="w-7 h-7 rounded-[6px] bg-blue-50 flex items-center justify-center">
 <PiLockKey className="text-[14px] text-blue-600" />
 </div>
 <div>
 <h3 className="text-[13px] font-[600] text-gray-900">Permissions</h3>
 <p className="text-[11.5px] text-gray-400">Select the permissions this role should have</p>
 </div>
 </div>

 <div className="px-5 py-5 space-y-4">
 {Object.entries(groupedPermissions).map(([resource, perms]) => {
 const allSelected = perms.every(p => selectedPermissions.has(p.id));
 return (
 <div key={resource} className="bg-white rounded-[8px] p-4" style={{ border: '1px solid rgba(0,0,0,0.07)' }}>
 <div className="flex items-center justify-between mb-3">
 <h4 className="text-[12.5px] font-[600] text-gray-900">{resource}</h4>
 <button
 type="button"
 onClick={() => toggleAllInResource(resource)}
 className={cn(
 "text-[10.5px] font-[500] px-2.5 py-1 rounded-[5px] transition-colors uppercase tracking-[0.05em]",
 allSelected ? "bg-indigo-50 text-[#6366F1]" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
 )}
 >
 {allSelected ? 'Deselect All' : 'Select All'}
 </button>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
 {perms.map(perm => (
 <button
 key={perm.id}
 type="button"
 onClick={() => togglePermission(perm.id)}
 className={cn(
 "p-3 rounded-[6px] text-left transition-all",
 selectedPermissions.has(perm.id)
 ? "bg-indigo-50 text-[#6366F1]"
 : "bg-white text-gray-600 hover:bg-gray-50"
 )}
 style={{ border: selectedPermissions.has(perm.id) ? '1px solid rgba(99,102,241,0.3)' : '1px solid rgba(0,0,0,0.07)' }}
 >
 <div className="flex items-center gap-2 mb-0.5">
 <div className={cn(
 "w-3.5 h-3.5 rounded-[3px] flex items-center justify-center shrink-0 transition-colors",
 selectedPermissions.has(perm.id) ? "bg-[#6366F1]" : "bg-white"
 )} style={{ border: selectedPermissions.has(perm.id) ? '1px solid #6366F1' : '1px solid rgba(0,0,0,0.15)' }}>
 {selectedPermissions.has(perm.id) && (
 <PiCheckCircle className="text-white text-[9px]" />
 )}
 </div>
 <span className={cn("text-[11.5px] font-mono font-[500]", selectedPermissions.has(perm.id) ? "text-[#6366F1]" : "text-gray-900")}>
 {perm.action}
 </span>
 </div>
 {perm.description && (
 <p className="text-[10.5px] text-gray-400 line-clamp-2 pl-5">
 {perm.description}
 </p>
 )}
 </button>
 ))}
 </div>
 </div>
 );
 })}
 </div>
 </div>
 </div>
 </form>
 </div>
 );
}
