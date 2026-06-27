"use client";

import { useEffect } from "react";

/**
 * Hook to prevent mouse wheel scroll from changing number input values
 * This prevents the common issue where scrolling over a focused number input
 * accidentally increments/decrements the value
 */
export function usePreventNumberScroll() {
  useEffect(() => {
    const handleWheelOnNumberInput = (e) => {
      // Check if the event target or active element is a number input
      if (
        (e.target && e.target.type === "number") ||
        (document.activeElement && document.activeElement.type === "number")
      ) {
        e.preventDefault();
        e.stopPropagation();
        // Blur the input to completely prevent any value change
        if (e.target && e.target.type === "number") {
          e.target.blur();
        }
        if (document.activeElement && document.activeElement.type === "number") {
          document.activeElement.blur();
        }
      }
    };

    // Add global wheel event listener with capture phase and non-passive
    document.addEventListener("wheel", handleWheelOnNumberInput, { 
      passive: false, 
      capture: true 
    });

    return () => {
      document.removeEventListener("wheel", handleWheelOnNumberInput, { 
        capture: true 
      });
    };
  }, []);
}

/**
 * Utility function to add to individual number inputs
 * Usage: <input type="number" onWheel={preventScrollChange} />
 */
export const preventScrollChange = (e) => {
  e.preventDefault();
  e.stopPropagation();
  e.currentTarget.blur();
};
