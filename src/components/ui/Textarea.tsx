"use client";

import * as React from "react"
import { cn } from "@/lib/utils"

export interface TextareaProps
    extends React.TextareaHTMLAttributes<HTMLTextAreaElement> { }

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
    ({ className, ...props }, ref) => {
        return (
            <textarea
                className={cn(
                    "flex min-h-[80px] w-full rounded-xl border border-[var(--p-line)] bg-[var(--glass)] px-4 py-3 text-xs ring-offset-background placeholder:text-[var(--t-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]/20 focus-visible:border-[var(--p)] disabled:cursor-not-allowed disabled:opacity-50 resize-none font-medium text-[var(--t1)] shadow-none transition-all",
                    className
                )}
                ref={ref}
                {...props}
            />
        )
    }
)
Textarea.displayName = "Textarea"

export { Textarea }
