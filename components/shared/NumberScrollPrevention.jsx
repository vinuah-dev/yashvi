"use client";

import { usePreventNumberScroll } from "@/lib/hooks/usePreventNumberScroll";

/**
 * Component that prevents scroll from changing number input values
 * Add this component to your layout to apply globally
 */
export default function NumberScrollPrevention() {
  usePreventNumberScroll();
  return null;
}
