"use client";

import { useRouter } from "next/navigation";
import { DollarSign, TrendingUp } from "lucide-react";

export default function RevenueCard({ totalRevenue, pendingDues, canViewFinance }) {
  const router = useRouter();

   return (
  <div className="relative overflow-hidden bg-white border border-[#ececec] rounded-3xl p-5 shadow-[0_10px_40px_rgba(0,0,0,0.06)]">
    
    {/* Premium Glow */}
    <div className="absolute top-0 right-0 w-52 h-52 bg-gradient-to-br from-[#f0813d]/30 to-[#f0813d]/5 rounded-full blur-3xl pointer-events-none" />

    <div className="relative z-10">
      
      {/* Top Section */}
      <div className="flex items-start justify-between mb-6 gap-4">
        
        {/* Revenue */}
        <div className="flex-1">
          <p className="text-[11px] font-bold tracking-[0.2em] uppercase text-[#8b8b8b] mb-1">
            Total Revenue
          </p>

          <h2 className="text-4xl font-black font-heading text-[#1a1c1c] tracking-tight">
            {canViewFinance
              ? `₹${(totalRevenue / 1000).toFixed(1)}K`
              : "*****"}
          </h2>

          <div className="flex items-center gap-2 mt-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#f0813d] to-[#9c4400] flex items-center justify-center shadow-[0_8px_18px_rgba(240,129,61,0.22)]">
              <TrendingUp className="w-4 h-4 text-white" />
            </div>

            <div>
              <p className="text-xs font-bold text-[#1a1c1c]">
                Revenue Growing
              </p>
              <p className="text-[11px] text-[#7b7b7b]">
                Strong monthly performance
              </p>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="w-px self-stretch bg-[#ececec]" />

        {/* Pending */}
        <div className="min-w-[110px] text-right">
          <p className="text-[11px] font-bold tracking-[0.2em] uppercase text-[#8b8b8b] mb-1">
            Pending
          </p>

          <h3 className="text-3xl font-black font-heading text-[#f0813d] tracking-tight">
            {canViewFinance
              ? `₹${(pendingDues / 1000).toFixed(1)}K`
              : "*****"}
          </h3>

          <p className="text-[11px] text-[#7b7b7b] mt-2 font-medium">
            awaiting collection
          </p>
        </div>
      </div>

      {/* CTA */}
      <button
        onClick={() => router.push("/finance")}
        className="w-full py-3 rounded-2xl bg-[#1a1c1c] hover:bg-black text-white font-bold text-sm active-scale transition-all flex items-center justify-center gap-2 shadow-[0_8px_24px_rgba(0,0,0,0.12)]"
        style={{ minHeight: "50px" }}
      >
        <DollarSign className="w-4 h-4 text-[#f0813d]" />
        Open Finance Dashboard
      </button>
    </div>
  </div>
);
}
