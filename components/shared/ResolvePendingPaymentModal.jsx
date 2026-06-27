"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function ResolvePendingPaymentModal({ payment, member, onClose, onResolved, onResolve }) {
    const [paymentMode, setPaymentMode] = useState("cash");
    const [receivedAmount, setReceivedAmount] = useState(payment.amount);
    const [loading, setLoading] = useState(false);
    const [collectorInfo, setCollectorInfo] = useState(null);

    // Get current user info to track who collected the payment
    useEffect(() => {
        const fetchCollectorInfo = async () => {
            try {
                const { data: authData } = await supabase.auth.getUser();
                if (authData?.user) {
                    const { data: profile } = await supabase
                        .from("profiles")
                        .select("id, first_name, last_name, role")
                        .eq("id", authData.user.id)
                        .single();
                    
                    if (profile) {
                        setCollectorInfo({
                            id: profile.id,
                            name: `${profile.first_name} ${profile.last_name}`.trim(),
                            role: profile.role
                        });
                    }
                }
            } catch (err) {
                console.error("Error fetching collector info:", err);
            }
        };
        fetchCollectorInfo();
    }, []);

    const handleResolvePayment = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const amount = parseFloat(receivedAmount);
            
            if (amount <= 0) {
                alert("Please enter a valid amount");
                setLoading(false);
                return;
            }

            if (amount > payment.amount) {
                alert(`Amount cannot exceed pending amount of ₹${payment.amount}`);
                setLoading(false);
                return;
            }

            // Update payment to paid status with collector info
            const updateData = {
                status: "paid",
                payment_mode: paymentMode,
                paid_at: new Date().toISOString(),
                amount: amount
            };

            // Add collector info if available (for trainer tracking)
            if (collectorInfo && collectorInfo.role === "trainer") {
                updateData.collected_by = collectorInfo.id;
                updateData.collected_by_name = collectorInfo.name;
            }

            const { error: paymentError } = await supabase
                .from("payments")
                .update(updateData)
                .eq("id", payment.id);

            if (paymentError) throw paymentError;

            // Update member balance if partial payment
            const balanceAdjustment = payment.amount - amount;
            if (balanceAdjustment > 0) {
                const { error: balanceError } = await supabase
                    .from("members")
                    .update({
                        balance: (member.balance || 0) + balanceAdjustment
                    })
                    .eq("id", member.id);

                if (balanceError) throw balanceError;
            } else if (balanceAdjustment < 0) {
                // If paying more than pending (edge case), reduce balance
                const { error: balanceError } = await supabase
                    .from("members")
                    .update({
                        balance: Math.max(0, (member.balance || 0) + balanceAdjustment)
                    })
                    .eq("id", member.id);

                if (balanceError) throw balanceError;
            }

            alert("Payment resolved successfully!");
            if (onResolved) onResolved();
            if (onResolve) onResolve();
            onClose();
        } catch (error) {
            console.error("Error resolving payment:", error);
            alert("Failed to resolve payment. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-white border-b border-gray-100 p-4 z-10">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-gray-900">
                            Resolve Pending Payment
                        </h3>
                        <button
                            onClick={onClose}
                            className="w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-full transition text-gray-600 hover:text-gray-900 font-bold text-lg"
                        >
                            ✕
                        </button>
                    </div>
                </div>

                <form onSubmit={handleResolvePayment} className="p-6 space-y-6">
                    {/* Payment Details */}
                    <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 bg-[#f0813d] rounded-full flex items-center justify-center text-white text-xl">
                                ⚠️
                            </div>
                            <div className="flex-1">
                                <p className="font-semibold text-gray-900">Pending Payment</p>
                                <p className="text-sm text-gray-600 mt-1">
                                    Created: {new Date(payment.created_at).toLocaleDateString("en-IN")}
                                </p>
                                <p className="text-lg font-bold text-[#f0813d] mt-2">
                                    ₹{payment.amount}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Member Info */}
                    <div className="bg-gray-50 rounded-xl p-4">
                        <p className="text-sm text-gray-500 mb-1">Member</p>
                        <p className="font-semibold text-gray-900">{member.name}</p>
                        <p className="text-sm text-gray-600">{member.phone}</p>
                    </div>

                    {/* Amount Input */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Received Amount <span className="text-[#f0813d]">*</span>
                        </label>
                        <input
                            type="text"
                            inputMode="decimal"
                            pattern="[0-9]*\.?[0-9]*"
                            value={receivedAmount}
                            onChange={(e) => {
                                const value = e.target.value;
                                if (value === '' || /^\d*\.?\d*$/.test(value)) {
                                    setReceivedAmount(value);
                                }
                            }}
                            required
                            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#f0813d] focus:border-[#f0813d] outline-none transition"
                            placeholder="Enter received amount"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            Maximum: ₹{payment.amount}
                        </p>
                    </div>

                    {/* Payment Mode */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Payment Method <span className="text-[#f0813d]">*</span>
                        </label>
                        <div className="grid grid-cols-3 gap-3">
                            {["cash", "upi", "card"].map((mode) => (
                                <button
                                    key={mode}
                                    type="button"
                                    onClick={() => setPaymentMode(mode)}
                                    className={`py-3 rounded-xl font-medium transition ${
                                        paymentMode === mode
                                            ? "bg-[#f0813d] text-white"
                                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                    }`}
                                >
                                    {mode.toUpperCase()}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Partial Payment Warning */}
                    {parseFloat(receivedAmount) < payment.amount && (
                        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                            <p className="text-sm text-orange-800">
                                <span className="font-semibold">Note:</span> Partial payment will add ₹
                                {(payment.amount - parseFloat(receivedAmount || 0)).toFixed(2)} to member's outstanding balance.
                            </p>
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-3 px-4 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition"
                            disabled={loading}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="flex-1 py-3 px-4 bg-[#f0813d] text-white rounded-xl font-semibold hover:bg-[#f0813d] transition disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={loading}
                        >
                            {loading ? "Processing..." : "Resolve Payment"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
