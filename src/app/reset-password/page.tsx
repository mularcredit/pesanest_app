"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { HiArrowLeft, HiArrowRight, HiCheckCircle } from "react-icons/hi2";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { cn } from "@/lib/utils";

function ResetPasswordForm() {
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState("");
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams.get("token");

    useEffect(() => {
        if (!token) {
            setError("Invalid or missing reset token");
        }
    }, [token]);

    const validatePassword = (pass: string) => {
        if (pass.length < 8) return "Password must be at least 8 characters long";
        if (!/[A-Z]/.test(pass)) return "Password must contain at least one uppercase letter";
        if (!/[a-z]/.test(pass)) return "Password must contain at least one lowercase letter";
        if (!/[0-9]/.test(pass)) return "Password must contain at least one number";
        if (!/[!@#$%^&*]/.test(pass)) return "Password must contain at least one special character";
        return null;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const passwordError = validatePassword(password);
        if (passwordError) {
            setError(passwordError);
            return;
        }

        if (password !== confirmPassword) {
            setError("Passwords do not match");
            return;
        }

        setLoading(true);
        setError("");

        try {
            const res = await fetch("/api/auth/reset-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token, password }),
            });

            if (res.ok) {
                setSuccess(true);
                setTimeout(() => {
                    router.push("/login");
                }, 3000);
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
                                Create New<br />Password
                            </h2>
                            <p className="text-lg text-white/80 max-w-md">
                                Choose a strong password to secure your account.
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

                    {!success ? (
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
                                    New password
                                </span>
                            </div>

                            <h1 className="text-[28px] font-bold text-zinc-900 tracking-tight mb-2">Reset password</h1>
                            <p className="text-[13px] font-light text-zinc-500 mb-10 leading-relaxed">
                                Enter your new password below.
                            </p>

                            <form onSubmit={handleSubmit}>
                                {error && (
                                    <div className="mb-5 p-3 rounded-lg text-[11px] text-center bg-rose-50 text-rose-700 border border-rose-200">
                                        {error}
                                    </div>
                                )}

                                <div className="mb-1.5 text-xs font-medium text-zinc-900">New password</div>
                                <div className="mb-2">
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Enter new password"
                                        required
                                        minLength={8}
                                        className="w-full outline-none transition-all rounded-lg text-[13px] text-zinc-900 bg-[#6366F1]/[0.02] border border-[#6366F1]/30 focus:border-[#6366F1] focus:bg-[#6366F1]/[0.04]"
                                        style={{ padding: "11px 16px" }}
                                    />
                                </div>
                                {password && (
                                    <div className="mb-6 px-1 space-y-1.5 pt-2">
                                        <div className="flex items-center gap-2 text-[11px]">
                                            <div className={`w-1.5 h-1.5 rounded-full ${password.length >= 8 ? 'bg-emerald-500' : 'bg-zinc-300'}`} />
                                            <span className={password.length >= 8 ? 'text-emerald-600 font-medium' : 'text-zinc-500'}>
                                                At least 8 characters
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 text-[11px]">
                                            <div className={`w-1.5 h-1.5 rounded-full ${/[A-Z]/.test(password) ? 'bg-emerald-500' : 'bg-zinc-300'}`} />
                                            <span className={/[A-Z]/.test(password) ? 'text-emerald-600 font-medium' : 'text-zinc-500'}>
                                                One uppercase letter
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 text-[11px]">
                                            <div className={`w-1.5 h-1.5 rounded-full ${/[0-9]/.test(password) ? 'bg-emerald-500' : 'bg-zinc-300'}`} />
                                            <span className={/[0-9]/.test(password) ? 'text-emerald-600 font-medium' : 'text-zinc-500'}>
                                                One number
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 text-[11px]">
                                            <div className={`w-1.5 h-1.5 rounded-full ${/[!@#$%^&*]/.test(password) ? 'bg-emerald-500' : 'bg-zinc-300'}`} />
                                            <span className={/[!@#$%^&*]/.test(password) ? 'text-emerald-600 font-medium' : 'text-zinc-500'}>
                                                One special character
                                            </span>
                                        </div>
                                    </div>
                                )}

                                <div className="mb-1.5 text-xs font-medium text-zinc-900">Confirm password</div>
                                <div className="mb-8">
                                    <input
                                        type="password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder="Confirm new password"
                                        required
                                        className="w-full outline-none transition-all rounded-lg text-[13px] text-zinc-900 bg-[#6366F1]/[0.02] border border-[#6366F1]/30 focus:border-[#6366F1] focus:bg-[#6366F1]/[0.04]"
                                        style={{ padding: "11px 16px" }}
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading || !token}
                                    className="w-full flex items-center justify-center gap-2.5 transition-all disabled:opacity-60 bg-[#6366F1] hover:brightness-110 hover:-translate-y-0.5 text-white rounded-lg py-[13px] text-sm font-bold tracking-wide"
                                >
                                    {loading ? "Resetting..." : <>Reset password <HiArrowRight /></>}
                                </button>
                            </form>
                        </>
                    ) : (
                        <div className="text-center">
                            <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6 border border-emerald-100">
                                <HiCheckCircle className="text-4xl text-emerald-600" />
                            </div>
                            <h1 className="text-[24px] font-bold text-zinc-900 tracking-tight mb-3">Password reset successful</h1>
                            <p className="text-zinc-500 text-[13px] mb-8">
                                Your password has been reset. Redirecting to login...
                            </p>
                            <Link href="/login">
                                <button className="inline-flex items-center justify-center gap-2.5 transition-all bg-[#6366F1] hover:brightness-110 text-white rounded-lg py-3 px-6 text-sm font-bold">
                                    Go to login
                                </button>
                            </Link>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function ResetPasswordPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center">Loading...</div>}>
            <ResetPasswordForm />
        </Suspense>
    );
}
