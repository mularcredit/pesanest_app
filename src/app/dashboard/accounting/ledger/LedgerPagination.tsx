import { PiCaretLeft, PiCaretRight } from "react-icons/pi";

const HAIRLINE = '1px solid rgba(0,0,0,0.07)';

interface LedgerPaginationProps {
    page: number;
    totalPages: number;
    totalCount: number;
    showing: { from: number; to: number };
    pageUrl: (p: number) => string;
}

export function LedgerPagination({ page, totalPages, totalCount, showing, pageUrl }: LedgerPaginationProps) {
    if (totalPages <= 1) return null;

    return (
        <div className="bg-white rounded-[8px] flex items-center justify-between px-5 py-3" style={{ border: HAIRLINE }}>
            <p className="text-[12px] text-gray-400">
                Showing <span className="font-[600] text-gray-700">{showing.from}–{showing.to}</span> of{' '}
                <span className="font-[600] text-gray-700">{totalCount}</span> entries
            </p>

            <div className="flex items-center gap-1">
                {page > 1 ? (
                    <a href={pageUrl(page - 1)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-[6px] text-[12px] font-[500] text-gray-600 hover:bg-gray-100 transition-colors"
                        style={{ border: HAIRLINE }}>
                        <PiCaretLeft className="text-[12px]" /> Previous
                    </a>
                ) : (
                    <span className="flex items-center gap-1 px-3 py-1.5 rounded-[6px] text-[12px] font-[500] text-gray-300 cursor-not-allowed"
                        style={{ border: '1px solid rgba(0,0,0,0.04)' }}>
                        <PiCaretLeft className="text-[12px]" /> Previous
                    </span>
                )}

                {/* Page pills */}
                <div className="flex items-center gap-1 mx-2">
                    {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                        const p = i + 1;
                        const isCurrent = p === page;
                        return (
                            <a key={p} href={pageUrl(p)}
                                className="w-7 h-7 flex items-center justify-center rounded-[5px] text-[12px] font-[500] transition-colors"
                                style={{
                                    background: isCurrent ? '#6366F1' : 'transparent',
                                    color: isCurrent ? 'white' : '#6b7280',
                                    border: isCurrent ? '1px solid #6366F1' : HAIRLINE,
                                }}>
                                {p}
                            </a>
                        );
                    })}
                    {totalPages > 7 && (
                        <span className="text-[12px] text-gray-400 px-1">…{totalPages}</span>
                    )}
                </div>

                {page < totalPages ? (
                    <a href={pageUrl(page + 1)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-[6px] text-[12px] font-[500] text-gray-600 hover:bg-gray-100 transition-colors"
                        style={{ border: HAIRLINE }}>
                        Next <PiCaretRight className="text-[12px]" />
                    </a>
                ) : (
                    <span className="flex items-center gap-1 px-3 py-1.5 rounded-[6px] text-[12px] font-[500] text-gray-300 cursor-not-allowed"
                        style={{ border: '1px solid rgba(0,0,0,0.04)' }}>
                        Next <PiCaretRight className="text-[12px]" />
                    </span>
                )}
            </div>
        </div>
    );
}
