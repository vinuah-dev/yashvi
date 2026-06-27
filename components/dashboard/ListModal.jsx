"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

export default function ListModal({
  open,
  onClose,
  title,
  subtitle,
  icon,
  iconBg = "bg-orange-50",
  iconColor = "text-[#f0813d]",
  footer,
  children,
}) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/35 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white border border-[#ececec] w-full sm:max-w-lg sm:rounded-[32px] rounded-t-[32px] max-h-[82vh] flex flex-col shadow-[0_-20px_70px_rgba(0,0,0,0.16)] overflow-hidden">
        <div className="w-12 h-1.5 rounded-full bg-[#d9d9d9] mx-auto mt-3 sm:hidden" />

        <div className="flex items-center justify-between p-5 border-b border-[#f1f1f1] sticky top-0 bg-white/90 backdrop-blur-2xl z-10">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-12 h-12 ${iconBg} rounded-2xl flex items-center justify-center border border-[#ececec] flex-shrink-0`}
            >
              <div className={iconColor}>{icon}</div>
            </div>

            <div className="min-w-0">
              <h2 className="text-lg font-heading font-black text-[#1a1c1c] truncate">
                {title}
              </h2>

              {subtitle && (
                <p className="text-xs text-[#897267] font-semibold mt-0.5 truncate">
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-10 h-10 bg-[#fafafa] hover:bg-white rounded-2xl flex items-center justify-center border border-[#ececec] active-scale transition-all shadow-sm"
          >
            <X className="w-4 h-4 text-[#1a1c1c]" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar bg-[#fbfbfb]">
          {children}
        </div>

        {footer && (
          <div className="p-4 border-t border-[#f1f1f1] bg-white">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}