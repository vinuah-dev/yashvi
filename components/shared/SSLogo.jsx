"use client";

export default function SSLogo({ size = "md", showWordmark = true, className = "" }) {
  const sizes = {
    sm: "w-11 h-11 text-base",
    md: "w-14 h-14 text-xl",
    lg: "w-20 h-20 text-3xl",
  };

  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      <div className={`${sizes[size] || sizes.md} relative grid place-items-center`}>
        <img
          src="/icons/ss-hexagon.svg"
          alt="SS Fitness"
          className="h-full w-full drop-shadow-[0_16px_30px_rgba(240,129,61,0.28)]"
        />
      </div>
      {showWordmark && (
        <div className="leading-none">
          <div className="text-xl font-black tracking-[0.18em] text-white">SS</div>
          <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.28em] text-[#f0813d]">
            Fitness
          </div>
        </div>
      )}
    </div>
  );
}
