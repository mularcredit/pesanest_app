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

const HAIRLINE = '1px solid rgba(0,0,0,0.07)';

export function StatsCard({ title, value, trend, trendUp, icon: Icon, lastMonthLabel, color = "purple", sparkline }: StatsCardProps) {
    const isUp = trendUp !== false;

    return (
        <div className="bg-white rounded-[10px] p-4 flex flex-col gap-2 relative overflow-hidden" style={{ border: HAIRLINE }}>

            {sparkline && sparkline.length > 0 && (
                <SparklineMini data={sparkline} color={color} />
            )}

            <div className="flex items-center gap-2 relative z-10">
                <div className="w-8 h-8 rounded-[7px] flex items-center justify-center shrink-0 bg-gray-50" style={{ color: '#059669' }}>
                    <Icon className="text-[14px]" />
                </div>
                <p className="flex-1 text-[10px] font-[600] uppercase tracking-[0.09em] text-gray-400 truncate leading-tight">{title}</p>
            </div>

            <div className="flex flex-col gap-1.5 min-w-0 relative z-10">
                <span className="text-[22px] font-[600] text-gray-900 leading-none tracking-tight truncate tabular-nums" title={value}>
                    {value}
                </span>
                {(trend || lastMonthLabel) && (
                    <div className="flex items-center gap-2 flex-wrap">
                        {trend && (
                            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-[4px] text-[10.5px] font-[500] shrink-0"
                                style={{
                                    background: isUp ? 'rgba(5,150,105,0.07)' : 'rgba(220,38,38,0.07)',
                                    color:      isUp ? '#059669' : '#dc2626',
                                    border:     isUp ? '1px solid rgba(5,150,105,0.2)' : '1px solid rgba(220,38,38,0.2)',
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
