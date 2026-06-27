"use client";

import { useState, useEffect, use } from "react";
import dynamic from "next/dynamic";
import { useAuthContext } from "@/contexts/AuthContext";
import { useRouter, useSearchParams } from "next/navigation";
import Header from "@/components/layout/Header";
import AttendanceTimePicker from "@/components/shared/AttendanceTimePicker";
import { supabase } from "@/lib/supabaseClient";
import { useUserRole } from "@/lib/hooks/useUserRole";
import { useToast } from "@/contexts/ToastContext";
import {
  User,
  Mail,
  Phone,
  Calendar,
  Users,
  Dumbbell,
  Apple,
  Edit2,
  UserPlus,
  UserMinus,
  Clock,
  CheckCircle,
  AlertCircle,
  ChevronRight,
  Activity,
  Key,
  Eye,
  EyeOff,
  Copy,
  Wallet,
  UserCheck,
  CalendarDays,
  IndianRupee,
  Plus,
  X,
  Trash2,
  XCircle,
  Award,
  Tag,
  TrendingUp,
  BarChart3,
  RefreshCw,
  Save,
} from "lucide-react";
import { DAYS_OF_WEEK } from "@/lib/constants/trainerSchedule";
import {
  TRAINER_ATTENDANCE_SESSIONS,
  buildAttendanceDrafts,
  createEmptyTimeParts,
  fromTimeParts,
  formatHoursLabel,
  validateSessionTimes,
} from "@/lib/utils/trainerAttendance";

const formatLocalDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatLocalMonth = (date) => formatLocalDate(date).slice(0, 7);

const calculateAssignmentEndDate = (startDate, durationDays) => {
  if (!startDate || !durationDays) return null;

  const endDate = new Date(`${startDate}T00:00:00`);
  if (Number.isNaN(endDate.getTime())) return null;

  endDate.setDate(endDate.getDate() + Number(durationDays));
  return endDate.toISOString().split("T")[0];
};

const calculateDaysRemaining = (endDateValue) => {
  if (!endDateValue) return null;

  const planEndDate = new Date(`${endDateValue}T00:00:00`);
  if (Number.isNaN(planEndDate.getTime())) return null;

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.ceil((planEndDate - now) / (1000 * 60 * 60 * 24));
};

const formatCompactRupees = (value) => {
  const amount = Number(value || 0);

  if (amount <= 0) return "₹0";
  if (amount < 1000) return `₹${amount.toLocaleString("en-IN")}`;
  if (amount < 100000) return `₹${(amount / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  if (amount < 10000000) return `₹${(amount / 100000).toFixed(1).replace(/\.0$/, "")}L`;

  return `₹${(amount / 10000000).toFixed(1).replace(/\.0$/, "")}Cr`;
};

export default function TrainerDetailsPage({ params }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { id } = use(params);
  const { canCreateTrainer } = useUserRole();
  const { showSuccess, showError } = useToast();
  const [trainer, setTrainer] = useState(null);
  const [assignedMembers, setAssignedMembers] = useState([]);
  const [activityLog, setActivityLog] = useState([]);
  const [loading, setLoading] = useState(true);
  const { selectedGym } = useAuthContext();
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "members");
  const [unassignMember, setUnassignMember] = useState(null);
  const [unassigning, setUnassigning] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(null);
  const [trainerPlans, setTrainerPlans] = useState([]);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [plansLoading, setPlansLoading] = useState(false);
  const [trainerEarnings, setTrainerEarnings] = useState([]);
  const [earningsLoading, setEarningsLoading] = useState(false);
  const [earningsSummary, setEarningsSummary] = useState({ total: 0, thisMonth: 0, lastMonth: 0 });
  const [trainerSlotAssignments, setTrainerSlotAssignments] = useState({});
  const [selectedScheduleSlot, setSelectedScheduleSlot] = useState(null);
  const [attendanceMonth, setAttendanceMonth] = useState(formatLocalMonth(new Date()));
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceSaving, setAttendanceSaving] = useState(false);
  const [attendanceData, setAttendanceData] = useState({ month: null, summary: null, attendance_days: [], pt_sessions: [] });
  const [attendanceDrafts, setAttendanceDrafts] = useState({});
  const [editingAssignmentId, setEditingAssignmentId] = useState(null);
  const [editingAssignmentStartDate, setEditingAssignmentStartDate] = useState("");
  const [assignmentUpdating, setAssignmentUpdating] = useState(false);

  // gym now comes from AuthContext


  useEffect(() => {
    if (!canCreateTrainer && searchParams.get("tab") === "attendance") {
      setActiveTab("members");
    }
  }, [canCreateTrainer, searchParams]);

  useEffect(() => {
    if (id && selectedGym?.id) {
      fetchTrainerDetails();
    }
  }, [id, selectedGym?.id]);

  useEffect(() => {
    if (selectedGym?.id && id && activeTab === "attendance") {
      fetchAttendanceSummary();
    }
  }, [selectedGym?.id, id, activeTab, attendanceMonth]);

  const fetchTrainerDetails = async () => {
    if (!selectedGym?.id || !id) return;
    setLoading(true);

    try {
      // Single RPC call replaces 8+ separate queries
      const response = await fetch("/api/trainers/details", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ p_trainer_id: id, p_gym_id: selectedGym.id }),
      });

      const result = await response.json();

      if (!response.ok || result.error) {
        console.error("Error fetching trainer details:", result.error);
        return;
      }

      const { trainer: trainerData, assigned_members, activity_log, trainer_plans, trainer_earnings, earnings_summary } = result.data;

      if (!trainerData) return;

      // Map trainer
      setTrainer({
        id: trainerData.id,
        profileId: trainerData.profile_id,
        name: `${trainerData.first_name || ""} ${trainerData.last_name || ""}`.trim(),
        firstName: trainerData.first_name,
        lastName: trainerData.last_name,
        email: trainerData.email,
        phone: trainerData.phone,
        password: trainerData.password,
        specialization: trainerData.specialization,
        bio: trainerData.bio,
        monthlySalary: trainerData.monthly_salary,
        isActive: trainerData.is_active,
        hireDate: trainerData.hire_date,
        createdAt: trainerData.created_at,
        trainerCost: trainerData.trainer_cost,
        availableDays: trainerData.available_days || [],
        availableTimeSlots: trainerData.available_time_slots || {}
      });

      // Fetch active bookings to show shared-session counts and member names by slot.
      const { data: slotBookingsData, error: slotBookingsError } = await supabase
        .from("trainer_bookings")
        .select("day, time_slot, member_id, members:member_id(full_name)")
        .eq("trainer_id", trainerData.profile_id)
        .eq("gym_id", selectedGym.id)
        .eq("is_active", true);

      if (slotBookingsError) {
        console.error("Error fetching trainer slot assignments:", slotBookingsError);
        setTrainerSlotAssignments({});
      } else {
        const groupedByDayAndSlot = {};
        (slotBookingsData || []).forEach((booking) => {
          if (!groupedByDayAndSlot[booking.day]) groupedByDayAndSlot[booking.day] = {};
          if (!groupedByDayAndSlot[booking.day][booking.time_slot]) {
            groupedByDayAndSlot[booking.day][booking.time_slot] = [];
          }

          const alreadyAdded = groupedByDayAndSlot[booking.day][booking.time_slot].some(
            (m) => m.memberId === booking.member_id
          );
          if (!alreadyAdded) {
            groupedByDayAndSlot[booking.day][booking.time_slot].push({
              memberId: booking.member_id,
              name: booking.members?.full_name || "Member",
            });
          }
        });
        setTrainerSlotAssignments(groupedByDayAndSlot);
      }
      setSelectedScheduleSlot(null);

      // Map assigned members
      const members = (assigned_members || []).map(a => {
        const daysRemaining = calculateDaysRemaining(a.plan_end_date);
        const paidAmount = a.paid_amount ? parseFloat(a.paid_amount) : 0;
        const planTotalAmount = a.plan_total_amount ? parseFloat(a.plan_total_amount) : (a.plan_price ? parseFloat(a.plan_price) : 0);
        const pendingAmount = a.pending_amount ? parseFloat(a.pending_amount) : Math.max(0, planTotalAmount - paidAmount);

        return {
          assignmentId: a.assignment_id,
          memberId: a.member_id,
          name: a.member_name,
          phone: a.member_phone,
          profileImage: a.member_profile_image,
          assignedAt: a.assigned_at,
          notes: a.notes,
          status: a.membership_status || "inactive",
          membershipEnd: a.membership_end_date,
          planName: a.plan_name || null,
          planPrice: a.plan_price ? parseFloat(a.plan_price) : null,
          planTotalAmount,
          paidAmount,
          pendingAmount,
          nextPaymentDate: a.next_payment_date || null,
          planStartDate: a.plan_start_date || null,
          planEndDate: a.plan_end_date,
          planDurationDays: a.plan_duration_days || null,
          daysRemaining,
        };
      });
      setAssignedMembers(members);

      // Map activity log (already sorted by RPC)
      const activity = (activity_log || []).map(a => ({
        id: a.id,
        type: a.type,
        action: a.action,
        memberName: a.member_name,
        details: a.details,
        date: a.date
      }));
      setActivityLog(activity.slice(0, 20));

      // Map trainer plans
      setTrainerPlans(
        (trainer_plans || []).map(p => ({
          ...p,
          price: parseFloat(p.price),
          subscribers: p.subscribers || 0,
        }))
      );

      // Map trainer earnings
      const earnings = (trainer_earnings || []).map(e => ({
        ...e,
        total_amount: parseFloat(e.total_amount),
        trainer_amount: parseFloat(e.trainer_amount),
        gym_amount: parseFloat(e.gym_amount),
        members: { full_name: e.member_name, phone: e.member_phone },
        trainer_plans: { name: e.plan_name, duration_days: e.plan_duration_days },
      }));
      setTrainerEarnings(earnings);

      // Set earnings summary
      setEarningsSummary({
        total: parseFloat(earnings_summary?.total || 0),
        thisMonth: parseFloat(earnings_summary?.this_month || 0),
        lastMonth: parseFloat(earnings_summary?.last_month || 0),
      });
    } catch (err) {
      console.error("Error fetching trainer details:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAttendanceSummary = async () => {
    if (!selectedGym?.id || !id) return;

    setAttendanceLoading(true);
    try {
      const response = await fetch("/api/trainers/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          p_gym_id: selectedGym.id,
          p_trainer_id: id,
          p_month: `${attendanceMonth}-01`,
        }),
      });

      const result = await response.json();

      if (!response.ok || result.error) {
        console.error("Error fetching attendance summary:", result.error);
        setAttendanceData({ month: null, summary: null, attendance_days: [], pt_sessions: [] });
        return;
      }

      setAttendanceData({
        month: result.data?.month || null,
        summary: result.data?.summary || null,
        attendance_days: result.data?.attendance_days || [],
        pt_sessions: result.data?.pt_sessions || [],
      });
    } catch (error) {
      console.error("Error fetching attendance summary:", error);
      setAttendanceData({ month: null, summary: null, attendance_days: [], pt_sessions: [] });
    } finally {
      setAttendanceLoading(false);
    }
  };

  useEffect(() => {
    setAttendanceDrafts(buildAttendanceDrafts(attendanceData.attendance_days || []));
  }, [attendanceData.attendance_days]);

  // fetchTrainerPlans and fetchTrainerEarnings are now included in the single RPC call above

  const togglePlanStatus = async (planId) => {
    const plan = trainerPlans.find((p) => p.id === planId);
    if (!plan) return;
    try {
      const { error } = await supabase
        .from("trainer_plans")
        .update({ is_active: !plan.is_active, updated_at: new Date().toISOString() })
        .eq("id", planId);
      if (error) throw error;
      setTrainerPlans((prev) =>
        prev.map((p) => (p.id === planId ? { ...p, is_active: !p.is_active } : p))
      );
    } catch (err) {
      console.error("Error toggling plan:", err);
      alert("Failed to update plan status");
    }
  };

  const deletePlan = async (planId) => {
    const plan = trainerPlans.find((p) => p.id === planId);
    if (!plan) return;
    if (plan.subscribers > 0) {
      alert("Cannot delete a plan with active subscribers");
      return;
    }
    if (!confirm(`Delete "${plan.name}"?`)) return;
    try {
      const { error } = await supabase.from("trainer_plans").delete().eq("id", planId);
      if (error) throw error;
      setTrainerPlans((prev) => prev.filter((p) => p.id !== planId));
    } catch (err) {
      console.error("Error deleting plan:", err);
      alert("Failed to delete plan");
    }
  };

  const formatDuration = (days) => {
    if (days === 1) return "1 Day";
    if (days === 7) return "1 Week";
    if (days < 30) return `${days} Days`;
    const months = Math.round(days / 30);
    if (months === 1) return "1 Month";
    if (months === 3) return "3 Months";
    if (months === 6) return "6 Months";
    if (months === 12) return "1 Year";
    return `${months} Months`;
  };

  const handleUnassignMember = async () => {
    if (!unassignMember) return;
    setUnassigning(true);

    try {
      const { error } = await supabase
        .from("trainer_member_assignments")
        .update({ is_active: false })
        .eq("id", unassignMember.assignmentId);

      if (error) throw error;

      setAssignedMembers(prev => 
        prev.filter(m => m.assignmentId !== unassignMember.assignmentId)
      );
      setUnassignMember(null);
    } catch (err) {
      console.error("Error unassigning member:", err);
      alert("Failed to unassign member");
    } finally {
      setUnassigning(false);
    }
  };

  const startEditingAssignment = (member) => {
    setEditingAssignmentId(member.assignmentId);
    setEditingAssignmentStartDate(member.planStartDate || "");
  };

  const cancelEditingAssignment = () => {
    setEditingAssignmentId(null);
    setEditingAssignmentStartDate("");
  };

  const saveAssignmentDates = async (member) => {
    if (!member?.assignmentId || !editingAssignmentStartDate) {
      showError("Please select a valid start date");
      return;
    }

    if (!member.planDurationDays) {
      showError("This assignment does not have a trainer plan duration");
      return;
    }

    const nextEndDate = calculateAssignmentEndDate(editingAssignmentStartDate, member.planDurationDays);
    if (!nextEndDate) {
      showError("Could not calculate end date for this plan");
      return;
    }

    setAssignmentUpdating(true);
    try {
      const { error } = await supabase
        .from("trainer_member_assignments")
        .update({
          plan_start_date: editingAssignmentStartDate,
          plan_end_date: nextEndDate,
        })
        .eq("id", member.assignmentId);

      if (error) throw error;

      setAssignedMembers((current) => current.map((item) => {
        if (item.assignmentId !== member.assignmentId) return item;

        return {
          ...item,
          planStartDate: editingAssignmentStartDate,
          planEndDate: nextEndDate,
          daysRemaining: calculateDaysRemaining(nextEndDate),
        };
      }));

      cancelEditingAssignment();
      showSuccess("Trainer assignment dates updated");
    } catch (error) {
      console.error("Error updating assignment dates:", error);
      showError("Failed to update assignment start date");
    } finally {
      setAssignmentUpdating(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric"
    });
  };

  const formatTimeAgo = (dateStr) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    return formatDate(dateStr);
  };

  const copyToClipboard = async (text, field) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(field);
      setTimeout(() => setCopied(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const updateSessionTimePart = (attendanceDate, sessionNumber, field, part, value) => {
    setAttendanceDrafts((currentDrafts) => ({
      ...currentDrafts,
      [attendanceDate]: {
        ...(currentDrafts[attendanceDate] || buildAttendanceDrafts([{ attendance_date: attendanceDate }])[attendanceDate]),
        [sessionNumber]: {
          ...((currentDrafts[attendanceDate] || {})[sessionNumber] || {
            id: null,
            notes: "",
            checkInParts: createEmptyTimeParts(),
            checkOutParts: createEmptyTimeParts(),
          }),
          [field]: {
            ...(((currentDrafts[attendanceDate] || {})[sessionNumber] || {})[field] || createEmptyTimeParts()),
            minute: part === "minute"
              ? value
              : ((((currentDrafts[attendanceDate] || {})[sessionNumber] || {})[field] || {}).minute || "00"),
            [part]: value,
          },
        },
      },
    }));
  };

  const clearSessionTime = (attendanceDate, sessionNumber, field) => {
    setAttendanceDrafts((currentDrafts) => ({
      ...currentDrafts,
      [attendanceDate]: {
        ...(currentDrafts[attendanceDate] || buildAttendanceDrafts([{ attendance_date: attendanceDate }])[attendanceDate]),
        [sessionNumber]: {
          ...((currentDrafts[attendanceDate] || {})[sessionNumber] || {
            id: null,
            notes: "",
            checkInParts: createEmptyTimeParts(),
            checkOutParts: createEmptyTimeParts(),
          }),
          [field]: createEmptyTimeParts(),
        },
      },
    }));
  };

  const resetAttendanceDay = (day) => {
    setAttendanceDrafts((currentDrafts) => ({
      ...currentDrafts,
      [day.attendance_date]: buildAttendanceDrafts([day])[day.attendance_date],
    }));
  };

  const saveAttendanceDay = async (day) => {
    if (!selectedGym?.id || !trainer?.profileId || !canCreateTrainer) return;
    const storedUser = localStorage.getItem("gymUser");
    const user = storedUser ? JSON.parse(storedUser) : null;
    const dayDraft = attendanceDrafts[day.attendance_date] || buildAttendanceDrafts([day])[day.attendance_date];

    for (const session of TRAINER_ATTENDANCE_SESSIONS) {
      const draft = dayDraft[session.sessionNumber];
      const validationError = validateSessionTimes(draft?.checkInParts, draft?.checkOutParts);
      if (validationError) {
        alert(`${session.label}: ${validationError}`);
        return;
      }
    }

    setAttendanceSaving(true);
    try {
      const existingSessions = new Map((day.sessions || []).map((session) => [session.session_number, session]));
      const sessionRowsToSave = [];
      const sessionIdsToDelete = [];

      for (const session of TRAINER_ATTENDANCE_SESSIONS) {
        const draft = dayDraft[session.sessionNumber] || {
          id: null,
          notes: "",
          checkInParts: createEmptyTimeParts(),
          checkOutParts: createEmptyTimeParts(),
        };
        const existingSession = existingSessions.get(session.sessionNumber);
        const checkInValue = fromTimeParts(draft.checkInParts);
        const checkOutValue = fromTimeParts(draft.checkOutParts);

        if (!checkInValue && !checkOutValue) {
          if (existingSession?.id) {
            sessionIdsToDelete.push(existingSession.id);
          }
          continue;
        }

        sessionRowsToSave.push({
          gym_id: selectedGym.id,
          trainer_id: trainer.profileId,
          attendance_date: day.attendance_date,
          session_number: session.sessionNumber,
          check_in_time: checkInValue,
          check_out_time: checkOutValue,
          notes: draft.notes || null,
          marked_by: user?.id || null,
          marked_at: new Date().toISOString(),
        });
      }

      if (sessionIdsToDelete.length > 0) {
        const { error } = await supabase
          .from("trainer_attendance")
          .delete()
          .in("id", sessionIdsToDelete);

        if (error) throw error;
      }

      if (sessionRowsToSave.length > 0) {
        const { error } = await supabase
          .from("trainer_attendance")
          .upsert(sessionRowsToSave, {
            onConflict: "gym_id,trainer_id,attendance_date,session_number",
          });

        if (error) throw error;
      }

      await fetchAttendanceSummary();
    } catch (error) {
      console.error("Error updating trainer attendance:", error);
      alert("Failed to update trainer attendance");
    } finally {
      setAttendanceSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 pb-24">
        <Header title="Trainer Details" />
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#9c4400]"></div>
        </div>
      </div>
    );
  }

  if (!trainer) {
    return (
      <div className="min-h-screen bg-gray-50 pb-24">
        <Header title="Trainer Details" />
        <div className="px-4 py-8 text-center">
          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Trainer Not Found</h2>
          <p className="text-gray-500 mb-4">This trainer doesn&apos;t exist or has been removed.</p>
          <button
            onClick={() => router.push("/settings/trainers")}
            className="px-4 py-2 bg-[#9c4400] text-white rounded-lg"
          >
            Back to Trainers
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Header title="Trainer Details" />

      <main className="px-4 py-4 space-y-4">
        {/* Trainer Profile Card */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-start gap-4">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-2xl ${
              trainer.isActive 
                ? "bg-gradient-to-br from-[#f0813d] to-[#9c4400]" 
                : "bg-gray-400"
            }`}>
              {trainer.name.charAt(0).toUpperCase()}
            </div>
            
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-xl font-bold text-gray-900">{trainer.name}</h2>
                {trainer.isActive ? (
                  <span className="px-2 py-0.5 bg-[#f0813d]/15 text-[#9c4400] text-xs font-medium rounded-full">
                    Active
                  </span>
                ) : (
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">
                    Inactive
                  </span>
                )}
              </div>
              
              {trainer.specialization && (
                <p className="text-[#f0813d] font-medium mb-2">{trainer.specialization}</p>
              )}

              <div className="space-y-1 text-sm text-gray-500">
                {trainer.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    <span>{trainer.email}</span>
                  </div>
                )}
                {trainer.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    <span>{trainer.phone}</span>
                  </div>
                )}
                {trainer.hireDate && (
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    <span>Joined {formatDate(trainer.hireDate)}</span>
                  </div>
                )}
                {trainer.monthlySalary !== null && trainer.monthlySalary !== undefined && (
                  <div className="flex items-center gap-2">
                    <IndianRupee className="w-4 h-4" />
                    <span>Monthly Salary: <span className="font-semibold text-gray-800">₹{Number(trainer.monthlySalary || 0).toLocaleString("en-IN")}</span></span>
                  </div>
                )}
                {trainer.trainerCost && (
                  <div className="flex items-center gap-2">
                    <Wallet className="w-4 h-4" />
                    <span>Hourly PT Rate: <span className="font-semibold text-gray-800">₹{trainer.trainerCost.toLocaleString("en-IN")}</span>/hr</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {trainer.bio && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-gray-600 text-sm">{trainer.bio}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100">
            <button
              onClick={() => router.push(`/settings/trainers/${id}/edit`)}
              className="flex-1 py-2 text-sm font-medium text-[#f0813d] bg-[#f0813d]/10 rounded-lg hover:bg-[#f0813d]/15 transition-colors flex items-center justify-center gap-2"
            >
              <Edit2 className="w-4 h-4" />
              Edit Profile
            </button>
            <button
              onClick={() => router.push(`/settings/trainers/${id}/assign`)}
              className="flex-1 py-2 text-sm font-medium text-[#f0813d] bg-[#f0813d]/10 rounded-lg hover:bg-[#f0813d]/15 transition-colors flex items-center justify-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              Assign Members
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-2">
          <div className="bg-white rounded-xl p-3 shadow-sm text-center">
            <Users className="w-5 h-5 text-[#f0813d] mx-auto mb-1" />
            <p className="text-xl font-bold text-gray-900">{assignedMembers.length}</p>
            <p className="text-[10px] text-gray-500">Members</p>
          </div>
          <div className="bg-white rounded-xl p-3 shadow-sm text-center">
            <Apple className="w-5 h-5 text-[#f0813d] mx-auto mb-1" />
            <p className="text-xl font-bold text-gray-900">
              {activityLog.filter(a => a.type === "diet").length}
            </p>
            <p className="text-[10px] text-gray-500">Diets</p>
          </div>
          <div className="bg-white rounded-xl p-3 shadow-sm text-center">
            <Dumbbell className="w-5 h-5 text-[#f0813d] mx-auto mb-1" />
            <p className="text-xl font-bold text-gray-900">
              {activityLog.filter(a => a.type === "workout").length}
            </p>
            <p className="text-[10px] text-gray-500">Workouts</p>
          </div>
          <div className="bg-white rounded-xl p-3 shadow-sm text-center">
            <IndianRupee className="w-5 h-5 text-[#f0813d] mx-auto mb-1" />
            <p className="text-xl font-bold text-gray-900">
              {formatCompactRupees(earningsSummary.total)}
            </p>
            <p className="text-[10px] text-gray-500">Earnings</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-white rounded-xl p-1 shadow-sm overflow-x-auto no-scrollbar">
          {["members", "plans", "earnings", ...(canCreateTrainer ? ["attendance"] : []), "availability", "credentials", "activity"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap px-1.5 ${
                activeTab === tab
                  ? tab === "earnings"
                    ? "bg-[#9c4400] text-white"
                    : tab === "attendance"
                      ? "bg-[#9c4400] text-white"
                      : "bg-[#9c4400] text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {tab === "members" ? "Members" : tab === "plans" ? "Plans" : tab === "earnings" ? "Earnings" : tab === "attendance" ? "Attendance" : tab === "availability" ? "Schedule" : tab === "credentials" ? "Creds" : "Activity"}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === "members" && (
          <div className="space-y-3">
            {assignedMembers.length === 0 ? (
              <div className="bg-white rounded-xl p-8 shadow-sm text-center">
                <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <h3 className="font-semibold text-gray-900 mb-1">No Members Assigned</h3>
                <p className="text-gray-500 text-sm mb-4">
                  Assign members to this trainer to get started
                </p>
                <button
                  onClick={() => router.push(`/settings/trainers/${id}/assign`)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[#9c4400] text-white rounded-lg text-sm font-medium"
                >
                  <UserPlus className="w-4 h-4" />
                  Assign Members
                </button>
              </div>
            ) : (
              assignedMembers.map((member) => (
                <div key={member.assignmentId} className="bg-white rounded-xl p-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                      {member.profileImage ? (
                        <img src={member.profileImage} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-gray-900 truncate">{member.name}</h4>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <Phone className="w-3 h-3" />
                        <span>{member.phone}</span>
                        <span className={`px-1.5 py-0.5 rounded-full ${
                          member.status === "active" 
                            ? "bg-[#f0813d]/15 text-[#9c4400]" 
                            : "bg-gray-100 text-gray-600"
                        }`}>
                          {member.status}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => router.push(`/members/${member.memberId}`)}
                        className="p-2 hover:bg-gray-100 rounded-lg"
                        title="View Member"
                      >
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                      </button>
                      <button
                        onClick={() => setUnassignMember(member)}
                        className="p-2 hover:bg-[#f0813d]/10 rounded-lg text-[#f0813d]"
                        title="Unassign"
                      >
                        <UserMinus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  
                  {/* Plan info: price and days remaining */}
                  {member.planName && (
                    <div className="mt-2 pt-2 border-t border-gray-100 flex items-center gap-3 flex-wrap">
                      <div className="flex items-center gap-1 text-xs">
                        <Tag className="w-3 h-3 text-[#f0813d]" />
                        <span className="font-medium text-gray-700">{member.planName}</span>
                      </div>
                      {(member.paidAmount || member.planTotalAmount || member.planPrice) && (
                        <div className="flex items-center gap-1 text-xs">
                          <IndianRupee className="w-3 h-3 text-[#f0813d]" />
                          <span className="font-semibold text-[#9c4400]">Paid ₹{Number(member.paidAmount || 0).toLocaleString("en-IN")}</span>
                        </div>
                      )}
                      {member.pendingAmount > 0 && (
                        <div className="flex items-center gap-1 text-xs">
                          <IndianRupee className="w-3 h-3 text-[#f0813d]" />
                          <span className="font-semibold text-[#9c4400]">Due ₹{Number(member.pendingAmount || 0).toLocaleString("en-IN")}</span>
                        </div>
                      )}
                      {member.daysRemaining !== null && (
                        <div className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
                          member.daysRemaining <= 0
                            ? "bg-[#f0813d]/10 text-[#f0813d]"
                            : member.daysRemaining <= 7
                              ? "bg-[#f0813d]/10 text-[#f0813d]"
                              : "bg-[#f0813d]/10 text-[#f0813d]"
                        }`}>
                          <CalendarDays className="w-3 h-3" />
                          <span className="font-medium">
                            {member.daysRemaining <= 0
                              ? "Expired"
                              : `${member.daysRemaining} day${member.daysRemaining !== 1 ? "s" : ""} left`}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {member.nextPaymentDate && member.pendingAmount > 0 && (
                    <div className="mt-1.5 text-xs text-[#9c4400] font-medium">
                      Next PT due: {new Date(`${member.nextPaymentDate}T00:00:00`).toLocaleDateString("en-IN")}
                    </div>
                  )}

                  {member.planName && member.planDurationDays && (
                    <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-xs text-gray-600">Plan Dates</p>
                          <p className="text-sm font-medium text-gray-900">
                            {member.planStartDate ? formatDate(member.planStartDate) : "N/A"} to {member.planEndDate ? formatDate(member.planEndDate) : "N/A"}
                          </p>
                        </div>
                        {editingAssignmentId !== member.assignmentId && (
                          <button
                            type="button"
                            onClick={() => startEditingAssignment(member)}
                            className="text-xs font-medium text-[#f0813d] hover:text-[#9c4400]"
                          >
                            Update Start Date
                          </button>
                        )}
                      </div>

                      {editingAssignmentId === member.assignmentId && (
                        <div className="space-y-3 border-t border-gray-200 pt-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Start Date</label>
                              <input
                                type="date"
                                value={editingAssignmentStartDate}
                                onChange={(e) => setEditingAssignmentStartDate(e.target.value)}
                                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-[#f0813d]/20 outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">End Date</label>
                              <div className="w-full rounded-lg border border-gray-200 bg-gray-100 px-3 py-2 text-sm text-gray-700">
                                {editingAssignmentStartDate
                                  ? formatDate(calculateAssignmentEndDate(editingAssignmentStartDate, member.planDurationDays))
                                  : "Select start date"}
                              </div>
                              <p className="mt-1 text-[11px] text-gray-500">
                                Auto-calculated for {formatDuration(member.planDurationDays)}.
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={cancelEditingAssignment}
                              disabled={assignmentUpdating}
                              className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => saveAssignmentDates(member)}
                              disabled={assignmentUpdating}
                              className="flex-1 rounded-lg bg-[#9c4400] px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
                            >
                              {assignmentUpdating ? "Saving..." : "Save Dates"}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className={`${member.planName ? "mt-1.5" : "mt-2 pt-2 border-t border-gray-100"} text-xs text-gray-500 flex items-center gap-1`}>
                    <Clock className="w-3 h-3" />
                    Assigned {formatTimeAgo(member.assignedAt)}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "plans" && (
          <div className="space-y-3">
            {/* Add Plan Button */}
            <button
              onClick={() => { setEditingPlan(null); setShowPlanModal(true); }}
              className="w-full py-3 bg-gradient-to-r from-[#f0813d] to-[#9c4400] text-white font-medium rounded-xl hover:shadow-lg active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2"
              style={{ minHeight: "44px" }}
            >
              <Plus className="w-5 h-5" />
              Create Plan for {trainer.firstName || trainer.name}
            </button>

            {plansLoading ? (
              <div className="bg-white rounded-xl p-8 shadow-sm text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#9c4400] mx-auto"></div>
                <p className="text-gray-500 text-sm mt-3">Loading plans...</p>
              </div>
            ) : trainerPlans.length === 0 ? (
              <div className="bg-white rounded-xl p-8 shadow-sm text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-[#f0813d]/10 to-[#f0813d]/15 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Tag className="w-8 h-8 text-white" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">No Plans Yet</h3>
                <p className="text-gray-500 text-sm">
                  Create monthly, quarterly, or yearly plans for this trainer
                </p>
              </div>
            ) : (
              trainerPlans.map((plan) => (
                <div
                  key={plan.id}
                  className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:shadow-md transition-all"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-11 h-11 rounded-xl flex items-center justify-center text-white shadow-sm flex-shrink-0 ${
                        plan.is_active
                          ? "bg-gradient-to-br from-[#f0813d] to-[#9c4400]"
                          : "bg-gradient-to-br from-gray-400 to-gray-500"
                      }`}
                    >
                      <Award className="w-5 h-5" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-semibold text-gray-900 text-sm truncate">
                              {plan.name}
                            </h4>
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1 ${
                                plan.is_active
                                  ? "bg-[#f0813d]/10 text-[#9c4400]"
                                  : "bg-gray-100 text-gray-600"
                              }`}
                            >
                              {plan.is_active ? (
                                <CheckCircle className="w-3 h-3" />
                              ) : (
                                <XCircle className="w-3 h-3" />
                              )}
                              {plan.is_active ? "Active" : "Inactive"}
                            </span>
                          </div>
                          {plan.description && (
                            <p className="text-gray-500 text-xs mt-0.5 line-clamp-1">
                              {plan.description}
                            </p>
                          )}
                        </div>
                        <div className="text-right ml-2 flex-shrink-0">
                          <p className="text-lg font-bold text-gray-900">
                            ₹{plan.price.toLocaleString()}
                          </p>
                        </div>
                      </div>

                      {/* Metadata */}
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {formatDuration(plan.duration_days)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5" />
                          {plan.subscribers} subscriber{plan.subscribers !== 1 ? "s" : ""}
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100 overflow-x-auto no-scrollbar -mx-1 px-1">
                        <button
                          onClick={() => { setEditingPlan(plan); setShowPlanModal(true); }}
                          className="flex-shrink-0 px-3 py-1.5 bg-[#f0813d]/10 text-[#9c4400] text-xs font-medium rounded-lg active:bg-[#f0813d]/15 transition-all flex items-center gap-1.5"
                          style={{ minHeight: "32px" }}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          Edit
                        </button>
                        <button
                          onClick={() => togglePlanStatus(plan.id)}
                          className={`flex-shrink-0 px-3 py-1.5 text-xs font-medium rounded-lg active:scale-95 transition-all flex items-center gap-1.5 text-white ${
                            plan.is_active
                              ? "bg-gradient-to-r from-[#f0813d] to-[#9c4400]"
                              : "bg-gradient-to-r from-[#f0813d] to-[#9c4400]"
                          }`}
                          style={{ minHeight: "32px" }}
                        >
                          {plan.is_active ? (
                            <XCircle className="w-3.5 h-3.5" />
                          ) : (
                            <CheckCircle className="w-3.5 h-3.5" />
                          )}
                          {plan.is_active ? "Deactivate" : "Activate"}
                        </button>
                        <button
                          onClick={() => deletePlan(plan.id)}
                          disabled={plan.subscribers > 0}
                          className={`flex-shrink-0 px-3 py-1.5 text-xs font-medium rounded-lg flex items-center gap-1.5 ${
                            plan.subscribers > 0
                              ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                              : "bg-[#f0813d]/10 text-[#9c4400] active:bg-[#f0813d]/15 transition-all"
                          }`}
                          style={{ minHeight: "32px" }}
                          title={
                            plan.subscribers > 0
                              ? "Cannot delete plan with active subscribers"
                              : "Delete plan"
                          }
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "availability" && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#f0813d]/15 rounded-lg">
                  <CalendarDays className="w-5 h-5 text-[#f0813d]" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Weekly Schedule</h3>
                  <p className="text-xs text-gray-500">Trainer availability & timings</p>
                </div>
              </div>
              <button
                onClick={() => router.push(`/settings/trainers/${id}/edit`)}
                className="text-xs text-[#f0813d] font-medium px-3 py-1.5 bg-[#f0813d]/10 rounded-lg hover:bg-[#f0813d]/15 transition-colors"
              >
                Edit
              </button>
            </div>

            {trainer.availableDays && trainer.availableDays.length > 0 ? (
              <div className="divide-y divide-gray-100">
                {DAYS_OF_WEEK.map((day) => {
                  const isAvailable = trainer.availableDays.includes(day);
                  const slots = trainer.availableTimeSlots?.[day] || [];
                  const daySlotAssignments = trainerSlotAssignments[day] || {};
                  
                  return (
                    <div key={day} className={`px-4 py-3 flex items-start gap-3 ${!isAvailable ? 'opacity-40' : ''}`}>
                      <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                        isAvailable ? 'bg-[#f0813d]' : 'bg-gray-300'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-medium ${
                            isAvailable ? 'text-gray-900' : 'text-gray-400'
                          }`}>
                            {day}
                          </span>
                          {!isAvailable && (
                            <span className="text-xs text-gray-400">Off</span>
                          )}
                        </div>
                        {isAvailable && slots.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            {slots
                              .sort((a, b) => {
                                const getHour = (s) => parseInt(s.split('-')[0]);
                                const isPM_a = a.includes('PM') && !a.includes('12');
                                const isPM_b = b.includes('PM') && !b.includes('12');
                                return (getHour(a) + (isPM_a ? 12 : 0)) - (getHour(b) + (isPM_b ? 12 : 0));
                              })
                              .map((slot) => {
                                const assignedMembers = daySlotAssignments[slot] || [];
                                const assignedCount = assignedMembers.length;
                                const isSelectedSlot =
                                  selectedScheduleSlot?.day === day &&
                                  selectedScheduleSlot?.slot === slot;

                                return (
                                  <button
                                    key={slot}
                                    type="button"
                                    onClick={() => {
                                      setSelectedScheduleSlot((prev) => {
                                        if (prev?.day === day && prev?.slot === slot) return null;
                                        return { day, slot };
                                      });
                                    }}
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-md border transition-colors ${
                                      isSelectedSlot
                                        ? "bg-[#9c4400] text-white border-[#9c4400]"
                                        : assignedCount > 0
                                          ? "bg-[#f0813d]/10 text-[#9c4400] border-[#f0813d]/20 hover:bg-[#f0813d]/15"
                                          : "bg-[#f0813d]/10 text-[#9c4400] border-[#f0813d]/10 hover:bg-[#f0813d]/15"
                                    }`}
                                  >
                                    <Clock className="w-3 h-3" />
                                    {slot}
                                    {assignedCount > 0 && (
                                      <span className={`ml-0.5 ${isSelectedSlot ? "text-white/75" : "text-[#9c4400]"}`}>
                                        ({assignedCount} member{assignedCount > 1 ? "s" : ""})
                                      </span>
                                    )}
                                  </button>
                                );
                              })}
                          </div>
                        )}
                        {isAvailable &&
                          selectedScheduleSlot?.day === day &&
                          selectedScheduleSlot?.slot && (
                            <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                              <p className="text-xs font-semibold text-gray-700">
                                {selectedScheduleSlot.slot} - Assigned Members
                              </p>
                              {(() => {
                                const selectedMembers =
                                  daySlotAssignments[selectedScheduleSlot.slot] || [];
                                if (selectedMembers.length === 0) {
                                  return (
                                    <p className="text-xs text-gray-500 mt-1">No members assigned</p>
                                  );
                                }
                                return (
                                  <div className="mt-1 space-y-1">
                                    {selectedMembers.map((m) => (
                                      <p key={m.memberId} className="text-xs text-gray-700">
                                        {m.name}
                                      </p>
                                    ))}
                                  </div>
                                );
                              })()}
                            </div>
                          )}
                        {isAvailable && slots.length === 0 && (
                          <p className="text-xs text-gray-400 mt-1">Available (no specific slots set)</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 text-center">
                <CalendarDays className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <h3 className="font-semibold text-gray-900 mb-1">No Schedule Set</h3>
                <p className="text-gray-500 text-sm mb-4">
                  Set this trainer&apos;s weekly availability and time slots
                </p>
                <button
                  onClick={() => router.push(`/settings/trainers/${id}/edit`)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[#9c4400] text-white rounded-lg text-sm font-medium"
                >
                  <Edit2 className="w-4 h-4" />
                  Set Availability
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === "credentials" && (
          <div className="bg-white rounded-xl p-4 shadow-sm space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
              <div className="p-2 bg-[#f0813d]/15 rounded-lg">
                <Key className="w-5 h-5 text-[#f0813d]" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Login Credentials</h3>
                <p className="text-xs text-gray-500">Trainer&apos;s login information</p>
              </div>
            </div>

            {/* Login Email/Phone */}
            <div className="space-y-3">
              <div className="p-3 bg-gray-50 rounded-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Mail className="w-4 h-4 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500">Login Email</p>
                      <p className="font-medium text-gray-900">{trainer.email || "Not set"}</p>
                    </div>
                  </div>
                  {trainer.email && (
                    <button
                      onClick={() => copyToClipboard(trainer.email, "email")}
                      className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                      {copied === "email" ? (
                        <CheckCircle className="w-4 h-4 text-[#f0813d]" />
                      ) : (
                        <Copy className="w-4 h-4 text-gray-400" />
                      )}
                    </button>
                  )}
                </div>
              </div>

              <div className="p-3 bg-gray-50 rounded-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Phone className="w-4 h-4 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500">Login Phone</p>
                      <p className="font-medium text-gray-900">{trainer.phone || "Not set"}</p>
                    </div>
                  </div>
                  {trainer.phone && (
                    <button
                      onClick={() => copyToClipboard(trainer.phone, "phone")}
                      className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                      {copied === "phone" ? (
                        <CheckCircle className="w-4 h-4 text-[#f0813d]" />
                      ) : (
                        <Copy className="w-4 h-4 text-gray-400" />
                      )}
                    </button>
                  )}
                </div>
              </div>

              <div className="p-3 bg-gray-50 rounded-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Key className="w-4 h-4 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500">Password</p>
                      <p className="font-medium text-gray-900 font-mono">
                        {showPassword ? (trainer.password || "Not set") : "••••••••"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setShowPassword(!showPassword)}
                      className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4 text-gray-400" />
                      ) : (
                        <Eye className="w-4 h-4 text-gray-400" />
                      )}
                    </button>
                    {trainer.password && (
                      <button
                        onClick={() => copyToClipboard(trainer.password, "password")}
                        className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                      >
                        {copied === "password" ? (
                          <CheckCircle className="w-4 h-4 text-[#f0813d]" />
                        ) : (
                          <Copy className="w-4 h-4 text-gray-400" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-gray-100">
              <p className="text-xs text-gray-500 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Share these credentials securely with the trainer
              </p>
            </div>
          </div>
        )}

        {activeTab === "earnings" && (
          <div className="space-y-4">
            {/* Earnings Summary Cards */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-gradient-to-br from-[#f0813d]/10 to-[#f0813d]/10 border border-[#f0813d]/10 rounded-xl p-3 text-center">
                <p className="text-[10px] text-[#f0813d] font-semibold uppercase tracking-wider">Total Earned</p>
                <p className="text-lg font-bold text-[#9c4400] mt-1">
                  ₹{earningsSummary.total.toLocaleString("en-IN")}
                </p>
              </div>
              <div className="bg-gradient-to-br from-[#f0813d]/10 to-[#f0813d]/10 border border-[#f0813d]/10 rounded-xl p-3 text-center">
                <p className="text-[10px] text-[#f0813d] font-semibold uppercase tracking-wider">This Month</p>
                <p className="text-lg font-bold text-[#9c4400] mt-1">
                  ₹{earningsSummary.thisMonth.toLocaleString("en-IN")}
                </p>
              </div>
              <div className="bg-gradient-to-br from-gray-50 to-slate-50 border border-gray-200 rounded-xl p-3 text-center">
                <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Last Month</p>
                <p className="text-lg font-bold text-gray-700 mt-1">
                  ₹{earningsSummary.lastMonth.toLocaleString("en-IN")}
                </p>
              </div>
            </div>

            {/* Earnings Trend */}
            {earningsSummary.thisMonth > 0 && earningsSummary.lastMonth > 0 && (
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <div className="flex items-center gap-2">
                  <TrendingUp className={`w-5 h-5 ${earningsSummary.thisMonth >= earningsSummary.lastMonth ? 'text-[#f0813d]' : 'text-[#f0813d]'}`} />
                  <p className="text-sm text-gray-700">
                    {earningsSummary.thisMonth >= earningsSummary.lastMonth ? (
                      <span className="text-[#9c4400] font-medium">
                        +{Math.round(((earningsSummary.thisMonth - earningsSummary.lastMonth) / earningsSummary.lastMonth) * 100)}% from last month
                      </span>
                    ) : (
                      <span className="text-[#f0813d] font-medium">
                        -{Math.round(((earningsSummary.lastMonth - earningsSummary.thisMonth) / earningsSummary.lastMonth) * 100)}% from last month
                      </span>
                    )}
                  </p>
                </div>
              </div>
            )}

            {/* Earnings History */}
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Earning History
              </h3>

              {earningsLoading ? (
                <div className="bg-white rounded-xl p-8 shadow-sm text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#9c4400] mx-auto"></div>
                  <p className="text-gray-500 text-sm mt-3">Loading earnings...</p>
                </div>
              ) : trainerEarnings.length === 0 ? (
                <div className="bg-white rounded-xl p-8 shadow-sm text-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-[#f0813d]/10 to-[#f0813d]/15 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Wallet className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-1">No Earnings Yet</h3>
                  <p className="text-gray-500 text-sm">
                    Earnings will appear here when members are assigned with a trainer plan
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {trainerEarnings.map((earning) => (
                    <div key={earning.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-[#f0813d] to-[#9c4400] rounded-full flex items-center justify-center text-white flex-shrink-0">
                          <IndianRupee className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-900 text-sm truncate">
                                {earning.members?.full_name || "Unknown Member"}
                              </p>
                              <p className="text-xs text-gray-500 mt-0.5">
                                {earning.trainer_plans?.name || "Custom Plan"} ({earning.trainer_plans?.duration_days ? formatDuration(earning.trainer_plans.duration_days) : "N/A"})
                              </p>
                            </div>
                            <div className="text-right flex-shrink-0 ml-2">
                              <p className="text-base font-bold text-[#9c4400]">
                                +₹{earning.trainer_amount.toLocaleString("en-IN")}
                              </p>
                              <p className="text-[10px] text-gray-400">
                                of ₹{earning.total_amount.toLocaleString("en-IN")}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatDate(earning.created_at)}
                            </span>
                            <span className="px-1.5 py-0.5 bg-gray-100 rounded text-[10px] uppercase font-medium">
                              {earning.payment_mode || "cash"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "attendance" && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl p-4 shadow-sm space-y-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <h3 className="font-semibold text-gray-900">Attendance & Payroll</h3>
                  <p className="text-xs text-gray-500">Salary is calculated from worked hours against the trainer&apos;s weekly schedule.</p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="month"
                    value={attendanceMonth}
                    onChange={(e) => setAttendanceMonth(e.target.value)}
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#f0813d]/20 focus:border-transparent"
                  />
                  <button
                    onClick={fetchAttendanceSummary}
                    className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50"
                    title="Refresh"
                  >
                    <RefreshCw className={`w-4 h-4 text-gray-500 ${attendanceLoading ? "animate-spin" : ""}`} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">Working Days</p>
                  <p className="mt-1 text-lg font-bold text-gray-900">{Number(attendanceData.month?.working_days || 0).toLocaleString("en-IN")}</p>
                </div>
                <div className="rounded-xl border border-[#f0813d]/10 bg-[#f0813d]/10 p-3">
                  <p className="text-xs text-[#f0813d]">Expected Hours</p>
                  <p className="mt-1 text-lg font-bold text-[#9c4400]">{formatHoursLabel(Number(attendanceData.summary?.expected_hours || 0) * 60)}</p>
                </div>
                <div className="rounded-xl border border-[#f0813d]/10 bg-[#f0813d]/10 p-3">
                  <p className="text-xs text-[#f0813d]">Worked Hours</p>
                  <p className="mt-1 text-lg font-bold text-[#9c4400]">{formatHoursLabel(Number(attendanceData.summary?.worked_hours || 0) * 60)}</p>
                </div>
                <div className="rounded-xl border border-[#f0813d]/10 bg-[#f0813d]/10 p-3">
                  <p className="text-xs text-[#f0813d]">Salary Earned</p>
                  <p className="mt-1 text-lg font-bold text-[#9c4400]">₹{Number(attendanceData.summary?.salary_earned || 0).toLocaleString("en-IN")}</p>
                </div>
                <div className="rounded-xl border border-[#f0813d]/10 bg-[#f0813d]/10 p-3">
                  <p className="text-xs text-[#f0813d]">PT Charges</p>
                  <p className="mt-1 text-lg font-bold text-[#9c4400]">₹{Number(attendanceData.summary?.pt_charges || 0).toLocaleString("en-IN")}</p>
                </div>
                <div className="rounded-xl border border-[#f0813d]/10 bg-[#f0813d]/10 p-3">
                  <p className="text-xs text-[#f0813d]">Total Payable</p>
                  <p className="mt-1 text-lg font-bold text-[#9c4400]">₹{Number(attendanceData.summary?.total_payable || 0).toLocaleString("en-IN")}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                <div className="rounded-lg bg-gray-50 px-3 py-2">
                  <span className="text-gray-500">Monthly Salary</span>
                  <p className="font-semibold text-gray-900">₹{Number(trainer.monthlySalary || 0).toLocaleString("en-IN")}</p>
                </div>
                <div className="rounded-lg bg-gray-50 px-3 py-2">
                  <span className="text-gray-500">Hourly Salary</span>
                  <p className="font-semibold text-gray-900">₹{Number(attendanceData.summary?.hourly_salary || 0).toLocaleString("en-IN")}</p>
                </div>
                <div className="rounded-lg bg-gray-50 px-3 py-2">
                  <span className="text-gray-500">PT Charges</span>
                  <p className="font-semibold text-gray-900">₹{Number(attendanceData.summary?.pt_charges || 0).toLocaleString("en-IN")}</p>
                  <p className="text-xs text-gray-500 mt-1">Taken from trainer earnings for this month</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-4 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#f0813d]/15 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-[#f0813d]" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Session Attendance</h3>
                  <p className="text-xs text-gray-500">Record Morning Session and Evening Session using check in and check out times.</p>
                </div>
              </div>

              {attendanceLoading ? (
                <div className="py-10 text-center text-gray-500">Loading attendance...</div>
              ) : (
                <div className="space-y-2 max-h-112 overflow-y-auto pr-1">
                  {(attendanceData.attendance_days || []).map((day) => (
                    <div key={day.attendance_date} className="rounded-xl border border-gray-100 px-3 py-3 space-y-3">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div>
                          <p className="font-medium text-gray-900">
                            {new Date(`${day.attendance_date}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                          </p>
                          <p className="text-xs text-gray-500">{day.weekday_name}</p>
                        </div>
                        <div className="flex gap-2 flex-wrap text-xs">
                          <span className="rounded-full bg-gray-100 px-2.5 py-1 text-gray-700">Expected {formatHoursLabel(day.expected_minutes)}</span>
                          <span className="rounded-full bg-[#f0813d]/10 px-2.5 py-1 text-[#9c4400]">Worked {formatHoursLabel(day.worked_minutes)}</span>
                          <span className="rounded-full bg-[#f0813d]/10 px-2.5 py-1 text-[#9c4400]">Salary ₹{Number(day.daily_salary || 0).toLocaleString("en-IN")}</span>
                        </div>
                      </div>

                      {(day.expected_slots || []).length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {day.expected_slots.map((slot) => (
                            <span key={slot} className="rounded-full bg-[#f0813d]/10 px-2.5 py-1 text-xs font-medium text-[#9c4400]">
                              {slot}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="grid gap-3 lg:grid-cols-2">
                        {TRAINER_ATTENDANCE_SESSIONS.map((session) => {
                          const draft = attendanceDrafts[day.attendance_date]?.[session.sessionNumber] || {
                            checkInParts: createEmptyTimeParts(),
                            checkOutParts: createEmptyTimeParts(),
                          };
                          const existingSession = (day.sessions || []).find((item) => item.session_number === session.sessionNumber);
                          return (
                            <div key={session.sessionNumber} className="rounded-xl border border-gray-200 bg-gray-50 p-3 space-y-3">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-sm font-semibold text-gray-900">{session.label}</p>
                                <span className="text-xs text-gray-500">{existingSession?.worked_minutes ? formatHoursLabel(existingSession.worked_minutes) : "0 hrs"}</span>
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                <AttendanceTimePicker
                                  label="Check In"
                                  parts={draft.checkInParts}
                                  disabled={attendanceSaving || !canCreateTrainer}
                                  onPartChange={(part, value) => updateSessionTimePart(day.attendance_date, session.sessionNumber, "checkInParts", part, value)}
                                  onClear={() => clearSessionTime(day.attendance_date, session.sessionNumber, "checkInParts")}
                                />
                                <AttendanceTimePicker
                                  label="Check Out"
                                  parts={draft.checkOutParts}
                                  disabled={attendanceSaving || !canCreateTrainer}
                                  onPartChange={(part, value) => updateSessionTimePart(day.attendance_date, session.sessionNumber, "checkOutParts", part, value)}
                                  onClear={() => clearSessionTime(day.attendance_date, session.sessionNumber, "checkOutParts")}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {canCreateTrainer && (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => resetAttendanceDay(day)}
                            disabled={attendanceSaving}
                            className="px-3 py-2 rounded-lg border border-gray-200 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                          >
                            Reset
                          </button>
                          <button
                            type="button"
                            onClick={() => saveAttendanceDay(day)}
                            disabled={attendanceSaving}
                            className="inline-flex items-center gap-2 rounded-lg bg-[#9c4400] px-3 py-2 text-xs font-medium text-white hover:bg-[#9c4400] disabled:opacity-60"
                          >
                            <Save className="w-3.5 h-3.5" />
                            Save Day
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl p-4 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#f0813d]/15 rounded-lg">
                  <Wallet className="w-5 h-5 text-[#f0813d]" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">PT Charges from Earnings</h3>
                  <p className="text-xs text-gray-500">These values come from trainer plans already assigned and paid by members.</p>
                </div>
              </div>

              {attendanceData.pt_sessions.length === 0 ? (
                <div className="rounded-xl bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
                  No trainer earnings recorded for this month.
                </div>
              ) : (
                <div className="space-y-2">
                  {attendanceData.pt_sessions.map((session) => (
                    <div key={session.id} className="rounded-xl border border-gray-100 p-3 flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-gray-900">{session.member_name}</p>
                        <p className="text-xs text-gray-500">
                          {formatDate(session.session_date)}
                          {session.plan_name ? ` • ${session.plan_name}` : ""}
                        </p>
                        {session.notes && (
                          <p className="text-sm text-gray-600 mt-1">{session.notes}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-[#9c4400]">₹{Number(session.amount || 0).toLocaleString("en-IN")}</p>
                        <p className="text-xs text-gray-500">Trainer share</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "activity" && (
          <div className="space-y-3">
            {activityLog.length === 0 ? (
              <div className="bg-white rounded-xl p-8 shadow-sm text-center">
                <Activity className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <h3 className="font-semibold text-gray-900 mb-1">No Activity Yet</h3>
                <p className="text-gray-500 text-sm">
                  Activity will appear here when the trainer assigns plans, collects payments, or gets members assigned
                </p>
              </div>
            ) : (
              activityLog.map((activity) => {
                const getActivityIcon = () => {
                  switch (activity.type) {
                    case "diet":
                      return { bg: "bg-[#f0813d]/15", icon: <Apple className="w-5 h-5 text-[#f0813d]" /> };
                    case "workout":
                      return { bg: "bg-[#f0813d]/15", icon: <Dumbbell className="w-5 h-5 text-[#f0813d]" /> };
                    case "payment":
                      return { bg: "bg-[#f0813d]/15", icon: <Wallet className="w-5 h-5 text-[#f0813d]" /> };
                    case "member_assignment":
                      return { bg: "bg-[#f0813d]/15", icon: <UserCheck className="w-5 h-5 text-[#f0813d]" /> };
                    default:
                      return { bg: "bg-gray-100", icon: <Activity className="w-5 h-5 text-gray-600" /> };
                  }
                };

                const { bg, icon } = getActivityIcon();

                return (
                  <div key={activity.id} className="bg-white rounded-xl p-4 shadow-sm">
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${bg}`}>
                        {icon}
                      </div>
                      
                      <div className="flex-1">
                        <p className="text-sm text-gray-900">
                          <span className="font-medium">{activity.action}</span>
                          {activity.details && (
                            <> - <strong>{activity.details}</strong></>
                          )}
                        </p>
                        <p className="text-xs text-gray-600 mt-0.5">
                          Member: <strong>{activity.memberName}</strong>
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {formatTimeAgo(activity.date)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Trainer Plan Modal */}
        {showPlanModal && (
          <TrainerPlanModal
            plan={editingPlan}
            gymId={selectedGym?.id}
            trainerId={trainer?.profileId}
            trainerName={trainer?.firstName || trainer?.name}
            onClose={() => { setShowPlanModal(false); setEditingPlan(null); }}
            onSave={() => {
              fetchTrainerDetails();
              setShowPlanModal(false);
              setEditingPlan(null);
            }}
          />
        )}

        {/* Unassign Confirmation Modal */}
        {unassignMember && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-[#f0813d]/15 rounded-full">
                  <UserMinus className="w-6 h-6 text-[#f0813d]" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Unassign Member</h3>
                  <p className="text-sm text-gray-500">Remove member from trainer</p>
                </div>
              </div>
              
              <p className="text-gray-600 mb-6">
                Are you sure you want to unassign <strong>{unassignMember.name}</strong> from this trainer?
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => setUnassignMember(null)}
                  className="flex-1 py-2 px-4 border border-gray-200 rounded-xl font-medium text-gray-700 hover:bg-gray-50"
                  disabled={unassigning}
                >
                  Cancel
                </button>
                <button
                  onClick={handleUnassignMember}
                  className="flex-1 py-2 px-4 bg-[#9c4400] text-white rounded-xl font-medium hover:bg-[#9c4400] disabled:opacity-50"
                  disabled={unassigning}
                >
                  {unassigning ? "Removing..." : "Unassign"}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// ─── Trainer Plan Modal (Create/Edit) ─────────────────────────
function TrainerPlanModal({ plan, gymId, trainerId, trainerName, onClose, onSave }) {
  const [formData, setFormData] = useState({
    name: plan?.name || "",
    duration: plan?.duration_days || "",
    price: plan?.price || "",
    active: plan?.is_active ?? true,
    description: plan?.description || "",
  });
  const [saving, setSaving] = useState(false);
  const [durationUnit, setDurationUnit] = useState("months");

  const presets = [
    { label: "1 Month", value: 1 },
    { label: "3 Months", value: 3 },
    { label: "6 Months", value: 6 },
    { label: "1 Year", value: 12 },
  ];

  useEffect(() => {
    if (plan?.duration_days) {
      if (plan.duration_days % 30 === 0) {
        setDurationUnit("months");
        setFormData((prev) => ({ ...prev, duration: Math.round(plan.duration_days / 30) }));
      } else if (plan.duration_days % 7 === 0) {
        setDurationUnit("weeks");
        setFormData((prev) => ({ ...prev, duration: Math.round(plan.duration_days / 7) }));
      } else {
        setDurationUnit("days");
      }
    }
  }, [plan]);

  const updateForm = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const calculateDays = (value, unit) => {
    const num = parseInt(value);
    if (isNaN(num) || num <= 0) return 0;
    if (unit === "months") return num * 30;
    if (unit === "weeks") return num * 7;
    return num;
  };

  const selectPreset = (preset) => {
    setDurationUnit("months");
    setFormData((prev) => ({
      ...prev,
      duration: preset.value,
      name: prev.name || `${preset.label} Training`,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.duration || !formData.price) {
      alert("Please fill all required fields");
      return;
    }
    const durationInDays = calculateDays(formData.duration, durationUnit);
    if (durationInDays <= 0) {
      alert("Duration must be greater than 0");
      return;
    }

    try {
      setSaving(true);
      if (plan) {
        const { error } = await supabase
          .from("trainer_plans")
          .update({
            name: formData.name.trim(),
            duration_days: durationInDays,
            price: parseFloat(formData.price),
            is_active: formData.active,
            description: formData.description.trim(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", plan.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("trainer_plans").insert({
          gym_id: gymId,
          trainer_id: trainerId,
          name: formData.name.trim(),
          duration_days: durationInDays,
          price: parseFloat(formData.price),
          is_active: formData.active,
          description: formData.description.trim(),
        });
        if (error) throw error;
      }
      onSave();
    } catch (error) {
      console.error("Error saving trainer plan:", error);
      alert("Failed to save plan: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className=" mb-15 fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center px-0 pb-[env(safe-area-inset-bottom,0px)] sm:p-4">
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl max-h-[85vh] sm:max-h-[90vh] overflow-hidden shadow-2xl animate-slide-up flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 bg-white z-10 shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-gray-900">
                {plan ? "Edit Plan" : "Create Plan"}
              </h3>
              <p className="text-gray-500 text-xs mt-0.5">
                {plan ? `Update plan for ${trainerName}` : `New plan for ${trainerName}`}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors active:scale-95"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="overflow-y-auto flex-1 min-h-0 p-4">
          <div className="space-y-4">
            {/* Quick Duration Presets */}
            {!plan && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Quick Select
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {presets.map((preset) => {
                    const isSelected =
                      durationUnit === "months" &&
                      parseInt(formData.duration) === preset.value;
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => selectPreset(preset)}
                        className={`py-2.5 px-2 rounded-xl text-xs font-medium transition-all duration-200 border-2 flex flex-col items-center gap-0.5 ${
                          isSelected
                            ? "border-[#f0813d] bg-[#f0813d]/10 text-[#9c4400] shadow-sm"
                            : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                        }`}
                      >
                        <Calendar
                          className={`w-3.5 h-3.5 ${
                            isSelected ? "text-[#f0813d]" : "text-gray-400"
                          }`}
                        />
                        <span>{preset.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Plan Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Plan Name *
              </label>
              <input
                type="text"
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#f0813d]/20 focus:border-[#f0813d] outline-none transition-all text-sm"
                placeholder="e.g., 1 Month Training, Quarterly PT"
                value={formData.name}
                onChange={(e) => updateForm("name", e.target.value)}
                required
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Description
              </label>
              <textarea
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#f0813d]/20 focus:border-[#f0813d] outline-none transition-all resize-none text-sm"
                placeholder="What's included in this plan..."
                rows={2}
                value={formData.description}
                onChange={(e) => updateForm("description", e.target.value)}
              />
            </div>

            {/* Duration & Price */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Duration *
                </label>
                <div className="space-y-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#f0813d]/20 focus:border-[#f0813d] outline-none transition-all text-sm"
                    placeholder="e.g., 1"
                    value={formData.duration}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === "" || /^\d+$/.test(v))
                        updateForm("duration", v === "" ? "" : parseInt(v));
                    }}
                    required
                  />
                  <select
                    value={durationUnit}
                    onChange={(e) => setDurationUnit(e.target.value)}
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#f0813d]/20 focus:border-[#f0813d] outline-none transition-all text-sm"
                  >
                    <option value="days">Days</option>
                    <option value="weeks">Weeks</option>
                    <option value="months">Months</option>
                  </select>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {durationUnit === "days" && `${formData.duration || 0} days`}
                  {durationUnit === "weeks" &&
                    `${formData.duration || 0} wks (${(formData.duration || 0) * 7} days)`}
                  {durationUnit === "months" &&
                    `${formData.duration || 0} mo (${(formData.duration || 0) * 30} days)`}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Price (₹) *
                </label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                    <IndianRupee className="w-4 h-4 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    inputMode="decimal"
                    pattern="[0-9]*\.?[0-9]*"
                    className="w-full pl-9 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#f0813d]/20 focus:border-[#f0813d] outline-none transition-all text-sm"
                    placeholder="e.g., 3000"
                    value={formData.price}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === "" || /^\d*\.?\d*$/.test(v))
                        updateForm("price", v === "" ? "" : parseFloat(v));
                    }}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Status Toggle */}
            <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-900 text-sm">Status</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {formData.active ? "Available for assigning" : "Hidden from assignments"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => updateForm("active", !formData.active)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    formData.active ? "bg-[#f0813d]" : "bg-gray-300"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      formData.active ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
          </div>

          {/* Actions - sticky footer */}
          <div className="flex gap-3 p-4 pb-8 border-t border-gray-200 bg-white shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-gray-100 text-gray-700 font-medium rounded-xl active:scale-95 transition-all text-sm"
              disabled={saving}
              style={{ minHeight: "44px" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-3 bg-gradient-to-r from-[#f0813d] to-[#9c4400] text-white font-medium rounded-xl hover:shadow-lg active:scale-95 transition-all text-sm disabled:opacity-50"
              disabled={saving}
              style={{ minHeight: "44px" }}
            >
              {saving ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  {plan ? "Saving..." : "Creating..."}
                </span>
              ) : (
                plan ? "Save Changes" : "Create Plan"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
