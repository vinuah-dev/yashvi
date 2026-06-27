"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DollarSign, CheckCircle, AlertCircle } from "lucide-react";
import ListModal from "./ListModal";

function PaymentRow({ payment, size = "sm", onClick }) {
  return (
    <div
      onClick={onClick}
      className="flex items-center justify-between p-3 rounded-2xl border border-[#ececec] bg-[#fafafa] hover:bg-white transition-all duration-300 cursor-pointer active-scale"
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        
        <div className="w-11 h-11 bg-orange-50 text-[#f0813d] border border-orange-100 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm">
          <DollarSign className="w-5 h-5" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-[#1a1c1c] truncate">
            {payment.name}
          </p>

          <div className="flex items-center gap-1 mt-1">
            <AlertCircle className="w-3.5 h-3.5 text-[#f0813d]" />
            <span className="text-[10px] font-black text-[#f0813d] uppercase tracking-wide">
              overdue payment
            </span>
          </div>
        </div>
      </div>

      <div className="text-right flex-shrink-0 pl-2">
        <p className="text-lg font-black font-heading text-[#f0813d] tracking-tight">
          ₹
          {typeof payment.amount === "number"
            ? payment.amount.toLocaleString()
            : payment.amount}
        </p>

        <span className="text-[10px] font-bold text-[#5f5e5e]">
          {size === "lg" ? "View Details" : "Collect"}
        </span>
      </div>
    </div>
  );
}

export default function PendingPaymentsSection({
  topPayments,
  allPayments,
  totalDues,
}) {
  const [showModal, setShowModal] = useState(false);
  const router = useRouter();

  return (
    <>
      <div className="bg-white border border-[#ececec] rounded-3xl p-5 shadow-[0_10px_40px_rgba(0,0,0,0.05)]">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-[#f0813d] to-[#9c4400] text-white border border-[#f0813d]/30 rounded-2xl flex items-center justify-center shadow-[0_10px_24px_rgba(240,129,61,0.24)]">
              <DollarSign className="w-5 h-5 text-white" />
            </div>

            <div>
              <h3 className="text-sm font-black text-[#1a1c1c] tracking-tight">
                Pending Payments
              </h3>

              <p className="text-[11px] font-semibold text-[#897267] uppercase tracking-wide mt-0.5">
                ₹{totalDues.toLocaleString()} outstanding
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowModal(true)}
              className="px-3 py-2 bg-[#fafafa] hover:bg-white border border-[#ececec] text-[#1a1c1c] rounded-xl text-[11px] font-bold active-scale transition-all"
            >
              View All
            </button>

            <button
              onClick={() => router.push("/finance")}
              className="px-4 py-2 bg-[#1a1c1c] hover:bg-black text-white rounded-xl text-[11px] font-bold active-scale transition-all shadow-[0_8px_24px_rgba(0,0,0,0.12)]"
            >
              Collect
            </button>
          </div>
        </div>

        {/* Payments */}
        <div className="space-y-2.5">
          {topPayments.length > 0 ? (
            topPayments.map((p) => (
              <PaymentRow
                key={p.id}
                payment={p}
                onClick={() => router.push(`/members/${p.id}`)}
              />
            ))
          ) : (
            <div className="text-center py-8 bg-[#fafafa] border border-dashed border-[#e5e5e5] rounded-2xl">
              
              <div className="w-14 h-14 bg-[#f0813d]/20 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <CheckCircle className="w-7 h-7 text-white" />
              </div>

              <p className="text-[#1a1c1c] font-black text-sm">
                All payments cleared
              </p>

              <p className="text-xs text-[#897267] mt-1">
                No pending dues right now
              </p>
            </div>
          )}
        </div>
      </div>

      <ListModal
        open={showModal}
        onClose={() => setShowModal(false)}
        title="Pending Payments"
        subtitle={`₹${totalDues.toLocaleString()} outstanding`}
        icon={<DollarSign className="w-5 h-5" />}
        iconBg="bg-orange-50"
        iconColor="text-[#f0813d]"
        footer={
          <button
            onClick={() => {
              setShowModal(false);
              router.push("/finance");
            }}
            className="w-full py-3 bg-[#1a1c1c] text-white rounded-2xl font-bold text-sm active-scale transition-all"
          >
            Open Finance Dashboard
          </button>
        }
      >
        {allPayments.length > 0 ? (
          allPayments.map((p) => (
            <PaymentRow
              key={p.id}
              payment={p}
              size="lg"
              onClick={() => {
                setShowModal(false);
                router.push(`/members/${p.id}`);
              }}
            />
          ))
        ) : (
          <div className="text-center py-8 bg-[#fafafa] border border-dashed border-[#e5e5e5] rounded-2xl">
            <CheckCircle className="w-10 h-10 text-[#9c4400] mx-auto mb-3" />

            <p className="text-[#1a1c1c] font-black">
              Everything is cleared
            </p>

            <p className="text-xs text-[#897267] mt-1">
              No pending payments remaining
            </p>
          </div>
        )}
      </ListModal>
    </>
  );
}
