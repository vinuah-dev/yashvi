"use client";

import { createContext, useContext, useState, useCallback } from "react";
import Toast from "@/components/shared/Toast";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toast, setToast] = useState({
    message: "",
    type: "success",
    isVisible: false,
  });

  const showToast = useCallback((message, type = "success") => {
    setToast({
      message,
      type,
      isVisible: true,
    });
  }, []);

  const hideToast = useCallback(() => {
    setToast((prev) => ({ ...prev, isVisible: false }));
  }, []);

  // Helper functions for different toast types
  const showSuccess = useCallback((message) => showToast(message, "success"), [showToast]);
  const showError = useCallback((message) => showToast(message, "error"), [showToast]);
  const showWarning = useCallback((message) => showToast(message, "warning"), [showToast]);
  const showInfo = useCallback((message) => showToast(message, "info"), [showToast]);

  return (
    <ToastContext.Provider
      value={{
        showToast,
        showSuccess,
        showError,
        showWarning,
        showInfo,
        hideToast,
      }}
    >
      {children}
      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={hideToast}
      />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

