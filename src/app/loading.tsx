'use client';
import { BrandLogo } from "@/components/ui/BrandLogo";

export default function Loading() {
    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#F6F5F2] pointer-events-none">
            <div style={{ animation: 'logo-pulse 1.4s ease-in-out infinite' }}>
                <BrandLogo width={180} height={40} color="#4338ca" />
            </div>

            <style jsx global>{`
                @keyframes logo-pulse {
                    0%, 100% { opacity: 1; }
                    50%       { opacity: 0.3; }
                }
            `}</style>
        </div>
    );
}
