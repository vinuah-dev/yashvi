"use client";

import {
  Building,
  TrendingUp,
  MapPin,
  Activity,
} from "lucide-react";

export default function GymHeroCard({ gym }) {
  if (!gym) return null;

  return (
    <div className="relative overflow-hidden rounded-[32px] mx-1">
      {/* Main Card */}
      <div
        className="
          relative
          bg-gradient-to-br
          from-[#f0813d]
          via-[#d76621]
          to-[#9c4400]
          p-6
          min-h-[220px]
          overflow-hidden
          shadow-[0_25px_60px_rgba(240,129,61,0.28)]
        "
      >
        {/* Decorative Glow */}
        <div className="absolute -top-16 -right-16 w-56 h-56 bg-white/20 rounded-full blur-3xl" />

        <div className="absolute bottom-0 right-0 opacity-10">
          <Activity className="w-52 h-52 text-white" />
        </div>

        {/* Top Section */}
        <div className="relative z-10 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 bg-white/15 backdrop-blur-md border border-white/20 w-fit px-3 py-1.5 rounded-full">
              <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
              <span className="text-[11px] uppercase tracking-[0.18em] font-bold text-white">
                Gym Active
              </span>
            </div>

            <h2 className="mt-5 text-[28px] leading-[1.05] font-black text-white max-w-[240px]">
              {gym.name}
            </h2>

            <div className="mt-3 flex items-center gap-2 text-white/80">
              <MapPin className="w-4 h-4" />
              <p className="text-sm truncate max-w-[240px]">
                {gym.address || "Premium Fitness Facility"}
              </p>
            </div>
          </div>

          {/* Logo Badge */}
          <div
            className="
              w-14
              h-14
              rounded-2xl
              bg-white/15
              backdrop-blur-lg
              border
              border-white/20
              flex
              items-center
              justify-center
              shadow-lg
            "
          >
            <Building className="w-6 h-6 text-white" />
          </div>
        </div>

        {/* Bottom Stats */}
        <div className="relative z-10 mt-10 grid grid-cols-2 gap-3">
          {/* Performance */}
          <div className="bg-white/14 backdrop-blur-lg rounded-2xl p-4 border border-white/15">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-white" />
              <p className="text-[11px] uppercase tracking-[0.16em] text-white/70 font-bold">
                Performance
              </p>
            </div>

            <p className="text-lg font-black text-white">
              High Growth
            </p>

            <p className="text-xs text-white/70 mt-1">
              Excellent member engagement
            </p>
          </div>

          {/* Status */}
          <div className="bg-white/14 backdrop-blur-lg rounded-2xl p-4 border border-white/15">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-4 h-4 text-white" />
              <p className="text-[11px] uppercase tracking-[0.16em] text-white/70 font-bold">
                Status
              </p>
            </div>

            <p className="text-lg font-black text-white">
              Operational
            </p>

            <p className="text-xs text-white/70 mt-1">
              Running smoothly today
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}