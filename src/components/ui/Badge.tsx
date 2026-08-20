import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
    "inline-flex items-center rounded-[var(--r-pill)] px-2.5 py-1 text-[11px] font-medium transition-all duration-200 focus:outline-none",
    {
        variants: {
            variant: {
                default:
                    "border-transparent bg-[var(--p)] text-white shadow hover:bg-[var(--p-glow)]",
                secondary:
                    "border-[var(--p-line)] bg-[var(--glass)] text-[var(--t2)] hover:bg-[var(--glass-h)]",
                destructive:
                    "border-[var(--red-glow)] bg-[var(--red-d)] text-[var(--red)] shadow hover:bg-[var(--red)] hover:text-white",
                outline: "text-[var(--t1)] border-[var(--p-line)] bg-transparent",
                success: "border-[var(--green-glow)] bg-[var(--green-d)] text-[var(--green)] hover:bg-[var(--green)] hover:text-white",
                warning: "border-[var(--amber-glow)] bg-[var(--amber-d)] text-[var(--amber)] hover:bg-[var(--amber)] hover:text-white",
                info: "border-[var(--p-line)] bg-[var(--glass)] text-[var(--p)] hover:bg-[var(--p)] hover:text-white",
                purple: "border-transparent bg-[var(--p)]/10 text-[var(--p)] hover:bg-[var(--p)]/20",
            },
        },
        defaultVariants: {
            variant: "default",
        },
    }
)

export interface BadgeProps
    extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> { }

function Badge({ className, variant, ...props }: BadgeProps) {
    return (
        <div className={cn(badgeVariants({ variant }), className)} {...props} />
    )
}

export { Badge, badgeVariants }
