"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/layout/Header";
import { useAuth } from "@/lib/hooks/useAuth";

function getStoredGym() {
  if (typeof window === "undefined") {
    return null;
  }

  const storedGym = localStorage.getItem("selectedGym");

  if (!storedGym) {
    return null;
  }

  try {
    return JSON.parse(storedGym);
  } catch {
    return null;
  }
}

function getLocalCollectorName() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const storedUser = localStorage.getItem("gymUser");
    if (!storedUser) return null;

    const user = JSON.parse(storedUser);
    if (!user || typeof user !== "object") return null;

    const fullName = `${user.first_name || ""} ${user.last_name || ""}`.trim();
    return user.name || user.full_name || fullName || null;
  } catch {
    return null;
  }
}

export default function TransactionsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const initialGym = getStoredGym();
  const [filterMode, setFilterMode] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(Boolean(initialGym));
  const [selectedGym] = useState(initialGym);
  const [localCollectorName, setLocalCollectorName] = useState(null);

  useEffect(() => {
    setLocalCollectorName(getLocalCollectorName());
  }, []);

  async function fetchTransactions(gymId) {
    try {
      if (authLoading || !user?.id) {
        setTransactions([]);
        return;
      }

      const response = await fetch("/api/finance/transactions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": String(user.id),
        },
        body: JSON.stringify({
          p_gym_id: gymId,
        }),
      });

      const result = await response.json();
      if (!response.ok || result.error) {
        console.error("Error fetching transactions:", result.error);
        setTransactions([]);
      } else {
        setTransactions(result.data || []);
      }
    } catch (err) {
      console.error("Error:", err);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (selectedGym?.id) {
      const timerId = setTimeout(() => {
        fetchTransactions(selectedGym.id);
      }, 0);

      return () => clearTimeout(timerId);
    }

    return undefined;
  }, [authLoading, selectedGym, user?.id]);

  const filteredTransactions = transactions.filter((txn) => {
    const matchesMode = filterMode === "all" || txn.mode === filterMode;
    const matchesType = filterType === "all" || txn.type === filterType;
    return matchesMode && matchesType;
  });

  const totalAmount = filteredTransactions.reduce(
    (sum, t) => sum + t.amount,
    0
  );

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return "";

    return date.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 pb-24">
        <Header title="All Transactions" />
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#f0813d]"></div>
        </div>
      </div>
    );
  }

  if (!selectedGym) {
    return (
      <div className="min-h-screen bg-gray-50 pb-24">
        <Header title="All Transactions" />
        <div className="px-4 py-4 text-center">
          <p className="text-gray-500">Please select a gym first</p>
          <button
            onClick={() => router.push("/admin/dashboard")}
            className="mt-4 px-4 py-2 bg-[#f0813d] text-white rounded-lg"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Header title="All Transactions" />

      <main className="px-4 py-4 space-y-4">
        {/* Summary */}
        <div className="bg-white rounded-xl p-4 shadow-sm flex justify-between items-center">
          <div>
            <p className="text-sm text-gray-500">
              Total ({filteredTransactions.length} transactions)
            </p>
            <p className="text-2xl font-bold text-[#f0813d]">
              ₹{totalAmount.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="space-y-2">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {["all", "cash", "upi", "card"].map((mode) => (
              <button
                key={mode}
                onClick={() => setFilterMode(mode)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium capitalize whitespace-nowrap ${
                  filterMode === mode
                    ? "bg-black text-white"
                    : "bg-white text-gray-600 border border-gray-200"
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {["all", "membership", "personal_training", "supplements"].map(
              (type) => (
                <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium capitalize whitespace-nowrap ${
                    filterType === type
                      ? "bg-black text-white"
                      : "bg-white text-gray-600 border border-gray-200"
                  }`}
                >
                  {type.replace("_", " ")}
                </button>
              )
            )}
          </div>
        </div>

        {/* Transactions List */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="divide-y divide-gray-100">
            {filteredTransactions.map((txn) => (
              (() => {
                const collectorDisplayName = txn.collectedBy || localCollectorName || "—";
                const collectorLine = collectorDisplayName !== "—"
                  ? txn.type === "personal_training" || txn.type === "trainer"
                    ? `₹${txn.amount.toLocaleString("en-IN")} collected by trainer (${collectorDisplayName})`
                    : `₹${txn.amount.toLocaleString("en-IN")} collected by ${collectorDisplayName}`
                  : `₹${txn.amount.toLocaleString("en-IN")} collected by —`;

                return (
              <div
                key={txn.id}
                className="p-4 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    collectorDisplayName !== "—" ? "bg-orange-100" : "bg-orange-100"
                  }`}>
                    <span className={`font-bold ${collectorDisplayName !== "—" ? "text-[#f0813d]" : "text-[#f0813d]"}`}>₹</span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{txn.name}</p>
                    <p className="text-xs text-gray-500 capitalize">
                      {txn.type.replace("_", " ")} • {txn.mode} • {formatDate(txn.date)}
                    </p>
                    <p className="text-xs text-[#f0813d] font-medium mt-0.5">
                      {collectorLine}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-[#f0813d]">+₹{txn.amount}</p>
                  {txn.status === "partial" && (
                    <span className="text-xs text-[#f0813d]">Partial</span>
                  )}
                </div>
              </div>
                );
              })()
            ))}
          </div>
        </div>

        {filteredTransactions.length === 0 && (
          <div className="text-center py-8">
            <p className="text-gray-500">No transactions found</p>
          </div>
        )}
      </main>
    </div>
  );
}
