"use client";
import { useState } from "react";
import { PiArrowsClockwise, PiCheckCircle, PiSpinner } from "react-icons/pi";

export function SyncPermissionsButton() {
    const [state, setState] = useState<"idle" | "loading" | "done">("idle");
    const [msg, setMsg] = useState("");

    const sync = async () => {
        setState("loading");
        try {
            const res = await fetch("/api/admin/sync-permissions", { method: "POST" });
            const data = await res.json();
            setMsg(data.message || "Done");
            setState("done");
        } catch {
            setMsg("Failed — check console");
            setState("idle");
        }
    };

    return (
        <div className="flex items-center gap-3">
            {msg && (
                <span className="text-[11.5px] text-emerald-600 font-[500] flex items-center gap-1">
                    <PiCheckCircle className="text-[13px]" />
                    {msg}
                </span>
            )}
            <button
                onClick={sync}
                disabled={state === "loading"}
                className="flex items-center gap-2 px-3 py-1.5 rounded-[6px] text-[12px] font-[500] bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                style={{ border: "1px solid rgba(0,0,0,0.12)" }}
                title="Add any missing permissions to the database so they can be assigned to roles"
            >
                {state === "loading"
                    ? <PiSpinner className="animate-spin text-[13px]" />
                    : <PiArrowsClockwise className="text-[13px]" />}
                Sync permissions
            </button>
        </div>
    );
}
