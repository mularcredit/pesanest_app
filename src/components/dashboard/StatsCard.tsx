import { cn } from "@/lib/utils";
import { IconType } from "react-icons";
import { PiArrowUp, PiArrowDown } from "react-icons/pi";
import { SparklineMini } from "./SparklineMini";

interface StatsCardProps {
    title: string;
    value: string;
    trend?: string;
    trendUp?: boolean;
    icon: IconType;
    lastMonthLabel?: string;
    color?: "purple" | "cyan" | "emerald" | "blue" | "indigo" | "amber" | "slate";
    sparkline?: number[];
    /** @deprecated */ officialIcon?: string;
    /** @deprecated */ image?: string;
    bgColor?: string;
}

const iconBg: Record<string, string> = {
    emerald: "bg-emerald-50 text-emerald-600",
    purple:  "bg-indigo-50 text-[#6366F1]",
    indigo:  "bg-indigo-50 text-[#6366F1]",
    cyan:    "bg-cyan-50 text-cyan-600",
    amber:   "bg-amber-50 text-amber-600",
    blue:    "bg-blue-50 text-blue-600",
    slate:   "bg-gray-50 text-slate-500",
};

const CARD_STYLE: React.CSSProperties = { border: '1px solid rgba(0,0,0,0.09)' };

export function StatsCard({ title, value, trend, trendUp, icon: Icon, lastMonthLabel, color = "purple", sparkline }: StatsCardProps) {
    const iconClass = iconBg[color] ?? iconBg.slate;
    const isUp = trendUp !== false;

    return (
        <div className="bg-white rounded-[8px] p-5 flex flex-col gap-3 overflow-hidden relative" style={CARD_STYLE}>

            {sparkline && sparkline.length > 0 && (
                <SparklineMini data={sparkline} color={color} />
            )}

            <div className="flex items-center gap-3 relative z-10">
                <div className={cn("w-9 h-9 rounded-[7px] flex items-center justify-center shrink-0", iconClass)}>
                    <Icon className="text-[15px]" />
                </div>
                <p className="flex-1 text-[12.5px] font-[500] text-gray-500 truncate leading-tight">{title}</p>
            </div>

            <div className="flex flex-col gap-2 min-w-0 relative z-10">
                <span className="text-[22px] font-[600] text-gray-900 leading-none tracking-tight truncate tabular-nums" title={value}>
                    {value}
                </span>
                {(trend || lastMonthLabel) && (
                    <div className="flex items-center gap-2 flex-wrap">
                        {trend && (
                            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-[4px] text-[10.5px] font-[500] shrink-0"
                                style={{
                                    background: isUp ? 'rgba(16,185,129,0.07)' : 'rgba(239,68,68,0.07)',
                                    color:      isUp ? '#059669' : '#dc2626',
                                    border:     isUp ? '1px solid rgba(16,185,129,0.2)' : '1px solid rgba(239,68,68,0.2)',
                                }}>
                                {isUp ? <PiArrowUp className="text-[10px]" /> : <PiArrowDown className="text-[10px]" />}
                                {trend}
                            </span>
                        )}
                        {lastMonthLabel && (
                            <span className="text-[11.5px] text-gray-400 truncate">{lastMonthLabel}</span>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
