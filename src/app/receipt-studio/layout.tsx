import type { Metadata } from "next";

const appName = process.env.NEXT_PUBLIC_APP_NAME || "CapitalPay";

export const metadata: Metadata = {
    title: `Voucher Studio | ${appName}`,
    description: "Create & issue official disbursement vouchers",
};

/**
 * Voucher Studio layout intentionally resets the global Avenir Next font back
 * to the system/Lexend stack. This studio has its own dark-mode design language
 * and should not inherit the Avenir Next global font.
 */
export default function VoucherStudioLayout({ children }: { children: React.ReactNode }) {
    return (
        <div style={{
            fontFamily: 'var(--font-lexend), -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", Helvetica, Arial, sans-serif',
        }}>
            {children}
        </div>
    );
}
