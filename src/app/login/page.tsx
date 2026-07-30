"use client";

import { Suspense } from "react";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { HiArrowRight } from "react-icons/hi2";
import { BrandLogo } from "@/components/ui/BrandLogo";

function LoginComponent() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [totp, setTotp] = useState("");
    const [totpRequired, setTotpRequired] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const searchParams = useSearchParams();
    const signupSuccess = searchParams.get("signup") === "success";

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            const result = await signIn("credentials", {
                email,
                password,
                totp: totp || undefined,
                redirect: false,
            });

            if (result?.error) {
                if (!totpRequired && !totp) {
                    // Check server whether this account actually has TOTP before showing the field
                    const check = await fetch(`/api/auth/check-totp?email=${encodeURIComponent(email)}`).then(r => r.json()).catch(() => ({ totpEnabled: false }));
                    if (check.totpEnabled) {
                        setTotpRequired(true);
                        setError("Enter your 6-digit authenticator code below.");
                    } else {
                        setError("Invalid email or password. Please try again.");
                    }
                } else {
                    setError("Invalid credentials or authenticator code. Please try again.");
                }
                setLoading(false);
                return;
            }

            router.push("/dashboard");
        } catch (err) {
            setError("Something went wrong. Please try again.");
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col lg:flex-row font-sans">
            {/* Left Side */}
            <div className="hidden lg:block lg:w-1/2 relative overflow-hidden"
                style={{ background: '#3730a3' }}>

                {/* Wave texture background */}
                <div className="absolute inset-0" style={{
                    backgroundImage: 'url(/card-waves.jpeg)',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    opacity: 0.2,
                    mixBlendMode: 'screen',
                }} />

                {/* Logo */}
                <div className="absolute top-10 left-10 z-20">
                    <Link href="/">
                        <BrandLogo width={180} height={42} color="#ffffff" />
                    </Link>
                </div>

                {/* Headline text */}
                <div className="absolute left-0 right-0 z-20 px-10" style={{ top: '20%' }}>
                    <h2 className="text-[58px] font-[500] leading-[1.1] tracking-tight" style={{ color: '#ffffff' }}>
                        Where every<br />shilling finds<br />its nest.
                    </h2>
                    <p className="text-[14px] mt-5 leading-relaxed max-w-[280px]" style={{ color: 'rgba(255,255,255,0.6)' }}>
                        Expenses, invoices, and books. All cozy in one place. No spreadsheet panic required.
                    </p>
                </div>

                {/* Person image */}
                <div className="absolute bottom-0 left-0 right-0 z-10" style={{ height: '52%' }}>
                    <Image
                        src="/bearded-man-denim-shirt-round-glasses.png"
                        alt="Platform user"
                        fill
                        className="object-contain object-bottom"
                        priority
                    />
                    <div className="absolute bottom-0 left-0 right-0 h-24"
                        style={{ background: 'linear-gradient(to top, #3730a3, transparent)' }} />
                </div>
            </div>

            {/* Right Side - Login Form */}
            <div className="flex-1 flex flex-col bg-white" style={{ fontFamily: 'var(--font-lexend)' }}>

                {/* ── MOBILE HEADER (visible only on small screens) ── */}
                <div className="lg:hidden relative overflow-hidden px-8 pt-10 pb-16"
                    style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #3730a3 50%, #1e1b4b 100%)' }}>
                    <div className="absolute inset-0 pointer-events-none" style={{
                        backgroundImage: 'url(/card-waves.jpeg)',
                        backgroundSize: 'cover',
                        opacity: 0.1,
                        mixBlendMode: 'screen',
                    }} />
                    <Link href="/" className="relative z-10 inline-flex items-center gap-3 mb-6">
                        <BrandLogo width={160} height={40} color="#ffffff" />
                    </Link>
                    <div className="relative z-10">
                        <h2 className="text-2xl font-[700] text-white tracking-tight leading-snug">
                            Where Every Shilling<br />Finds Its Nest.
                        </h2>
                        <p className="text-xs text-white/60 mt-2">
                            Expenses, invoices, and books. All cozy in one place. No spreadsheet panic required.
                        </p>
                    </div>
                </div>

                {/* ── FORM PANEL ── */}
                <div className="flex-1 flex items-center justify-center px-6 py-10 bg-[#F5F5F5] relative">
                    <div className="w-full max-w-[420px] relative z-10">

                        <h1 className="text-[28px] font-bold text-zinc-900 tracking-tight mb-2">Welcome back</h1>
                        <p className="text-[13px] font-light text-zinc-500 mb-10 leading-relaxed">
                            Sign in to your {process.env.NEXT_PUBLIC_APP_NAME || "Pesanest"} workspace.
                        </p>

                        {signupSuccess && (
                            <div className="mb-5 p-3 rounded-lg text-[11px] text-center bg-emerald-50 text-emerald-700 border border-emerald-200">
                                Request submitted! Please wait for admin approval.
                            </div>
                        )}
                        {error && (
                            <div className="mb-5 p-3 rounded-lg text-[11px] text-center bg-rose-50 text-rose-700 border border-rose-200">
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit}>
                            {/* Email */}
                            <div className="mb-1.5 text-xs font-medium text-zinc-900">Work email</div>
                            <div className="mb-5">
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="you@company.com"
                                    required
                                    className="w-full outline-none transition-all rounded-lg text-[13px] text-zinc-900 bg-[#6366F1]/[0.02] border border-[#6366F1]/30 focus:border-[#6366F1] focus:bg-[#6366F1]/[0.04]"
                                    style={{ padding: "11px 16px" }}
                                />
                            </div>

                            {/* Password */}
                            <div className="flex justify-between items-center mb-1.5">
                                <span className="text-xs font-medium text-zinc-900">Password</span>
                                <Link href="/forgot-password" className="text-[11px] text-[#6366F1]/70 hover:text-[#6366F1] transition-colors">
                                    Forgot password?
                                </Link>
                            </div>
                            <div className={totpRequired ? 'mb-4' : 'mb-8'}>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Enter your secure password"
                                    required
                                    className="w-full outline-none transition-all rounded-lg text-[13px] text-zinc-900 bg-[#6366F1]/[0.02] border border-[#6366F1]/30 focus:border-[#6366F1] focus:bg-[#6366F1]/[0.04]"
                                    style={{ padding: "11px 16px" }}
                                />
                            </div>

                            {totpRequired && (
                                <div className="mb-6">
                                    <div className="mb-1.5 text-xs font-medium text-zinc-900">Authenticator Code</div>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        pattern="[0-9]{6}"
                                        maxLength={6}
                                        value={totp}
                                        onChange={(e) => setTotp(e.target.value.replace(/\D/g, ''))}
                                        placeholder="000000"
                                        className="w-full outline-none transition-all rounded-lg text-[13px] text-zinc-900 bg-[#6366F1]/[0.02] border border-[#6366F1]/30 focus:border-[#6366F1] focus:bg-[#6366F1]/[0.04] text-center tracking-[0.5em] font-mono"
                                        style={{ padding: "11px 16px" }}
                                    />
                                </div>
                            )}

                            <div className="flex items-center gap-2 mb-8">
                                <input
                                    type="checkbox"
                                    className="w-4 h-4 rounded border-zinc-300 text-[#6366F1] focus:ring-[#6366F1]"
                                />
                                <span className="text-xs font-normal text-zinc-600">Remember me</span>
                            </div>

                            {/* Submit */}
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full flex items-center justify-center gap-2.5 transition-all disabled:opacity-60 bg-[#6366F1] hover:brightness-110 hover:-translate-y-0.5 text-white rounded-lg py-[13px] text-sm font-bold tracking-wide"
                            >
                                {loading ? "Authenticating..." : <>Sign in <HiArrowRight /></>}
                            </button>
                        </form>

                        {/* Divider */}
                        <div className="flex items-center gap-3 my-6">
                            <div className="flex-1 h-[0.5px] bg-zinc-200" />
                            <span className="text-[11px] text-zinc-400">or</span>
                            <div className="flex-1 h-[0.5px] bg-zinc-200" />
                        </div>

                        {/* Footer */}
                        <p className="text-xs font-normal text-zinc-500">
                            Don't have an account?{" "}
                            <Link href="/signup" className="font-semibold text-[#6366F1] hover:text-[#6366F1]/80 transition-colors">
                                Request access
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-900">Loading...</div>}>
            <LoginComponent />
        </Suspense>
    );
}
