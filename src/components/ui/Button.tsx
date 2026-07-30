"use client";

import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
    "inline-flex items-center justify-center whitespace-nowrap rounded-[5px] text-sm font-normal ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
    {
        variants: {
            variant: {
                default: "bg-[var(--p)] text-white hover:bg-[var(--p)]/90 ",
                secondary:
                    "bg-[var(--sidebar)] text-[var(--t2)] border border-[var(--p-line)] hover:bg-[var(--glass)] ",
                outline:
                    "border border-[var(--p-line)] bg-[var(--sidebar)] hover:bg-[var(--glass-h)] hover:text-[var(--t1)]",
                ghost: "hover:bg-[var(--glass-h)] hover:text-[var(--t1)]",
                link: "text-[var(--p)] underline-offset-4 hover:underline",
                premium: "bg-gradient-to-r from-[var(--p)] to-[var(--p-soft)] text-white hover:brightness-110 shadow-lg shadow-[var(--p)]/25 border border-white/10",
                destructive: "bg-[var(--red)]/10 text-[var(--red)] border border-[var(--red)]/20 hover:bg-[var(--red)]/20",
                success: "bg-[var(--green)]/20 text-[var(--green)] hover:bg-[var(--green)]/30 border border-[var(--green)]/20",
            },
            size: {
                default: "h-10 px-4 py-2",
                sm: "h-9 rounded-[5px] px-3",
                lg: "h-11 rounded-[5px] px-8",
                icon: "h-10 w-10",
            },
        },
        defaultVariants: {
            variant: "default",
            size: "default",
        },
    }
)

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
    asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant, size, asChild = false, children, ...props }, ref) => {
        const Comp = asChild ? Slot : "button"
        return (
            <Comp
                className={cn(buttonVariants({ variant, size, className }))}
                ref={ref}
                {...props}
            >
                {children}
            </Comp>
        )
    }
)
Button.displayName = "Button"

export { Button, buttonVariants }
