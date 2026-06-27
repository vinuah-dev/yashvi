"use client";

import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/contexts/ToastContext";
import {
  Star,
  Plus,
  Minus,
  History,
  ChevronDown,
  ChevronUp,
  Gift,
  TrendingUp,
  TrendingDown,
} from "lucide-react";

export default function MemberPointsSection({ memberId, gymId, userId, initialPoints = 0, canEdit = true }) {
  const { showToast } = useToast();
  const [points, setPoints] = useState(initialPoints);
  const [showControls, setShowControls] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Quick add/remove amounts
  const [customAmount, setCustomAmount] = useState("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    setPoints(initialPoints);
  }, [initialPoints]);

  const fetchHistory = useCallback(async () => {
    if (historyLoaded) return;
    try {
      const res = await fetch("/api/members/points", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": userId || "" },
        body: JSON.stringify({ action: "history", member_id: memberId }),
      });
      const json = await res.json();
      if (res.ok) { setHistory(json.data || []); setHistoryLoaded(true); }
    } catch {}
  }, [memberId, userId, historyLoaded]);

  const updatePoints = async (change) => {
    if (change === 0 || processing) return;
    setProcessing(true);
    try {
      const res = await fetch("/api/members/points", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": userId || "" },
        body: JSON.stringify({
          action: "update",
          member_id: memberId,
          points_change: change,
          reason: reason.trim() || (change > 0 ? "Points added" : "Points removed"),
        }),
      });
      const json = await res.json();
      if (res.ok && json.data) {
        setPoints(json.data.new_total);
        showToast(`${change > 0 ? "+" : ""}${change} points ${change > 0 ? "added" : "removed"}`, "success");
        setCustomAmount("");
        setReason("");
        setHistoryLoaded(false); // refresh history next time
      } else {
        showToast(json.error || "Failed to update points", "error");
      }
    } catch {
      showToast("Failed to update points", "error");
    }
    setProcessing(false);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between p-4 cursor-pointer active:bg-gray-50"
        onClick={() => { if (canEdit) setShowControls(!showControls); }}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#f0813d] to-[#f0813d] flex items-center justify-center shadow-sm shadow-orange-200/50">
            <Star className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Reward Points</p>
            <p className="text-2xl font-black text-gray-900">{points.toLocaleString()}</p>
          </div>
        </div>
        {canEdit && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">
              {showControls ? "Close" : "Manage"}
            </span>
            {showControls ? (
              <ChevronUp className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            )}
          </div>
        )}
      </div>

      {/* Controls (admin only) */}
      {showControls && canEdit && (
        <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3">
          {/* Quick buttons */}
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">Quick Add</p>
            <div className="flex gap-2">
              {[5, 10, 25, 50].map((amt) => (
                <button
                  key={amt}
                  onClick={() => updatePoints(amt)}
                  disabled={processing}
                  className="flex-1 py-2 bg-orange-50 border border-orange-200 rounded-xl text-sm font-semibold text-[#f0813d] active:scale-95 transition-transform disabled:opacity-50"
                >
                  +{amt}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">Quick Remove</p>
            <div className="flex gap-2">
              {[5, 10, 25, 50].map((amt) => (
                <button
                  key={amt}
                  onClick={() => updatePoints(-amt)}
                  disabled={processing || points < amt}
                  className="flex-1 py-2 bg-orange-50 border border-orange-200 rounded-xl text-sm font-semibold text-[#f0813d] active:scale-95 transition-transform disabled:opacity-50"
                >
                  -{amt}
                </button>
              ))}
            </div>
          </div>

          {/* Custom amount */}
          <div className="flex gap-2">
            <input
              type="number"
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
              placeholder="Custom amount"
              className="flex-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#f0813d]/20 focus:border-[#f0813d]"
            />
            <button
              onClick={() => {
                const amt = parseInt(customAmount);
                if (amt && amt !== 0) updatePoints(amt);
              }}
              disabled={processing || !customAmount}
              className="px-4 py-2.5 bg-[#f0813d] text-white rounded-xl text-sm font-medium active:scale-95 transition-transform disabled:opacity-50"
            >
              Apply
            </button>
          </div>

          {/* Reason */}
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (optional)"
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#f0813d]/20 focus:border-[#f0813d]"
          />
        </div>
      )}

      {/* History toggle */}
      <div className="border-t border-gray-100">
        <button
          onClick={() => {
            setShowHistory(!showHistory);
            if (!showHistory) fetchHistory();
          }}
          className="w-full flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium text-gray-500 active:bg-gray-50"
        >
          <History className="w-3.5 h-3.5" />
          {showHistory ? "Hide History" : "View History"}
        </button>
      </div>

      {/* History List */}
      {showHistory && (
        <div className="border-t border-gray-100 max-h-60 overflow-y-auto">
          {history.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-gray-400 text-xs">No points history yet</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {history.map((h) => (
                <div key={h.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      h.points_change > 0
                        ? "bg-orange-50 text-[#f0813d]"
                        : "bg-orange-50 text-[#f0813d]"
                    }`}
                  >
                    {h.points_change > 0 ? (
                      <TrendingUp className="w-4 h-4" />
                    ) : (
                      <TrendingDown className="w-4 h-4" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800">
                      {h.reason || (h.points_change > 0 ? "Points added" : "Points removed")}
                    </p>
                    <p className="text-xs text-gray-400">
                      {h.changed_by_name ? `by ${h.changed_by_name} • ` : ""}
                      {new Date(h.created_at).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p
                      className={`text-sm font-bold ${
                        h.points_change > 0 ? "text-[#f0813d]" : "text-[#f0813d]"
                      }`}
                    >
                      {h.points_change > 0 ? "+" : ""}
                      {h.points_change}
                    </p>
                    <p className="text-xs text-gray-400">→ {h.new_total}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
