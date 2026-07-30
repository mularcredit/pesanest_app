const STROKE = '#6366f1';

export function SparklineMini({ }: { data?: number[]; color?: string }) {
    return (
        <div
            className="absolute bottom-0 left-0 right-0 h-[64px] pointer-events-none"
            style={{
                background: `linear-gradient(to top, ${STROKE}18 0%, transparent 100%)`,
                borderBottom: `1px solid ${STROKE}66`,
            }}
        />
    );
}
