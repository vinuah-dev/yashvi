"use client";

import { memo, useCallback, useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { useAuthContext } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Header from "@/components/layout/Header";
const RenewMembershipModal = dynamic(() => import("@/components/shared/RenewMembershipModal"), { ssr: false });
const ShareReceiptModal = dynamic(() => import("@/components/shared/ShareReceiptModal"), { ssr: false });
import { MembersPageSkeleton } from "@/components/shared/Skeleton";
import RouteLoadingScreen from "@/components/shared/RouteLoadingScreen";
import TrainersView from "@/components/shared/TrainersView";
import { useUserRole } from "@/lib/hooks/useUserRole";
import {
  Users,
  CheckCircle,
  AlertTriangle,
  DollarSign,
  Clock,
  Search,
  Plus,
  Filter,
  User as UserIcon,
  Calendar,
  CreditCard,
  Key,
  Trash2,
  RefreshCw,
  ChevronRight,
  ChevronLeft,
  Building,
  Phone,
  Mail,
  MessageCircle,
  Share2,
  UserCheck,
  Download,
  FileText,
  FileSpreadsheet,
  Dumbbell,
} from "lucide-react";

const PAGE_SIZE = 20;
const MEMBER_FILTERS = new Set(["all", "active", "expired", "renewal", "inactive"]);

function MemberAvatar({ name, profileImage }) {
  const [imageFailed, setImageFailed] = useState(false);

  if (profileImage && !imageFailed) {
    return (
      <img
        src={profileImage}
        alt={name}
        loading="lazy"
        decoding="async"
        className="w-14 h-14 rounded-2xl object-cover shadow-sm"
        onError={() => setImageFailed(true)}
      />
    );
  }

  return (
    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#f0813d] to-[#9c4400] flex items-center justify-center text-white font-bold text-lg shadow-sm">
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

// Transform server response to the shape expected by the UI
const transformMember = (m) => ({
  id: m.id,
  gymId: m.gym_id,
  name: m.full_name || "N/A",
  profileImage: m.profile_image || null,
  phone: m.phone || "N/A",
  email: m.email,
  plan: m.plan_name || "No Plan",
  status: m.computed_status || "inactive",
  validTillRaw: m.valid_till || null,
  validTill: m.valid_till
    ? new Date(m.valid_till).toLocaleDateString("en-IN")
    : "N/A",
  dueAmount: m.due_amount || 0,
  balance: m.balance || 0,
  hasCredentials: m.has_credentials || false,
  daysRemaining: m.days_remaining ?? null,
  createdByTrainerName: m.created_by_trainer_name || null,
  trainerAssignment: m.trainer_assignment
    ? {
        trainerName: m.trainer_assignment.trainer_name,
        planEndDate: m.trainer_assignment.plan_end_date,
        trainerPlanDaysRemaining:
          m.trainer_assignment.trainer_plan_days_remaining ?? null,
      }
    : null,
});

const sortRenewalMembers = (memberList) => {
  const activeMembers = [];
  const expiredMembers = [];

  memberList.forEach((member) => {
    const isExpired =
      member.status === "expired" ||
      member.daysRemaining === null ||
      member.daysRemaining <= 0;

    if (isExpired) {
      expiredMembers.push(member);
    } else {
      activeMembers.push(member);
    }
  });

  expiredMembers.sort((leftMember, rightMember) => {
    const leftTs = leftMember.validTillRaw
      ? new Date(`${leftMember.validTillRaw}T00:00:00`).getTime()
      : Number.POSITIVE_INFINITY;
    const rightTs = rightMember.validTillRaw
      ? new Date(`${rightMember.validTillRaw}T00:00:00`).getTime()
      : Number.POSITIVE_INFINITY;

    if (leftTs !== rightTs) {
      return leftTs - rightTs;
    }

    return leftMember.name.localeCompare(rightMember.name);
  });

  return [...activeMembers, ...expiredMembers];
};

const getStatusConfig = (status) => {
  switch (status) {
    case "active":
      return {
        color: "bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200",
        text: "text-[#f0813d]",
        label: "Active",
        icon: <CheckCircle className="w-3.5 h-3.5" />,
      };
    case "expired":
      return {
        color: "bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200",
        text: "text-[#f0813d]",
        label: "Expired",
        icon: <Clock className="w-3.5 h-3.5" />,
      };
    case "inactive":
    default:
      return {
        color: "bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200",
        text: "text-gray-700",
        label: "Inactive",
        icon: <AlertTriangle className="w-3.5 h-3.5" />,
      };
  }
};

const getDaysRemainingColor = (days) => {
  if (days === null) return "text-gray-500";
  if (days <= 0) return "text-[#f0813d] font-semibold";
  if (days <= 7) return "text-[#f0813d] font-semibold";
  return "text-gray-600";
};

const MemberCard = memo(function MemberCard({
  member,
  canViewFinance,
  isTrainer,
  isViewOnly,
  onOpen,
  onCredentials,
  onShareReceipt,
  onRenewalReminder,
  onRenew,
  onDelete,
}) {
  const statusConfig = getStatusConfig(member.status);
  const canShowRenewReminder =
    member.status === "expired" ||
    member.status === "renewal" ||
    (member.daysRemaining !== null && member.daysRemaining <= 7);

  return (
    <div
      onClick={() => onOpen(member.id)}
      className="relative overflow-hidden bg-white rounded-[28px] p-5 border border-[#ececec] shadow-[0_10px_35px_rgba(0,0,0,0.06)] hover:shadow-[0_18px_45px_rgba(0,0,0,0.10)] active:scale-[0.99] transition-all duration-300 cursor-pointer mx-1"
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#f0813d]/10 to-transparent rounded-full blur-3xl pointer-events-none" />

      <div className="flex items-start gap-4 relative z-10">
        <div className="flex-shrink-0">
          <div className="w-14 h-14 rounded-2xl overflow-hidden shadow-[0_10px_25px_rgba(55,104,248,0.18)] border-2 border-white">
            <MemberAvatar name={member.name} profileImage={member.profileImage} />
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex-1 min-w-0">
              <h3 className="font-black text-[#1a1c1c] text-[18px] tracking-tight leading-tight break-words">
                {member.name}
              </h3>

              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#f0813d] mt-2">
                Premium Gym Member
              </p>

              <div className="flex flex-col gap-1 mt-2">
                <div className="flex items-center gap-1">
                  <Phone className="w-3 h-3 text-[#897267]" />
                  <span className="text-[#5f5e5e] text-xs break-all">
                    {member.phone}
                  </span>
                </div>

                {member.email && (
                  <div className="flex items-center gap-1">
                    <Mail className="w-3 h-3 text-[#897267]" />
                    <span className="text-[#5f5e5e] text-xs break-all">
                      {member.email}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col items-end gap-2">
              <div className={`px-3 py-1.5 rounded-full border ${statusConfig.color} ${statusConfig.text} flex items-center gap-1.5 shadow-sm`}>
                <div className={statusConfig.text}>{statusConfig.icon}</div>
                <span className="text-[11px] font-black uppercase tracking-wide">
                  {statusConfig.label}
                </span>
              </div>

              <ChevronRight className="w-4 h-4 text-[#897267]" />
            </div>
          </div>

          {member.daysRemaining !== null && (
            <div className="flex items-center gap-2 mt-2">
              <Calendar className="w-4 h-4 text-[#897267]" />
              <span className={`text-xs ${getDaysRemainingColor(member.daysRemaining)}`}>
                {member.daysRemaining > 0
                  ? `${member.daysRemaining} days remaining`
                  : "Membership expired"}
              </span>
            </div>
          )}

          <div className="mt-4 space-y-3 pt-4 border-t border-[#f1f1f1]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-[#f0813d]/10 rounded-2xl flex items-center justify-center">
                  <UserIcon className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-xs text-[#897267]">Plan</p>
                  <p className="text-sm font-bold text-[#1a1c1c]">
                    {member.plan}
                  </p>
                </div>
              </div>

              <div className="text-right">
                <p className="text-xs text-[#897267]">Valid Till</p>
                <p className="text-sm font-bold text-[#1a1c1c]">
                  {member.validTill}
                </p>
              </div>
            </div>

            {member.dueAmount > 0 && (
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-[#f0813d]/10 rounded-2xl flex items-center justify-center">
                  <CreditCard className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-[#897267]">Pending Payment</p>
                  <p className="text-sm font-black text-[#f0813d]">
                    {canViewFinance ? `₹${member.dueAmount}` : "*****"}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="flex space-x-2 overflow-x-auto mt-4 pt-4 border-t border-[#f1f1f1] pb-1 -mx-1 px-1 no-scrollbar">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCredentials(member.id);
              }}
              className="flex-shrink-0 px-3 py-2 bg-[#f0813d]/10 text-[#f0813d] text-xs font-bold rounded-xl active-scale"
            >
              <Key className="w-3.5 h-3.5 inline mr-1" />
              Login
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                onShareReceipt(member);
              }}
              className="flex-shrink-0 px-3 py-2 bg-orange-50 text-[#f0813d] text-xs font-bold rounded-xl active-scale"
            >
              <Share2 className="w-3.5 h-3.5 inline mr-1" />
              Receipt
            </button>

            {canShowRenewReminder && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRenewalReminder(member);
                }}
                className="flex-shrink-0 px-3 py-2 bg-[#f0813d]/10 text-[#f0813d] text-xs font-bold rounded-xl active-scale"
              >
                <MessageCircle className="w-3.5 h-3.5 inline mr-1" />
                Remind
              </button>
            )}

            {(member.status === "expired" || member.status === "renewal") && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRenew(member);
                }}
                className="flex-shrink-0 px-3 py-2 bg-[#1a1c1c] text-white text-xs font-bold rounded-xl active-scale"
              >
                <RefreshCw className="w-3.5 h-3.5 inline mr-1" />
                Renew
              </button>
            )}

            {!isTrainer && !isViewOnly && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(member);
                }}
                className="flex-shrink-0 px-3 py-2 bg-orange-50 text-[#f0813d] text-xs font-bold rounded-xl active-scale"
              >
                <Trash2 className="w-3.5 h-3.5 inline mr-1" />
                Delete
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

// Members and trainers are both "people at the gym", so they share one screen.
// Trainers still live at /settings/trainers for anyone landing there directly.
function ViewSwitch({ value, onChange }) {
  const tabs = [
    { id: "members", label: "Members", Icon: Users },
    { id: "trainers", label: "Trainers", Icon: Dumbbell },
  ];

  return (
    <div className="flex gap-1 rounded-[20px] bg-white border border-[#ececec] p-1 shadow-[0_10px_30px_rgba(0,0,0,0.05)]">
      {tabs.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          aria-pressed={value === id}
          className={`flex-1 flex items-center justify-center gap-2 rounded-2xl py-2.5 text-sm font-bold transition-all active:scale-95 ${
            value === id
              ? "bg-gradient-to-r from-[#f0813d] to-[#9c4400] text-white"
              : "text-gray-600"
          }`}
          style={{ minHeight: "44px" }}
        >
          <Icon className="w-4 h-4" />
          {label}
        </button>
      ))}
    </div>
  );
}

export default function MembersPage() {
  const router = useRouter();
  const { canViewFinance, isTrainer, isViewOnly, user, isReady, selectedGym: authGym } = useAuthContext();
  const roleLoading = !isReady;

  // Members and trainers share this screen; the switch at the top picks which
  // list is shown, so staff don't have to go through Settings for trainers.
  const [view, setView] = useState("members");

  // Search & filter
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [expiredStartDate, setExpiredStartDate] = useState("");
  const [expiredEndDate, setExpiredEndDate] = useState("");
  const [showMyMembers, setShowMyMembers] = useState(false);
  const searchTimerRef = useRef(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Data
  const selectedGym = authGym;
  const [members, setMembers] = useState([]);
  const [stats, setStats] = useState({ total: 0, active: 0, expired: 0, dues: 0, renewal: 0 });
  const [myMembersCount, setMyMembersCount] = useState(0);

  // UI states
  const [loading, setLoading] = useState(true);
  const [membersLoading, setMembersLoading] = useState(false);
  const [showRenewModal, setShowRenewModal] = useState(false);
  const [showShareReceiptModal, setShowShareReceiptModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [exportingType, setExportingType] = useState(null);

  // Refresh trigger for manual refreshes (delete, renew, etc.)
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    const filterParam = new URLSearchParams(window.location.search).get("filter");
    if (filterParam && MEMBER_FILTERS.has(filterParam)) {
      setFilterStatus(filterParam);
      if (filterParam !== "expired") {
        setExpiredStartDate("");
        setExpiredEndDate("");
      }
      setCurrentPage(1);
    }
  }, []);

  // gym now comes from AuthContext

  // ─── Debounce search input (300ms) ──────────────────────────
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1);
    }, 300);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [searchQuery]);

  // ─── Fetch stats (independent of pagination) ────────────────
  useEffect(() => {
    if (!selectedGym?.id || roleLoading) return;
    const fetchStats = async () => {
      try {
        const res = await fetch("/api/members/stats", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-user-id": String(user?.id || ""),
          },
          body: JSON.stringify({
            p_gym_id: selectedGym.id,
            p_user_id: user?.id || null,
            p_is_trainer: isTrainer || false,
          }),
        });
        const json = await res.json();
        if (res.ok && json.data) {
          setStats({
            total: json.data.total || 0,
            active: json.data.active || 0,
            expired: json.data.expired || 0,
            dues: json.data.dues || 0,
            renewal: json.data.renewal || 0,
          });
          if (isTrainer) setMyMembersCount(json.data.my_members || 0);
        }
      } catch (err) {
        console.error("Error fetching stats:", err);
      }
    };
    fetchStats();
  }, [selectedGym?.id, user?.id, isTrainer, roleLoading, refreshTrigger]);

  // ─── Fetch paginated members ─────────────────────────────────
  useEffect(() => {
    if (!selectedGym?.id || roleLoading) return;
    let cancelled = false;

    const fetchMembersList = async () => {
      setMembersLoading(true);
      try {
        const hasExpiredRangeFilter =
          filterStatus === "expired" && (expiredStartDate || expiredEndDate);
        const isPendingFilter = filterStatus === "pending";
        const requestPage = (hasExpiredRangeFilter || isPendingFilter) ? 1 : currentPage;
        const requestPageSize = (hasExpiredRangeFilter || isPendingFilter) ? 5000 : PAGE_SIZE;
        // The RPC has no "pending" status, so fetch everyone and filter by due amount client-side.
        const requestStatus = isPendingFilter ? "all" : filterStatus;

        let result;
        try {
          const res = await fetch("/api/members/list", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              p_gym_id: selectedGym.id,
              p_search: debouncedSearch,
              p_status: requestStatus,
              p_page: requestPage,
              p_page_size: requestPageSize,
              p_user_id: user?.id || null,
              p_is_trainer: isTrainer || false,
              p_show_my_members: showMyMembers,
            }),
          });
          const json = await res.json();
          if (!res.ok) throw new Error(json.error);
          result = json.data;
        } catch (apiErr) {
          console.warn("API proxy failed, falling back to direct Supabase:", apiErr);
          const { data, error } = await supabase.rpc("get_members_paginated", {
            p_gym_id: selectedGym.id,
            p_search: debouncedSearch,
            p_status: requestStatus,
            p_page: requestPage,
            p_page_size: requestPageSize,
            p_user_id: user?.id || null,
            p_is_trainer: isTrainer || false,
            p_show_my_members: showMyMembers,
          });
          if (error) throw error;
          result = data;
        }

        if (cancelled) return;

        if (result) {
          const transformedMembers = (result.members || []).map(transformMember);

          if (isPendingFilter) {
            // Members with an outstanding balance (partial / pending payment).
            const pendingMembers = transformedMembers.filter(
              (member) => Number(member.dueAmount || 0) > 0
            );

            const filteredTotal = pendingMembers.length;
            const calculatedPages = Math.max(1, Math.ceil(filteredTotal / PAGE_SIZE));

            if (currentPage > calculatedPages) {
              setCurrentPage(calculatedPages);
              return;
            }

            const startIndex = (currentPage - 1) * PAGE_SIZE;
            const endIndex = startIndex + PAGE_SIZE;
            setMembers(pendingMembers.slice(startIndex, endIndex));
            setTotalCount(filteredTotal);
            setTotalPages(calculatedPages);
          } else if (hasExpiredRangeFilter) {
            const fromTs = expiredStartDate
              ? new Date(`${expiredStartDate}T00:00:00`).getTime()
              : null;
            const toTs = expiredEndDate
              ? new Date(`${expiredEndDate}T23:59:59.999`).getTime()
              : null;

            const rangeFiltered = transformedMembers.filter((member) => {
              if (!member.validTillRaw) return false;
              const memberTs = new Date(`${member.validTillRaw}T00:00:00`).getTime();
              if (Number.isNaN(memberTs)) return false;
              if (fromTs && memberTs < fromTs) return false;
              if (toTs && memberTs > toTs) return false;
              return true;
            });

            const sortedFiltered =
              filterStatus === "renewal"
                ? sortRenewalMembers(rangeFiltered)
                : rangeFiltered;

            const filteredTotal = sortedFiltered.length;
            const calculatedPages = Math.max(1, Math.ceil(filteredTotal / PAGE_SIZE));

            if (currentPage > calculatedPages) {
              setCurrentPage(calculatedPages);
              return;
            }

            const startIndex = (currentPage - 1) * PAGE_SIZE;
            const endIndex = startIndex + PAGE_SIZE;
            setMembers(sortedFiltered.slice(startIndex, endIndex));
            setTotalCount(filteredTotal);
            setTotalPages(calculatedPages);
          } else {
            // If current page is beyond total pages (e.g. after deletion), reset
            if (result.members?.length === 0 && result.total_count > 0 && currentPage > 1) {
              setCurrentPage(Math.max(1, result.total_pages || 1));
              return;
            }

            setMembers(
              filterStatus === "renewal"
                ? sortRenewalMembers(transformedMembers)
                : transformedMembers
            );
            setTotalCount(result.total_count || 0);
            setTotalPages(Math.max(1, result.total_pages || 1));
          }
        } else {
          setMembers([]);
          setTotalCount(0);
          setTotalPages(1);
        }
      } catch (err) {
        if (cancelled) return;
        console.error("Error fetching members:", err);
        setMembers([]);
        setTotalCount(0);
        setTotalPages(1);
      }
      if (!cancelled) {
        setMembersLoading(false);
        setLoading(false);
      }
    };

    fetchMembersList();
    return () => {
      cancelled = true;
    };
  }, [
    selectedGym?.id,
    debouncedSearch,
    filterStatus,
    currentPage,
    showMyMembers,
    expiredStartDate,
    expiredEndDate,
    user?.id,
    isTrainer,
    roleLoading,
    refreshTrigger,
  ]);

  useEffect(() => {
    if (filterStatus !== "expired") return;
    setCurrentPage(1);
  }, [expiredStartDate, expiredEndDate, filterStatus]);

  // ─── Refresh handler for mutations (delete, renew) ───────────
  const refreshData = useCallback(() => setRefreshTrigger((t) => t + 1), []);

  // ─── Export Members PDF (fetches its own data directly) ──────
  const exportMembersPDF = async () => {
    try {
      const jsPDF = (await import("jspdf")).default;
      const autoTable = (await import("jspdf-autotable")).default;

      if (!selectedGym) {
        alert("No gym selected!");
        return;
      }

      const gym = selectedGym;

      const { data: membersData, error: membersError } = await supabase
        .from("members")
        .select(`
          id,
          full_name,
          phone,
          join_date,
          created_at,
          balance,
          memberships (
            id,
            status,
            start_date,
            end_date,
            membership_plans (
              name,
              price
            )
          )
        `)
        .eq("gym_id", gym.id);

      if (membersError) throw membersError;

      if (!membersData || membersData.length === 0) {
        alert("No members found to export!");
        return;
      }

      const { data: payments, error: paymentsError } = await supabase
        .from("payments")
        .select("member_id, amount, status")
        .eq("gym_id", gym.id);

      if (paymentsError) throw paymentsError;

      const memberRows = (membersData || []).map((member) => {
        const memberPayments =
          payments?.filter(
            (p) => p.member_id === member.id && p.status === "paid"
          ) || [];
        const totalPaid = Math.round(
          memberPayments.reduce((sum, p) => sum + (p.amount || 0), 0)
        );
        const dueAmount = Math.round(member.balance || 0);
        const allMemberships = member.memberships || [];
        const activeMembership = allMemberships.find((m) => m.status === "active");
        const planName = activeMembership?.membership_plans?.name || "No Plan";
        const totalPlans = allMemberships.length;

        let totalMembershipDays = 0;
        allMemberships.forEach((membership) => {
          if (membership.start_date && membership.end_date) {
            const startDate = new Date(membership.start_date);
            const endDate = new Date(membership.end_date);
            const days = Math.ceil(
              (endDate - startDate) / (1000 * 60 * 60 * 24)
            );
            totalMembershipDays += days > 0 ? days : 0;
          }
        });

        const isRegularCustomer =
          (totalPlans >= 2 && totalMembershipDays >= 180) ||
          totalMembershipDays >= 365;
        const displayName = isRegularCustomer
          ? `${member.full_name || "N/A"} (Regular)`
          : member.full_name || "N/A";

        return {
          name: displayName,
          phone: member.phone || "N/A",
          plan: planName,
          joinDate: member.join_date || member.created_at
            ? new Date(
                member.join_date
                  ? member.join_date + "T00:00:00"
                  : member.created_at
              ).toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })
            : "N/A",
          totalPaid,
          dueAmount,
          isRegularCustomer,
        };
      });

      memberRows.sort((a, b) => b.totalPaid - a.totalPaid);

      const doc = new jsPDF("landscape");
      const pageWidth = doc.internal.pageSize.getWidth();

      doc.setFillColor(37, 99, 235);
      doc.rect(0, 0, pageWidth, 40, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.setFont("helvetica", "bold");
      doc.text(gym.name || "Gym", pageWidth / 2, 18, { align: "center" });
      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
      doc.text("Member Payment Report", pageWidth / 2, 28, { align: "center" });
      doc.setFontSize(10);
      doc.text(
        `Generated on: ${new Date().toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "long",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })}`,
        pageWidth / 2,
        36,
        { align: "center" }
      );

      doc.setTextColor(0, 0, 0);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Summary", 14, 52);

      const formatCurrency = (value) =>
        `Rs. ${Math.round(value || 0).toLocaleString("en-IN")}`;
      const totalMembersCount = memberRows.length;
      const grandTotalPaid = Math.round(
        memberRows.reduce((sum, m) => sum + m.totalPaid, 0)
      );
      const grandTotalDue = Math.round(
        memberRows.reduce((sum, m) => sum + m.dueAmount, 0)
      );

      doc.setFillColor(248, 250, 252);
      doc.roundedRect(14, 56, pageWidth - 28, 24, 3, 3, "F");
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 100, 100);
      const summaryY = 66;
      const colWidth = (pageWidth - 28) / 3;
      doc.text("Total Members", 14 + colWidth * 0 + 10, summaryY);
      doc.text("Total Collected", 14 + colWidth * 1 + 10, summaryY);
      doc.text("Total Due", 14 + colWidth * 2 + 10, summaryY);
      doc.setTextColor(0, 0, 0);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text(totalMembersCount.toString(), 14 + colWidth * 0 + 10, summaryY + 8);
      doc.setTextColor(34, 197, 94);
      doc.text(
        formatCurrency(grandTotalPaid),
        14 + colWidth * 1 + 10,
        summaryY + 8
      );
      doc.setTextColor(239, 68, 68);
      doc.text(
        formatCurrency(grandTotalDue),
        14 + colWidth * 2 + 10,
        summaryY + 8
      );

      doc.setTextColor(0, 0, 0);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Member Details (Sorted by Total Paid)", 14, 92);

      const tableData = memberRows.map((member, index) => [
        (index + 1).toString(),
        member.name,
        member.phone,
        member.plan,
        member.joinDate,
        formatCurrency(member.totalPaid),
        formatCurrency(member.dueAmount),
      ]);

      autoTable(doc, {
        startY: 98,
        head: [["#", "Name", "Phone", "Plan", "Join Date", "Total Paid", "Due Amount"]],
        body: tableData,
        theme: "striped",
        styles: { cellPadding: 4 },
        headStyles: {
          fillColor: [37, 99, 235],
          textColor: 255,
          fontSize: 10,
          fontStyle: "bold",
          halign: "center",
        },
        bodyStyles: { fontSize: 9, textColor: [50, 50, 50] },
        columnStyles: {
          0: { halign: "center", cellWidth: 12 },
          1: { halign: "left", cellWidth: 45 },
          2: { halign: "center", cellWidth: 30 },
          3: { halign: "center", cellWidth: 25 },
          4: { halign: "center", cellWidth: 28 },
          5: {
            halign: "right",
            cellWidth: 55,
            textColor: [34, 197, 94],
            fontStyle: "bold",
          },
          6: {
            halign: "right",
            cellWidth: 55,
            textColor: [239, 68, 68],
            fontStyle: "bold",
          },
        },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        margin: { left: 14, right: 14 },
        didDrawPage: function (data) {
          doc.setFontSize(8);
          doc.setTextColor(150, 150, 150);
          doc.text(
            `Page ${data.pageNumber}`,
            pageWidth / 2,
            doc.internal.pageSize.getHeight() - 10,
            { align: "center" }
          );
        },
      });

      const fileName = `${gym.name?.replace(/\s+/g, "_") || "Gym"}_Members_Report_${new Date().toISOString().split("T")[0]}.pdf`;
      doc.save(fileName);
      alert("PDF exported successfully!");
    } catch (error) {
      console.error("Error exporting PDF:", error);
      alert("Failed to export PDF. Please try again.");
    }
  };

  // ─── Export Members Excel (fetches its own data directly) ───
  const exportMembersExcel = async () => {
    try {
      const XLSX = await import("xlsx");

      if (!selectedGym) {
        alert("No gym selected!");
        return;
      }

      const gym = selectedGym;

      const { data: membersData, error: membersError } = await supabase
        .from("members")
        .select(`
          id,
          full_name,
          phone,
          email,
          join_date,
          created_at,
          balance,
          memberships (
            id,
            status,
            start_date,
            end_date,
            membership_plans (
              name,
              price
            )
          )
        `)
        .eq("gym_id", gym.id);

      if (membersError) throw membersError;

      if (!membersData || membersData.length === 0) {
        alert("No members found to export!");
        return;
      }

      const { data: payments, error: paymentsError } = await supabase
        .from("payments")
        .select("member_id, amount, status")
        .eq("gym_id", gym.id);

      if (paymentsError) throw paymentsError;

      const formatDate = (dateValue) => {
        if (!dateValue) return "";
        const parsed = new Date(dateValue);
        if (Number.isNaN(parsed.getTime())) return "";
        return parsed.toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        });
      };

      const getMonthsFromRange = (startDate, endDate) => {
        if (!startDate || !endDate) return "";
        const start = new Date(startDate);
        const end = new Date(endDate);
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "";
        const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
        if (days <= 0) return "";
        return Math.max(1, Math.round(days / 30));
      };

      const normalizePhone = (phone) => {
        if (!phone) return "";
        let cleaned = `${phone}`.replace(/\D/g, "");
        if (cleaned.startsWith("0")) cleaned = cleaned.slice(1);
        if (cleaned.length === 10 && !cleaned.startsWith("91")) {
          cleaned = `91${cleaned}`;
        }
        return cleaned;
      };

      const rows = (membersData || []).map((member, index) => {
        const memberPayments =
          payments?.filter((payment) => payment.member_id === member.id && payment.status === "paid") || [];
        const totalPaid = Math.round(
          memberPayments.reduce((sum, payment) => sum + (payment.amount || 0), 0)
        );

        const dueAmount = Math.max(0, Math.round(member.balance || 0));
        const sortedMemberships = [...(member.memberships || [])].sort((a, b) => {
          const dateA = new Date(a?.end_date || 0).getTime();
          const dateB = new Date(b?.end_date || 0).getTime();
          return dateB - dateA;
        });
        const latestMembership = sortedMemberships[0] || null;
        const admissionType = sortedMemberships.length > 1 ? "Renewal" : "New Admission";
        const memberName = member.full_name || "N/A";
        const firstName = memberName.split(" ")[0] || "Member";
        const message =
          dueAmount > 0
            ? `Hi ${firstName}, your payment of Rs ${dueAmount.toLocaleString("en-IN")} is pending. Please pay on time. - ${gym.name || "Gym"}`
            : `Hi ${firstName}, thank you for your payment. - ${gym.name || "Gym"}`;
        const whatsappPhone = normalizePhone(member.phone);
        const whatsappLink = whatsappPhone
          ? `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(message)}`
          : "";

        return {
          "Sr No": index + 1,
          Name: memberName,
          "Admission Type": admissionType,
          "Mobile No": member.phone || "",
          "Date of Admission": formatDate(member.join_date || member.created_at),
          Months: getMonthsFromRange(
            latestMembership?.start_date || member.join_date,
            latestMembership?.end_date || null
          ),
          "Due Date": formatDate(latestMembership?.end_date),
          "Fees Paid": totalPaid,
          "Fees Remaining": dueAmount,
          Message: message,
          "Whatsapp Link": whatsappLink,
        };
      });

      // Prioritize members with pending dues at the top, then by paid amount.
      rows.sort((leftRow, rightRow) => {
        if (rightRow["Fees Remaining"] !== leftRow["Fees Remaining"]) {
          return rightRow["Fees Remaining"] - leftRow["Fees Remaining"];
        }
        return rightRow["Fees Paid"] - leftRow["Fees Paid"];
      });
      rows.forEach((row, index) => {
        row["Sr No"] = index + 1;
      });

      const summary = [
        ["Gym", gym.name || "Gym"],
        ["Generated On", new Date().toLocaleString("en-IN")],
        ["Total Members", rows.length],
        ["Total Fees Paid", rows.reduce((sum, row) => sum + (row["Fees Paid"] || 0), 0)],
        ["Total Fees Remaining", rows.reduce((sum, row) => sum + (row["Fees Remaining"] || 0), 0)],
        [],
      ];

      const headers = [
        "Sr No",
        "Name",
        "Admission Type",
        "Mobile No",
        "Date of Admission",
        "Months",
        "Due Date",
        "Fees Paid",
        "Fees Remaining",
        "Message",
        "Whatsapp Link",
      ];
      const dataRows = rows.map((row) => headers.map((header) => row[header]));
      const worksheet = XLSX.utils.aoa_to_sheet([...summary, headers, ...dataRows]);

      const dataStartRow = summary.length + 2;
      rows.forEach((row, rowIndex) => {
        const link = row["Whatsapp Link"];
        if (!link) return;
        const cellRef = XLSX.utils.encode_cell({
          r: dataStartRow + rowIndex - 1,
          c: headers.indexOf("Whatsapp Link"),
        });
        if (worksheet[cellRef]) {
          worksheet[cellRef].v = "Open Chat";
          worksheet[cellRef].l = { Target: link, Tooltip: "Open WhatsApp" };
        }
      });

      worksheet["!cols"] = [
        { wch: 8 },
        { wch: 28 },
        { wch: 16 },
        { wch: 14 },
        { wch: 16 },
        { wch: 8 },
        { wch: 14 },
        { wch: 12 },
        { wch: 14 },
        { wch: 70 },
        { wch: 18 },
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Member Analytics");

      const fileName = `${gym.name?.replace(/\s+/g, "_") || "Gym"}_Members_Analytics_${new Date()
        .toISOString()
        .split("T")[0]}.xlsx`;
      XLSX.writeFile(workbook, fileName);

      alert("Excel exported successfully!");
    } catch (error) {
      console.error("Error exporting Excel:", error);
      alert("Failed to export Excel. Please try again.");
    }
  };

  // ─── Helper functions ────────────────────────────────────────
  const handleRenewalReminder = useCallback((member) => {
    const gymName = selectedGym?.name || "Our Gym";
    const validTillText = member.validTill || "your membership expiry date";
    const statusLine =
      member.status === "expired"
        ? " *Status:* Your membership has already expired"
        : member.daysRemaining !== null
        ? ` *Days Remaining:* ${member.daysRemaining} day${member.daysRemaining === 1 ? "" : "s"}`
        : " *Renewal Reminder:* Your membership is due for renewal soon";
    const message = `Dear ${member.name},

Greetings from *${gymName}*! 

This is a friendly reminder that your *${member.plan}* membership is due for renewal.

*Current Plan:* ${member.plan}
 *Valid Till:* ${validTillText}
${statusLine}

To continue enjoying uninterrupted access to our gym facilities, we request you to renew your membership at the earliest.

You can visit the gym reception for quick renewal assistance.

If you have any questions, feel free to contact us.

Thank you for being a valued member! 

Best regards,
*${gymName} Team*`;

    const phone = `${member.phone || ""}`.replace(/\D/g, "");
    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/91${phone}?text=${encodedMessage}`);
  }, [selectedGym?.name]);

  // ─── Event handlers ──────────────────────────────────────────
  const handleFilterChange = useCallback((newStatus) => {
    setFilterStatus(newStatus);
    if (newStatus !== "expired") {
      setExpiredStartDate("");
      setExpiredEndDate("");
    }
    setCurrentPage(1);
  }, []);

  const handleOpenMember = useCallback((memberId) => {
    router.push(`/members/${memberId}`);
  }, [router]);

  const handleOpenCredentials = useCallback((memberId) => {
    router.push(`/members/${memberId}/credentials`);
  }, [router]);

  const handleShareReceipt = useCallback((member) => {
    setSelectedMember(member);
    setShowShareReceiptModal(true);
  }, []);

  const handleRenewClick = useCallback((member) => {
    setSelectedMember(member);
    setShowRenewModal(true);
  }, []);

  const handleRenewal = useCallback(() => {
    setShowRenewModal(false);
    setSelectedMember(null);
    refreshData();
  }, [refreshData]);

  const handleDeleteMember = useCallback(async (member) => {
    if (isTrainer || isViewOnly) {
      return;
    }

    const confirmDelete = window.confirm(
      `Are you sure you want to delete ${member.name}? This action cannot be undone. All associated data including memberships, payments, and attendance records will be permanently deleted.`
    );

    if (!confirmDelete) return;

    try {
      const { error } = await supabase
        .from("members")
        .delete()
        .eq("id", member.id);

      if (error) throw error;

      refreshData();
    } catch (error) {
      console.error("Error deleting member:", error);
      alert("Failed to delete member. Please try again.");
    }
  }, [isTrainer, isViewOnly, refreshData]);

  // The trainer list fetches its own data, so it is rendered before the member
  // loading gate — switching tabs stays instant even while members load.
  if (view === "trainers") {
    return (
      <div className="members-page-theme min-h-screen bg-[#f6f3f1] text-[#1a1c1c] safe-area-inset-bottom">
        <Header title="Trainers" showBack={false} />
        <div className="px-3 md:px-8 lg:px-12 pt-3 md:pt-6 max-w-7xl mx-auto w-full">
          <ViewSwitch value={view} onChange={setView} />
        </div>
        <TrainersView showHeader={false} />
      </div>
    );
  }

  // ─── Loading / no-gym states ─────────────────────────────────
  if (loading) {
    return <RouteLoadingScreen variant="members" />;
  }

  if (!selectedGym) {
    return (
      <div className="members-page-theme min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 safe-area-inset-bottom">
        <Header title="Members" showBack={false} />
        <main className="px-4 py-4">
          <div className="text-center py-12">
            <div className="w-20 h-20 bg-gradient-to-br from-[#f0813d] to-[#f0813d] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <Building className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">
              No Gym Selected
            </h2>
            <p className="text-gray-500 text-sm mb-6 px-4">
              Please select a gym to view and manage members
            </p>
            <button
              onClick={() => router.push("/admin/dashboard")}
              className="px-6 py-3 bg-gradient-to-r from-[#f0813d] to-[#f0813d] text-white rounded-xl font-semibold text-sm active:scale-95 transition-transform"
              style={{ minHeight: "44px" }}
            >
              Go to Dashboard
            </button>
          </div>
        </main>
      </div>
    );
  }

  // ─── Main render ─────────────────────────────────────────────
  const filterTabs = [
    { id: "all", label: "All Members", count: stats.total },
    { id: "active", label: "Active", count: stats.active },
    { id: "expired", label: "Expired", count: stats.expired },
    { id: "pending", label: "Pending", count: stats.dues },
    { id: "renewal", label: "Renewal", count: stats.renewal },
    { id: "inactive", label: "Inactive" },
  ];

  return (

    <div className="members-page-theme min-h-screen bg-[#f6f3f1] text-[#1a1c1c] safe-area-inset-bottom">
      <Header title="Members" showBack={false} />

      <main className="px-3 md:px-8 lg:px-12 py-3 md:py-6 space-y-4 max-w-7xl mx-auto w-full">
        <ViewSwitch value={view} onChange={setView} />

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 px-1">
          <div className="relative overflow-hidden bg-white rounded-[24px] p-4 border border-[#ececec] shadow-[0_10px_30px_rgba(0,0,0,0.05)]">
  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-[#f0813d]/10 to-transparent rounded-full blur-2xl" />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 font-medium">Total</p>
                <p className="text-xl font-bold text-gray-900 mt-0.5">
                  {stats.total}
                </p>
              </div>
              <div className="w-10 h-10 bg-[#f0813d]/10 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>

          <div className="relative overflow-hidden bg-white rounded-[24px] p-4 border border-[#ececec] shadow-[0_10px_30px_rgba(0,0,0,0.05)]">
            
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-[#f0813d]/10 to-transparent rounded-full blur-2xl" /><div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 font-medium">Active</p>
                <p className="text-xl font-bold text-[#f0813d] mt-0.5">
                  {stats.active}
                </p>
              </div>
              <div className="w-10 h-10 bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>

          <div className="relative overflow-hidden bg-white rounded-[24px] p-4 border border-[#ececec] shadow-[0_10px_30px_rgba(0,0,0,0.05)]">
  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-[#f0813d]/10 to-transparent rounded-full blur-2xl" />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 font-medium">Dues</p>
                <p className="text-xl font-bold text-[#f0813d] mt-0.5">
                  {stats.dues}
                </p>
              </div>
              <div className="w-10 h-10 bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>

          <div className="relative overflow-hidden bg-white rounded-[24px] p-4 border border-[#ececec] shadow-[0_10px_30px_rgba(0,0,0,0.05)]">
  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-[#f0813d]/10 to-transparent rounded-full blur-2xl" />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 font-medium">Expired</p>
                <p className="text-xl font-bold text-[#f0813d] mt-0.5">
                  {stats.expired}
                </p>
              </div>
              <div className="w-10 h-10 bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>
        </div>
{/* Members Hero Banner */}
<div className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-[#f0813d] via-[#d96a28] to-[#9c4400] p-6 mx-1 mb-4 shadow-[0_20px_50px_rgba(240,129,61,0.28)]">
  <div className="absolute top-0 right-0 w-52 h-52 bg-white/10 rounded-full blur-3xl" />

  <div className="relative z-10 flex items-center justify-between gap-4">
    <div className="flex-1">
      <p className="text-white/70 text-xs font-bold uppercase tracking-[0.2em] mb-2">
        Gym Members
      </p>

      <h1 className="text-3xl font-black text-white leading-none tracking-tight">
        Stronger
        <br />
        Every Day
      </h1>

      <p className="text-white/80 text-sm mt-3 leading-relaxed max-w-[220px]">
        Manage members, renewals, dues and fitness progress beautifully.
      </p>

      <div className="flex items-center gap-3 mt-5">
        <div className="bg-white/15 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10">
          <p className="text-white text-lg font-black">
            {stats.total}
          </p>
          <p className="text-white/70 text-[10px] uppercase tracking-widest">
            Total
          </p>
        </div>

        <div className="bg-white/15 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10">
          <p className="text-white text-lg font-black">
            {stats.active}
          </p>
          <p className="text-white/70 text-[10px] uppercase tracking-widest">
            Active
          </p>
        </div>
      </div>
    </div>

    <div className="hidden sm:block relative">
      <img
        src="https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?q=80&w=800&auto=format&fit=crop"
        alt="Fitness member"
        className="h-56 w-36 object-cover rounded-3xl shadow-[0_20px_40px_rgba(0,0,0,0.25)]"
      />
    </div>
  </div>
</div>
        {/* Search and Add Member */}
       <div className="premium-card rounded-[28px] p-4 mx-1 space-y-4 border border-[#ececec] shadow-[0_10px_35px_rgba(0,0,0,0.06)]">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-[#5f5e5e]" />
            </div>
            <input
  type="text"
  placeholder="Search members, phone or email..."
  value={searchQuery}
  onChange={(e) => setSearchQuery(e.target.value)}
  className="w-full pl-11 pr-4 py-3 bg-[#f5f5f5] border border-[#ececec] rounded-2xl focus:ring-2 focus:ring-[#f0813d]/20 focus:border-[#f0813d] outline-none transition-all text-sm text-[#1a1c1c] placeholder:text-[#8b8b8b] shadow-inner"
/>
          </div>

<div className="flex gap-2 overflow-x-auto no-scrollbar pt-3">
  {filterTabs.map((tab) => {
    const isActiveFilter = filterStatus === tab.id;

    return (
      <button
        key={tab.id}
        type="button"
        onClick={() => handleFilterChange(tab.id)}
        className={`px-4 py-2 rounded-2xl text-xs whitespace-nowrap transition-all active:scale-95 ${
          isActiveFilter
            ? "bg-[#f0813d] text-white font-black tracking-wide shadow-[0_8px_20px_rgba(240,129,61,0.25)]"
            : "bg-[#f5f5f5] border border-[#ececec] text-[#5f5e5e] font-bold hover:bg-white"
        }`}
      >
        {tab.label}
        {typeof tab.count === "number" && (
          <span
            className={`ml-2 rounded-full px-2 py-0.5 text-[10px] ${
              isActiveFilter ? "bg-white/20 text-white" : "bg-white text-[#897267]"
            }`}
          >
            {tab.count}
          </span>
        )}
      </button>
    );
  })}
</div>

          {/* Compact Action Icons */}
          <div className={`grid gap-2 ${canViewFinance ? "grid-cols-2 md:grid-cols-3" : "grid-cols-1"}`}>
            <button
              onClick={() => router.push("/members/add")}
              title="Add Member"
              className="flex flex-col items-center justify-center gap-1.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 active:bg-gray-100 active:scale-95 transition-all"
              style={{ minHeight: "62px" }}
            >
              <div className="w-8 h-8 rounded-full bg-orange-100 text-[#f0813d] flex items-center justify-center">
                <Plus className="w-4 h-4" />
              </div>
              <span className="text-[11px] font-medium text-gray-700">Add Member</span>
            </button>

            {canViewFinance && (
              <>
                <button
                  onClick={async () => {
                    setExportingType("pdf");
                    try {
                      await exportMembersPDF();
                    } finally {
                      setExportingType(null);
                    }
                  }}
                  disabled={exportingType !== null}
                  title="Export PDF"
                  className="flex flex-col items-center justify-center gap-1.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 active:bg-gray-100 active:scale-95 transition-all disabled:opacity-50"
                  style={{ minHeight: "62px" }}
                >
                  <div className="w-8 h-8 rounded-full bg-orange-100 text-[#f0813d] flex items-center justify-center">
                    {exportingType === "pdf" ? (
                      <div className="w-4 h-4 border-2 border-[#f0813d] border-t-[#f0813d] rounded-full animate-spin"></div>
                    ) : (
                      <FileText className="w-4 h-4" />
                    )}
                  </div>
                  <span className="text-[11px] font-medium text-gray-700">Export PDF</span>
                </button>

                <button
                  onClick={async () => {
                    setExportingType("excel");
                    try {
                      await exportMembersExcel();
                    } finally {
                      setExportingType(null);
                    }
                  }}
                  disabled={exportingType !== null}
                  title="Export Excel"
                  className="flex flex-col items-center justify-center gap-1.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 active:bg-gray-100 active:scale-95 transition-all disabled:opacity-50"
                  style={{ minHeight: "62px" }}
                >
                  <div className="w-8 h-8 rounded-full bg-[#f0813d]/10 text-[#f0813d] flex items-center justify-center">
                    {exportingType === "excel" ? (
                      <div className="w-4 h-4 border-2 border-[#f0813d] border-t-[#f0813d] rounded-full animate-spin"></div>
                    ) : (
                      <FileSpreadsheet className="w-4 h-4" />
                    )}
                  </div>
                  <span className="text-[11px] font-medium text-gray-700">Export Excel</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* My Members Toggle for Trainers */}
        {isTrainer && (
          <div className="bg-white rounded-xl p-3 mx-1">
            <button
              onClick={() => {
                setShowMyMembers(!showMyMembers);
                setCurrentPage(1);
              }}
              className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${
                showMyMembers
                  ? "bg-gradient-to-r from-[#f0813d] to-[#f0813d] text-white shadow-md"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
              style={{ minHeight: "40px" }}
            >
              <UserCheck className="w-4 h-4" />
              {showMyMembers ? "Showing My Members" : "My Members"}
              <span
                className={`px-2 py-0.5 text-xs rounded-full ${
                  showMyMembers ? "bg-white/20" : "bg-white text-gray-600"
                }`}
              >
                {myMembersCount}
              </span>
            </button>
          </div>
        )}

        {/* Filter Tabs */}
   

        {/* Members List */}
        <div
          className={`space-y-3 ${
            membersLoading && members.length > 0
              ? "opacity-60 pointer-events-none"
              : ""
          } transition-opacity duration-200`}
        >
          <div className="flex items-center justify-between px-2 pt-2">
  <div>
    <h2 className="text-xl font-black text-[#1a1c1c] tracking-tight">
      Members Directory
    </h2>

    <p className="text-sm text-[#897267] mt-1">
      Manage and monitor all gym members
    </p>
  </div>

  <div className="bg-white border border-[#ececec] shadow-sm rounded-2xl px-4 py-2">
    <p className="text-[10px] uppercase tracking-[0.18em] text-[#897267] font-bold">
      Showing
    </p>

    <p className="text-lg font-black text-[#f0813d] leading-none mt-1">
      {members.length}
    </p>
  </div>
</div>
            {members.map((member) => (
              <MemberCard
                key={member.id}
                member={member}
                canViewFinance={canViewFinance}
                isTrainer={isTrainer}
                isViewOnly={isViewOnly}
                onOpen={handleOpenMember}
                onCredentials={handleOpenCredentials}
                onShareReceipt={handleShareReceipt}
                onRenewalReminder={handleRenewalReminder}
                onRenew={handleRenewClick}
                onDelete={handleDeleteMember}
              />
            ))}
        </div>

        {/* Loading spinner for subsequent page/filter loads */}
        {membersLoading && members.length === 0 && !loading && (
          <div className="py-4">
            <RouteLoadingScreen variant="members" compact />
          </div>
        )}

        {/* Empty State */}
        {members.length === 0 && !membersLoading && (
          <div className="text-center py-8 px-4">
            <div className="w-16 h-16 bg-gradient-to-br from-gray-100 to-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-base font-semibold text-gray-900 mb-2">
              {searchQuery || filterStatus !== "all"
                ? "No members found"
                : "No members yet"}
            </h3>
            <p className="text-gray-500 text-sm mb-4">
              {searchQuery || filterStatus !== "all"
                ? "Try adjusting your search or filter criteria"
                : "Add your first member to get started"}
            </p>
            {(searchQuery || filterStatus !== "all") && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setFilterStatus("all");
                  setCurrentPage(1);
                }}
                className="px-4 py-2 text-[#f0813d] text-sm font-medium hover:text-[#f0813d] active:scale-95 transition-transform"
              >
                Clear filters
              </button>
            )}
          </div>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="bg-white rounded-xl p-3 mx-1 flex items-center justify-between">
            <p className="text-xs text-gray-500">
              {(currentPage - 1) * PAGE_SIZE + 1}–
              {Math.min(currentPage * PAGE_SIZE, totalCount)} of {totalCount}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1 || membersLoading}
                className="p-2 rounded-lg bg-gray-100 disabled:opacity-40 active:scale-95 transition-all"
                style={{ minHeight: "36px" }}
              >
                <ChevronLeft className="w-4 h-4 text-gray-700" />
              </button>
              <span className="text-sm font-medium text-gray-700 min-w-[60px] text-center">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                disabled={currentPage >= totalPages || membersLoading}
                className="p-2 rounded-lg bg-gray-100 disabled:opacity-40 active:scale-95 transition-all"
                style={{ minHeight: "36px" }}
              >
                <ChevronRight className="w-4 h-4 text-gray-700" />
              </button>
            </div>
          </div>
        )}

        {/* Bottom spacing for bottom nav */}
        <div className="pb-16 md:pb-6" />
      </main>

      {/* Renew Membership Modal */}
      {showRenewModal && selectedMember && (
        <RenewMembershipModal
          member={selectedMember}
          gymId={selectedGym?.id}
          onClose={() => {
            setShowRenewModal(false);
            setSelectedMember(null);
          }}
          onRenew={handleRenewal}
        />
      )}

      {/* Share Receipt Modal */}
      {showShareReceiptModal && selectedMember && (
        <ShareReceiptModal
          member={selectedMember}
          gymData={selectedGym}
          onClose={() => {
            setShowShareReceiptModal(false);
            setSelectedMember(null);
          }}
        />
      )}
    </div>
  );
}
