"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/layout/Header";

// Mock data
const membershipPlans = [
    { id: 1, name: "Basic", duration: 30, price: 1000, features: ["Gym Access", "Locker Facility"] },
    { id: 2, name: "Standard", duration: 90, price: 2500, features: ["Gym Access", "Locker Facility", "Group Classes"] },
    { id: 3, name: "Premium", duration: 180, price: 4500, features: ["Gym Access", "Locker Facility", "Group Classes", "Personal Training (2 sessions)"] },
    { id: 4, name: "Annual", duration: 365, price: 8000, features: ["Gym Access", "Locker Facility", "Group Classes", "Personal Training (4 sessions)", "Diet Plan"] },
];

const mockCurrentMembership = {
    plan: "Premium",
    endDate: "2025-06-30",
    daysLeft: 166,
};

export default function CustomerRenewPage() {
    const router = useRouter();
    const [selectedPlan, setSelectedPlan] = useState(null);
    const [paymentMode, setPaymentMode] = useState("upi");
    const [loading, setLoading] = useState(false);
    const [showConfirmation, setShowConfirmation] = useState(false);

    const plan = membershipPlans.find((p) => p.id === selectedPlan);

    const calculateNewEndDate = () => {
        if (!plan) return null;
        const currentEndDate = new Date(mockCurrentMembership.endDate);
        const newEndDate = new Date(currentEndDate);
        newEndDate.setDate(newEndDate.getDate() + plan.duration);
        return newEndDate.toISOString().split("T")[0];
    };

    const handleSubmit = async () => {
        if (!selectedPlan) {
            alert("Please select a plan");
            return;
        }
        setShowConfirmation(true);
    };

    const confirmRenewal = async () => {
        setLoading(true);
        // Simulate API call
        await new Promise((resolve) => setTimeout(resolve, 2000));
        setLoading(false);
        alert("Renewal request submitted! Admin will confirm your payment.");
        router.push("/profile");
    };

    return (
        <div className="min-h-screen bg-page pb-24">
            <Header title="Renew Membership" />

            <main className="px-4 py-4 space-y-4">
                {/* Current Membership Info */}
                <div className="bg-gradient-to-r from-[#f0813d] to-[#f0813d] rounded-2xl p-5 text-white shadow-lg">
                    <div className="flex items-center justify-between mb-3">
                        <div>
                            <p className="text-white/80 text-sm">Current Plan</p>
                            <p className="text-2xl font-bold">{mockCurrentMembership.plan}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-white/80 text-sm">Days Left</p>
                            <p className="text-2xl font-bold">{mockCurrentMembership.daysLeft}</p>
                        </div>
                    </div>
                    <div className="bg-white/20 rounded-lg p-3">
                        <p className="text-sm text-white/90">Valid Till</p>
                        <p className="font-semibold">{mockCurrentMembership.endDate}</p>
                    </div>
                </div>

                {/* Info Banner */}
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                        <span className="text-2xl">💡</span>
                        <div>
                            <p className="font-semibold text-orange-900 mb-1">How it works</p>
                            <p className="text-sm text-[#f0813d]">
                                Select a plan and payment mode. Your renewal request will be sent to the gym admin.
                                Once payment is confirmed, your membership will be extended.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Select Plan */}
                <div>
                    <h3 className="font-semibold text-gray-900 mb-3">Select Renewal Plan</h3>
                    <div className="space-y-3">
                        {membershipPlans.map((p) => (
                            <div
                                key={p.id}
                                onClick={() => setSelectedPlan(p.id)}
                                className={`bg-white rounded-xl p-4 cursor-pointer transition border-2 ${selectedPlan === p.id
                                        ? "border-[#F97316] shadow-md"
                                        : "border-gray-200 hover:border-gray-300"
                                    }`}
                            >
                                <div className="flex items-center justify-between mb-3">
                                    <div>
                                        <p className="font-bold text-gray-900 text-lg">{p.name}</p>
                                        <p className="text-sm text-gray-500">{p.duration} days</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-2xl font-bold text-gray-900">₹{p.price}</p>
                                        {selectedPlan === p.id && (
                                            <span className="text-xs text-[#F97316] font-medium">✓ Selected</span>
                                        )}
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    {p.features.map((feature, idx) => (
                                        <div key={idx} className="flex items-center gap-2 text-sm text-gray-600">
                                            <span className="text-[#f0813d]">✓</span>
                                            <span>{feature}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* New End Date Preview */}
                {selectedPlan && (
                    <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                        <div className="flex items-center gap-3">
                            <span className="text-3xl">📅</span>
                            <div className="flex-1">
                                <p className="text-sm text-[#f0813d] mb-1">New Membership Validity</p>
                                <p className="font-bold text-orange-900 text-lg">
                                    {mockCurrentMembership.endDate} → {calculateNewEndDate()}
                                </p>
                                <p className="text-xs text-[#f0813d] mt-1">
                                    +{plan.duration} days extension
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Payment Mode */}
                {selectedPlan && (
                    <div>
                        <h3 className="font-semibold text-gray-900 mb-3">Preferred Payment Mode</h3>
                        <div className="grid grid-cols-2 gap-3">
                            {[
                                { id: "upi", label: "UPI", icon: "📱" },
                                { id: "cash", label: "Cash", icon: "💵" },
                                { id: "card", label: "Card", icon: "💳" },
                                { id: "bank", label: "Bank Transfer", icon: "🏦" },
                            ].map((mode) => (
                                <button
                                    key={mode.id}
                                    onClick={() => setPaymentMode(mode.id)}
                                    className={`p-4 rounded-xl border-2 transition ${paymentMode === mode.id
                                            ? "border-[#F97316] bg-orange-50"
                                            : "border-gray-200 bg-white hover:border-gray-300"
                                        }`}
                                >
                                    <div className="text-3xl mb-2">{mode.icon}</div>
                                    <p className="font-medium text-gray-900 text-sm">{mode.label}</p>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Summary */}
                {selectedPlan && (
                    <div className="bg-white rounded-xl p-4 shadow-sm">
                        <h3 className="font-semibold text-gray-900 mb-3">Renewal Summary</h3>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-600">Plan:</span>
                                <span className="font-medium text-gray-900">{plan.name}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600">Duration:</span>
                                <span className="font-medium text-gray-900">{plan.duration} days</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600">Payment Mode:</span>
                                <span className="font-medium text-gray-900 capitalize">{paymentMode}</span>
                            </div>
                            <div className="flex justify-between pt-2 border-t border-gray-200">
                                <span className="font-semibold text-gray-900">Amount to Pay:</span>
                                <span className="text-xl font-bold text-[#F97316]">₹{plan.price}</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Submit Button */}
                <button
                    onClick={handleSubmit}
                    disabled={!selectedPlan}
                    className="w-full py-4 btn-gradient-orange text-white rounded-xl font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                >
                    Request Renewal
                </button>

                {/* Note */}
                <div className="bg-gray-50 rounded-xl p-4 text-center">
                    <p className="text-sm text-gray-600">
                        💬 Need help? Contact gym admin for assistance
                    </p>
                </div>
            </main>

            {/* Confirmation Modal */}
            {showConfirmation && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
                        <div className="text-center mb-4">
                            <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                <span className="text-3xl">🔄</span>
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 mb-2">
                                Confirm Renewal Request
                            </h3>
                            <p className="text-sm text-gray-600">
                                Your renewal request for <span className="font-semibold">{plan?.name}</span> plan
                                (₹{plan?.price}) will be sent to the gym admin.
                            </p>
                        </div>

                        <div className="bg-orange-50 rounded-lg p-3 mb-4">
                            <p className="text-xs text-[#f0813d] text-center">
                                Please make the payment of <span className="font-bold">₹{plan?.price}</span> via {paymentMode.toUpperCase()}
                                at the gym reception or as instructed by admin.
                            </p>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowConfirmation(false)}
                                disabled={loading}
                                className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmRenewal}
                                disabled={loading}
                                className="flex-1 py-3 btn-gradient-orange text-white rounded-xl font-medium disabled:opacity-50"
                            >
                                {loading ? "Submitting..." : "Confirm"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
