"use client";

const COLOR_MAP = {
  blue: {
    accent: "from-[#f0813d] to-[#9c4400]",
    softBg: "bg-orange-50",
    iconBg: "bg-orange-100 text-[#f0813d]",
    badge: "bg-orange-100 text-[#f0813d]",
  },

  green: {
    accent: "from-[#f0813d] to-[#9c4400]",
    softBg: "bg-orange-50",
    iconBg: "bg-orange-100 text-[#9c4400]",
    badge: "bg-orange-100 text-[#9c4400]",
  },

  orange: {
    accent: "from-[#fb923c] to-[#f0813d]",
    softBg: "bg-orange-50",
    iconBg: "bg-orange-100 text-[#f0813d]",
    badge: "bg-orange-100 text-[#f0813d]",
  },

  orangeDeep: {
    accent: "from-[#9c4400] to-[#9c4400]",
    softBg: "bg-orange-50",
    iconBg: "bg-orange-100 text-[#f0813d]",
    badge: "bg-orange-100 text-[#f0813d]",
  },
};

export default function KPICard({
  title,
  value,
  icon,
  color = "blue",
  trend,
  onClick,
}) {
  const c = COLOR_MAP[color] || COLOR_MAP.blue;

  return (
    <button
      onClick={onClick}
      className="
        relative
        overflow-hidden
        rounded-[28px]
        border
        border-black/5
        bg-white
        p-4
        text-left
        transition-all
        duration-300
        hover:-translate-y-1
        hover:shadow-[0_18px_40px_rgba(0,0,0,0.08)]
        active:scale-[0.98]
        shadow-[0_8px_30px_rgba(0,0,0,0.04)]
        w-full
      "
      style={{ minHeight: "140px" }}
    >
      {/* Background Gradient Glow */}
      <div
        className={`absolute inset-0 opacity-[0.06] bg-gradient-to-br ${c.accent}`}
      />

      {/* Top Glow Blob */}
      <div
        className={`absolute -top-10 -right-10 w-28 h-28 rounded-full blur-3xl opacity-20 bg-gradient-to-br ${c.accent}`}
      />

      <div className="relative z-10 flex flex-col justify-between h-full">
        {/* Top Row */}
        <div className="flex items-start justify-between">
          <div
            className={`
              w-12
              h-12
              rounded-2xl
              flex
              items-center
              justify-center
              ${c.iconBg}
              shadow-sm
            `}
          >
            {icon}
          </div>

          {trend && (
            <span
              className={`
                text-[10px]
                font-bold
                px-2.5
                py-1
                rounded-full
                tracking-wide
                ${c.badge}
              `}
            >
              {trend}
            </span>
          )}
        </div>

        {/* Content */}
        <div className="mt-6">
          <p className="text-[34px] leading-none font-black tracking-tight text-[#1a1c1c]">
            {value}
          </p>

          <p className="mt-2 text-[11px] uppercase tracking-[0.18em] font-bold text-[#897267]">
            {title}
          </p>
        </div>

        {/* Bottom Accent Line */}
        <div
          className={`mt-4 h-1.5 w-16 rounded-full bg-gradient-to-r ${c.accent}`}
        />
      </div>
    </button>
  );
}