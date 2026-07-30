"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { HiArrowRight } from "react-icons/hi2";
import { BrandLogo } from "@/components/ui/BrandLogo";

export default function SignupPage() {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [passwordError, setPasswordError] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (validatePassword(password)) {
            setError(validatePassword(password) || "");
            setLoading(false);
            return;
        }

        setLoading(true);
        setError("");

        try {
            const res = await fetch("/api/auth/signup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, email, password }),
            });

            if (res.ok) {
                router.push("/login?signup=success");
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

    const validatePassword = (pass: string) => {
        if (pass.length < 8) return "Password must be at least 8 characters long";
        if (!/[A-Z]/.test(pass)) return "Password must contain at least one uppercase letter";
        if (!/[a-z]/.test(pass)) return "Password must contain at least one lowercase letter";
        if (!/[0-9]/.test(pass)) return "Password must contain at least one number";
        if (!/[!@#$%^&*]/.test(pass)) return "Password must contain at least one special character";
        return null;
    };

    const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setPassword(val);
        const validationError = validatePassword(val);
        setPasswordError(validationError || "");
    };

    return (
        <div className="min-h-screen bg-white flex font-sans">
            {/* Left Side - Branded Visual Area */}
            <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-b from-black to-zinc-900 items-end justify-center">

                {/* Prominent Spotlight Behind Character */}
                <div className="absolute top-[40%] left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-red-500/20 rounded-full blur-[100px] pointer-events-none" />

                {/* Foreground Image */}
                <div className="relative w-full h-[85%] max-w-2xl">
                    <Image
                        src="/bearded-man-denim-shirt-round-glasses.png"
                        alt="Smiling man looking at phone"
                        fill
                        className="object-contain object-bottom"
                        priority
                    />
                    {/* Bottom Edge Fade Blend */}
                    <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-red-950 to-transparent pointer-events-none" />
                </div>

                {/* Floating Content Overlay */}
                <div className="absolute inset-0 flex flex-col justify-between p-12 pointer-events-none">
                    {/* Logo */}
                    <div className="pointer-events-auto">
                        <Link href="/" className="inline-flex items-center gap-3">
                            <BrandLogo width={140} height={32} color="#ffffff" />
                        </Link>
                    </div>

                    {/* Center Text Pitch */}
                    <div className="pointer-events-auto text-white pb-12">
                        <h2 className="text-5xl font-semibold mb-5 tracking-tight leading-tight">
                            Join Our<br />Platform Today
                        </h2>
                        <p className="text-lg text-white/90 max-w-md font-medium leading-relaxed drop-shadow-md">
                            Request access to start managing your business finances efficiently.
                        </p>

                        {/* Partner Logos */}
                        <div className="mt-8">
                            <p className="text-white/60 text-[10px] uppercase tracking-widest mb-3 font-semibold">Trusted By</p>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center border border-white/20 shadow-md">
                                    <Image
                                        src="/assets/branding/south-sudan-revenue-authority-formerly-national-revenue-authority-586928.jpg"
                                        alt="Revenue Authority"
                                        width={24}
                                        height={24}
                                        className="w-6 h-6 object-contain mix-blend-multiply"
                                    />
                                </div>
                                <div className="w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center border border-white/20 shadow-md">
                                    <Image
                                        src="/assets/branding/logo.857ac6f8bbd7.png"
                                        alt="Civil Aviation"
                                        width={24}
                                        height={24}
                                        className="w-6 h-6 object-contain mix-blend-multiply"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="pointer-events-auto text-white/50 text-xs font-semibold tracking-wider uppercase mb-[-1rem]">
                        © 2026 {process.env.NEXT_PUBLIC_APP_NAME || "CapitalPay"}. All rights reserved.
                    </div>
                </div>
            </div>

            {/* Right Side - Signup Form */}
            <div className="flex-1 flex items-center justify-center p-8 bg-[#F5F5F5] relative" style={{ fontFamily: 'var(--font-lexend)' }}>
                <div className="w-full max-w-[420px] relative z-10">
                    {/* Mobile Logo */}
                    <div className="lg:hidden mb-12 text-center">
                        <Link href="/" className="inline-block">
                            <BrandLogo width={120} height={28} color="#6366F1" />
                        </Link>
                    </div>

                    {/* Eyebrow */}
                    <div className="flex items-center gap-3 mb-7">
                        <div className="w-5 h-[1.5px] bg-[#6366F1]" />
                        <span className="text-[11px] text-[#6366F1] tracking-[2px] font-semibold uppercase">
                            Get started
                        </span>
                    </div>

                    <h1 className="text-[28px] font-bold text-zinc-900 tracking-tight mb-2">Request access</h1>
                    <p className="text-[13px] font-light text-zinc-500 mb-10 leading-relaxed">
                        Submit a request to join the organization.
                    </p>

                    {error && (
                        <div className="mb-5 p-3 rounded-lg text-[11px] text-center bg-rose-50 text-rose-700 border border-rose-200">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit}>
                        {/* Full name */}
                        <div className="mb-1.5 text-xs font-medium text-zinc-900">Full name</div>
                        <div className="mb-5">
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="John Doe"
                                required
                                className="w-full outline-none transition-all rounded-lg text-[13px] text-zinc-900 bg-[#6366F1]/[0.02] border border-[#6366F1]/30 focus:border-[#6366F1] focus:bg-[#6366F1]/[0.04]"
                                style={{ padding: "11px 16px" }}
                            />
                        </div>

                        {/* Email */}
                        <div className="mb-1.5 text-xs font-medium text-zinc-900">Email address</div>
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
                        <div className="mb-1.5 text-xs font-medium text-zinc-900">Password</div>
                        <div className="mb-2">
                            <input
                                type="password"
                                value={password}
                                onChange={handlePasswordChange}
                                placeholder="Create a strong password"
                                required
                                minLength={8}
                                className={`w-full outline-none transition-all rounded-lg text-[13px] text-zinc-900 bg-[#6366F1]/[0.02] border focus:bg-[#6366F1]/[0.04] ${passwordError ? "border-rose-400 focus:border-rose-500" : "border-[#6366F1]/30 focus:border-[#6366F1]"}`}
                                style={{ padding: "11px 16px" }}
                            />
                        </div>
                        {password && (
                            <div className="mb-6 px-1 space-y-2 pt-2">
                                <div className="flex items-center gap-2.5 text-[11px] tracking-wide">
                                    <div className={`flex-shrink-0 w-2 h-2 rounded-full ${password.length >= 8 ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-zinc-300'}`} />
                                    <span className={`font-normal ${password.length >= 8 ? 'text-emerald-700' : 'text-zinc-500'}`}>
                                        At least 8 characters
                                    </span>
                                </div>
                                <div className="flex items-center gap-2.5 text-[11px] tracking-wide">
                                    <div className={`flex-shrink-0 w-2 h-2 rounded-full ${/[A-Z]/.test(password) ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-zinc-300'}`} />
                                    <span className={`font-normal ${/[A-Z]/.test(password) ? 'text-emerald-700' : 'text-zinc-500'}`}>
                                        One uppercase letter
                                    </span>
                                </div>
                                <div className="flex items-center gap-2.5 text-[11px] tracking-wide">
                                    <div className={`flex-shrink-0 w-2 h-2 rounded-full ${/[0-9]/.test(password) ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-zinc-300'}`} />
                                    <span className={`font-normal ${/[0-9]/.test(password) ? 'text-emerald-700' : 'text-zinc-500'}`}>
                                        One number
                                    </span>
                                </div>
                                <div className="flex items-center gap-2.5 text-[11px] tracking-wide">
                                    <div className={`flex-shrink-0 w-2 h-2 rounded-full ${/[!@#$%^&*]/.test(password) ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-zinc-300'}`} />
                                    <span className={`font-normal ${/[!@#$%^&*]/.test(password) ? 'text-emerald-700' : 'text-zinc-500'}`}>
                                        One special character (!@#$%^&*)
                                    </span>
                                </div>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full flex items-center justify-center gap-2.5 transition-all disabled:opacity-60 bg-[#6366F1] hover:brightness-110 hover:-translate-y-0.5 text-white rounded-lg py-[13px] text-sm font-bold tracking-wide mt-2"
                        >
                            {loading ? "Submitting..." : <>Submit request <HiArrowRight /></>}
                        </button>
                    </form>

                    {/* Divider */}
                    <div className="flex items-center gap-3 my-6">
                        <div className="flex-1 h-[0.5px] bg-zinc-200" />
                        <span className="text-[11px] text-zinc-400">or</span>
                        <div className="flex-1 h-[0.5px] bg-zinc-200" />
                    </div>

                    <p className="text-xs font-normal text-zinc-500">
                        Already have an account?{" "}
                        <Link href="/login" className="font-semibold text-[#6366F1] hover:text-[#6366F1]/80 transition-colors">
                            Sign in
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
