import { IconType } from "react-icons";
import { PiArrowUp, PiArrowDown } from "react-icons/pi";

interface HeroStatTileProps {
    title: string;
    value: string;
    trend?: string;
    trendUp?: boolean;
    icon: IconType;
    lastMonthLabel?: string;
    accent: string;
    accentSoft: string;
    sparkline?: number[];
}

/** Builds a smoothed SVG path from a small series, scaled to a 0-100 x 0-32 box. */
function buildSparkPath(data: number[]): { line: string; area: string } {
    if (data.length < 2) return { line: '', area: '' };
    const max = Math.max(...data, 1);
    const min = Math.min(...data, 0);
    const range = max - min || 1;
    const stepX = 100 / (data.length - 1);
    const points = data.map((v, i) => {
        const x = i * stepX;
        const y = 32 - ((v - min) / range) * 30 - 1;
        return [x, y];
    });
    const line = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
    const area = `${line} L100,32 L0,32 Z`;
    return { line, area };
}

export function HeroStatTile({ title, value, trend, trendUp, icon: Icon, lastMonthLabel, accent, accentSoft, sparkline }: HeroStatTileProps) {
    const isUp = trendUp !== false;
    const hasSpark = sparkline && sparkline.length >= 2 && sparkline.some(v => v > 0);
    const { line, area } = hasSpark ? buildSparkPath(sparkline!) : { line: '', area: '' };
    const gradId = `spark-${title.replace(/\s+/g, '')}`;

    return (
        <div className="relative rounded-[16px] overflow-hidden bg-white transition-all duration-200 hover:-translate-y-0.5"
            style={{ border: '1px solid rgba(15,23,42,0.06)', boxShadow: '0 1px 2px rgba(15,23,42,0.03), 0 12px 28px -10px rgba(15,23,42,0.10)' }}>

            {/* Top accent bar */}
            <div className="h-[3px] w-full" style={{ background: accent }} />

            <div className="p-4 pt-3.5 relative">
                {/* Sparkline wash, bottom of card */}
                {hasSpark && (
                    <svg className="absolute bottom-0 left-0 w-full h-[34px] pointer-events-none" viewBox="0 0 100 32" preserveAspectRatio="none">
                        <defs>
                            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={accent} stopOpacity={0.18} />
                                <stop offset="100%" stopColor={accent} stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <path d={area} fill={`url(#${gradId})`} />
                        <path d={line} fill="none" stroke={accent} strokeOpacity={0.45} strokeWidth={1.25} vectorEffect="non-scaling-stroke" />
                    </svg>
                )}

                <div className="flex items-center gap-2.5 relative z-10">
                    <div className="w-8 h-8 rounded-[9px] flex items-center justify-center shrink-0" style={{ background: accentSoft }}>
                        <Icon className="text-[15px]" style={{ color: accent }} />
                    </div>
                    <p className="flex-1 text-[10px] font-[600] uppercase tracking-[0.09em] text-gray-400 truncate leading-tight">{title}</p>
                </div>

                <div className="flex flex-col gap-1.5 min-w-0 relative z-10 mt-3">
                    <span className="text-[23px] font-[700] text-gray-900 leading-none tracking-tight truncate tabular-nums" title={value}>
                        {value}
                    </span>
                    {(trend || lastMonthLabel) && (
                        <div className="flex items-center gap-2 flex-wrap">
                            {trend && (
                                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-[5px] text-[10.5px] font-[600] shrink-0"
                                    style={{
                                        background: isUp ? 'rgba(5,150,105,0.08)' : 'rgba(220,38,38,0.08)',
                                        color:      isUp ? '#059669' : '#dc2626',
                                    }}>
                                    {isUp ? <PiArrowUp className="text-[9.5px]" /> : <PiArrowDown className="text-[9.5px]" />}
                                    {trend}
                                </span>
                            )}
                            {lastMonthLabel && (
                                <span className="text-[11px] text-gray-400 truncate">{lastMonthLabel}</span>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
