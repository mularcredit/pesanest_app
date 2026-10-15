"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { BaseModal } from "@/components/ui/Modal";
import { PiTimer } from "react-icons/pi";

const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "wheel"] as const;
// Once the warning is up we stop listening for activity and require an
// explicit "Stay signed in" click — otherwise a stray mouse twitch (or a
// script moving the cursor) would silently dismiss the warning and defeat
// the whole point of the timeout.
const WARNING_SECONDS = 60;
// Debounces how often a burst of mousemove/scroll events is allowed to
// restart the timer — resetting on every single event is wasted work.
const ACTIVITY_THROTTLE_MS = 5_000;

export function IdleTimeoutManager() {
    const { data: session, status } = useSession();
    const idleTimeoutMinutes = (session?.user as any)?.idleTimeoutMinutes ?? 15;

    const [showWarning, setShowWarning] = useState(false);
    const [secondsLeft, setSecondsLeft] = useState(WARNING_SECONDS);

    const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const lastActivityResetRef = useRef(0);

    const clearAllTimers = useCallback(() => {
        if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
        if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
        warningTimerRef.current = null;
        countdownIntervalRef.current = null;
    }, []);

    const doLogout = useCallback(() => {
        clearAllTimers();
        signOut({ callbackUrl: "/login" });
    }, [clearAllTimers]);

    const startWarningCountdown = useCallback(() => {
        setShowWarning(true);
        setSecondsLeft(WARNING_SECONDS);
        countdownIntervalRef.current = setInterval(() => {
            setSecondsLeft(prev => {
                if (prev <= 1) {
                    doLogout();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    }, [doLogout]);

    const scheduleTimers = useCallback(() => {
        clearAllTimers();
        setShowWarning(false);
        const totalMs = Math.max(1, idleTimeoutMinutes) * 60 * 1000;
        const warningMs = Math.min(WARNING_SECONDS * 1000, Math.floor(totalMs / 2));
        const untilWarningMs = Math.max(0, totalMs - warningMs);
        warningTimerRef.current = setTimeout(startWarningCountdown, untilWarningMs);
    }, [idleTimeoutMinutes, clearAllTimers, startWarningCountdown]);

    const handleActivity = useCallback(() => {
        // Ignore activity while the warning modal is up — see note above.
        if (showWarning) return;
        const now = Date.now();
        if (now - lastActivityResetRef.current < ACTIVITY_THROTTLE_MS) return;
        lastActivityResetRef.current = now;
        scheduleTimers();
    }, [showWarning, scheduleTimers]);

    const handleStaySignedIn = useCallback(() => {
        lastActivityResetRef.current = Date.now();
        scheduleTimers();
    }, [scheduleTimers]);

    useEffect(() => {
        if (status !== "authenticated") {
            clearAllTimers();
            return;
        }
        scheduleTimers();
        ACTIVITY_EVENTS.forEach(evt => window.addEventListener(evt, handleActivity, { passive: true }));
        return () => {
            ACTIVITY_EVENTS.forEach(evt => window.removeEventListener(evt, handleActivity));
            clearAllTimers();
        };
        // Deliberately re-runs when idleTimeoutMinutes changes (e.g. the user
        // just changed it in Settings) so the new duration takes effect
        // without needing a full page reload.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [status, idleTimeoutMinutes]);

    if (status !== "authenticated") return null;

    const minutes = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
    const seconds = String(secondsLeft % 60).padStart(2, "0");

    return (
        <BaseModal isOpen={showWarning} onClose={handleStaySignedIn} maxWidth="sm">
            <div className="p-8 text-center">
                <div className="w-14 h-14 rounded-full bg-[rgba(99,102,241,0.1)] text-[#6366F1] flex items-center justify-center mx-auto mb-4">
                    <PiTimer className="text-3xl" />
                </div>
                <h3 className="text-[16px] font-[600] text-gray-900 mb-2">Still there?</h3>
                <p className="text-[13px] text-gray-500 mb-1">
                    You've been inactive for a while. For your security, you'll be signed out in
                </p>
                <p className="text-[28px] font-[700] font-mono text-gray-900 mb-6">{minutes}:{seconds}</p>
                <div className="flex gap-3 justify-center">
                    <button
                        onClick={doLogout}
                        className="px-5 py-2.5 text-[13px] font-[500] text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-[6px] transition-colors"
                    >
                        Log out now
                    </button>
                    <button
                        onClick={handleStaySignedIn}
                        className="px-5 py-2.5 text-[13px] font-[600] text-white bg-[#6366F1] hover:bg-[#6366F1]/90 rounded-[6px] transition-colors"
                    >
                        Stay signed in
                    </button>
                </div>
            </div>
        </BaseModal>
    );
}
