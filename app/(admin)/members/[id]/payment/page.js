"use client";

import { useAuthContext } from "@/contexts/AuthContext";
import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Header from "@/components/layout/Header";
import { useAuth } from "@/lib/hooks/useAuth";

export default function AddPaymentPage() {
  const router = useRouter();
  const params = useParams();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [member, setMember] = useState(null);
  const { selectedGym } = useAuthContext();
  const [formData, setFormData] = useState({
    amount: "",
    type: "membership",
    mode: "cash",
    notes: "",
    date: new Date().toISOString().split("T")[0],
  });

  // gym now comes from AuthContext
  useEffect(() => {
    if (selectedGym?.id) {
      fetchMemberData(params.id);
    }
  }, [selectedGym?.id]);


  const fetchMemberData = async (memberId) => {
    try {
      const { data: memberData, error: memberError } = await supabase
        .from("members")
        .select("id, full_name, phone")
        .eq("id", memberId)
        .single();

      if (memberError) throw memberError;

      const { data: memberships, error: membershipError } = await supabase
        .from("memberships")
        .select(`
          id,
          total_amount,
          custom_price,
          start_date,
          created_at,
          membership_plans (
            price
          )
        `)
        .eq("member_id", memberId)
        .order("end_date", { ascending: false })
        .order("start_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(25);

      if (membershipError) throw membershipError;

      const membershipRows = memberships || [];
      const membershipIds = membershipRows.map((membership) => membership.id).filter(Boolean);

      let paidRows = [];
      if (membershipIds.length > 0) {
        const { data: paidData, error: paidRowsError } = await supabase
          .from("payments")
          .select("membership_id, amount")
          .in("membership_id", membershipIds)
          .eq("status", "paid");

        if (paidRowsError) throw paidRowsError;
        paidRows = paidData || [];
      }

      const paidByMembership = paidRows.reduce((acc, row) => {
        const key = row.membership_id;
        acc[key] = (acc[key] || 0) + Number(row.amount || 0);
        return acc;
      }, {});

      const getMembershipTotalAmount = (membership) => Number(
        membership?.total_amount ||
        membership?.custom_price ||
        membership?.membership_plans?.price ||
        0
      );

      const membershipWithDue = membershipRows.find((membership) => {
        const totalAmount = getMembershipTotalAmount(membership);
        const paidAmount = Number(paidByMembership[membership.id] || 0);
        return Math.max(0, totalAmount - paidAmount) > 0;
      });

      const latestMembership = membershipWithDue || membershipRows[0] || null;
      const membershipTotalAmount = latestMembership
        ? getMembershipTotalAmount(latestMembership)
        : 0;
      const membershipPaidAmount = latestMembership
        ? Number(paidByMembership[latestMembership.id] || 0)
        : 0;
      const dueAmount = Math.max(0, membershipTotalAmount - membershipPaidAmount);

      setMember({
        id: memberData.id,
        name: memberData.full_name,
        phone: memberData.phone,
        membershipId: latestMembership?.id || null,
        totalAmount: membershipTotalAmount,
        paidAmount: membershipPaidAmount,
        dueAmount,
      });

      // Auto-fill amount if there's a due amount
      if (dueAmount > 0) {
        setFormData((prev) => ({ ...prev, amount: dueAmount.toString() }));
      }
    } catch (error) {
      console.error("Error fetching member:", error);
      alert("Failed to load member data");
    }
  };

  const updateForm = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const amount = parseFloat(formData.amount);
      
      if (amount <= 0) {
        alert("Please enter a valid amount");
        setLoading(false);
        return;
      }

      if (!member?.membershipId) {
        alert("No membership found for this member.");
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
          p_member_id: member.id,
          p_membership_id: member.membershipId,
          p_amount: amount,
          p_payment_mode: formData.mode,
          p_status: "paid",
          p_paid_at: new Date(`${formData.date}T00:00:00`).toISOString(),
          p_created_at: new Date().toISOString(),
          p_notes: formData.notes || null,
        }),
      });

      const paymentJson = await paymentRes.json();
      if (!paymentRes.ok) {
        throw new Error(paymentJson?.error || "Failed to record payment");
      }

      alert("Payment recorded successfully!");
      router.back();
    } catch (error) {
      console.error("Error recording payment:", error);
      alert("Failed to record payment. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Header title="Add Payment" />

      {!member ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-[#F97316] border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="px-4 py-4 space-y-4">
          {/* Member Info */}
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-gray-800 to-gray-600 rounded-full flex items-center justify-center text-white font-bold">
                {member.name.charAt(0)}
              </div>
              <div>
                <p className="font-semibold text-gray-900">{member.name}</p>
                <p className="text-sm text-gray-500">{member.phone}</p>
                {member.dueAmount > 0 && (
                  <p className="text-sm font-semibold text-[#f0813d]">
                    Due: ₹{member.dueAmount}
                  </p>
                )}
              </div>
            </div>
          </div>

        {/* Payment Form */}
        <div className="bg-white rounded-2xl p-6 shadow-sm space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-2">
              Amount *
            </label>
            <input
              type="text"
              inputMode="decimal"
              pattern="[0-9]*\.?[0-9]*"
              className="w-full px-4 py-3.5 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-[#F97316] focus:border-[#F97316] outline-none text-xl font-semibold transition-all duration-200 text-gray-900 placeholder-gray-400 bg-white"
              placeholder="₹ 0"
              value={formData.amount}
              onChange={(e) => {
                const value = e.target.value;
                if (value === '' || /^\d*\.?\d*$/.test(value)) {
                  updateForm("amount", value);
                }
              }}
              required
            />
            <p className="text-xs text-gray-500 mt-1">Enter amount greater than 0</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Payment Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              {["membership","other"].map(
                (type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => updateForm("type", type)}
                    className={`py-2 px-4 rounded-lg text-sm font-medium capitalize transition ${
                      formData.type === type
                        ? "bg-black text-white"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {type.replace("_", " ")}
                  </button>
                )
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Payment Mode
            </label>
            <div className="flex gap-2">
              {["cash", "upi", "card", "bank"].map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => updateForm("mode", mode)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium capitalize transition ${
                    formData.mode === mode
                      ? "bg-black text-white"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-2">
              Date
            </label>
            <input
              type="date"
              className="w-full px-4 py-3.5 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-[#F97316] focus:border-[#F97316] outline-none transition-all duration-200 text-gray-900 bg-white"
              value={formData.date}
              onChange={(e) => updateForm("date", e.target.value)}
              max={new Date().toISOString().split("T")[0]}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-2">
              Notes (Optional)
            </label>
            <textarea
              className="w-full px-4 py-3.5 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-[#F97316] focus:border-[#F97316] outline-none resize-none transition-all duration-200 text-gray-900 placeholder-gray-400 bg-white"
              rows={3}
              placeholder="Payment notes..."
              value={formData.notes}
              onChange={(e) => updateForm("notes", e.target.value)}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="flex-1 py-3.5 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 active:scale-[0.98] transition-all duration-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!formData.amount || loading}
              className="flex-1 py-3.5 bg-gradient-to-r from-[#F97316] to-[#FF8C42] text-white rounded-xl font-semibold disabled:opacity-50 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
            >
              {loading ? "Processing..." : "Record Payment"}
            </button>
          </div>
        </div>
      </form>
      )}
    </div>
  );
}
