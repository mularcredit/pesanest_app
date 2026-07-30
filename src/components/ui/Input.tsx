"use client";

import * as React from "react"
import { cn } from "@/lib/utils"

export interface InputProps
    extends React.InputHTMLAttributes<HTMLInputElement> {
    icon?: React.ReactNode;
    label?: string; // Add label to interface
    error?: string; // Add error to interface
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ className, type, icon, label, error, ...props }, ref) => {
        return (
            <div className="w-full space-y-1.5">
                {label && (
                    <label className="text-xs font-normal leading-none text-[var(--t3)] peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                        {label}
                    </label>
                )}
                <div className="relative group w-full">
                    <input
                        type={type}
                        className={cn(
                            "flex h-10 w-full rounded-[5px] border border-[var(--p-line)] bg-transparent px-3 py-2 text-xs ring-offset-transparent file:border-0 file:bg-transparent file:text-xs file:font-medium placeholder:text-[var(--t-muted)] focus-visible:outline-none focus:bg-transparent active:bg-transparent focus-visible:ring-1 focus-visible:ring-[var(--p)] focus-visible:border-[var(--p)] disabled:cursor-not-allowed disabled:opacity-50 text-[var(--t1)] transition-all shadow-none appearance-none",
                            error ? "border-[var(--red)] focus-visible:ring-[var(--red)]" : "",
                            className,
                        )}
                        ref={ref}
                        {...props}
                    />
                </div>
                {error && (
                    <p className="text-xs font-medium text-[var(--red)] animate-slide-in-right">
                        {error}
                    </p>
                )}
            </div>
        )
    }
)
Input.displayName = "Input"

export { Input }
