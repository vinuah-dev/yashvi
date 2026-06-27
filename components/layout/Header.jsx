"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useNotification } from "@/contexts/NotificationContext";
import { useTheme } from "@/components/shared/ThemeProvider";
import { ArrowLeft, Bell, Moon, Sun } from "lucide-react";

export default function Header({ title, showBack = true, gymLogo = null }) {
  const router = useRouter();
  const { unreadCount, clearUnread, items } = useNotification();
  const { theme, toggleTheme } = useTheme();

  const [open, setOpen] = useState(false);
  const [localLogo, setLocalLogo] = useState(null);

  const toggleOpen = () => {
    setOpen((v) => !v);
    clearUnread();
    console.log('Bell clicked');
  };

  useEffect(() => {
    if (gymLogo) return;

    const storedGym = localStorage.getItem("selectedGym");
    if (storedGym) {
      try {
        const gym = JSON.parse(storedGym);
        if (gym.logo_url) {
          setLocalLogo(gym.logo_url);
          return;
        }
      } catch (e) {
        console.error("Error parsing selectedGym", e);
      }
    }

    // Member fallback — fetch from Supabase
    const storedMember = localStorage.getItem("member");
    if (storedMember) {
      try {
        const member = JSON.parse(storedMember);
        const fetchMemberLogo = async () => {
          const { supabase } = await import("@/lib/supabaseClient");
          const { data } = await supabase
            .from("members")
            .select("gym_id")
            .eq("id", member.id)
            .single();
          if (data?.gym_id) {
            const { data: gymData } = await supabase
              .from("gyms")
              .select("logo_url")
              .eq("id", data.gym_id)
              .single();
            if (gymData?.logo_url) {
              setLocalLogo(gymData.logo_url);
            }
          }
        };
        fetchMemberLogo();
      } catch (e) {
        console.error("Error fetching member logo", e);
      }
    }
  }, [gymLogo]);

  useEffect(() => {
    if (gymLogo || localLogo) return;

    let cancelled = false;

    const fetchUserGymLogo = async () => {
      try {
        const storedUser = localStorage.getItem("gymUser");
        if (!storedUser) return;

        const user = JSON.parse(storedUser);
        const savedLogo = user?.gym_logo || user?.gymLogo || user?.logo_url;
        if (savedLogo) {
          setLocalLogo(savedLogo);
          return;
        }

        const gymId = user?.gym_id || user?.gymId;
        if (!gymId) return;

        const { supabase } = await import("@/lib/supabaseClient");
        const { data } = await supabase
          .from("gyms")
          .select("logo_url")
          .eq("id", gymId)
          .maybeSingle();

        if (!cancelled && data?.logo_url) {
          setLocalLogo(data.logo_url);
        }
      } catch (e) {
        console.error("Error fetching user gym logo", e);
      }
    };

    fetchUserGymLogo();

    return () => {
      cancelled = true;
    };
  }, [gymLogo, localLogo]);

  const displayLogo = gymLogo || localLogo;

  return (
    <>
    <header className="fixed left-1/2 top-0 z-[100] w-full max-w-md -translate-x-1/2 app-header overflow-visible border-b-[5px] border-black bg-white md:sticky md:left-auto md:max-w-none md:translate-x-0">
      <div className="flex items-center justify-between px-4 py-4 relative">
        <div className="flex items-center gap-3">
          {showBack && (
            <button
              onClick={() => router.back()}
              className="header-action p-2.5 rounded-2xl transition-all active-scale flex items-center justify-center text-lg font-bold shadow-sm"
              style={{ width: '40px', height: '40px' }}
              aria-label="Go back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          {displayLogo && (
            <img
              src={displayLogo}
              alt="Gym Logo"
              className="h-11 w-11 rounded-2xl object-cover border-2 border-black shadow-[4px_4px_0_rgba(0,0,0,1)]"
            />
          )}
          <span className="sr-only">{title}</span>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            className="header-action relative p-2.5 rounded-2xl transition-all active-scale cursor-pointer flex items-center justify-center shadow-sm"
            style={{ width: '40px', height: '40px' }}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            onClick={toggleTheme}
            type="button"
            title={theme === "dark" ? "Light mode" : "Dark mode"}
          >
            {theme === "dark" ? (
              <Sun className="w-5 h-5" />
            ) : (
              <Moon className="w-5 h-5" />
            )}
          </button>

          <button
            className="header-action relative p-2.5 rounded-2xl transition-all active-scale cursor-pointer flex items-center justify-center shadow-sm"
            style={{ width: '40px', height: '40px' }}
            aria-label="Notifications"
            onClick={toggleOpen}
            type="button"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-black text-white text-[10px] font-extrabold rounded-full px-1.5 py-[2px] min-w-[18px] text-center shadow-[0_0_0_2px_#fff]">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
        </div>

        {open && (
          <div className="fixed right-4 top-20 w-[calc(100vw-2rem)] max-w-80 bg-white border border-[#ececec] rounded-3xl shadow-[0_24px_60px_rgba(0,0,0,0.18)] backdrop-blur-2xl z-[1000] overflow-hidden animate-slideUp">
            <div className="px-4 py-3 bg-black/2 border-b border-black/5 font-bold text-sm text-[#1a1c1c] tracking-wide uppercase font-heading flex justify-between items-center">
              <span>Notifications</span>
              {unreadCount > 0 && (
                <span className="text-[10px] bg-[#f0813d]/10 text-[#9c4400] px-2 py-0.5 rounded-full font-extrabold uppercase">New</span>
              )}
            </div>
            <div className="max-h-72 overflow-y-auto no-scrollbar">
              {items && items.length > 0 ? (
                items.map((n) => (
                <div key={n.id} className="px-4 py-3 hover:bg-[#fafafa] border-b border-[#f1f1f1] last:border-0 transition-colors duration-200">
                   
                    {n.body && (<div className="text-xs text-zinc-500 leading-relaxed">{n.body}</div>)}
                    <div className="text-[9px] text-zinc-400 font-medium mt-1.5 tracking-wider uppercase">{new Date(n.receivedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                  </div>
                ))
              ) : (
                <div className="p-6 text-center text-sm text-zinc-400 font-medium">
                  <div className="text-2xl mb-2">📥</div>
                  No notifications yet
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
    <div className="h-[77px] shrink-0 md:hidden" aria-hidden="true" />
    </>
  );
}
