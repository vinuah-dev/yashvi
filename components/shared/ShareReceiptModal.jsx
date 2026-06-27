"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { 
  getLatestMemberReceipt, 
  shareReceiptOnWhatsApp, 
  downloadReceipt,
  createPaymentReceipt 
} from "@/lib/receiptGenerator";
import {
  X,
  Share2,
  Download,
  FileText,
  Clock,
  CheckCircle,
  AlertCircle,
  MessageCircle,
  Loader2,
  ExternalLink
} from "lucide-react";

export default function ShareReceiptModal({ member, gymData, onClose }) {
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [latestPayment, setLatestPayment] = useState(null);
  const [error, setError] = useState(null);

  // Fetch latest receipt or payment info
  useEffect(() => {
    const fetchReceiptData = async () => {
      if (!member?.id) return;

      setLoading(true);
      setError(null);

      try {
        // First, try to get existing valid receipt
        const existingReceipt = await getLatestMemberReceipt(member.id);
        
        if (existingReceipt) {
          setReceipt(existingReceipt);
          setLoading(false);
          return;
        }

        // If no receipt, fetch latest payment to potentially generate one
        // Fetch latest MEMBERSHIP payment (not trainer payments)
        const { data: payment, error: paymentError } = await supabase
          .from("payments")
          .select(`
            *,
            memberships (
              id,
              start_date,
              end_date,
              membership_plans (
                name,
                duration_days
              )
            )
          `)
          .eq("member_id", member.id)
          .eq("status", "paid")
          .not("membership_id", "is", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (paymentError && paymentError.code !== "PGRST116") {
          console.error("Error fetching payment:", paymentError);
        }

        setLatestPayment(payment);
      } catch (err) {
        console.error("Error:", err);
        setError("Failed to load receipt data");
      }

      setLoading(false);
    };

    fetchReceiptData();
  }, [member?.id]);

  // Generate receipt from latest payment
  const handleGenerateReceipt = async () => {
    if (!latestPayment || !gymData?.id) {
      setError("Missing payment or gym data");
      return;
    }

    setGenerating(true);
    setError(null);

    try {
      let membership = latestPayment.memberships;
      let plan = membership?.membership_plans;

      // If membership join didn't resolve dates, fetch active membership directly
      if (!membership?.start_date || !membership?.end_date) {
        const { data: activeMembership } = await supabase
          .from("memberships")
          .select(`
            id,
            start_date,
            end_date,
            membership_plans (
              name,
              duration_days
            )
          `)
          .eq("member_id", member.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (activeMembership) {
          membership = activeMembership;
          plan = activeMembership.membership_plans || plan;
        }
      }

      const result = await createPaymentReceipt({
        gymId: gymData.id,
        gymName: gymData.name,
        gymAddress: gymData.address || "",
        gymPhone: gymData.phone || "",
        memberId: member.id,
        memberName: member.name,
        memberPhone: member.phone,
        memberEmail: member.email,
        planName: plan?.name || member.plan || "Membership",
        planDuration: plan?.duration_days || 30,
        validityStart: membership?.start_date || null,
        validityEnd: membership?.end_date || null,
        amount: latestPayment.amount,
        balanceAmount: member.balance || 0,
        paymentMode: latestPayment.payment_mode,
        paymentId: latestPayment.id,
        paymentDate: latestPayment.paid_at || latestPayment.created_at
      });

      if (result.success) {
        setReceipt(result.receipt);
      } else {
        setError(result.error || "Failed to generate receipt");
      }
    } catch (err) {
      console.error("Error generating receipt:", err);
      setError("Failed to generate receipt. Please try again.");
    }

    setGenerating(false);
  };

  // Handle WhatsApp share
  const handleWhatsAppShare = () => {
    if (!receipt) return;

    const resolvedBalanceAmount =
      receipt.balance_amount ?? member?.dueAmount ?? member?.balance ?? 0;

    shareReceiptOnWhatsApp({
      memberName: member.name,
      memberPhone: member.phone,
      gymName: gymData?.name || "Gym",
      planName: receipt.plan_name || member.plan,
      amount: receipt.amount,
      balanceAmount: resolvedBalanceAmount,
      validityEnd: receipt.validity_end || member.validTill,
      receiptUrl: receipt.receipt_url
    });
  };

  // Handle download
  const handleDownload = () => {
    if (!receipt) return;
    downloadReceipt(receipt.receipt_url, receipt.receipt_number);
  };

  // Calculate expiry info
  const getExpiryInfo = () => {
    if (!receipt?.expires_at) return null;
    
    const expiresAt = new Date(receipt.expires_at);
    const now = new Date();
    const daysLeft = Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24));
    
    return {
      daysLeft,
      formattedDate: expiresAt.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      })
    };
  };

  const expiryInfo = getExpiryInfo();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#f0813d] to-[#f0813d] p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Share Receipt</h2>
              <p className="text-orange-100 text-sm">{member?.name}</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Loading State */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="w-10 h-10 text-[#f0813d] animate-spin mb-3" />
              <p className="text-gray-600">Loading receipt data...</p>
            </div>
          )}

          {/* Error State */}
          {error && !loading && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-[#f0813d] flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-orange-800 font-medium">Error</p>
                <p className="text-[#f0813d] text-sm">{error}</p>
              </div>
            </div>
          )}

          {/* No Receipt - Can Generate */}
          {!loading && !receipt && latestPayment && (
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8 text-white" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">No Receipt Found</h3>
              <p className="text-gray-500 text-sm mb-4">
                Generate a receipt for the last payment of ₹{Number(latestPayment.amount).toLocaleString("en-IN")}
              </p>
              <button
                onClick={handleGenerateReceipt}
                disabled={generating}
                className="px-6 py-3 bg-gradient-to-r from-[#f0813d] to-[#f0813d] text-white font-medium rounded-xl hover:shadow-lg active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2 mx-auto"
              >
                {generating ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <FileText className="w-5 h-5" />
                    Generate Receipt
                  </>
                )}
              </button>
            </div>
          )}

          {/* No Payment Found */}
          {!loading && !receipt && !latestPayment && !error && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8 text-white" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">No Payments Found</h3>
              <p className="text-gray-500 text-sm">
                This member has no recorded payments yet.
              </p>
            </div>
          )}

          {/* Receipt Available */}
          {!loading && receipt && (
            <>
              {/* Receipt Info Card */}
              <div className="bg-gradient-to-br from-orange-50 to-orange-50 border border-orange-200 rounded-xl p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-sm text-[#f0813d] font-medium">Receipt #{receipt.receipt_number}</p>
                    <p className="text-xs text-[#f0813d] mt-1">
                      Generated: {new Date(receipt.created_at).toLocaleDateString("en-IN")}
                    </p>
                  </div>
                  <div className="bg-[#f0813d] text-white text-xs font-medium px-2 py-1 rounded-lg flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" />
                    Valid
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Amount:</span>
                    <span className="font-semibold text-gray-900">₹{Number(receipt.amount).toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Plan:</span>
                    <span className="font-medium text-gray-900">{receipt.plan_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Mode:</span>
                    <span className="font-medium text-gray-900 capitalize">{receipt.payment_mode}</span>
                  </div>
                </div>
              </div>

              {/* Expiry Warning */}
              {expiryInfo && (
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                  expiryInfo.daysLeft <= 2 
                    ? "bg-orange-50 border border-orange-200" 
                    : "bg-orange-50 border border-orange-200"
                }`}>
                  <Clock className={`w-4 h-4 ${
                    expiryInfo.daysLeft <= 2 ? "text-[#f0813d]" : "text-[#f0813d]"
                  }`} />
                  <p className={`text-sm ${
                    expiryInfo.daysLeft <= 2 ? "text-[#f0813d]" : "text-[#f0813d]"
                  }`}>
                    Expires in {expiryInfo.daysLeft} day{expiryInfo.daysLeft !== 1 ? 's' : ''}
                    <span className="text-xs ml-1 opacity-75">({expiryInfo.formattedDate})</span>
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-3">
                {/* WhatsApp Share Button */}
                <button
                  onClick={handleWhatsAppShare}
                  className="w-full py-3.5 bg-gradient-to-r from-[#f0813d] to-[#f0813d] text-white font-semibold rounded-xl hover:shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  <MessageCircle className="w-5 h-5" />
                  Share on WhatsApp
                </button>

                {/* Secondary Actions */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={handleDownload}
                    className="py-3 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Download
                  </button>
                  <button
                    onClick={() => window.open(receipt.receipt_url, '_blank')}
                    className="py-3 bg-orange-50 text-[#f0813d] font-medium rounded-xl hover:bg-orange-100 active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Preview
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
