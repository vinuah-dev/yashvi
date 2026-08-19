"use client";

import { useState, useEffect, useCallback } from "react";
import Header from "@/components/layout/Header";
import { useAuthContext } from "@/contexts/AuthContext";
import {
  Fingerprint,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  Terminal,
} from "lucide-react";

function timeAgo(ts) {
  if (!ts) return "—";
  const mins = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return `${Math.floor(hrs / 24)} day(s) ago`;
}

export default function BiometricDiagnosticsPage() {
  const { selectedGym, user: authUser } = useAuthContext();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!selectedGym?.id) return;
    setLoading(true);
    try {
      const res = await fetch("/api/biometric/diagnostics", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": String(authUser?.id || ""),
        },
        body: JSON.stringify({ p_gym_id: selectedGym.id }),
      });
      const json = await res.json();
      if (res.ok) setData(json.data);
    } catch {
      // leave previous data on screen
    } finally {
      setLoading(false);
    }
  }, [selectedGym?.id, authUser?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const supported = data?.templatesSupported;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 safe-area-inset-bottom">
      <Header title="Biometric Diagnostics" />

      <main className="px-3 py-4 space-y-4 mb-20">
        {/* The headline answer */}
        <div
          className={`mx-1 rounded-2xl border p-4 ${
            loading
              ? "border-gray-200 bg-white"
              : supported
                ? "border-green-200 bg-green-50"
                : "border-amber-200 bg-amber-50"
          }`}
        >
          <div className="flex gap-3">
            {loading ? (
              <Loader2 className="h-5 w-5 shrink-0 animate-spin text-gray-400" />
            ) : supported ? (
              <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
            ) : (
              <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
            )}
            <div>
              <p className="font-semibold text-gray-900">
                {loading
                  ? "Checking your scanner..."
                  : supported
                    ? "Fingerprints are being backed up"
                    : "No fingerprint backups yet"}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-gray-600">
                {loading
                  ? "Reading what the device has sent so far."
                  : supported
                    ? "Blocked members can be restored on renewal without enrolling their finger again."
                    : "Enroll a finger on the scanner, then refresh this page. If nothing appears, this firmware doesn't upload templates — blocked members will need to be re-enrolled when they renew."}
              </p>
            </div>
          </div>
        </div>

        {/* Counts */}
        <div className="mx-1 grid grid-cols-3 gap-2">
          {[
            { label: "Backed up", value: data?.membersWithTemplates ?? "—" },
            { label: "With UID", value: data?.membersWithUid ?? "—" },
            { label: "Templates", value: data?.templateCount ?? "—" },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-gray-200 bg-white p-3 text-center">
              <p className="text-xl font-black text-gray-900">{s.value}</p>
              <p className="text-[11px] font-semibold text-gray-500">{s.label}</p>
            </div>
          ))}
        </div>

        <button
          onClick={load}
          disabled={loading}
          className="mx-1 flex w-[calc(100%-0.5rem)] items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#f0813d] to-[#9c4400] py-3 text-sm font-bold text-white disabled:opacity-50 active:scale-95"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>

        {/* Command results — did the device accept what we sent? */}
        <section className="mx-1 rounded-2xl border border-gray-200 bg-white p-4">
          <div className="mb-3 flex items-center gap-2">
            <Terminal className="h-4 w-4 text-gray-500" />
            <h3 className="text-sm font-bold text-gray-900">Recent commands</h3>
          </div>
          {(data?.recentCommands || []).length === 0 ? (
            <p className="text-xs text-gray-500">Nothing sent to the scanner yet.</p>
          ) : (
            <div className="space-y-2">
              {data.recentCommands.map((cmd, i) => (
                <div key={i} className="rounded-lg border border-gray-100 bg-gray-50 p-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 flex-1 truncate font-mono text-[11px] text-gray-700">
                      {cmd.command}
                    </p>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        cmd.status === "SUCCESS"
                          ? "bg-green-100 text-green-700"
                          : cmd.status === "FAILED"
                            ? "bg-red-100 text-red-700"
                            : "bg-gray-200 text-gray-600"
                      }`}
                    >
                      {cmd.status}
                    </span>
                  </div>
                  <p className="mt-1 text-[10px] text-gray-400">
                    {timeAgo(cmd.at)}
                    {cmd.returnCode !== null && cmd.returnCode !== undefined
                      ? ` · Return=${cmd.returnCode}`
                      : ""}
                    {cmd.returnCode === -1004 ? " (not supported on this model)" : ""}
                    {cmd.returnCode === -1002 ? " (invalid syntax)" : ""}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Stored templates */}
        <section className="mx-1 rounded-2xl border border-gray-200 bg-white p-4">
          <div className="mb-3 flex items-center gap-2">
            <Fingerprint className="h-4 w-4 text-gray-500" />
            <h3 className="text-sm font-bold text-gray-900">Stored fingerprints</h3>
          </div>
          {(data?.recentTemplates || []).length === 0 ? (
            <p className="text-xs text-gray-500">None captured yet.</p>
          ) : (
            <div className="space-y-1.5">
              {data.recentTemplates.map((t, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
                  <span className="font-mono text-xs text-gray-700">
                    UID {t.uid} · finger {t.finger}
                  </span>
                  <span className="text-[10px] text-gray-400">{timeAgo(t.at)}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Raw pushes — useful when nothing is being captured */}
        <section className="mx-1 rounded-2xl border border-gray-200 bg-white p-4">
          <div className="mb-3 flex items-center gap-2">
            <XCircle className="h-4 w-4 text-gray-500" />
            <h3 className="text-sm font-bold text-gray-900">What the device sent</h3>
          </div>
          {(data?.recentPushes || []).length === 0 ? (
            <p className="text-xs text-gray-500">
              Nothing besides attendance so far.
            </p>
          ) : (
            <div className="space-y-2">
              {data.recentPushes.map((p, i) => (
                <div key={i} className="rounded-lg border border-gray-100 bg-gray-50 p-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-gray-700">
                      {p.table || "—"} <span className="font-normal text-gray-400">/{p.endpoint}</span>
                    </span>
                    <span className="text-[10px] text-gray-400">{timeAgo(p.at)}</span>
                  </div>
                  <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-all font-mono text-[10px] text-gray-500">
                    {p.preview}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
