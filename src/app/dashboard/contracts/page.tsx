import { PiFileText, PiPlus, PiShieldCheck, PiBell, PiClipboardText } from "react-icons/pi";

const CARD_STYLE: React.CSSProperties = { border: '1px solid rgba(0,0,0,0.09)' };

export default function ContractsPage() {
    return (
        <div className="space-y-6 pb-24">
            {/* Page header */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-[20px] font-[600] text-gray-900 tracking-tight">Contracts</h1>
                    <p className="text-[12.5px] text-gray-400 mt-0.5">Vendor agreements, renewals &amp; compliance</p>
                </div>
                <button className="flex items-center gap-2 px-4 py-2 rounded-[6px] text-[12.5px] font-[500] bg-[#6366F1] text-white hover:bg-indigo-600 transition-colors">
                    <PiPlus className="text-[14px]" />
                    New Contract
                </button>
            </div>

            {/* Coming soon feature tiles */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                    { Icon: PiFileText,       title: 'Contract Repository',  desc: 'Store and version-control all your vendor agreements in one place.' },
                    { Icon: PiBell,           title: 'Renewal Alerts',       desc: 'Automated reminders before contracts expire so nothing slips through.' },
                    { Icon: PiShieldCheck,    title: 'Compliance Tracking',  desc: 'Track obligations, deliverables, and compliance status per agreement.' },
                ].map(({ Icon, title, desc }) => (
                    <div key={title} className="bg-white rounded-[8px] px-5 py-5" style={CARD_STYLE}>
                        <div className="w-8 h-8 rounded-[7px] bg-indigo-50 flex items-center justify-center mb-3">
                            <Icon className="text-[#6366F1] text-[15px]" />
                        </div>
                        <p className="text-[13px] font-[600] text-gray-900">{title}</p>
                        <p className="text-[12px] text-gray-400 mt-1 leading-relaxed">{desc}</p>
                    </div>
                ))}
            </div>

            {/* Empty state */}
            <div className="bg-white rounded-[8px] py-20 flex flex-col items-center" style={CARD_STYLE}>
                <div className="w-10 h-10 rounded-[8px] bg-gray-50 flex items-center justify-center mb-3"
                    style={{ border: '1px solid rgba(0,0,0,0.07)' }}>
                    <PiClipboardText className="text-gray-300 text-xl" />
                </div>
                <p className="text-[13px] font-[500] text-gray-700">Contract repository coming soon</p>
                <p className="text-[12px] text-gray-400 mt-0.5">Create your first contract to get started.</p>
            </div>
        </div>
    );
}
