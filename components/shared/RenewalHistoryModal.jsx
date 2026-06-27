"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/contexts/ToastContext";

const PAYMENT_MODE_OPTIONS = ["cash", "upi", "card", "bank"];

const roundCurrency = (value) => Math.round((Number(value) || 0) * 100) / 100;
const formatCurrency = (value) => `₹${Number(value || 0).toLocaleString("en-IN")}`;

const getDateInputValue = (value) => {
    if (!value) return "";
    if (typeof value === "string" && value.includes("T")) {
        return value.split("T")[0];
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "";
    return parsed.toISOString().split("T")[0];
};

const mergeDateWithOriginalTime = (dateValue, originalDateTime) => {
    if (!dateValue) return null;
    const fallbackTime = "12:00:00.000Z";

    if (originalDateTime) {
        const original = new Date(originalDateTime);
        if (!Number.isNaN(original.getTime())) {
            const timePart = original.toISOString().split("T")[1] || fallbackTime;
            return `${dateValue}T${timePart}`;
        }
    }

    return `${dateValue}T${fallbackTime}`;
};

const calculateExtendedTillDate = (startDate, durationDays) => {
    if (!startDate || !durationDays) return "";

    const endDate = new Date(`${startDate}T00:00:00`);
    if (Number.isNaN(endDate.getTime())) return "";

    endDate.setDate(endDate.getDate() + Number(durationDays));
    return endDate.toISOString().split("T")[0];
};

export default function RenewalHistoryModal({ member, renewalHistory, onClose, onPaymentModeUpdated, readOnly = false }) {
    const [paymentModeOverrides, setPaymentModeOverrides] = useState({});
    const [renewalOverrides, setRenewalOverrides] = useState({});
    const [deletedMembershipIds, setDeletedMembershipIds] = useState({});
    const [savingPaymentId, setSavingPaymentId] = useState(null);
    const [editingMembershipId, setEditingMembershipId] = useState(null);
    const [deletingMembershipId, setDeletingMembershipId] = useState(null);
    const [editingValues, setEditingValues] = useState({
        renewedAt: "",
        customPrice: "",
        paymentAmount: "",
    });
    const [savingMembershipId, setSavingMembershipId] = useState(null);
    const { showSuccess, showError } = useToast();

    const historyItems = (renewalHistory || [])
        .filter((item) => !deletedMembershipIds[item.membershipId])
        .map((item) => ({
            ...item,
            ...renewalOverrides[item.membershipId],
            paymentMode: item.paymentId && paymentModeOverrides[item.paymentId]
                ? paymentModeOverrides[item.paymentId]
                : item.paymentMode,
        }));

    const totalPaid = roundCurrency(
        historyItems.reduce((sum, renewal) => sum + Number(renewal.paymentAmount || 0), 0)
    );
    const totalDue = roundCurrency(
        historyItems.reduce((sum, renewal) => sum + Number(renewal.dueAmount || 0), 0)
    );

    const syncMemberBalanceFromLatestMembershipDue = async () => {
        const { data: latestMembershipRows, error: latestMembershipError } = await supabase
            .from("memberships")
            .select(`
                id,
                total_amount,
                custom_price,
                end_date,
                start_date,
                membership_plans (
                    price
                ),
                created_at
            `)
            .eq("member_id", member.id)
            .order("end_date", { ascending: false, nullsFirst: false })
            .order("start_date", { ascending: false, nullsFirst: false })
            .order("created_at", { ascending: false })
            .limit(1);

        if (latestMembershipError) {
            console.error("Error fetching latest membership for balance sync:", latestMembershipError);
            return;
        }

        const latestMembership = latestMembershipRows?.[0] || null;
        if (!latestMembership?.id) {
            const { error: clearBalanceError } = await supabase
                .from("members")
                .update({ balance: 0 })
                .eq("id", member.id);

            if (clearBalanceError) {
                console.error("Error clearing member balance:", clearBalanceError);
            }
            return;
        }

        const membershipTotal = roundCurrency(
            latestMembership.custom_price ?? latestMembership.total_amount ?? latestMembership.membership_plans?.price ?? 0
        );

        const { data: paidRows, error: paidRowsError } = await supabase
            .from("payments")
            .select("amount")
            .eq("membership_id", latestMembership.id)
            .eq("status", "paid");

        if (paidRowsError) {
            console.error("Error fetching paid rows for balance sync:", paidRowsError);
            return;
        }

        const paidAmount = roundCurrency(
            (paidRows || []).reduce((sum, row) => sum + Number(row.amount || 0), 0)
        );
        const dueAmount = roundCurrency(Math.max(0, membershipTotal - paidAmount));

        const { error: memberUpdateError } = await supabase
            .from("members")
            .update({ balance: dueAmount })
            .eq("id", member.id);

        if (memberUpdateError) {
            console.error("Error syncing member balance:", memberUpdateError);
        }
    };

    const updatePaymentMode = async (renewalIndex, paymentId, nextMode) => {
        if (readOnly) return;
        if (!paymentId || !nextMode) return;

        const previousMode = historyItems[renewalIndex]?.paymentMode || "cash";
        if (previousMode === nextMode) return;

        setSavingPaymentId(paymentId);
        setPaymentModeOverrides((current) => ({ ...current, [paymentId]: nextMode }));

        const { error } = await supabase
            .from("payments")
            .update({ payment_mode: nextMode })
            .eq("id", paymentId);

        if (error) {
            console.error("Error updating payment mode:", error);
            setPaymentModeOverrides((current) => ({ ...current, [paymentId]: previousMode }));
            showError("Failed to update payment mode");
            setSavingPaymentId(null);
            return;
        }

        setSavingPaymentId(null);
        showSuccess("Payment mode updated");
        onPaymentModeUpdated?.();
    };

    const startEditingRenewal = (renewal) => {
        if (readOnly) return;
        setEditingMembershipId(renewal.membershipId);
        setEditingValues({
            renewedAt: getDateInputValue(renewal.renewedAt),
            customPrice: renewal.customPrice != null ? String(renewal.customPrice) : "",
            paymentAmount: String(renewal.paymentAmount || 0),
        });
    };

    const cancelEditingRenewal = () => {
        setEditingMembershipId(null);
        setEditingValues({
            renewedAt: "",
            customPrice: "",
            paymentAmount: "",
        });
    };

    const updateRenewalDetails = async (renewal, action = "all") => {
        if (readOnly) return;
        if (!renewal?.membershipId) return;

        const updateDates = action === "dates" || action === "all";
        const updatePrice = action === "price" || action === "all";
        const updatePaid = action === "paid" || action === "all";

        const renewalDate = updateDates
            ? editingValues.renewedAt
            : getDateInputValue(renewal.renewedAt);
        const newEndDate = updateDates
            ? calculateExtendedTillDate(renewalDate, renewal.duration)
            : (getDateInputValue(renewal.newEndDate) || calculateExtendedTillDate(renewalDate, renewal.duration));
        const customPriceInput = editingValues.customPrice.trim();
        const paymentAmountInput = editingValues.paymentAmount.trim();
        const planPrice = roundCurrency(renewal.planPrice || renewal.price);

        if (updateDates && (!renewalDate || !newEndDate)) {
            showError("Please select a valid renewal date");
            return;
        }

        const parsedCustomPrice = updatePrice && customPriceInput !== "" ? Number(customPriceInput) : null;
        if (updatePrice && parsedCustomPrice != null && (!Number.isFinite(parsedCustomPrice) || parsedCustomPrice < 0)) {
            showError("Please enter a valid applied price");
            return;
        }

        if (updatePaid && paymentAmountInput !== "" && (!Number.isFinite(Number(paymentAmountInput)) || Number(paymentAmountInput) < 0)) {
            showError("Please enter a valid paid amount");
            return;
        }

        const appliedPrice = updatePrice
            ? (parsedCustomPrice == null ? planPrice : roundCurrency(parsedCustomPrice))
            : roundCurrency(renewal.customPrice != null ? renewal.customPrice : planPrice);
        const updatedPaymentAmount = updatePaid
            ? roundCurrency(paymentAmountInput === "" ? renewal.paymentAmount || 0 : Number(paymentAmountInput))
            : roundCurrency(renewal.paymentAmount || 0);
        const recalculatedDue = roundCurrency(Math.max(0, appliedPrice - updatedPaymentAmount));
        const customPriceValue = updatePrice
            ? (appliedPrice === planPrice ? null : appliedPrice)
            : (renewal.customPrice != null ? roundCurrency(renewal.customPrice) : null);
        setSavingMembershipId(renewal.membershipId);

        const membershipUpdate = {
            due_amount: recalculatedDue,
        };

        if (updateDates) {
            membershipUpdate.start_date = renewalDate;
            membershipUpdate.end_date = newEndDate;
        }

        if (updatePrice) {
            membershipUpdate.custom_price = customPriceValue;
            membershipUpdate.total_amount = appliedPrice;
        }

        const { error: membershipError } = await supabase
            .from("memberships")
            .update(membershipUpdate)
            .eq("id", renewal.membershipId);

        if (membershipError) {
            console.error("Error updating renewal details:", membershipError);
            showError("Failed to update renewal details");
            setSavingMembershipId(null);
            return;
        }

        if (renewal.paymentId) {
            const paymentUpdate = {};

            if (updatePaid) {
                paymentUpdate.amount = updatedPaymentAmount;
            }

            if (updateDates) {
                paymentUpdate.paid_at = mergeDateWithOriginalTime(renewalDate, renewal.renewedAt);
            }

            if (Object.keys(paymentUpdate).length > 0) {
            const { error: paymentDateError } = await supabase
                .from("payments")
                .update(paymentUpdate)
                .eq("id", renewal.paymentId);

            if (paymentDateError) {
                console.error("Error updating renewal payment date:", paymentDateError);
                showError("Renewal updated, but failed to update payment date");
                setSavingMembershipId(null);
                return;
            }
            }
        } else if (updatedPaymentAmount > 0) {
            const insertedPaidAt = mergeDateWithOriginalTime(
                getDateInputValue(renewal.renewedAt) || renewalDate,
                renewal.renewedAt
            );
            const { error: paymentInsertError } = await supabase
                .from("payments")
                .insert({
                    gym_id: member.gymId,
                    member_id: member.id,
                    membership_id: renewal.membershipId,
                    amount: updatedPaymentAmount,
                    payment_mode: renewal.paymentMode || "cash",
                    status: "paid",
                    paid_at: insertedPaidAt,
                });

            if (paymentInsertError) {
                console.error("Error creating paid renewal payment:", paymentInsertError);
                showError("Renewal updated, but failed to create paid payment");
                setSavingMembershipId(null);
                return;
            }
        }

        const { data: pendingPayments, error: pendingFetchError } = await supabase
            .from("payments")
            .select("id")
            .eq("membership_id", renewal.membershipId)
            .eq("status", "pending");

        if (pendingFetchError) {
            console.error("Error fetching pending renewal payments:", pendingFetchError);
            showError("Renewal updated, but failed to sync pending amount");
            setSavingMembershipId(null);
            return;
        }

        // Match /members/add behavior: due is tracked in member/membership only,
        // not as separate pending payment rows in payment history.
        if ((pendingPayments || []).length > 0) {
            const { error: pendingDeleteError } = await supabase
                .from("payments")
                .delete()
                .in("id", pendingPayments.map((payment) => payment.id));

            if (pendingDeleteError) {
                console.error("Error removing pending renewal payment:", pendingDeleteError);
                showError("Renewal updated, but failed to clear pending amount");
                setSavingMembershipId(null);
                return;
            }
        }

        await syncMemberBalanceFromLatestMembershipDue();

        setRenewalOverrides((current) => ({
            ...current,
            [renewal.membershipId]: {
                renewedAt: updateDates
                    ? mergeDateWithOriginalTime(renewalDate, renewal.renewedAt)
                    : renewal.renewedAt,
                newEndDate,
                customPrice: customPriceValue,
                price: appliedPrice,
                paymentAmount: updatedPaymentAmount,
                dueAmount: recalculatedDue,
            },
        }));

        setSavingMembershipId(null);
        cancelEditingRenewal();
        showSuccess("Renewal updated");
        onPaymentModeUpdated?.();
    };

    const deleteRenewalRecord = async (renewal) => {
        if (readOnly) return;
        if (!renewal?.membershipId) return;

        const confirmed = window.confirm(
            `Delete ${renewal.planName} renewal record? This will permanently remove this renewal history entry.`
        );
        if (!confirmed) return;

        setDeletingMembershipId(renewal.membershipId);

        const { error: paymentsDeleteError } = await supabase
            .from("payments")
            .delete()
            .eq("membership_id", renewal.membershipId);

        if (paymentsDeleteError) {
            console.error("Error deleting linked payments:", paymentsDeleteError);
            showError("Failed to delete linked payment records");
            setDeletingMembershipId(null);
            return;
        }

        const { error: membershipDeleteError } = await supabase
            .from("memberships")
            .delete()
            .eq("id", renewal.membershipId);

        if (membershipDeleteError) {
            console.error("Error deleting renewal record:", membershipDeleteError);
            showError("Failed to delete renewal record");
            setDeletingMembershipId(null);
            return;
        }

        await syncMemberBalanceFromLatestMembershipDue();

        setDeletedMembershipIds((current) => ({
            ...current,
            [renewal.membershipId]: true,
        }));

        if (editingMembershipId === renewal.membershipId) {
            cancelEditingRenewal();
        }

        setDeletingMembershipId(null);
        showSuccess("Renewal record deleted");
        onPaymentModeUpdated?.();
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
            <div className="bg-white w-full rounded-t-3xl max-h-[90vh] overflow-hidden flex flex-col">
                <div className="sticky top-0 bg-white border-b border-gray-100 p-4 z-10">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-gray-900">
                            Renewal History
                        </h3>
                        <button
                            onClick={onClose}
                            className="w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-full transition text-gray-600 hover:text-gray-900 font-bold text-lg"
                        >
                            ✕
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4" style={{ minHeight: 0 }}>
                    {/* Member Info */}
                    <div className="bg-gradient-to-r from-orange-50 to-orange-50 rounded-xl p-4 mb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 avatar-gradient rounded-full flex items-center justify-center text-white font-bold">
                                {member.name.charAt(0)}
                            </div>
                            <div>
                                <p className="font-semibold text-gray-900">{member.name}</p>
                                <p className="text-sm text-gray-600">
                                    Current Plan: {member.plan}
                                </p>
                            </div>
                        </div>  
                    </div>

                    {/* Renewal Timeline */}
                    <div className="space-y-3">
                        {historyItems && historyItems.length > 0 ? (
                            historyItems.map((renewal, index) => (
                                <div
                                    key={index}
                                    className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition"
                                >
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 bg-gradient-to-br from-[#f0813d] to-[#f0813d] rounded-full flex items-center justify-center text-white text-xs font-bold">
                                                {historyItems.length - index}
                                            </div>
                                            <div>
                                                <p className="font-semibold text-gray-900">
                                                    {renewal.planName}
                                                </p>
                                                <p className="text-xs text-gray-500">
                                                    {new Date(renewal.renewedAt).toLocaleDateString("en-IN", {
                                                        day: "numeric",
                                                        month: "short",
                                                        year: "numeric",
                                                    })}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-bold text-gray-900">₹{renewal.price || renewal.planPrice}</p>
                                            <p className="text-xs text-gray-500">{renewal.duration} days</p>
                                            {!readOnly && (
                                                <button
                                                    type="button"
                                                    onClick={() => deleteRenewalRecord(renewal)}
                                                    disabled={deletingMembershipId === renewal.membershipId}
                                                    className="mt-1 text-[11px] font-semibold text-[#f0813d] hover:text-[#f0813d] disabled:opacity-60"
                                                >
                                                    {deletingMembershipId === renewal.membershipId ? "Deleting..." : "Delete"}
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Price Breakdown */}
                                    <div className="bg-orange-50 border border-orange-100 rounded-lg p-3 mb-3 space-y-1.5">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-600">Plan Price</span>
                                            <span className={`font-medium ${renewal.customPrice != null ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                                                {formatCurrency(renewal.planPrice || renewal.price)}
                                            </span>
                                        </div>
                                        {renewal.customPrice != null && (
                                            <div className="flex justify-between text-sm">
                                                <span className="text-[#f0813d] font-medium">Custom Price Applied</span>
                                                <span className="font-semibold text-[#f0813d]">{formatCurrency(renewal.customPrice)}</span>
                                            </div>
                                        )}
                                      
                                    </div>

                                    <div className="mb-3 grid grid-cols-2 gap-2">
                                        <div className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2">
                                            <p className="text-[11px] font-medium uppercase tracking-wide text-[#f0813d]">Paid Amount</p>
                                            <p className="mt-1 text-lg font-bold text-[#f0813d]">{formatCurrency(renewal.paymentAmount || 0)}</p>
                                        </div>
                                        <div className={`rounded-lg border px-3 py-2 ${Number(renewal.dueAmount || 0) > 0 ? "border-orange-200 bg-orange-50" : "border-orange-200 bg-orange-50"}`}>
                                            <p className={`text-[11px] font-medium uppercase tracking-wide ${Number(renewal.dueAmount || 0) > 0 ? "text-[#f0813d]" : "text-[#f0813d]"}`}>
                                                Due Amount
                                            </p>
                                            <p className={`mt-1 text-lg font-bold ${Number(renewal.dueAmount || 0) > 0 ? "text-[#f0813d]" : "text-[#f0813d]"}`}>
                                                {formatCurrency(renewal.dueAmount || 0)}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="mb-3 rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2">
                                        <div className="flex items-center justify-between gap-2">
                                            <div>
                                                <p className="text-xs text-gray-600">Renewal Dates</p>
                                                <p className="text-sm font-medium text-gray-900">
                                                    {new Date(renewal.renewedAt).toLocaleDateString("en-IN", {
                                                        day: "numeric",
                                                        month: "short",
                                                        year: "numeric",
                                                    })}
                                                    {renewal.newEndDate ? ` to ${new Date(renewal.newEndDate).toLocaleDateString("en-IN", {
                                                        day: "numeric",
                                                        month: "short",
                                                        year: "numeric",
                                                    })}` : ""}
                                                </p>
                                            </div>
                                            {!readOnly && (
                                                <button
                                                    type="button"
                                                    onClick={() => startEditingRenewal(renewal)}
                                                    className="text-xs font-medium text-[#f0813d] hover:text-[#f0813d]"
                                                >
                                                    {editingMembershipId === renewal.membershipId ? "Editing" : "Tap to edit"}
                                                </button>
                                            )}
                                        </div>

                                        {editingMembershipId === renewal.membershipId && (
                                            <div className="space-y-3 border-t border-gray-200 pt-3">
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="block text-xs font-medium text-gray-600 mb-1">Renewal Date</label>
                                                        <input
                                                            type="date"
                                                            value={editingValues.renewedAt}
                                                            onChange={(e) => setEditingValues((current) => ({ ...current, renewedAt: e.target.value }))}
                                                            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-[#f0813d] outline-none"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-medium text-gray-600 mb-1">Extended Till</label>
                                                        <div className="w-full rounded-lg border border-gray-200 bg-gray-100 px-3 py-2 text-sm text-gray-700">
                                                            {editingValues.renewedAt
                                                                ? new Date(`${calculateExtendedTillDate(editingValues.renewedAt, renewal.duration)}T00:00:00`).toLocaleDateString("en-IN")
                                                                : "Select renewal date"}
                                                        </div>
                                                        <p className="mt-1 text-[11px] text-gray-500">
                                                            Auto-calculated for {renewal.duration} days.
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={cancelEditingRenewal}
                                                        disabled={savingMembershipId === renewal.membershipId}
                                                        className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700"
                                                    >
                                                        Cancel
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => updateRenewalDetails(renewal, "dates")}
                                                        disabled={savingMembershipId === renewal.membershipId}
                                                        className="flex-1 rounded-lg bg-[#f0813d] px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
                                                    >
                                                        {savingMembershipId === renewal.membershipId ? "Saving..." : "Save Dates"}
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="mb-3 rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2">
                                        <div className="flex items-center justify-between gap-2">
                                            <div>
                                                <p className="text-xs text-gray-600">Applied Price</p>
                                                <p className="text-sm font-medium text-gray-900">
                                                    {renewal.customPrice != null
                                                        ? `₹${renewal.customPrice}`
                                                        : `Default ₹${renewal.planPrice || renewal.price}`}
                                                </p>
                                            </div>
                                            {!readOnly && editingMembershipId !== renewal.membershipId && (
                                                <button
                                                    type="button"
                                                    onClick={() => startEditingRenewal(renewal)}
                                                    className="text-xs font-medium text-[#f0813d] hover:text-[#f0813d]"
                                                >
                                                    Tap to edit
                                                </button>
                                            )}
                                        </div>

                                        {editingMembershipId === renewal.membershipId && (
                                            <div className="space-y-3 border-t border-gray-200 pt-3">
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-600 mb-1">Applied Price</label>
                                                    <input
                                                        type="text"
                                                        inputMode="decimal"
                                                        value={editingValues.customPrice}
                                                        onChange={(e) => {
                                                            const value = e.target.value;
                                                            if (value === "" || /^\d*\.?\d*$/.test(value)) {
                                                                setEditingValues((current) => ({ ...current, customPrice: value }));
                                                            }
                                                        }}
                                                        placeholder={`Default: ₹${renewal.planPrice || renewal.price}`}
                                                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-[#f0813d] outline-none"
                                                    />
                                                    <p className="mt-1 text-[11px] text-gray-500">Leave empty to use the original plan price.</p>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={cancelEditingRenewal}
                                                        disabled={savingMembershipId === renewal.membershipId}
                                                        className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700"
                                                    >
                                                        Cancel
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => updateRenewalDetails(renewal, "price")}
                                                        disabled={savingMembershipId === renewal.membershipId}
                                                        className="flex-1 rounded-lg bg-[#f0813d] px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
                                                    >
                                                        {savingMembershipId === renewal.membershipId ? "Saving..." : "Save Price"}
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="mb-3 rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2">
                                        <div className="flex items-center justify-between gap-2">
                                            <div>
                                                <p className="text-xs text-gray-600">Paid Amount</p>
                                                <p className="text-sm font-medium text-gray-900">{formatCurrency(renewal.paymentAmount || 0)}</p>
                                            </div>
                                        </div>

                                        <div className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2">
                                            <p className="text-[11px] font-medium text-orange-800">
                                                Paid amount editing is disabled here.
                                            </p>
                                            <p className="mt-1 text-[11px] text-[#f0813d]">
                                                To update amount, open this member and go to Payments.
                                            </p>
                                        </div>
                                    </div>

                                    {renewal.paymentAmount > 0 && (
                                        <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-2">
                                            <div className="flex items-center justify-between gap-2">
                                                <div>
                                                    <p className="text-xs text-gray-600">Payment Mode</p>
                                                    <p className="font-medium text-gray-900 capitalize">
                                                        {renewal.paymentMode}
                                                    </p>
                                                </div>
                                                {renewal.paymentId && !readOnly && (
                                                    <span className="text-[11px] text-gray-400">
                                                        {savingPaymentId === renewal.paymentId ? "Updating..." : "Tap to change"}
                                                    </span>
                                                )}
                                            </div>

                                            {renewal.paymentId && !readOnly && (
                                                <div className="grid grid-cols-4 gap-2">
                                                    {PAYMENT_MODE_OPTIONS.map((mode) => (
                                                        <button
                                                            key={mode}
                                                            type="button"
                                                            onClick={() => updatePaymentMode(index, renewal.paymentId, mode)}
                                                            disabled={savingPaymentId === renewal.paymentId}
                                                            className={`py-2 text-xs font-medium rounded-lg capitalize transition-all ${
                                                                renewal.paymentMode === mode
                                                                    ? "bg-[#f0813d] text-white"
                                                                    : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-100"
                                                            } ${savingPaymentId === renewal.paymentId ? "opacity-60 cursor-not-allowed" : ""}`}
                                                        >
                                                            {mode}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {renewal.newEndDate && (
                                        <div className="mt-3 pt-3 border-t border-gray-100">
                                            <p className="text-xs text-gray-600">Extended Till</p>
                                            <p className="font-medium text-[#f0813d]">
                                                {new Date(renewal.newEndDate).toLocaleDateString("en-IN", {
                                                    day: "numeric",
                                                    month: "short",
                                                    year: "numeric",
                                                })}
                                            </p>
                                        </div>
                                    )}

                                    {renewal.notes && (
                                        <div className="mt-2 text-xs text-gray-600 bg-gray-50 rounded-lg p-2">
                                            <p className="font-medium text-gray-700 mb-1">Notes:</p>
                                            <p>{renewal.notes}</p>
                                        </div>
                                    )}

                                    {(renewal.dueAmount || 0) > 0 && renewal.paymentAmount <= 0 && (
                                        <div className="mt-2 flex items-center gap-1 text-xs text-[#f0813d] bg-orange-50 rounded-lg p-2">
                                            <span>⚠️</span>
                                            <span>
                                                No payment recorded - Full amount pending
                                            </span>
                                        </div>
                                    )}
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-12">
                                <div className="text-6xl mb-4">📋</div>
                                <p className="text-gray-500 font-medium">No renewal history</p>
                                <p className="text-sm text-gray-400 mt-1">
                                    Renewals will appear here
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Summary Stats */}
                    {historyItems && historyItems.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-gray-200">
                            <div className="grid grid-cols-3 gap-3">
                                <div className="bg-orange-50 rounded-lg p-3 text-center">
                                    <p className="text-xs text-[#f0813d] mb-1">Total Renewals</p>
                                    <p className="text-xl font-bold text-[#f0813d]">
                                        {historyItems.length-1}
                                    </p>
                                </div>
                                <div className="bg-orange-50 rounded-lg p-3 text-center">
                                    <p className="text-xs text-[#f0813d] mb-1">Total Paid</p>
                                    <p className="text-xl font-bold text-[#f0813d]">
                                        ₹{totalPaid}
                                    </p>
                                </div>
                                <div className="bg-orange-50 rounded-lg p-3 text-center">
                                    <p className="text-xs text-[#f0813d] mb-1">Total Due</p>
                                    <p className="text-xl font-bold text-[#f0813d]">
                                        ₹{totalDue}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    <button
                        onClick={onClose}
                        className="w-full mt-4 py-3 bg-gray-900 text-white rounded-xl font-semibold hover:bg-gray-800 transition shadow-md"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
