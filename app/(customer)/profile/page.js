"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/layout/Header";
import { supabase } from "@/lib/supabaseClient";
import { clearSession } from "@/lib/sessionStorage";
import { ProfilePageSkeleton } from "@/components/shared/CustomerSkeleton";
import { Edit2, Camera, Calendar, AlertTriangle, DollarSign, Gift, Copy, Check } from "lucide-react";

export default function CustomerProfilePage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("membership");
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [membership, setMembership] = useState(null);
  const [payments, setPayments] = useState([]);
  const [gymInfo, setGymInfo] = useState(null);
  const [pendingPaymentInfo, setPendingPaymentInfo] = useState(null);
  const [copiedReferral, setCopiedReferral] = useState(false);

  // A member's referral code is their own member id — sharing it lets a new
  // member enter it so this member gets referral points.
  const referralCode = profile?.id ? String(profile.id) : "";

  const handleCopyReferral = async () => {
    if (!referralCode) return;
    try {
      await navigator.clipboard.writeText(referralCode);
      setCopiedReferral(true);
      setTimeout(() => setCopiedReferral(false), 2000);
    } catch {
      // Clipboard can fail on some mobile browsers; fall back to a select-all prompt.
      window.prompt("Copy your referral code:", referralCode);
    }
  };

  useEffect(() => {
    fetchProfileData();
  }, []);

  const fetchProfileData = async () => {
    try {
      setLoading(true);
      
      // Get logged-in member from localStorage
      const storedMember = localStorage.getItem("member");
      if (!storedMember) {
        router.push("/auth/login");
        return;
      }

      const member = JSON.parse(storedMember);
      setProfile({
        id: member.id,
        name: member.full_name || member.name || "Member",
        email: member.email || "",
        phone: member.phone || "",
        profileImage: member.profile_image || member.profileImage || null,
        joinDate: member.join_date || member.created_at || new Date().toISOString(),
      });

      // Fetch member details
      const { data: memberData, error: memberError } = await supabase
        .from("members")
        .select(`
          id,
          full_name,
          phone,
          email,
          profile_image,
          gym_id,
          join_date,
          created_at,
          memberships (
            id,
            plan_id,
            start_date,
            end_date,
            status,
            membership_plans (
              name,
              duration_days,
              price
            )
          )
        `)
        .eq("id", member.id)
        .single();

      if (memberError) throw memberError;

      setProfile({
        id: memberData.id,
        name: memberData.full_name,
        email: memberData.email || "",
        phone: memberData.phone,
        profileImage: memberData.profile_image,
        joinDate: memberData.join_date || memberData.created_at,
      });

      // Get active membership
      const activeMembership = memberData.memberships?.find(m => m.status === 'active') || memberData.memberships?.[0];
      if (activeMembership) {
        const endDate = new Date(activeMembership.end_date);
        const startDate = new Date(activeMembership.start_date);
        const today = new Date();
        const daysLeft = Math.max(0, Math.ceil((endDate - today) / (1000 * 60 * 60 * 24)));
        const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));

        setMembership({
          plan: activeMembership.membership_plans?.name || "No Plan",
          status: activeMembership.status,
          startDate: activeMembership.start_date,
          endDate: activeMembership.end_date,
          daysLeft: daysLeft,
          totalDays: totalDays,
        });
      } else {
        setMembership({
          plan: "No Plan",
          status: "expired",
          startDate: null,
          endDate: null,
          daysLeft: 0,
          totalDays: 0,
        });
      }

      // Fetch payments
      const { data: paymentsData, error: paymentsError } = await supabase
        .from("payments")
        .select("*")
        .eq("member_id", member.id)
        .order("created_at", { ascending: false })
        .limit(20);

      if (!paymentsError && paymentsData) {
        setPayments(paymentsData.map(p => ({
          id: p.id,
          date: p.created_at.split('T')[0],
          amount: parseFloat(p.amount),
          type: p.membership_id ? "Membership" : "Trainer",
          status: p.status,
        })));
      }

      // Fetch pending payment with next payment date
      const { data: pendingData } = await supabase
        .from("payments")
        .select("next_payment_date, remaining_amount")
        .eq("member_id", member.id)
        .not("next_payment_date", "is", null)
        .gt("remaining_amount", 0)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (pendingData) {
        setPendingPaymentInfo({
          nextPaymentDate: pendingData.next_payment_date,
          remainingAmount: pendingData.remaining_amount,
        });
      }

      // Also check member balance
      const { data: balanceData } = await supabase
        .from("members")
        .select("balance")
        .eq("id", member.id)
        .single();

      if (balanceData && balanceData.balance > 0 && !pendingData) {
        setPendingPaymentInfo({
          remainingAmount: balanceData.balance,
          nextPaymentDate: null,
        });
      }

      // Fetch gym info
      if (memberData.gym_id) {
        const { data: gymData, error: gymError } = await supabase
          .from("gyms")
          .select(`
            id, name, address, phone, email, website,
            weekday_morning_start, weekday_morning_end,
            weekday_evening_start, weekday_evening_end,
            weekend_morning_start, weekend_morning_end,
            weekend_evening_start, weekend_evening_end,
            sunday_off
          `)
          .eq("id", memberData.gym_id)
          .single();

        if (!gymError && gymData) {
          const formatTime = (time) => {
            if (!time) return "";
            const [hours, minutes] = time.split(':');
            const hour = parseInt(hours);
            const ampm = hour >= 12 ? 'PM' : 'AM';
            const displayHour = hour % 12 || 12;
            return `${displayHour}:${minutes} ${ampm}`;
          };

          setGymInfo({
            name: gymData.name,
            address: gymData.address || "",
            phone: gymData.phone || "",
            email: gymData.email || "",
            website: gymData.website || "",
            weekdayMorning: gymData.weekday_morning_start && gymData.weekday_morning_end
              ? `${formatTime(gymData.weekday_morning_start)} - ${formatTime(gymData.weekday_morning_end)}`
              : null,
            weekdayEvening: gymData.weekday_evening_start && gymData.weekday_evening_end
              ? `${formatTime(gymData.weekday_evening_start)} - ${formatTime(gymData.weekday_evening_end)}`
              : null,
            weekendMorning: gymData.weekend_morning_start && gymData.weekend_morning_end
              ? `${formatTime(gymData.weekend_morning_start)} - ${formatTime(gymData.weekend_morning_end)}`
              : null,
            weekendEvening: gymData.weekend_evening_start && gymData.weekend_evening_end
              ? `${formatTime(gymData.weekend_evening_start)} - ${formatTime(gymData.weekend_evening_end)}`
              : null,
            sundayOff: gymData.sunday_off || false,
          });
        }
      }

    } catch (error) {
      console.error("Error fetching profile data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <ProfilePageSkeleton />;
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-[#1a1c1c] text-white pb-24">
        <Header title="My Profile" showBack={false} />
        <div className="px-4 py-4 text-center">
          <p className="text-zinc-400">Failed to load profile data</p>
        </div>
      </div>
    );
  }

  const membershipProgress = membership && membership.totalDays > 0
    ? ((membership.totalDays - membership.daysLeft) / membership.totalDays) * 100
    : 0;

  return (
    <div className="min-h-screen bg-[#1a1c1c] text-white pb-24 animate-fadeIn font-sans selection:bg-[#f0813d] selection:text-black">
      <Header title="My Profile" showBack={false} />

      <main className="px-4 py-4 space-y-4">
        <div className="relative overflow-hidden rounded-3xl min-h-[190px] p-5 border border-white/10 shadow-[0_20px_45px_rgba(0,0,0,0.16)]">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage:
                "url('https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=900&q=80')",
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-br from-black/80 via-black/45 to-[#9c4400]/50" />
          <div className="relative z-10 flex h-full min-h-[150px] flex-col justify-between">
            <div className="inline-flex w-fit items-center rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-white">
              Member Studio
            </div>
            <div>
              <h2 className="max-w-[240px] text-3xl font-black leading-none tracking-tight text-white">
                {profile.name}
              </h2>
              <p className="mt-2 max-w-[260px] text-sm font-medium leading-relaxed text-white/75">
                Track your plan, dues, gym details and progress in one place.
              </p>
            </div>
          </div>
        </div>

        {/* Profile Card */}
        <div className="rounded-3xl border border-white/6 bg-[#2d2926] p-6 shadow-lg">
          <div className="flex items-center gap-4">
            {/* Clickable Profile Image */}
            <div 
              className="relative cursor-pointer group"
              onClick={() => router.push("/profile/edit")}
            >
              {profile.profileImage ? (
                <img
                  src={profile.profileImage}
                  alt={profile.name}
                  className="w-20 h-20 rounded-full object-cover"
                />
              ) : (
                <div className="w-20 h-20 bg-gradient-to-br from-[#f0813d] to-[#9c4400] rounded-full flex items-center justify-center text-white text-2xl font-bold">
                  {profile.name.charAt(0)}
                </div>
              )}
              {/* Camera overlay on hover */}
              <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="w-6 h-6 text-white" />
              </div>
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-white">
                {profile.name}
              </h2>
              <p className="text-zinc-400">{profile.phone}</p>
              {profile.email && (
                <p className="text-zinc-500 text-sm">{profile.email}</p>
              )}
            </div>
            {/* Edit Button */}
            <button
              onClick={() => router.push("/profile/edit")}
              className="p-2.5 bg-zinc-950/50 hover:bg-zinc-900 rounded-full transition-colors border border-white/8"
            >
              <Edit2 className="w-5 h-5 text-[#f0813d]" />
            </button>
          </div>

          {/* Member Since */}
          <div className="mt-4 pt-4 border-t border-white/8 flex justify-between text-sm">
            <span className="text-zinc-500">Member since</span>
            <span className="font-medium text-white">
              {new Date(profile.joinDate).toLocaleDateString("en-US", {
                month: "short",
                year: "numeric",
              })}
            </span>
          </div>
        </div>

        {/* Referral Code — share this so referrals credit you points */}
        {referralCode && (
          <div className="relative overflow-hidden rounded-3xl border border-[#f0813d]/25 bg-gradient-to-br from-[#2a211c] via-[#241e1a] to-[#1c1917] p-5 shadow-[0_18px_45px_rgba(0,0,0,0.36)]">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#f0813d]/15 border border-[#f0813d]/25">
                <Gift className="w-4 h-4 text-[#f0813d]" />
              </div>
              <div>
                <p className="text-sm font-bold text-white leading-tight">Your Referral Code</p>
                <p className="text-[11px] text-zinc-400">Share with friends to earn points</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0 rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                <p className="truncate text-base font-black tracking-wider text-[#f0813d]">{referralCode}</p>
              </div>
              <button
                onClick={handleCopyReferral}
                className="shrink-0 flex items-center gap-1.5 rounded-2xl bg-[#f0813d] px-4 py-3 text-sm font-bold text-white active:scale-95 transition-all"
              >
                {copiedReferral ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copiedReferral ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-2xl border border-white/6 bg-[#2d2926] p-3 text-center shadow-lg">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">
              Plan
            </p>
            <p className="mt-1 truncate text-sm font-black text-white">
              {membership?.plan || "No Plan"}
            </p>
          </div>
          <div className="rounded-2xl border border-white/6 bg-[#2d2926] p-3 text-center shadow-lg">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">
              Days
            </p>
            <p className="mt-1 text-sm font-black text-[#f0813d]">
              {membership?.daysLeft ?? 0}
            </p>
          </div>
          <div className="rounded-2xl border border-white/6 bg-[#2d2926] p-3 text-center shadow-lg">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">
              Status
            </p>
            <p className="mt-1 truncate text-sm font-black capitalize text-white">
              {membership?.status || "expired"}
            </p>
          </div>
        </div>

        {/* Membership Status Card */}
        <div className="relative overflow-hidden bg-gradient-to-br from-zinc-900 via-zinc-800 to-black rounded-3xl p-5 text-white border border-white/10 shadow-[0_18px_45px_rgba(0,0,0,0.36)]">
          <div
            className="absolute inset-0 bg-cover bg-center opacity-20 mix-blend-overlay"
            style={{
              backgroundImage:
                "url('https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=900&q=80')",
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/45 to-transparent" />
          <div className="relative z-10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-zinc-300 text-sm">Current Plan</p>
              <p className="text-xl font-bold">{membership?.plan || "No Plan"}</p>
            </div>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              membership?.status === 'active' ? 'bg-[#f0813d]' : 'bg-[#f0813d]'
            }`}>
              {membership?.status || "expired"}
            </span>
          </div>

          {membership && membership.totalDays > 0 && (
            <>
              {/* Progress Bar */}
              <div className="mb-2">
                <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-white rounded-full"
                    style={{ width: `${membershipProgress}%` }}
                  ></div>
                </div>
              </div>

              <div className="flex justify-between text-sm">
                <span className="text-zinc-300">
                  {membership.daysLeft} days left
                </span>
                {membership.endDate && (
                  <span className="text-zinc-300">
                    Expires: {new Date(membership.endDate).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric"
                    })}
                  </span>
                )}
              </div>
            </>
          )}

          {/* Renew Button */}
       
          </div>
        </div>

        {/* Pending Payment Alert */}
        {pendingPaymentInfo && pendingPaymentInfo.remainingAmount > 0 && (
          <div className="rounded-2xl border border-[#f0813d]/30 bg-[#f0813d]/10 p-4 shadow-lg">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-[#f0813d] to-[#9c4400] rounded-lg flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-white mb-1">
                  Pending Payment
                </h4>
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="w-4 h-4 text-[#f0813d]" />
                  <p className="text-lg font-bold text-[#f0813d]">
                    ₹{pendingPaymentInfo.remainingAmount}
                  </p>
                </div>
                {pendingPaymentInfo.nextPaymentDate && (
                  <div className="flex items-center gap-2 p-2 bg-zinc-950/50 rounded-lg border border-[#f0813d]/20">
                    <Calendar className="w-4 h-4 text-[#f0813d]" />
                    <p className="text-sm text-orange-200">
                      Due on{" "}
                      <span className="font-semibold">
                        {new Date(pendingPaymentInfo.nextPaymentDate).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric"
                        })}
                      </span>
                    </p>
                  </div>
                )}
                <p className="text-xs text-zinc-500 mt-2">
                  Please clear your dues at the gym reception.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2">
          {["membership", "payments", "gym"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 rounded-xl text-sm font-medium capitalize ${activeTab === tab
                  ? "bg-[#f0813d] text-black shadow-[0_0_12px_rgba(240,129,61,0.22)]"
                  : "bg-[#2d2926] text-zinc-400 border border-white/6"
                }`}
            >
              {tab === "gym" ? "Gym Info" : tab}
            </button>
          ))}
        </div>

        {/* Membership Tab */}
        {activeTab === "membership" && (
          <div className="rounded-2xl border border-white/6 bg-[#2d2926] p-4 shadow-lg space-y-4">
            <h3 className="font-semibold text-white">Membership Details</h3>

            {membership ? (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-zinc-500">Plan</p>
                  <p className="font-medium text-white">
                    {membership.plan}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Status</p>
                  <p className={`font-medium capitalize ${
                    membership.status === 'active' ? 'text-[#f0813d]' : 'text-[#f0813d]'
                  }`}>
                    {membership.status}
                  </p>
                </div>
                {membership.startDate && (
                  <div>
                    <p className="text-xs text-zinc-500">Start Date</p>
                    <p className="font-medium text-white">
                      {new Date(membership.startDate).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric"
                      })}
                    </p>
                  </div>
                )}
                {membership.endDate && (
                  <div>
                    <p className="text-xs text-zinc-500">End Date</p>
                    <p className="font-medium text-white">
                      {new Date(membership.endDate).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric"
                      })}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-zinc-500 text-center py-4">No active membership</p>
            )}
          </div>
        )}

        {/* Payments Tab */}
        {activeTab === "payments" && (
          <div className="rounded-2xl border border-white/6 bg-[#2d2926] shadow-lg overflow-hidden">
            <div className="p-4 border-b border-white/8">
              <h3 className="font-semibold text-white">Payment History</h3>
            </div>
            {payments.length === 0 ? (
              <div className="p-8 text-center text-zinc-500">
                <p>No payment history found</p>
              </div>
            ) : (
              <div className="divide-y divide-white/8">
                {payments.map((payment) => (
                  <div
                    key={payment.id}
                    className="p-4 flex items-center justify-between"
                  >
                    <div>
                      <p className="font-medium text-white">
                        ₹{payment.amount.toLocaleString()}
                      </p>
                      <p className="text-sm text-zinc-500">
                        {payment.type} • {new Date(payment.date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric"
                        })}
                      </p>
                    </div>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      payment.status === 'paid' 
                        ? 'bg-[#f0813d]/15 text-[#f0813d]' 
                        : 'bg-[#f0813d]/15 text-[#f0813d]'
                    }`}>
                      {payment.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Gym Info Tab */}
        {activeTab === "gym" && (
          <div className="rounded-2xl border border-white/6 bg-[#2d2926] p-4 shadow-lg space-y-4">
            {gymInfo ? (
              <>
                <h3 className="font-semibold text-white text-lg">{gymInfo.name}</h3>

                <div className="space-y-4">
                  {gymInfo.address && (
                    <div className="flex items-start gap-3">
                      <span className="text-lg">📍</span>
                      <div className="flex-1">
                        <p className="text-xs text-zinc-500 mb-0.5">Address</p>
                        <p className="text-sm text-white">{gymInfo.address}</p>
                      </div>
                    </div>
                  )}
                  
                  {gymInfo.phone && (
                    <div className="flex items-start gap-3">
                      <span className="text-lg">📞</span>
                      <div className="flex-1">
                        <p className="text-xs text-zinc-500 mb-0.5">Phone</p>
                        <a
                          href={`tel:${gymInfo.phone}`}
                          className="text-sm text-[#f0813d] font-medium"
                        >
                          {gymInfo.phone}
                        </a>
                      </div>
                    </div>
                  )}
                  
                  {gymInfo.email && (
                    <div className="flex items-start gap-3">
                      <span className="text-lg">✉️</span>
                      <div className="flex-1">
                        <p className="text-xs text-zinc-500 mb-0.5">Email</p>
                        <p className="text-sm text-white">{gymInfo.email}</p>
                      </div>
                    </div>
                  )}

                  {gymInfo.website && (
                    <div className="flex items-start gap-3">
                      <span className="text-lg">🌐</span>
                      <div className="flex-1">
                        <p className="text-xs text-zinc-500 mb-0.5">Website</p>
                        <a
                          href={gymInfo.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-[#f0813d] font-medium"
                        >
                          {gymInfo.website}
                        </a>
                      </div>
                    </div>
                  )}

                  {/* Operating Hours */}
                  {(gymInfo.weekdayMorning || gymInfo.weekdayEvening || gymInfo.weekendMorning || gymInfo.weekendEvening) && (
                    <div className="flex items-start gap-3">
                      <span className="text-lg">🕐</span>
                      <div className="flex-1">
                        <p className="text-xs text-zinc-500 mb-2">Operating Hours</p>
                        
                        {/* Weekdays */}
                        {(gymInfo.weekdayMorning || gymInfo.weekdayEvening) && (
                          <div className="mb-3">
                            <p className="text-xs font-semibold text-zinc-300 mb-1">Weekdays (Mon - Fri)</p>
                            <div className="space-y-1">
                              {gymInfo.weekdayMorning && (
                                <div className="flex items-center gap-2">
                                  <span className="text-xs bg-[#f0813d]/15 text-[#f0813d] px-2 py-0.5 rounded">Morning</span>
                                  <span className="text-sm text-white font-medium">{gymInfo.weekdayMorning}</span>
                                </div>
                              )}
                              {gymInfo.weekdayEvening && (
                                <div className="flex items-center gap-2">
                                  <span className="text-xs bg-[#f0813d]/15 text-[#f0813d] px-2 py-0.5 rounded">Evening</span>
                                  <span className="text-sm text-white font-medium">{gymInfo.weekdayEvening}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Weekends */}
                        {(gymInfo.weekendMorning || gymInfo.weekendEvening) && (
                          <div>
                            <p className="text-xs font-semibold text-zinc-300 mb-1">
                              Weekends {gymInfo.sundayOff ? "(Saturday Only)" : "(Sat - Sun)"}
                            </p>
                            <div className="space-y-1">
                              {gymInfo.weekendMorning && (
                                <div className="flex items-center gap-2">
                                  <span className="text-xs bg-[#f0813d]/15 text-[#f0813d] px-2 py-0.5 rounded">Morning</span>
                                  <span className="text-sm text-white font-medium">{gymInfo.weekendMorning}</span>
                                </div>
                              )}
                              {gymInfo.weekendEvening && (
                                <div className="flex items-center gap-2">
                                  <span className="text-xs bg-[#f0813d]/15 text-[#f0813d] px-2 py-0.5 rounded">Evening</span>
                                  <span className="text-sm text-white font-medium">{gymInfo.weekendEvening}</span>
                                </div>
                              )}
                            </div>
                            {gymInfo.sundayOff && (
                              <p className="text-xs text-[#f0813d] mt-2 font-medium">⚠️ Closed on Sundays</p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Quick Actions */}
                {gymInfo.phone && (
                  <div className="flex gap-3 pt-4 border-t border-white/8">
                    <button
                      onClick={() => window.open(`tel:${gymInfo.phone}`)}
                      className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 rounded-lg text-sm font-medium text-white transition-colors border border-white/8"
                    >
                      📞 Call
                    </button>
                    <button
                      onClick={() =>
                        window.open(`https://wa.me/91${gymInfo.phone.replace(/\D/g, '')}`)
                      }
                      className="flex-1 py-2.5 bg-[#f0813d]/15 hover:bg-[#f0813d]/25 text-[#f0813d] rounded-lg text-sm font-medium transition-colors border border-[#f0813d]/20"
                    >
                      💬 WhatsApp
                    </button>
                  </div>
                )}
              </>
            ) : (
              <p className="text-zinc-500 text-center py-4">Gym information not available</p>
            )}
          </div>
        )}

        {/* Logout Button */}
        <button
          onClick={async () => {
            // Clear visible auth immediately and finish IndexedDB cleanup
            // without delaying the redirect.
            const cleanup = clearSession();
            localStorage.removeItem("swr-cache");
            localStorage.removeItem("trainer_login_at");
            localStorage.removeItem("notif_state");
            localStorage.removeItem("lastReceiptCleanup");
            router.replace("/auth/login");
            void cleanup;
          }}
          className="w-full py-3 bg-[#f0813d]/15 text-[#f0813d] rounded-xl font-medium border border-[#f0813d]/20 active-scale"
        >
          Logout
        </button>
      </main>
    </div>
  );
}
