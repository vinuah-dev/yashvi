"use client";

import { useEffect } from "react";

export default function Toast({ message, type = "success", isVisible, onClose }) {
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => {
        onClose();
      }, 3000); // Auto-close after 3 seconds

      return () => clearTimeout(timer);
    }
  }, [isVisible, onClose]);

  if (!isVisible) return null;

  const typeStyles = {
    success: {
      bg: "bg-orange-50 border-orange-200",
      text: "text-orange-800",
      icon: "✓",
      iconBg: "bg-[#f0813d]",
    },
    error: {
      bg: "bg-orange-50 border-orange-200",
      text: "text-orange-800",
      icon: "✕",
      iconBg: "bg-[#f0813d]",
    },
    warning: {
      bg: "bg-orange-50 border-orange-200",
      text: "text-orange-800",
      icon: "⚠",
      iconBg: "bg-[#f0813d]",
    },
    info: {
      bg: "bg-orange-50 border-orange-200",
      text: "text-orange-800",
      icon: "ℹ",
      iconBg: "bg-[#f0813d]",
    },
  };

  const styles = typeStyles[type] || typeStyles.success;

  return (
    <div className="fixed top-4 right-4 z-50 animate-slide-in-right">
      <div
        className={`${styles.bg} ${styles.text} border-2 rounded-xl shadow-lg p-4 min-w-[300px] max-w-[400px] flex items-start gap-3`}
      >
        <div
          className={`${styles.iconBg} text-white w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0`}
        >
          {styles.icon}
        </div>
        <div className="flex-1">
          <p className="font-medium text-sm leading-relaxed">{message}</p>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 flex-shrink-0 ml-2"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

