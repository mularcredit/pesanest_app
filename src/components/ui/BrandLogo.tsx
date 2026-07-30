"use client";

import Image from "next/image";

export function BrandLogo({ width = 150, height = 34, className = "", color }: { width?: number | string; height?: number | string; className?: string; color?: string }) {
    // On light backgrounds a color prop is passed — use mask technique to apply that color
    if (color) {
        return (
            <div
                role="img"
                aria-label={process.env.NEXT_PUBLIC_APP_NAME || "Pesanest"}
                className={className}
                style={{
                    width,
                    height,
                    backgroundColor: color,
                    WebkitMaskImage: "url(/off-logo.png)",
                    maskImage: "url(/off-logo.png)",
                    WebkitMaskSize: "contain",
                    maskSize: "contain",
                    WebkitMaskRepeat: "no-repeat",
                    maskRepeat: "no-repeat",
                    WebkitMaskPosition: "left center",
                    maskPosition: "left center",
                }}
            />
        );
    }

    // On dark backgrounds — show the real full-colour logo
    return (
        <Image
            src="/off-logo.png"
            alt={process.env.NEXT_PUBLIC_APP_NAME || "Pesanest"}
            width={typeof width === "number" ? width : 150}
            height={typeof height === "number" ? height : 34}
            className={className}
            style={{ objectFit: "contain", objectPosition: "left center" }}
            priority
        />
    );
}
