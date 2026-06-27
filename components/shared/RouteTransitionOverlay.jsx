"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import RouteLoadingScreen from "@/components/shared/RouteLoadingScreen";

function isModifiedClick(event) {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0;
}

function getLoadingVariant(pathname) {
  if (pathname.includes("/members")) return "members";
  if (pathname.includes("/settings/trainers")) return "trainers";
  if (pathname.includes("/settings/amenities")) return "amenities";
  if (pathname.includes("/settings/notifications")) return "notifications";
  if (pathname.includes("/finance")) return "finance";
  if (pathname.includes("/knowledge")) return "knowledge";
  if (pathname.includes("/shop")) return "shop";
  return "default";
}

export default function RouteTransitionOverlay() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isNavigating, setIsNavigating] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);
  const [loadingVariant, setLoadingVariant] = useState("default");
  const overlayDelayRef = useRef(null);

  useEffect(() => {
    if (overlayDelayRef.current) {
      window.clearTimeout(overlayDelayRef.current);
      overlayDelayRef.current = null;
    }
    setIsNavigating(false);
    setShowOverlay(false);

    return undefined;
  }, [pathname, searchParams]);

  useEffect(() => {
    const beginNavigation = (url) => {
      const nextUrl = new URL(url, window.location.href);
      if (nextUrl.origin !== window.location.origin) return;

      const currentPath = `${window.location.pathname}${window.location.search}`;
      const nextPath = `${nextUrl.pathname}${nextUrl.search}`;
      if (currentPath === nextPath) return;

      setLoadingVariant(getLoadingVariant(nextUrl.pathname));
      setIsNavigating(true);
      setShowOverlay(false);

      if (overlayDelayRef.current) {
        window.clearTimeout(overlayDelayRef.current);
      }

      // Fast Next.js transitions should feel instant. Only cover the page
      // when navigation is genuinely taking long enough to need feedback.
      overlayDelayRef.current = window.setTimeout(() => {
        setShowOverlay(true);
      }, 450);
    };

    const handleClick = (event) => {
      if (isModifiedClick(event)) return;

      const link = event.target?.closest?.("a[href]");
      if (!link) return;

      const target = link.getAttribute("target");
      const href = link.getAttribute("href");
      if (!href || target === "_blank" || href.startsWith("#")) return;

      beginNavigation(href);
    };

    const handlePopState = () => {
      setLoadingVariant(getLoadingVariant(window.location.pathname));
      setIsNavigating(true);
      setShowOverlay(false);
      overlayDelayRef.current = window.setTimeout(() => {
        setShowOverlay(true);
      }, 450);
    };

    const handlePageShow = () => {
      setIsNavigating(false);
      setShowOverlay(false);
    };

    document.addEventListener("click", handleClick, true);
    window.addEventListener("popstate", handlePopState);
    window.addEventListener("pageshow", handlePageShow);

    return () => {
      if (overlayDelayRef.current) {
        window.clearTimeout(overlayDelayRef.current);
      }
      document.removeEventListener("click", handleClick, true);
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, []);

  useEffect(() => {
    if (!isNavigating) return undefined;

    const timeout = window.setTimeout(() => {
      setIsNavigating(false);
      setShowOverlay(false);
    }, 6000);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [isNavigating]);

  if (!isNavigating || !showOverlay) return null;

  return (
    <div className="fixed inset-0 z-[9999]">
      <RouteLoadingScreen variant={loadingVariant} />
    </div>
  );
}
