const fs = require('fs');
const file = '/Users/mac/Desktop/pesanest1/src/components/dashboard/ApprovalQueue.tsx';
let content = fs.readFileSync(file, 'utf8');

// Update function signature
content = content.replace(
    /action: 'APPROVE' \| 'REJECT'\) => {/,
    "action: 'APPROVE' | 'REJECT' | 'ADJUST') => {"
);

content = content.replace(
    /decision: action === 'APPROVE' \? 'APPROVED' : 'REJECTED'/,
    "decision: action === 'APPROVE' ? 'APPROVED' : (action === 'REJECT' ? 'REJECTED' : 'ADJUSTMENT')"
);

// We have grid buttons of form: <div className="grid grid-cols-2 gap-2">
const gridRegex = /<div className="grid grid-cols-2 gap-2">\s*<button\s*onClick={\(\) => handleApproval\(\(([^ ]+) as any\)\.approvalId, 'APPROVE'\)}\s*disabled={isProcessing}\s*className="py-2 bg-\[#29258D\] text-white text-xs font-semibold rounded-md hover:bg-\[#29258D\]\/90 transition-all flex items-center justify-center gap-1"\s*>\s*{isProcessing \? <PiSpinner className="animate-spin" \/> : <PiCheckCircle \/>} Approve\s*<\/button>\s*<button\s*onClick={\(\) => handleApproval\(\(\1 as any\)\.approvalId, 'REJECT'\)}\s*disabled={isProcessing}\s*className="py-2 bg-white border border-rose-200 text-rose-600 text-xs font-semibold rounded-md hover:bg-rose-50 transition-all flex items-center justify-center gap-1"\s*>\s*{isProcessing \? <PiSpinner className="animate-spin" \/> : <PiXCircle \/>} Reject\s*<\/button>\s*<\/div>/g;

content = content.replace(gridRegex, (match, entityType) => {
    return `<div className="grid grid-cols-3 gap-2">
                                                <button
                                                    onClick={() => handleApproval((${entityType} as any).approvalId, 'APPROVE')}
                                                    disabled={isProcessing}
                                                    className="py-2 bg-[#29258D] text-white text-xs font-semibold rounded-md hover:bg-[#29258D]/90 transition-all flex items-center justify-center gap-1"
                                                >
                                                    {isProcessing ? <PiSpinner className="animate-spin" /> : <PiCheckCircle />} Approve
                                                </button>
                                                <button
                                                    onClick={() => handleApproval((${entityType} as any).approvalId, 'ADJUST')}
                                                    disabled={isProcessing}
                                                    className="py-2 bg-white border border-amber-200 text-amber-600 text-xs font-semibold rounded-md hover:bg-amber-50 transition-all flex items-center justify-center gap-1"
                                                >
                                                    {isProcessing ? <PiSpinner className="animate-spin" /> : <PiClock />} Adjust
                                                </button>
                                                <button
                                                    onClick={() => handleApproval((${entityType} as any).approvalId, 'REJECT')}
                                                    disabled={isProcessing}
                                                    className="py-2 bg-white border border-rose-200 text-rose-600 text-xs font-semibold rounded-md hover:bg-rose-50 transition-all flex items-center justify-center gap-1"
                                                >
                                                    {isProcessing ? <PiSpinner className="animate-spin" /> : <PiXCircle />} Reject
                                                </button>
                                            </div>`;
});


// We have list buttons of form: 
const listRegex = /<button onClick={\(\) => handleApproval\(\(([^ ]+) as any\)\.approvalId, 'REJECT'\)}\s*disabled={isProcessing}\s*className="(py-2\.5 px-4 bg-white border border-rose-200 text-rose-600[^"]+)"\s*>({isProcessing \? <PiSpinner className="animate-spin text-sm" \/> : <PiXCircle className="text-sm" \/>} Reject)<\/button>\s*<button onClick={\(\) => handleApproval\(\(\1 as any\)\.approvalId, 'APPROVE'\)}\s*disabled={isProcessing}\s*className="([^"]+)"\s*>({isProcessing \? <PiSpinner className="animate-spin text-sm" \/> : <PiCheckCircle className="text-sm" \/>} Approve)<\/button>/g;

content = content.replace(listRegex, (match, entityType, rejectClass, rejectInner, approveClass, approveInner) => {
    return `<button onClick={() => handleApproval((${entityType} as any).approvalId, 'REJECT')} disabled={isProcessing} className="${rejectClass}">${rejectInner}</button>
                                                                <button onClick={() => handleApproval((${entityType} as any).approvalId, 'ADJUST')} disabled={isProcessing} className="py-2.5 px-4 bg-white border border-amber-200 text-amber-600 text-[11px] font-semibold uppercase tracking-widest rounded-lg hover:bg-amber-50 transition-all flex items-center gap-1.5">{isProcessing ? <PiSpinner className="animate-spin text-sm" /> : <PiClock className="text-sm" />} Adjust</button>
                                                                <button onClick={() => handleApproval((${entityType} as any).approvalId, 'APPROVE')} disabled={isProcessing} className="${approveClass}">${approveInner}</button>`;
});

fs.writeFileSync(file, content);
