import type { Metadata } from "next";
import { Lexend, Poppins } from "next/font/google";
import { GeistSans } from "geist/font/sans";
import "./globals.css";
import { Providers } from "@/components/Providers";

const lexend = Lexend({
  subsets: ["latin"],
  variable: "--font-lexend",
});

// Trying Poppins as the app's primary typeface. Bound to the same --font-outfit
// variable that globals.css already references everywhere (body, .font-sans,
// .font-heading, .dash-main, .font-mono) so this is a one-line swap to try —
// revert by changing this back to next/font/google's Outfit.
const outfit = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-outfit",
  display: "swap",
});

const appName = process.env.NEXT_PUBLIC_APP_NAME || "CapitalPay";
const defaultLogoUrl = process.env.NEXT_PUBLIC_LOGO_URL || "/SITE.png";
const logoUrl = appName === "Pesanest" ? "/pesanest/pesanest-light-new.png" : defaultLogoUrl;

export const metadata: Metadata = {
  title: `${appName} expense system`,
  description: "Smart expense management and automated approval system",
  icons: {
    icon: `${logoUrl}?v=2`,
    shortcut: `${logoUrl}?v=2`,
    apple: `${logoUrl}?v=2`,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="light">
      <body className={`antialiased min-h-screen ${lexend.variable} ${GeistSans.variable} ${outfit.variable} font-sans`} style={{ backgroundColor: 'var(--page)', color: 'var(--t1)' }} suppressHydrationWarning>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
