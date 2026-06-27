"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/contexts/ToastContext";
import {
  X,
  Loader2,
  Package,
  Check,
  IndianRupee,
  AlertCircle,
  Sparkles,
} from "lucide-react";

export default function AssignAmenityModal({
  isOpen,
  onClose,
  memberId,
  memberName,
  selectedGym,
  onSuccess,
}) {
  const { showSuccess, showError } = useToast();
  const [amenities, setAmenities] = useState([]);
  const [assignedAmenityIds, setAssignedAmenityIds] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [paymentMode, setPaymentMode] = useState("cash");

  useEffect(() => {
    if (isOpen && selectedGym?.id && memberId) {
      fetchAmenities();
      fetchAssigned();
      setSelectedIds([]);
      setPaymentMode("cash");
    }
  }, [isOpen, selectedGym?.id, memberId]);

  const fetchAmenities = async () => {
    setFetching(true);
    try {
      const { data, error } = await supabase
        .from("gym_amenities")
        .select("*")
        .eq("gym_id", selectedGym.id)
        .eq("is_active", true)
        .order("name", { ascending: true });

      if (error) throw error;
      setAmenities(
        (data || []).map((a) => ({ ...a, cost: parseFloat(a.cost) }))
      );
    } catch (err) {
      console.error("Error fetching amenities:", err);
      showError("Failed to load amenities");
    } finally {
      setFetching(false);
    }
  };

  const fetchAssigned = async () => {
    try {
      const { data, error } = await supabase
        .from("member_amenities")
        .select("amenity_id")
        .eq("member_id", memberId)
        .eq("gym_id", selectedGym.id)
        .eq("is_active", true);

      if (!error) {
        setAssignedAmenityIds((data || []).map((a) => a.amenity_id));
      }
    } catch (err) {
      console.error("Error fetching assigned amenities:", err);
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const selectedAmenities = amenities.filter((a) => selectedIds.includes(a.id));
  const totalCost = selectedAmenities.reduce((sum, a) => sum + a.cost, 0);

  const handleAssign = async () => {
    if (selectedIds.length === 0) {
      showError("Please select at least one amenity");
      return;
    }

    setLoading(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const assignedBy = authData?.user?.id;

      for (const amenity of selectedAmenities) {
        // 1. Create payment record
        let paymentId = null;
        if (amenity.cost > 0) {
          const { data: paymentData, error: paymentError } = await supabase
            .from("payments")
            .insert({
              gym_id: selectedGym.id,
              member_id: memberId,
              amount: amenity.cost,
              payment_mode: paymentMode,
              status: "paid",
              paid_at: new Date().toISOString(),
              notes: `Amenity: ${amenity.name}`,
            })
            .select("id")
            .single();

          if (paymentError) {
            console.error("Payment error:", paymentError);
          } else {
            paymentId = paymentData?.id;
          }
        }

        // 2. Create member amenity assignment
        const { error: assignError } = await supabase
          .from("member_amenities")
          .insert({
            gym_id: selectedGym.id,
            member_id: memberId,
            amenity_id: amenity.id,
            assigned_by: assignedBy,
            payment_id: paymentId,
            is_active: true,
          });

        if (assignError) {
          if (assignError.code === "23505") {
            showError(`${amenity.name} is already assigned to this member`);
          } else {
            throw assignError;
          }
        }
      }

      showSuccess(
        `${selectedIds.length} amenit${selectedIds.length > 1 ? "ies" : "y"} assigned${
          totalCost > 0 ? ` (₹${totalCost.toLocaleString("en-IN")} recorded)` : ""
        }`
      );
      onSuccess?.();
      onClose();
    } catch (err) {
      console.error("Error assigning amenities:", err);
      showError("Failed to assign amenities");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const availableAmenities = amenities.filter(
    (a) => !assignedAmenityIds.includes(a.id)
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fadeIn">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative w-full max-w-md transform transition-all animate-slideUp max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#f0813d] to-[#f0813d] rounded-t-2xl p-5 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <Package className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Assign Amenity</h2>
              <p className="text-orange-100 text-sm opacity-90">
                {memberName ? `For ${memberName}` : "Select amenities to assign"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-2 hover:bg-white/20 rounded-full transition-all duration-200 disabled:opacity-50"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Content */}
        <div className="bg-white flex-1 overflow-y-auto">
          <div className="p-5">
            {fetching ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="relative">
                  <Loader2 className="w-8 h-8 text-[#f0813d] animate-spin" />
                  <Sparkles className="absolute -top-1 -right-1 w-4 h-4 text-[#f0813d] animate-pulse" />
                </div>
                <p className="mt-4 text-gray-500 text-sm">Loading amenities...</p>
              </div>
            ) : availableAmenities.length === 0 ? (
              <div className="text-center py-10 bg-gray-50 rounded-xl">
                <div className="w-16 h-16 bg-gradient-to-br from-gray-200 to-gray-300 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Package className="w-8 h-8 text-white" />
                </div>
                <h4 className="font-medium text-gray-700">
                  {amenities.length === 0
                    ? "No amenities available"
                    : "All amenities already assigned"}
                </h4>
                <p className="text-sm text-gray-500 mt-1">
                  {amenities.length === 0
                    ? "Create amenities in Settings first"
                    : "This member has all available amenities"}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  Available Amenities
                </h3>
                {availableAmenities.map((amenity) => {
                  const isSelected = selectedIds.includes(amenity.id);
                  return (
                    <div
                      key={amenity.id}
                      onClick={() => !loading && toggleSelect(amenity.id)}
                      className={`p-3 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                        isSelected
                          ? "border-[#f0813d] bg-gradient-to-r from-orange-50/50 to-orange-100/50 shadow-sm"
                          : "border-gray-100 bg-gray-50/50 hover:border-gray-300"
                      } ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0 ${
                            isSelected
                              ? "border-[#f0813d] bg-[#f0813d]"
                              : "border-gray-300 bg-white"
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 text-white" />}
                        </div>
                        <div
                          className={`w-9 h-9 rounded-lg flex items-center justify-center text-white flex-shrink-0 ${
                            isSelected
                              ? "bg-gradient-to-br from-[#f0813d] to-[#f0813d]"
                              : "bg-gradient-to-br from-gray-400 to-gray-500"
                          }`}
                        >
                          <Package className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-gray-900 text-sm truncate">
                            {amenity.name}
                          </h4>
                          {amenity.description && (
                            <p className="text-xs text-gray-500 mt-0.5 truncate">
                              {amenity.description}
                            </p>
                          )}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-base font-bold text-gray-900">
                            ₹{amenity.cost.toLocaleString("en-IN")}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Already assigned (shown as info) */}
                {assignedAmenityIds.length > 0 && (
                  <div className="mt-4">
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
                      Already Assigned
                    </h3>
                    {amenities
                      .filter((a) => assignedAmenityIds.includes(a.id))
                      .map((amenity) => (
                        <div
                          key={amenity.id}
                          className="p-3 rounded-xl border-2 border-orange-100 bg-orange-50/50 mb-2 opacity-60"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-5 h-5 rounded-full bg-[#f0813d] flex items-center justify-center flex-shrink-0">
                              <Check className="w-3 h-3 text-white" />
                            </div>
                            <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white flex-shrink-0 bg-gradient-to-br from-[#f0813d] to-[#f0813d]">
                              <Package className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-semibold text-gray-700 text-sm truncate">
                                {amenity.name}
                              </h4>
                            </div>
                            <span className="text-xs text-[#f0813d] font-medium">
                              Assigned
                            </span>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Payment Mode & Total (shown when selection exists) */}
          {selectedIds.length > 0 && (
            <div className="px-5 pb-5 space-y-3 border-t border-gray-100 pt-4">
              {/* Total Cost */}
              <div className="bg-gradient-to-r from-orange-50 to-orange-50 border border-orange-100 rounded-xl p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500">
                      {selectedIds.length} amenit{selectedIds.length > 1 ? "ies" : "y"} selected
                    </p>
                    <p className="text-lg font-bold text-gray-900 mt-0.5">
                      Total: ₹{totalCost.toLocaleString("en-IN")}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-gradient-to-br from-[#f0813d] to-[#f0813d] rounded-xl flex items-center justify-center">
                    <IndianRupee className="w-6 h-6 text-white" />
                  </div>
                </div>
              </div>

              {/* Payment Mode */}
              {totalCost > 0 && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">
                    Payment Mode
                  </label>
                  <div className="flex gap-2">
                    {["cash", "upi", "card", "bank"].map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setPaymentMode(mode)}
                        className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all border ${
                          paymentMode === mode
                            ? "border-[#f0813d] bg-orange-50 text-[#f0813d]"
                            : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                        }`}
                      >
                        {mode === "bank"
                          ? "Bank"
                          : mode.charAt(0).toUpperCase() + mode.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gradient-to-t from-white via-white to-gray-50 p-5 rounded-b-2xl border-t border-gray-200/60 shadow-lg">
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-5 py-3 bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 rounded-xl font-medium hover:from-gray-200 hover:to-gray-300 transition-all duration-200 active:scale-[0.98] disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleAssign}
              disabled={loading || selectedIds.length === 0}
              className="flex-1 px-5 py-3 bg-gradient-to-r from-[#f0813d] to-[#f0813d] text-white rounded-xl font-medium hover:shadow-lg hover:shadow-orange-200 transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Package className="w-4 h-4" />
                  Assign{totalCost > 0 ? ` (₹${totalCost.toLocaleString("en-IN")})` : ""}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
