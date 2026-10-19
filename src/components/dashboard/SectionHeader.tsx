import { IconType } from "react-icons";

export const CARD_STYLE: React.CSSProperties = {
    border: '1px solid rgba(15,23,42,0.06)',
    boxShadow: '0 1px 2px rgba(15,23,42,0.03), 0 12px 28px -10px rgba(15,23,42,0.10)',
};

export const HAIRLINE = '1px solid rgba(15,23,42,0.06)';

/**
 * Consistent icon-badge + title + subtitle header, used at the top of every
 * dashboard card so each section reads as part of one designed system
 * instead of a grid of unrelated boxes each inventing their own header.
 */
export function SectionHeader({ icon: Icon, color, bg, title, subtitle, right }: {
    icon: IconType;
    color: string;
    bg: string;
    title: string;
    subtitle?: string;
    right?: React.ReactNode;
}) {
    return (
        <div className="flex items-start justify-between gap-3 mb-5">
            <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0" style={{ background: bg }}>
                    <Icon style={{ color }} className="text-[16px]" />
                </div>
                <div className="min-w-0">
                    <h2 className="text-[13.5px] font-[600] text-gray-900 truncate">{title}</h2>
                    {subtitle && <p className="text-[11.5px] text-gray-400 mt-0.5 truncate">{subtitle}</p>}
                </div>
            </div>
            {right && <div className="shrink-0">{right}</div>}
        </div>
    );
}
