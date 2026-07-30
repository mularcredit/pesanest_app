"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useToast } from "@/components/ui/ToastProvider";

export function WalletVerifier() {
    const searchParams = useSearchParams();
    const { showToast } = useToast();
    const reference = searchParams.get('reference');
    const trxref = searchParams.get('trxref');
    const verifying = useRef(false);

    useEffect(() => {
        const ref = reference || trxref;
        if (!ref || verifying.current) return;

        verifying.current = true;

        fetch('/api/wallet/topup/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reference: ref })
        })
            .then(res => res.json().then(data => ({ ok: res.ok, data })))
            .then(({ ok, data }) => {
                if (!ok) throw new Error(data.error);
                // Show toast only for fresh verifications, not double-processed ones
                if (data.success && !data.alreadyVerified) {
                    showToast(`Successfully deposited KSh ${Number(data.amount).toLocaleString()} into your wallet!`, 'success');
                }
                // Hard reload so the server component always re-fetches fresh balance
                window.location.replace('/dashboard/wallet');
            })
            .catch(err => {
                console.error('Verification error:', err);
                showToast(err.message || 'Payment verification failed', 'error');
                window.location.replace('/dashboard/wallet');
            });
    }, [reference, trxref, showToast]);

    return null;
}
