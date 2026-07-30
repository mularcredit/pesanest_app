"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { HiEnvelope, HiArrowLeft, HiArrowRight, HiCheckCircle } from "react-icons/hi2";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { cn } from "@/lib/utils";

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            const res = await fetch("/api/auth/forgot-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
            });

            if (res.ok) {
                setSent(true);
            } else {
                const data = await res.json();
                setError(data.error || "Something went wrong.");
            }
        } catch (err) {
            setError("Something went wrong. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-white flex font-sans">
            {/* Left Side - Background Image */}
            <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
                <Image
                    src="/45021.jpg"
                    alt="Background"
                    fill
                    className="object-cover object-center"
                    priority
                />
                <div className={cn(
                    "absolute inset-0 backdrop-blur-[1px]",
                    process.env.NEXT_PUBLIC_APP_NAME === "Pesanest"
                        ? "bg-gradient-to-br from-[#1e005a]/90 to-black/70"
                        : "bg-gradient-to-br from-[#6366F1]/90 to-black/70"
                )}>
                    <div className="h-full flex flex-col justify-between p-12">
                        <Link href="/" className="flex items-center gap-3">
                            <BrandLogo width={140} height={32} color="#ffffff" />
                        </Link>

                        <div className="text-white">
                            <h2 className="text-4xl font-semibold mb-4">
                                Reset Your<br />Password
                            </h2>
                            <p className="text-lg text-white/80 max-w-md">
                                Enter your email address and we'll send you instructions to reset your password.
                            </p>
                        </div>

                        <div className="text-white/60 text-sm">
                            © 2026 {process.env.NEXT_PUBLIC_APP_NAME || "CapitalPay"}. All rights reserved.
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Side - Form */}
            <div className="flex-1 flex items-center justify-center p-8 bg-[#F5F5F5]">
                <div className="w-full max-w-[420px]">
                    {/* Mobile Logo */}
                    <div className="lg:hidden mb-8 text-center">
                        <Link href="/" className="inline-block">
                            <BrandLogo width={120} height={28} color="#6366F1" />
                        </Link>
                    </div>

                    {!sent ? (
                        <>
                            <Link
                                href="/login"
                                className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-500 hover:text-zinc-900 mb-6 transition-colors"
                            >
                                <HiArrowLeft />
                                Back to login
                            </Link>

                            {/* Eyebrow */}
                            <div className="flex items-center gap-3 mb-7">
                                <div className="w-5 h-[1.5px] bg-[#6366F1]" />
                                <span className="text-[11px] text-[#6366F1] tracking-[2px] font-semibold uppercase">
                                    Account recovery
                                </span>
                            </div>

                            <h1 className="text-[28px] font-bold text-zinc-900 tracking-tight mb-2">Forgot password?</h1>
                            <p className="text-[13px] font-light text-zinc-500 mb-10 leading-relaxed">
                                No worries — enter your email and we'll send you reset instructions.
                            </p>

                            <form onSubmit={handleSubmit}>
                                {error && (
                                    <div className="mb-5 p-3 rounded-lg text-[11px] text-center bg-rose-50 text-rose-700 border border-rose-200">
                                        {error}
                                    </div>
                                )}

                                <div className="mb-1.5 text-xs font-medium text-zinc-900">Email address</div>
                                <div className="mb-8">
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

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full flex items-center justify-center gap-2.5 transition-all disabled:opacity-60 bg-[#6366F1] hover:brightness-110 hover:-translate-y-0.5 text-white rounded-lg py-[13px] text-sm font-bold tracking-wide"
                                >
                                    {loading ? "Sending..." : <>Send reset instructions <HiArrowRight /></>}
                                </button>
                            </form>

                            <div className="flex items-center gap-3 my-6">
                                <div className="flex-1 h-[0.5px] bg-zinc-200" />
                                <span className="text-[11px] text-zinc-400">or</span>
                                <div className="flex-1 h-[0.5px] bg-zinc-200" />
                            </div>

                            <p className="text-xs font-normal text-zinc-500">
                                Remember your password?{" "}
                                <Link href="/login" className="font-semibold text-[#6366F1] hover:text-[#6366F1]/80 transition-colors">
                                    Sign in
                                </Link>
                            </p>
                        </>
                    ) : (
                        <div className="text-center">
                            <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6 border border-emerald-100">
                                <HiCheckCircle className="text-4xl text-emerald-600" />
                            </div>
                            <h1 className="text-[24px] font-bold text-zinc-900 tracking-tight mb-3">Check your email</h1>
                            <p className="text-zinc-500 text-[13px] mb-8">
                                We've sent password reset instructions to <strong className="text-zinc-700">{email}</strong>
                            </p>
                            <p className="text-xs text-zinc-400 mb-6">
                                Didn't receive the email? Check your spam folder or try again.
                            </p>
                            <Link href="/login">
                                <button className="inline-flex items-center justify-center gap-2.5 transition-all bg-[#6366F1] hover:brightness-110 text-white rounded-lg py-3 px-6 text-sm font-bold">
                                    Back to login
                                </button>
                            </Link>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
