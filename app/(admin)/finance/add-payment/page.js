"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/hooks/useAuth";
import Header from "@/components/layout/Header";
import { 
  Search, 
  User, 
  CreditCard, 
  ArrowLeft,
  DollarSign,
  Wallet,
  Smartphone,
  FileText,
  Calendar,
  Phone,
  ChevronRight,
  CheckCircle,
  AlertCircle
} from "lucide-react";

export default function AddPaymentPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [step, setStep] = useState(1);
  const [selectedMember, setSelectedMember] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState([]);
  const [selectedGym, setSelectedGym] = useState(null);
  const [formData, setFormData] = useState({
    amount: "",
    type: "membership",
    mode: "cash",
    notes: "",
  });

  useEffect(() => {
    const storedGym = localStorage.getItem("selectedGym");
    if (storedGym) {
      const gym = JSON.parse(storedGym);
      setSelectedGym(gym);
      fetchMembers(gym.id);
    }
  }, []);

  const fetchMembers = async (gymId) => {
    try {
      const { data, error } = await supabase
        .from("members")
        .select("id, full_name, phone, balance")
        .eq("gym_id", gymId)
        .order("full_name");

      if (error) throw error;

      const formattedMembers = data.map(m => ({
        id: m.id,
        name: m.full_name,
        phone: m.phone,
        dueAmount: Math.max(0, m.balance || 0),
        balance: m.balance || 0
      }));

      setMembers(formattedMembers);
    } catch (error) {
      console.error("Error fetching members:", error);
      alert("Failed to load members");
    }
  };

  const filteredMembers = members.filter(
    (m) =>
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.phone.includes(searchQuery)
  );

  const updateForm = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    setLoading(true);

    try {
      const amount = parseFloat(formData.amount);
      
      if (amount <= 0) {
        alert("Please enter a valid amount");
        setLoading(false);
        return;
      }

      if (authLoading || !user?.id) {
        alert("Session expired. Please login again.");
        setLoading(false);
        return;
      }

      const paymentRes = await fetch("/api/finance/payments/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": String(user.id),
        },
        body: JSON.stringify({
          p_gym_id: selectedGym.id,
          p_member_id: selectedMember.id,
          p_amount: amount,
          p_payment_mode: formData.mode,
          p_status: "paid",
          p_paid_at: new Date().toISOString(),
          p_created_at: new Date().toISOString(),
          p_notes: formData.notes || null,
        }),
      });

      const paymentJson = await paymentRes.json();
      if (!paymentRes.ok) {
        throw new Error(paymentJson?.error || "Failed to record payment");
      }

      alert("Payment recorded successfully!");
      router.push("/finance");
    } catch (error) {
      console.error("Error recording payment:", error);
      alert("Failed to record payment. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 safe-area-inset-bottom mb-18">
      <Header title="Add Payment" />

      <main className="px-3 py-3 space-y-4">
        {/* Progress Steps */}
        <div className="bg-white rounded-xl p-4 mx-1">
          <div className="flex items-center justify-between">
            <div className={`flex items-center gap-2 ${step === 1 ? "text-[#f0813d]" : "text-gray-400"}`}>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${step === 1 ?"bg-gradient-to-br from-orange-50 to-orange-100 border border-orange-200" :"bg-gray-100"}`}>
                <User className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-medium">Step 1</p>
                <p className="text-sm font-semibold">Select Member</p>
              </div>
            </div>
            
            <div className="flex-1 h-0.5 mx-4 bg-gray-200"></div>
            
            <div className={`flex items-center gap-2 ${step === 2 ? "text-[#f0813d]" : "text-gray-400"}`}>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${step === 2 ?"bg-gradient-to-br from-orange-50 to-orange-100 border border-orange-200" :"bg-gray-100"}`}>
                <CreditCard className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-medium">Step 2</p>
                <p className="text-sm font-semibold">Payment Details</p>
              </div>
            </div>
          </div>
        </div>

        {/* Step 1: Select Member */}
        {step === 1 && (
          <div className="space-y-4">
            {/* Search Bar */}
            <div className="bg-white rounded-xl p-3 mx-1">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search by name or phone number..."
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#f0813d] focus:border-[#f0813d] outline-none transition-all text-sm placeholder:text-gray-400"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                />
              </div>
            </div>

            {/* Members List */}
            {loading && !members.length ? (
              <div className="flex items-center justify-center py-12">
                <div className="relative">
                  <div className="w-12 h-12 border-4 border-[#f0813d]/20 border-t-[#f0813d] rounded-full animate-spin"></div>
                  <div className="absolute inset-0 w-12 h-12 border-4 border-transparent border-t-[#f0813d] rounded-full animate-spin animation-delay-200"></div>
                </div>
              </div>
            ) : filteredMembers.length === 0 ? (
              <div className="bg-white rounded-xl p-8 text-center mx-1">
                <div className="w-16 h-16 bg-gradient-to-br from-gray-100 to-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <User className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-base font-semibold text-gray-900 mb-2">
                  No members found
                </h3>
                <p className="text-gray-500 text-sm">
                  Try adjusting your search criteria
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredMembers.map((member) => (
                  <button
                    key={member.id}
                    onClick={() => {
                      setSelectedMember(member);
                      // Auto-fill amount with due amount if exists
                      if (member.dueAmount > 0) {
                        setFormData(prev => ({ ...prev, amount: member.dueAmount.toString() }));
                      }
                      setStep(2);
                    }}
                    className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md active:scale-95 transition-all duration-200 cursor-pointer w-full mx-1 text-left"
                  >
                    <div className="flex items-center gap-3">
                      {/* Avatar */}
                      <div className="flex-shrink-0">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#f0813d] to-[#f0813d] flex items-center justify-center text-white font-bold text-lg shadow-sm">
                          {member.name.charAt(0).toUpperCase()}
                        </div>
                      </div>

                      {/* Member Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-semibold text-gray-900 text-base truncate">
                              {member.name}
                            </h3>
                            <div className="flex items-center gap-2 mt-1">
                              <Phone className="w-3 h-3 text-gray-400" />
                              <span className="text-gray-500 text-sm">{member.phone}</span>
                            </div>
                          </div>
                          <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                        </div>

                        {/* Due Amount */}
                        {member.dueAmount > 0 && (
                          <div className="mt-3 flex items-center gap-2">
                            <div className="w-8 h-8 bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg flex items-center justify-center">
                              <AlertCircle className="w-4 h-4 text-white" />
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">Pending Payment</p>
                              <p className="text-sm font-semibold text-[#f0813d]">
                                ₹{member.dueAmount}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 2: Payment Details */}
        {step === 2 && selectedMember && (
          <div className="space-y-4">
            {/* Selected Member Card */}
            <div className="bg-white rounded-xl p-4 mx-1 border border-gray-200 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#f0813d] to-[#f0813d] flex items-center justify-center text-white font-bold text-lg shadow-sm">
                  {selectedMember.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900 text-base truncate">
                        {selectedMember.name}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <Phone className="w-3 h-3 text-gray-400" />
                        <span className="text-gray-500 text-sm">{selectedMember.phone}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => setStep(1)}
                      className="text-sm text-[#f0813d] font-medium px-2 py-1 hover:bg-orange-50 rounded-lg transition-colors"
                    >
                      Change
                    </button>
                  </div>

                  {selectedMember.dueAmount > 0 && (
                    <div className="mt-3 flex items-center gap-2">
                      <div className="w-8 h-8 bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg flex items-center justify-center">
                        <AlertCircle className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Due Amount</p>
                        <p className="text-sm font-semibold text-[#f0813d]">
                          ₹{selectedMember.dueAmount}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Payment Form */}
            <div className="bg-white rounded-xl p-4 mx-1 border border-gray-200 shadow-sm space-y-4">
              {/* Amount Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-gray-500" />
                    Amount *
                  </div>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <span className="text-2xl font-bold text-gray-400">₹</span>
                  </div>
                  <input
                    type="text"
                    inputMode="decimal"
                    pattern="[0-9]*\.?[0-9]*"
                    className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl text-2xl font-bold outline-none focus:ring-2 focus:ring-[#f0813d] focus:border-[#f0813d]"
                    placeholder="0.00"
                    value={formData.amount}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '' || /^\d*\.?\d*$/.test(value)) {
                        updateForm("amount", value);
                      }
                    }}
                    required
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2">Enter amount greater than 0</p>
              </div>

              {/* Payment Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-gray-500" />
                    Payment Type
                  </div>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: "membership", label: "Membership" },
                    { value: "personal_training", label: "Training" },
                    { value: "supplements", label: "Supplements" },
                    { value: "other", label: "Other" }
                  ].map((type) => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => updateForm("type", type.value)}
                      className={`py-3 rounded-lg text-sm font-medium capitalize transition-all ${
                        formData.type === type.value
                          ? "bg-gradient-to-r from-[#f0813d] to-[#f0813d] text-white shadow-md"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Payment Mode */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <div className="flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-gray-500" />
                    Payment Mode
                  </div>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: "cash", label: "Cash", icon: DollarSign },
                    { value: "upi", label: "UPI", icon: Smartphone },
                    { value: "card", label: "Card", icon: CreditCard }
                  ].map((mode) => {
                    const Icon = mode.icon;
                    return (
                      <button
                        key={mode.value}
                        type="button"
                        onClick={() => updateForm("mode", mode.value)}
                        className={`py-3 rounded-lg text-sm font-medium transition-all flex flex-col items-center gap-1 ${
                          formData.mode === mode.value
                            ? "bg-gradient-to-br from-orange-50 to-orange-100 border border-orange-200 text-[#f0813d]"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                        {mode.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-gray-500" />
                    Notes (Optional)
                  </div>
                </label>
                <textarea
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#f0813d] focus:border-[#f0813d] resize-none text-sm"
                  rows={3}
                  placeholder="Add any additional notes about this payment..."
                  value={formData.notes}
                  onChange={(e) => updateForm("notes", e.target.value)}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 active:scale-95 transition-all flex items-center justify-center gap-2"
                  style={{ minHeight: '44px' }}
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!formData.amount || loading}
                  className="flex-1 py-3 bg-gradient-to-r from-[#f0813d] to-[#f0813d] text-white rounded-xl font-medium disabled:opacity-50 hover:shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
                  style={{ minHeight: '44px' }}
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Processing...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-5 h-5" />
                      Record Payment
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
