"use client";

import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { AIAssistant } from "@/components/layout/AIAssistant";
import { useState } from "react";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(false);

    return (
        <div className="flex h-screen overflow-hidden bg-[var(--page)] font-[var(--font-midnight)] text-[var(--t1)]">
            {/* Technical Ambient Pattern — hidden in light mode */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10 opacity-30 dark-deco-layer">
                <div className="absolute inset-0 opacity-[0.1]"
                     style={{ backgroundImage: `linear-gradient(var(--p-line) 1px, transparent 1px), linear-gradient(90deg, var(--p-line) 1px, transparent 1px)`, backgroundSize: '40px 40px' }}
                />
                <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-[var(--p-glow)] rounded-full blur-[150px] mix-blend-screen opacity-10"></div>
            </div>

            <Sidebar
                isOpen={isMobileMenuOpen}
                onClose={() => setIsMobileMenuOpen(false)}
                isDesktopCollapsed={isDesktopCollapsed}
                onToggleDesktop={() => setIsDesktopCollapsed(!isDesktopCollapsed)}
            />

            {/* Mobile Overlay */}
            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            <div className="flex-1 flex flex-col min-w-0 w-full relative">
                <Header onMenuClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} />

                <div className="flex-1 overflow-y-auto w-full" style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--t4) transparent' }}>
                    <main className="w-full" style={{ padding: '22px 26px 52px' }}>
                        {children}
                    </main>
                </div>
            </div>

            <AIAssistant />
        </div>
    );
}
