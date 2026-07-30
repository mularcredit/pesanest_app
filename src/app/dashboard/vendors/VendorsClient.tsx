'use client';

import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import {
    PiBuildings, PiEnvelopeSimple, PiPhone, PiGlobe,
    PiPlus, PiTrash, PiArrowCounterClockwise, PiMagnifyingGlass,
    PiListBullets, PiGridFour,
} from 'react-icons/pi';
import { CreateVendorModal } from '@/components/dashboard/CreateVendorModal';
import { EditVendorModal } from '@/components/dashboard/EditVendorModal';
import { DeleteEntityButton } from '@/components/dashboard/DeleteEntityButton';
import { trashVendor, restoreVendor } from '@/app/actions/vendors';
import { useToast } from '@/components/ui/ToastProvider';

interface VendorsClientProps { vendors: any[] }

const CARD_STYLE: React.CSSProperties = { border: '1px solid rgba(0,0,0,0.09)' };
const ROW_BORDER: React.CSSProperties = { borderBottom: '1px solid rgba(0,0,0,0.06)' };

function vendorInitials(name: string) {
    return name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function statusBadge(vendor: any) {
    if (vendor.isTrashed) return { label: 'Trashed', cls: 'text-rose-600 bg-rose-50', border: 'rgba(239,68,68,0.2)' };
    if (vendor.isActive) return { label: 'Active', cls: 'text-emerald-600 bg-emerald-50', border: 'rgba(16,185,129,0.2)' };
    return { label: 'Inactive', cls: 'text-gray-500 bg-gray-100', border: 'rgba(0,0,0,0.09)' };
}

export function VendorsClient({ vendors }: VendorsClientProps) {
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [editingVendor, setEditingVendor] = useState<any>(null);
    const [activeTab, setActiveTab] = useState<'active' | 'trash'>('active');
    const [search, setSearch] = useState('');
    const [view, setView] = useState<'grid' | 'list'>('grid');
    const { showToast } = useToast();

    const handleTrash = async (id: string) => {
        const res = await trashVendor(id);
        if (res.success) showToast(res.message, 'success');
        else showToast(res.message, 'error');
    };
    const handleRestore = async (id: string) => {
        const res = await restoreVendor(id);
        if (res.success) showToast(res.message, 'success');
        else showToast(res.message, 'error');
    };

    const activeCount = vendors.filter(v => !v.isTrashed).length;
    const trashedCount = vendors.filter(v => v.isTrashed).length;

    const filtered = useMemo(() => {
        const base = vendors.filter(v => activeTab === 'active' ? !v.isTrashed : v.isTrashed);
        if (!search.trim()) return base;
        const q = search.toLowerCase();
        return base.filter(v =>
            v.name?.toLowerCase().includes(q) ||
            v.category?.toLowerCase().includes(q) ||
            v.email?.toLowerCase().includes(q)
        );
    }, [vendors, activeTab, search]);

    const navItems = [
        { id: 'active' as const, label: 'Active Vendors', count: activeCount, icon: PiBuildings },
        { id: 'trash' as const,  label: 'Trash Bin',      count: trashedCount, icon: PiTrash },
    ];

    return (
        <div className="flex -mt-[22px] -mx-[26px] -mb-[52px] min-h-[calc(100vh-64px)]">

            {/* ── SIDEBAR ── */}
            <aside className="w-[200px] shrink-0 bg-white flex flex-col sticky top-0 h-[calc(100vh-64px)] overflow-y-auto"
                style={{ borderRight: '1px solid rgba(0,0,0,0.07)' }}>
                <div className="px-5 pt-5 pb-4" style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                    <p className="text-[10px] font-[600] uppercase tracking-[0.08em] text-gray-400">Directory</p>
                    <h1 className="text-[14px] font-[600] text-gray-900 mt-0.5">Vendors</h1>
                    <p className="text-[22px] font-[600] text-[#6366F1] mt-1 tabular-nums leading-none">
                        {activeCount} <span className="text-[10px] font-[500] text-gray-400 uppercase tracking-[0.06em]">active</span>
                    </p>
                </div>
                <nav className="py-1.5 flex-1">
                    {navItems.map(item => {
                        const isActive = activeTab === item.id;
                        const Icon = item.icon;
                        return (
                            <button key={item.id} onClick={() => setActiveTab(item.id)}
                                className={cn(
                                    'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-[7px] mx-1.5 my-0.5 text-[13px] font-[500] transition-all text-left',
                                    isActive ? 'bg-indigo-50 text-[#6366F1]' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
                                )} style={{ width: 'calc(100% - 12px)' }}>
                                <Icon className="shrink-0 text-[15px]" />
                                <span className="flex-1 truncate">{item.label}</span>
                                {item.count > 0 && (
                                    <span className={cn(
                                        'text-[10px] font-[600] px-1.5 py-0.5 rounded-full min-w-[18px] text-center',
                                        isActive ? 'bg-[#6366F1]/15 text-[#6366F1]' : 'bg-gray-100 text-gray-500'
                                    )}>{item.count}</span>
                                )}
                            </button>
                        );
                    })}
                </nav>
                <div className="p-3" style={{ borderTop: '1px solid rgba(0,0,0,0.07)' }}>
                    <button onClick={() => setIsCreateOpen(true)}
                        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-[6px] bg-[#6366F1] text-white text-[12px] font-[500] hover:bg-indigo-600 transition-colors">
                        <PiPlus className="text-[13px]" />
                        Add Vendor
                    </button>
                </div>
            </aside>

            {/* ── MAIN CONTENT ── */}
            <div className="flex-1 min-w-0 px-7 py-6 flex flex-col gap-5">

                {/* Toolbar */}
                <div className="flex items-center gap-3">
                    <div className="flex-1 max-w-xs">
                        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                            placeholder="Search vendors…"
                            className="w-full rounded-[6px] pl-3 pr-3 py-[9px] text-[12.5px] text-gray-900 placeholder:text-gray-300 outline-none focus:ring-1 focus:ring-[#6366F1] bg-white"
                            style={{ border: '1px solid rgba(0,0,0,0.09)' }} />
                    </div>
                    <p className="text-[12px] text-gray-400 shrink-0">{filtered.length} vendor{filtered.length !== 1 ? 's' : ''}</p>
                    <div className="ml-auto flex items-center rounded-[6px] overflow-hidden"
                        style={{ border: '1px solid rgba(0,0,0,0.09)' }}>
                        <button onClick={() => setView('grid')}
                            className={cn('px-2.5 py-1.5 transition-colors', view === 'grid' ? 'bg-indigo-50 text-[#6366F1]' : 'bg-white text-gray-400 hover:bg-gray-50')}>
                            <PiGridFour className="text-[14px]" />
                        </button>
                        <button onClick={() => setView('list')}
                            className={cn('px-2.5 py-1.5 transition-colors', view === 'list' ? 'bg-indigo-50 text-[#6366F1]' : 'bg-white text-gray-400 hover:bg-gray-50')}
                            style={{ borderLeft: '1px solid rgba(0,0,0,0.09)' }}>
                            <PiListBullets className="text-[14px]" />
                        </button>
                    </div>
                </div>

                {/* Empty state */}
                {filtered.length === 0 && (
                    <div className="bg-white rounded-[8px] py-20 flex flex-col items-center" style={CARD_STYLE}>
                        <div className="w-10 h-10 rounded-[8px] bg-gray-50 flex items-center justify-center mb-3"
                            style={{ border: '1px solid rgba(0,0,0,0.07)' }}>
                            {activeTab === 'active' ? <PiBuildings className="text-gray-300 text-xl" /> : <PiTrash className="text-gray-300 text-xl" />}
                        </div>
                        <p className="text-[13px] font-[500] text-gray-700">
                            {search ? 'No vendors match your search' : activeTab === 'active' ? 'No active vendors' : 'Trash bin is empty'}
                        </p>
                        {!search && activeTab === 'active' && (
                            <p className="text-[12px] text-gray-400 mt-0.5">Add a vendor to get started.</p>
                        )}
                    </div>
                )}

                {/* Grid view */}
                {view === 'grid' && filtered.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                        {filtered.map(vendor => {
                            const badge = statusBadge(vendor);
                            return (
                                <div key={vendor.id} className={cn(
                                    'bg-white rounded-[8px] flex flex-col transition-shadow',
                                    !vendor.isTrashed && 'hover:shadow-sm',
                                    vendor.isTrashed && 'opacity-70'
                                )} style={CARD_STYLE}>
                                    {/* Card header */}
                                    <div className="flex items-center gap-3 px-4 py-3.5" style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                                        <div className="w-9 h-9 rounded-[7px] bg-indigo-50 flex items-center justify-center text-[13px] font-[700] text-[#6366F1] shrink-0">
                                            {vendorInitials(vendor.name)}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <h3 className="text-[13px] font-[600] text-gray-900 truncate">{vendor.name}</h3>
                                            <p className="text-[11px] text-gray-400 mt-0.5 truncate">{vendor.category || 'Vendor'}</p>
                                        </div>
                                        <span className={cn('text-[10px] font-[500] px-2 py-0.5 rounded-[4px] shrink-0', badge.cls)}
                                            style={{ border: `1px solid ${badge.border}` }}>{badge.label}</span>
                                    </div>

                                    {/* Card body */}
                                    <div className="px-4 py-4 flex-1 space-y-2">
                                        {vendor.description && (
                                            <p className="text-[12px] text-gray-500 line-clamp-2 leading-relaxed">{vendor.description}</p>
                                        )}
                                        {vendor.email && (
                                            <p className="flex items-center gap-2 text-[12px] text-gray-500">
                                                <PiEnvelopeSimple className="text-gray-300 shrink-0 text-[13px]" />
                                                <span className="truncate">{vendor.email}</span>
                                            </p>
                                        )}
                                        {vendor.phone && (
                                            <p className="flex items-center gap-2 text-[12px] text-gray-500">
                                                <PiPhone className="text-gray-300 shrink-0 text-[13px]" />
                                                {vendor.phone}
                                            </p>
                                        )}
                                        {vendor.paymentTerms && (
                                            <p className="text-[11px] text-gray-400">{vendor.paymentTerms}</p>
                                        )}
                                    </div>

                                    {/* Card footer */}
                                    <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: '1px solid rgba(0,0,0,0.07)' }}>
                                        <div className="flex items-center gap-2">
                                            {!vendor.isTrashed ? (
                                                <>
                                                    <button onClick={() => setEditingVendor(vendor)}
                                                        className="px-3.5 py-1.5 rounded-[6px] text-[12px] font-[500] text-gray-600 hover:bg-gray-50 transition-colors"
                                                        style={{ border: '1px solid rgba(0,0,0,0.09)' }}>
                                                        Manage
                                                    </button>
                                                    <button onClick={() => handleTrash(vendor.id)}
                                                        className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-[5px] transition-colors"
                                                        title="Move to Trash">
                                                        <PiTrash className="text-[14px]" />
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    <button onClick={() => handleRestore(vendor.id)}
                                                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-[6px] text-[12px] font-[500] text-emerald-600 hover:bg-emerald-50 transition-colors"
                                                        style={{ border: '1px solid rgba(16,185,129,0.2)' }}>
                                                        <PiArrowCounterClockwise className="text-[13px]" /> Restore
                                                    </button>
                                                    <DeleteEntityButton id={vendor.id} entityType="vendor" entityName={vendor.name}
                                                        className="p-1.5 text-rose-400 hover:text-rose-700 hover:bg-rose-50 rounded-[5px]" />
                                                </>
                                            )}
                                        </div>
                                        {!vendor.isTrashed && vendor.website && (
                                            <a href={vendor.website} target="_blank" rel="noopener noreferrer"
                                                className="p-1.5 text-gray-400 hover:text-[#6366F1] hover:bg-indigo-50 rounded-[5px] transition-colors"
                                                title="Visit Website">
                                                <PiGlobe className="text-[14px]" />
                                            </a>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* List view */}
                {view === 'list' && filtered.length > 0 && (
                    <div className="bg-white rounded-[8px] overflow-hidden" style={CARD_STYLE}>
                        <table className="w-full">
                            <thead>
                                <tr className="bg-gray-50/60" style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                                    {['Vendor', 'Category', 'Contact', 'Terms', 'Status', 'Actions'].map((h, i) => (
                                        <th key={h} className={cn(
                                            'px-5 py-2.5 text-[10.5px] font-[500] uppercase tracking-[0.08em] text-gray-400',
                                            i === 5 ? 'text-right' : 'text-left'
                                        )}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((vendor, i) => {
                                    const badge = statusBadge(vendor);
                                    return (
                                        <tr key={vendor.id} className="hover:bg-gray-50/60 transition-colors"
                                            style={i < filtered.length - 1 ? ROW_BORDER : {}}>
                                            <td className="px-5 py-3.5">
                                                <div className="flex items-center gap-2.5">
                                                    <div className="w-7 h-7 rounded-[6px] bg-indigo-50 flex items-center justify-center text-[11px] font-[700] text-[#6366F1] shrink-0">
                                                        {vendorInitials(vendor.name)}
                                                    </div>
                                                    <div>
                                                        <p className="text-[13px] font-[500] text-gray-900">{vendor.name}</p>
                                                        {vendor.description && (
                                                            <p className="text-[11px] text-gray-400 truncate max-w-[200px]">{vendor.description}</p>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-5 py-3.5 text-[12.5px] text-gray-500">{vendor.category || '—'}</td>
                                            <td className="px-5 py-3.5">
                                                {vendor.email && <p className="text-[12px] text-gray-500 truncate max-w-[180px]">{vendor.email}</p>}
                                                {vendor.phone && <p className="text-[11.5px] text-gray-400">{vendor.phone}</p>}
                                            </td>
                                            <td className="px-5 py-3.5 text-[12px] text-gray-500 whitespace-nowrap">{vendor.paymentTerms || '—'}</td>
                                            <td className="px-5 py-3.5">
                                                <span className={cn('text-[10.5px] font-[500] px-2 py-0.5 rounded-[4px]', badge.cls)}
                                                    style={{ border: `1px solid ${badge.border}` }}>{badge.label}</span>
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <div className="flex items-center justify-end gap-2">
                                                    {!vendor.isTrashed ? (
                                                        <>
                                                            <button onClick={() => setEditingVendor(vendor)}
                                                                className="px-3 py-1.5 rounded-[6px] text-[12px] font-[500] text-gray-600 hover:bg-gray-50 transition-colors"
                                                                style={{ border: '1px solid rgba(0,0,0,0.09)' }}>
                                                                Manage
                                                            </button>
                                                            <button onClick={() => handleTrash(vendor.id)}
                                                                className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-[5px] transition-colors">
                                                                <PiTrash className="text-[13px]" />
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <button onClick={() => handleRestore(vendor.id)}
                                                                className="flex items-center gap-1 px-3 py-1.5 rounded-[6px] text-[12px] font-[500] text-emerald-600 hover:bg-emerald-50 transition-colors"
                                                                style={{ border: '1px solid rgba(16,185,129,0.2)' }}>
                                                                <PiArrowCounterClockwise className="text-[12px]" /> Restore
                                                            </button>
                                                            <DeleteEntityButton id={vendor.id} entityType="vendor" entityName={vendor.name}
                                                                className="p-1.5 text-rose-400 hover:text-rose-700 hover:bg-rose-50 rounded-[5px]" />
                                                        </>
                                                    )}
                                                    {!vendor.isTrashed && vendor.website && (
                                                        <a href={vendor.website} target="_blank" rel="noopener noreferrer"
                                                            className="p-1.5 text-gray-400 hover:text-[#6366F1] hover:bg-indigo-50 rounded-[5px] transition-colors">
                                                            <PiGlobe className="text-[13px]" />
                                                        </a>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <CreateVendorModal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} />
            {editingVendor && (
                <EditVendorModal isOpen={!!editingVendor} vendor={editingVendor} onClose={() => setEditingVendor(null)} />
            )}
        </div>
    );
}
