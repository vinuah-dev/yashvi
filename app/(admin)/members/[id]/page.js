"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import MemberPointsSection from "@/components/shared/MemberPointsSection";
import Header from "@/components/layout/Header";
import RenewMembershipModal from "@/components/shared/RenewMembershipModal";
import RenewalHistoryModal from "@/components/shared/RenewalHistoryModal";
import ResolvePendingPaymentModal from "@/components/shared/ResolvePendingPaymentModal";
import AssignDietPlanModal from "@/components/shared/AssignDietPlanModal";
import AssignWorkoutPlanModal from "@/components/shared/AssignWorkoutPlanModal";
import AssignTrainerModal from "@/components/shared/AssignTrainerModal";
import AssignAmenityModal from "@/components/shared/AssignAmenityModal";
import ProfileImageUpload from "@/components/shared/ProfileImageUpload";
import {
  Phone,
  Mail,
  Calendar,
  CheckCircle,
  AlertTriangle,
  Clock,
  Users,
  DollarSign,
  CreditCard,
  Key,
  RefreshCw,
  FileText,
  BarChart3,
  Trash2,
  Edit,
  MessageCircle,
  PhoneCall,
  Shield,
  Plus,
  ChevronRight,
  Download,
  Eye,
  MoreVertical,
  ChevronLeft,
  Building,
  History,
  Utensils,
  Dumbbell,
  Apple,
  Edit2,
  Trash2 as TrashIcon,
  Eye as EyeIcon,
  Package,
  Star,
} from "lucide-react";
import { useToast } from "@/contexts/ToastContext";
import { useUserRole } from "@/lib/hooks/useUserRole";

export default function MemberDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { isTrainer, canWrite, isViewOnly, user } = useUserRole();
  const [activeTab, setActiveTab] = useState("overview");
  const [showRenewModal, setShowRenewModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showResolvePaymentModal, setShowResolvePaymentModal] = useState(false);
  const [showAssignDietModal, setShowAssignDietModal] = useState(false);
  const [showAssignWorkoutModal, setShowAssignWorkoutModal] = useState(false);
  const [showAssignTrainerModal, setShowAssignTrainerModal] = useState(false);
  const [showAssignAmenityModal, setShowAssignAmenityModal] = useState(false);
  const [selectedPendingPayment, setSelectedPendingPayment] = useState(null);
  const [member, setMember] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedGym, setSelectedGym] = useState(null);
  const [nextPaymentInfo, setNextPaymentInfo] = useState(null);
  const [renewalHistory, setRenewalHistory] = useState([]);
  const [pendingPayments, setPendingPayments] = useState([]);
  const [assignedDietPlans, setAssignedDietPlans] = useState([]);
  const [assignedWorkoutPlans, setAssignedWorkoutPlans] = useState([]);
  const [assignedTrainer, setAssignedTrainer] = useState(null);
  const [trainerHistory, setTrainerHistory] = useState([]);
  const [trainerHistoryLoading, setTrainerHistoryLoading] = useState(false);
  const [trainerAssignMode, setTrainerAssignMode] = useState("default");
  const [editingDietPlan, setEditingDietPlan] = useState(null);
  const { showSuccess, showError } = useToast();

  useEffect(() => {
    const storedGym = localStorage.getItem("selectedGym");
    if (storedGym) {
      const gym = JSON.parse(storedGym);
      setSelectedGym(gym);
      fetchMemberDetails(params.id, gym.id);
    } else {
      setLoading(false);
    }
  }, [params.id]);

  const fetchTrainerHistory = async (memberId) => {
    try {
      const raw = localStorage.getItem("gymUser");
      if (!raw) return;
      const userId = JSON.parse(raw)?.id;
      if (!userId) return;
      setTrainerHistoryLoading(true);
      const res = await fetch(
        `/api/member/${memberId}/trainer-history?p_user_id=${encodeURIComponent(userId)}`
      );
      const json = await res.json();
      if (res.ok && json.data?.assignments) {
        setTrainerHistory(json.data.assignments);
      }
    } catch (e) {
      console.error("fetchTrainerHistory:", e);
    } finally {
      setTrainerHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (params.id && selectedGym?.id) {
      fetchTrainerHistory(params.id);
    }
  }, [params.id, selectedGym?.id]);

  const fetchMemberDetails = async (memberId, gymId) => {
    setLoading(true);
    try {
      // Single RPC call replaces 7-8 separate queries
      // Use same-origin API proxy to avoid CORS issues, fallback to direct Supabase
      let result, error;
      try {
        const res = await fetch('/api/members/details', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ p_member_id: memberId, p_gym_id: gymId }),
        });
        const json = await res.json();
        if (!res.ok) {
          error = { message: json.error };
        } else {
          result = json.data;
        }
      } catch (apiErr) {
        console.warn("API proxy failed, falling back to direct Supabase:", apiErr);
        const rpcResult = await supabase.rpc('get_member_details', {
          p_member_id: memberId,
          p_gym_id: gymId
        });
        result = rpcResult.data;
        error = rpcResult.error;
      }

      if (error || result?.error) {
        console.error("Error fetching member:", error || result?.error);
        setLoading(false);
        return;
      }

      const memberData = result.member;
      const membershipsData = result.memberships || [];
      const paymentsData = result.payments || [];
      const attendanceData = result.attendance || [];
      const dietPlansData = result.diet_plans || [];
      const workoutPlansData = result.workout_plans || [];
      const trainerData = result.trainer;
      const trainerScheduleData = result.trainer_schedule || [];
      const nextPaymentData = result.next_payment;

      const sortedMemberships = [...membershipsData].sort((a, b) => {
        const aEndDate = new Date(a.end_date || 0).getTime();
        const bEndDate = new Date(b.end_date || 0).getTime();
        if (bEndDate !== aEndDate) {
          return bEndDate - aEndDate;
        }

        const aStartDate = new Date(a.start_date || 0).getTime();
        const bStartDate = new Date(b.start_date || 0).getTime();
        if (bStartDate !== aStartDate) {
          return bStartDate - aStartDate;
        }

        const aCreatedDate = new Date(a.created_at || 0).getTime();
        const bCreatedDate = new Date(b.created_at || 0).getTime();
        return bCreatedDate - aCreatedDate;
      });

      // Use the latest membership by end_date as the source of truth for validity.
      const latestMembership = sortedMemberships[0] || null;

      let memberStatus = "inactive";
      if (latestMembership?.end_date) {
        const endDate = new Date(latestMembership.end_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (!Number.isNaN(endDate.getTime())) {
          endDate.setHours(0, 0, 0, 0);
          memberStatus = endDate >= today ? "active" : "expired";
        } else {
          memberStatus = "expired";
        }
      }

      // Calculate days remaining
      let daysRemaining = null;
      if (latestMembership?.end_date) {
        const endDate = new Date(latestMembership.end_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (!Number.isNaN(endDate.getTime())) {
          endDate.setHours(0, 0, 0, 0);
          daysRemaining = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
        }
      }

      const totalPaid = paymentsData
        .filter((payment) => payment.status === "paid")
        .reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);

      const latestMembershipForFinancials = sortedMemberships[0] || null;
      const latestMembershipTotalAmount = latestMembershipForFinancials
        ? Number(
            latestMembershipForFinancials.custom_price ??
            latestMembershipForFinancials.total_amount ??
            latestMembershipForFinancials.membership_plans?.price ??
            0
          )
        : 0;
      const latestMembershipPaidAmount = latestMembershipForFinancials
        ? paymentsData
            .filter(
              (payment) =>
                payment.status === "paid" &&
                payment.membership_id === latestMembershipForFinancials.id
            )
            .reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0)
        : 0;
      const latestMembershipDueAmount = Math.max(
        0,
        latestMembershipTotalAmount - latestMembershipPaidAmount
      );
      const storedMemberBalance = Math.max(0, Number(memberData.balance || 0));
      const resolvedProfileDueAmount = latestMembershipForFinancials
        ? latestMembershipDueAmount
        : storedMemberBalance;

      const latestAdminNote = paymentsData
        .find((payment) => typeof payment.notes === "string" && payment.notes.trim().length > 0)?.notes?.trim() || "";

      const transformedMember = {
        id: memberData.id,
        gymId: memberData.gym_id,
        name: memberData.full_name,
        email: memberData.email || "",
        phone: memberData.phone,
        profileImage: memberData.profile_image || null,
        joinDate: memberData.join_date
          ? new Date(memberData.join_date + 'T00:00:00').toLocaleDateString("en-IN")
          : new Date(memberData.created_at).toLocaleDateString("en-IN"),
        createdByName: memberData.created_by_name || null,
        points: memberData.points || 0,
        plan: latestMembership?.membership_plans?.name || "No Plan",
        planPrice: latestMembershipTotalAmount,
        status: memberStatus,
        validTill: latestMembership?.end_date
          ? new Date(latestMembership.end_date).toLocaleDateString("en-IN")
          : "N/A",
        daysRemaining: daysRemaining,
        dueAmount: resolvedProfileDueAmount,
        balance: resolvedProfileDueAmount,
        totalPaid: latestMembershipForFinancials ? latestMembershipPaidAmount : totalPaid,
        adminNote: latestAdminNote,
        attendance: attendanceData.map(a => ({
          date: new Date(a.check_in_date).toLocaleDateString("en-IN"),
          checkIn: a.check_in_time,
          checkOut: a.check_out_time || "-"
        })),
        payments: paymentsData
          .filter((p) => p.status === "paid")
          .map(p => ({
          id: p.id,
          date: new Date(p.paid_at || p.created_at).toLocaleDateString("en-IN"),
          amount: p.amount,
          type: p.membership_id ? "Membership" : "Trainer",
          status: p.status,
          membership_id: p.membership_id || null,
          payment_mode: p.payment_mode,
          notes: p.notes || "",
          created_at: p.created_at
        }))
      };

      setMember(transformedMember);

      // Pending payments
      const pending = paymentsData.filter(p => p.status === "pending").map(p => ({
        id: p.id,
        amount: p.amount,
        created_at: p.created_at,
        membership_id: p.membership_id
      }));
      setPendingPayments(pending);

      // Renewal history
      const history = sortedMemberships.map(m => {
        const planPrice = m.membership_plans?.price || 0;
        const customPrice = m.custom_price ?? null;
        const actualPrice = Number(m.custom_price ?? m.total_amount ?? planPrice ?? 0);

        const membershipPayments = paymentsData
          .filter((p) => p.membership_id === m.id && p.status === "paid")
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        const paymentAmount = membershipPayments.reduce(
          (sum, payment) => sum + Number(payment.amount || 0),
          0
        );
        const dueAmount = Math.max(0, actualPrice - paymentAmount);
        const renewalEventDate = m.start_date
          ? `${m.start_date}T00:00:00`
          : (membershipPayments[0]?.paid_at || m.created_at);

        return {
          paymentId: membershipPayments[0]?.id || null,
          membershipId: m.id,
          planName: m.membership_plans?.name || "Unknown",
          duration: m.membership_plans?.duration_days || 0,
          planPrice,
          customPrice,
          price: actualPrice,
          paymentAmount,
          dueAmount,
          paymentMode: membershipPayments[0]?.payment_mode || "cash",
          notes: "",
          newEndDate: m.end_date,
          renewedAt: renewalEventDate,
        };
      });
      setRenewalHistory(history);

      // Diet plans
      setAssignedDietPlans(dietPlansData.map(d => ({
        id: d.id,
        planId: d.diet_plans?.id,
        title: d.diet_plans?.title || "Unknown Plan",
        description: d.diet_plans?.description,
        assignedAt: d.assigned_at,
        isCustom: !!d.diet_plans?.member_id,
        isTemplate: d.diet_plans?.is_template
      })));

      // Workout plans
      setAssignedWorkoutPlans(workoutPlansData.map(w => ({
        id: w.id,
        planId: w.workout_plans?.id,
        title: w.workout_plans?.title || "Unknown Plan",
        description: w.workout_plans?.description,
        assignedAt: w.assigned_at,
        isCustom: !!w.workout_plans?.member_id
      })));

      // Trainer
      if (trainerData) {
        let trainerPlanDaysRemaining = null;
        if (trainerData.plan_end_date) {
          const endDate = new Date(trainerData.plan_end_date);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          endDate.setHours(0, 0, 0, 0);
          trainerPlanDaysRemaining = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
        }

        // Process trainer schedule from RPC data
        let trainerSchedule = [];
        if (trainerScheduleData.length > 0) {
          const grouped = {};
          const dayOrder = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
          trainerScheduleData.forEach((b) => {
            if (!grouped[b.day]) grouped[b.day] = [];
            grouped[b.day].push(b.time_slot);
          });
          trainerSchedule = dayOrder
            .filter(d => grouped[d])
            .map(d => ({ day: d, slots: grouped[d] }));
        }

        setAssignedTrainer({
          assignmentId: trainerData.assignment_id,
          trainerId: trainerData.trainer_id,
          name: `${trainerData.first_name || ""} ${trainerData.last_name || ""}`.trim(),
          phone: trainerData.phone,
          planName: trainerData.plan_name || null,
          planEndDate: trainerData.plan_end_date,
          planStartDate: trainerData.plan_start_date,
          trainerPlanId: trainerData.trainer_plan_id,
          planTotalAmount: Number(trainerData.plan_total_amount || 0),
          totalPaidAmount: Number(trainerData.total_paid_amount || 0),
          pendingAmount: Number(trainerData.pending_amount || 0),
          nextPaymentDate: trainerData.next_payment_date || null,
          trainerPlanDaysRemaining: trainerPlanDaysRemaining,
          schedule: trainerSchedule,
        });
      } else {
        setAssignedTrainer(null);
      }

      // Next payment info
      if (nextPaymentData) {
        setNextPaymentInfo({
          nextPaymentDate: nextPaymentData.next_payment_date,
          remainingAmount: nextPaymentData.remaining_amount
        });
      }

    } catch (err) {
      console.error("Error:", err);
    }
    setLoading(false);
  };

  // Individual fetch functions for refresh after assign/remove operations
  const fetchAssignedDietPlans = async (memberId) => {
    try {
      const { data, error } = await supabase
        .from("member_diets")
        .select(`id, assigned_at, diet_plans (id, title, description, member_id, is_template)`)
        .eq("member_id", memberId)
        .order("assigned_at", { ascending: false });

      if (!error && data) {
        setAssignedDietPlans(data.map(d => ({
          id: d.id,
          planId: d.diet_plans?.id,
          title: d.diet_plans?.title || "Unknown Plan",
          description: d.diet_plans?.description,
          assignedAt: d.assigned_at,
          isCustom: !!d.diet_plans?.member_id,
          isTemplate: d.diet_plans?.is_template
        })));
      }
    } catch (err) {
      console.error("Error fetching diet plans:", err);
    }
  };

  const fetchAssignedWorkoutPlans = async (memberId) => {
    try {
      const { data, error } = await supabase
        .from("member_workouts")
        .select(`id, assigned_at, workout_plans (id, title, description, member_id)`)
        .eq("member_id", memberId)
        .order("assigned_at", { ascending: false });

      if (!error && data) {
        setAssignedWorkoutPlans(data.map(w => ({
          id: w.id,
          planId: w.workout_plans?.id,
          title: w.workout_plans?.title || "Unknown Plan",
          description: w.workout_plans?.description,
          assignedAt: w.assigned_at,
          isCustom: !!w.workout_plans?.member_id
        })));
      }
    } catch (err) {
      console.error("Error fetching workout plans:", err);
    }
  };

  const fetchAssignedTrainer = async (memberId, gymId) => {
    try {
      const { data, error } = await supabase
        .from("trainer_member_assignments")
        .select(`
          id,
          trainer_id,
          plan_end_date,
          plan_start_date,
          trainer_plan_id,
          plan_total_amount,
          total_paid_amount,
          pending_amount,
          next_payment_date,
          profiles:trainer_id (id, first_name, last_name, phone),
          trainer_plans:trainer_plan_id (id, name)
        `)
        .eq("member_id", memberId)
        .eq("is_active", true)
        .maybeSingle();

      if (!error && data) {
        let trainerPlanDaysRemaining = null;
        if (data.plan_end_date) {
          const endDate = new Date(data.plan_end_date);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          endDate.setHours(0, 0, 0, 0);
          trainerPlanDaysRemaining = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
        }

        let trainerSchedule = [];
        const resolvedGymId = gymId || selectedGym?.id;
        if (resolvedGymId) {
          const { data: bookingsData } = await supabase
            .from("trainer_bookings")
            .select("day, time_slot")
            .eq("member_id", memberId)
            .eq("gym_id", resolvedGymId)
            .eq("is_active", true)
            .order("day");

          if (bookingsData && bookingsData.length > 0) {
            const grouped = {};
            const dayOrder = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
            bookingsData.forEach((b) => {
              if (!grouped[b.day]) grouped[b.day] = [];
              grouped[b.day].push(b.time_slot);
            });
            trainerSchedule = dayOrder
              .filter(d => grouped[d])
              .map(d => ({ day: d, slots: grouped[d] }));
          }
        }

        setAssignedTrainer({
          assignmentId: data.id,
          trainerId: data.trainer_id,
          name: `${data.profiles?.first_name || ""} ${data.profiles?.last_name || ""}`.trim(),
          phone: data.profiles?.phone,
          planName: data.trainer_plans?.name || null,
          planEndDate: data.plan_end_date,
          planStartDate: data.plan_start_date,
          trainerPlanId: data.trainer_plan_id,
          planTotalAmount: Number(data.plan_total_amount || 0),
          totalPaidAmount: Number(data.total_paid_amount || 0),
          pendingAmount: Number(data.pending_amount || 0),
          nextPaymentDate: data.next_payment_date || null,
          trainerPlanDaysRemaining: trainerPlanDaysRemaining,
          schedule: trainerSchedule,
        });
      } else {
        setAssignedTrainer(null);
      }
    } catch (err) {
      console.error("Error fetching assigned trainer:", err);
    }
  };

  const handleRemoveDietPlan = async (assignmentId) => {
    if (!window.confirm("Are you sure you want to remove this diet plan from the member?")) {
      return;
    }

    try {
      const { error } = await supabase
        .from("member_diets")
        .delete()
        .eq("id", assignmentId);

      if (error) throw error;

      showSuccess("Diet plan removed successfully");
      fetchAssignedDietPlans(member.id);
    } catch (err) {
      console.error("Error removing diet plan:", err);
      showError("Failed to remove diet plan");
    }
  };

  const handleRemoveWorkoutPlan = async (assignmentId) => {
    if (!window.confirm("Are you sure you want to remove this workout plan from the member?")) {
      return;
    }

    try {
      const { error } = await supabase
        .from("member_workouts")
        .delete()
        .eq("id", assignmentId);

      if (error) throw error;

      showSuccess("Workout plan removed successfully");
      fetchAssignedWorkoutPlans(member.id);
    } catch (err) {
      console.error("Error removing workout plan:", err);
      showError("Failed to remove workout plan");
    }
  };

  const handleDeleteMember = async () => {
    const confirmDelete = window.confirm(
      `Are you sure you want to delete ${member.name}? This action cannot be undone. All associated data including memberships, payments, and attendance records will be permanently deleted.`
    );
    
    if (!confirmDelete) return;

    try {
      const { error } = await supabase
        .from("members")
        .delete()
        .eq("id", member.id);

      if (error) {
        throw error;
      }

      showSuccess("Member deleted successfully!");
      router.push("/members");
    } catch (error) {
      console.error("Error deleting member:", error);
      showError("Failed to delete member. Please try again.");
    }
  };

  const getStatusConfig = (status) => {
    switch (status) {
      case "active":
        return {
          color: "bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200",
          text: "text-[#f0813d]",
          dot: "bg-[#f0813d]",
          label: "Active",
          icon: <CheckCircle className="w-3.5 h-3.5" />
        };
      case "expired":
        return {
          color: "bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200",
          text: "text-[#f0813d]",
          dot: "bg-[#f0813d]",
          label: "Expired",
          icon: <Clock className="w-3.5 h-3.5" />
        };
      case "inactive":
        return {
          color: "bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200",
          text: "text-gray-700",
          dot: "bg-gray-500",
          label: "Inactive",
          icon: <AlertTriangle className="w-3.5 h-3.5" />
        };
      default:
        return {
          color: "bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200",
          text: "text-gray-700",
          dot: "bg-gray-500",
          label: "Inactive",
          icon: <AlertTriangle className="w-3.5 h-3.5" />
        };
    }
  };

  const handleRenewal = (renewalData) => {
    setRenewalHistory((prev) => [renewalData, ...prev]);
    setShowRenewModal(false);
    if (selectedGym) {
      fetchMemberDetails(params.id, selectedGym.id);
    }
    showSuccess("Membership renewed successfully!");
  };

  const handlePaymentResolved = () => {
    if (selectedGym) {
      fetchMemberDetails(params.id, selectedGym.id);
    }
  };

  const handleResolvePendingPayment = (payment) => {
    setSelectedPendingPayment(payment);
    setShowResolvePaymentModal(true);
  };

  const handleUpdatePaymentAmount = async (payment) => {
    if (!payment?.id) return;

    if ((payment.status || "").toLowerCase() !== "paid") {
      showError("Only paid payments can be edited");
      return;
    }

    const input = window.prompt("Enter updated payment amount", String(payment.amount || ""));
    if (input === null) return;

    const updatedAmount = Number(input);
    if (!Number.isFinite(updatedAmount) || updatedAmount <= 0) {
      showError("Please enter a valid amount");
      return;
    }

    if (Math.abs(updatedAmount - Number(payment.amount || 0)) < 0.0001) {
      return;
    }

    try {
      const { error: updatePaymentError } = await supabase
        .from("payments")
        .update({ amount: updatedAmount })
        .eq("id", payment.id);

      if (updatePaymentError) throw updatePaymentError;

      if (payment.membership_id) {
        const { data: membershipRow, error: membershipError } = await supabase
          .from("memberships")
          .select(`
            id,
            member_id,
            total_amount,
            custom_price,
            membership_plans (
              price
            )
          `)
          .eq("id", payment.membership_id)
          .maybeSingle();

        if (!membershipError && membershipRow?.id) {
          const membershipTotal = Number(
            membershipRow.total_amount ||
            membershipRow.custom_price ||
            membershipRow.membership_plans?.price ||
            0
          );

          const { data: membershipPaidRows, error: membershipPaidError } = await supabase
            .from("payments")
            .select("amount")
            .eq("membership_id", membershipRow.id)
            .eq("status", "paid");

          if (!membershipPaidError) {
            const membershipPaid = (membershipPaidRows || []).reduce(
              (sum, row) => sum + Number(row.amount || 0),
              0
            );
            const membershipDue = Math.max(0, membershipTotal - membershipPaid);

            await supabase
              .from("memberships")
              .update({ due_amount: membershipDue })
              .eq("id", membershipRow.id);

            const { data: latestMembershipRows, error: latestMembershipError } = await supabase
              .from("memberships")
              .select(`
                id,
                total_amount,
                custom_price,
                membership_plans (
                  price
                )
              `)
              .eq("member_id", membershipRow.member_id)
              .order("end_date", { ascending: false })
              .order("start_date", { ascending: false })
              .order("created_at", { ascending: false })
              .limit(1);

            if (!latestMembershipError) {
              const latestMembership = latestMembershipRows?.[0] || null;
              let latestDue = 0;

              if (latestMembership?.id) {
                const latestTotal = Number(
                  latestMembership.total_amount ||
                  latestMembership.custom_price ||
                  latestMembership.membership_plans?.price ||
                  0
                );

                const { data: latestPaidRows, error: latestPaidError } = await supabase
                  .from("payments")
                  .select("amount")
                  .eq("membership_id", latestMembership.id)
                  .eq("status", "paid");

                if (!latestPaidError) {
                  const latestPaid = (latestPaidRows || []).reduce(
                    (sum, row) => sum + Number(row.amount || 0),
                    0
                  );
                  latestDue = Math.max(0, latestTotal - latestPaid);
                }
              }

              await supabase
                .from("members")
                .update({ balance: latestDue })
                .eq("id", membershipRow.member_id);
            }
          }
        }
      }

      showSuccess("Payment amount updated");
      if (selectedGym?.id) {
        fetchMemberDetails(params.id, selectedGym.id);
      }
    } catch (error) {
      console.error("Error updating payment amount:", error);
      showError("Failed to update payment amount");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
        <Header title="Member Details" />
        <main className="px-3 py-3">
          <div className="flex items-center justify-center py-12">
            <div className="relative">
              <div className="w-14 h-14 border-4 border-[#f0813d]/20 border-t-[#f0813d] rounded-full animate-spin"></div>
              <div className="absolute inset-0 w-14 h-14 border-4 border-transparent border-t-[#f0813d] rounded-full animate-spin animation-delay-200"></div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!member) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
        <Header title="Member Details" />
        <main className="px-3 py-3">
          <div className="text-center py-12">
            <div className="w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Users className="w-10 h-10 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Member Not Found</h3>
            <p className="text-gray-500 text-center mb-6 max-w-sm mx-auto">
              The member you&apos;re looking for doesn&apos;t exist or has been removed.
            </p>
            <button
              onClick={() => router.push("/members")}
              className="px-6 py-3 bg-gradient-to-r from-[#f0813d] to-[#f0813d] text-white font-medium rounded-lg hover:shadow-lg transition-all duration-300 flex items-center gap-2 mx-auto"
            >
              <ChevronLeft className="w-4 h-4" />
              Back to Members
            </button>
          </div>
        </main>
      </div>
    );
  }

  const statusConfig = getStatusConfig(member.status);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 mb-17">
      <Header title="Member Details" />

      <main className="px-3 py-3 space-y-4">
        {/* Profile Header */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <div className="flex items-center gap-4 mb-4">
            <div className="shrink-0 self-start">
              <ProfileImageUpload
                currentImage={member.profileImage}
                onImageChange={(url) => setMember(prev => ({ ...prev, profileImage: url }))}
                memberId={member.id}
                size="lg"
                editable={true}
                showHint={false}
                align="left"
              />
            </div>
            <div className="flex-1 min-w-0 self-center">
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-gray-900 leading-tight wrap-break-word">
                  {member.name}
                </h2>
                <div className={`inline-flex px-2.5 py-1 rounded-lg border ${statusConfig.color} ${statusConfig.text} items-center gap-1.5`}>
                  {statusConfig.icon}
                  <span className="text-xs font-medium">{statusConfig.label}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-3 min-w-0">
                <Phone className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <span className="text-gray-600 text-sm min-w-0">{member.phone}</span>
              </div>
              {member.email && (
                <div className="flex items-center gap-2 mt-2 min-w-0">
                  <Mail className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  <span className="text-gray-600 text-sm break-all">{member.email}</span>
                </div>
              )}
            </div>
          </div>

          {/* Quick Statss */}
          <div className="grid grid-cols-3 gap-3 pt-4 border-t border-gray-100">
            <div className="text-center">
              <p className="text-lg font-bold text-gray-900">{member.plan}</p>
              <p className="text-xs text-gray-500">Current Plan</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-gray-900">
                {member.attendance.length}
              </p>
              <p className="text-xs text-gray-500">This Month</p>
            </div>
            <div className="text-center">
              <p className={`text-lg font-bold ${member.dueAmount > 0 ? "text-[#f0813d]" : "text-[#f0813d]"}`}>
                ₹{member.dueAmount}
              </p>
              <p className="text-xs text-gray-500">Due Amount</p>
            </div>
          </div>

          {member.adminNote && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="flex items-start gap-3 rounded-xl bg-orange-50 border border-orange-100 p-3">
                <div className="w-9 h-9 rounded-lg bg-orange-100 flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#f0813d] mb-1">
                    Admin Note
                  </p>
                  <p className="text-sm text-gray-700 leading-6 whitespace-pre-wrap wrap-break-word">
                    {member.adminNote}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Scheduled Membership Alert */}
        {/* Pending Payments Alert */}
       

        {/* Due Amount Alert */}
        {assignedTrainer?.pendingAmount > 0 && (
          <div className="bg-gradient-to-r from-orange-50 to-orange-50 border border-orange-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-[#f0813d] to-[#f0813d] rounded-lg flex items-center justify-center shrink-0">
                <Users className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-gray-900 mb-1">
                  Trainer Installment Pending
                </h4>
                <p className="text-sm text-gray-600 mb-3">
                  ₹{Number(assignedTrainer.pendingAmount || 0).toLocaleString("en-IN")} left for trainer installment collection.
                </p>
                <div className="bg-white rounded-lg p-4 border border-orange-200">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-[11px] text-gray-500 uppercase tracking-wide">Paid</p>
                      <p className="mt-1 text-sm font-bold text-[#f0813d]">₹{Number(assignedTrainer.totalPaidAmount || 0).toLocaleString("en-IN")}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-gray-500 uppercase tracking-wide">Due</p>
                      <p className="mt-1 text-sm font-bold text-[#f0813d]">₹{Number(assignedTrainer.pendingAmount || 0).toLocaleString("en-IN")}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-gray-500 uppercase tracking-wide">Plan</p>
                      <p className="mt-1 text-sm font-bold text-gray-900">₹{Number(assignedTrainer.planTotalAmount || 0).toLocaleString("en-IN")}</p>
                    </div>
                  </div>
                  {assignedTrainer.nextPaymentDate && (
                    <div className="mt-3 p-3 bg-gradient-to-r from-orange-50 to-orange-50 border border-orange-200 rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <Calendar className="w-4 h-4 text-[#f0813d]" />
                        <p className="text-sm font-semibold text-orange-800">Next Trainer Due</p>
                      </div>
                      <p className="text-sm text-[#f0813d]">
                        Collect on <span className="font-bold">{new Date(`${assignedTrainer.nextPaymentDate}T00:00:00`).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric"
                        })}</span>
                      </p>
                    </div>
                  )}
                  <button
                    onClick={() => setShowAssignTrainerModal(true)}
                    className="w-full mt-3 px-4 py-3 bg-gradient-to-r from-[#f0813d] to-[#f0813d] text-white font-semibold rounded-lg hover:shadow-lg transition-all duration-300"
                  >
                    Collect Trainer Installment
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {member.dueAmount > 0 && (
          <div className="bg-gradient-to-r from-orange-50 to-orange-50 border border-orange-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-[#f0813d] to-[#f0813d] rounded-lg flex items-center justify-center flex-shrink-0">
                <DollarSign className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-gray-900 mb-1">
                  Outstanding Balance
                </h4>
                <p className="text-sm text-gray-600 mb-3">
                  This member has an outstanding balance that needs to be collected.
                </p>
                <div className="bg-white rounded-lg p-4 border border-orange-200">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-sm text-gray-500">Total Due Amount</p>
                      <p className="text-2xl font-bold text-[#f0813d]">₹{member.dueAmount}</p>
                    </div>
                  </div>
                  {/* Next Payment Date Display */}
                  {nextPaymentInfo && nextPaymentInfo.nextPaymentDate && (
                    <div className="mb-3 p-3 bg-gradient-to-r from-orange-50 to-orange-50 border border-orange-200 rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <Calendar className="w-4 h-4 text-[#f0813d]" />
                        <p className="text-sm font-semibold text-orange-800">Next Payment Due</p>
                      </div>
                      <p className="text-sm text-[#f0813d]">
                        ₹{nextPaymentInfo.remainingAmount} to be paid on{" "}
                        <span className="font-bold">
                          {new Date(nextPaymentInfo.nextPaymentDate).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric"
                          })}
                        </span>
                      </p>
                    </div>
                  )}
                  <button
                    onClick={() => router.push(`/members/${member.id}/payment`)}
                    className="w-full px-4 py-3 bg-gradient-to-r from-[#f0813d] to-[#f0813d] text-white font-semibold rounded-lg hover:shadow-lg transition-all duration-300"
                  >
                    Collect Payment
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Quick Action Buttons */}
        <div className={`grid ${(selectedGym?.plan === "Basic" || selectedGym?.plan_type === "Basic") ? "grid-cols-4" : "grid-cols-5"} gap-2`}>
          {!(selectedGym?.plan === "Basic" || selectedGym?.plan_type === "Basic") && (
            <button
              onClick={() => router.push(`/members/${member.id}/credentials`)}
              className="bg-white rounded-xl p-3 border border-gray-200 shadow-sm flex flex-col items-center gap-1 hover:shadow-md transition-all duration-200 active:scale-95"
            >
              <div className="w-10 h-10 bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg flex items-center justify-center">
                <Key className="w-5 h-5 text-white" />
              </div>
              <span className="text-xs font-medium text-gray-600">Credentials</span>
            </button>
          )}
          
          <a
            href={`tel:${member.phone}`}
            className="bg-white rounded-xl p-3 border border-gray-200 shadow-sm flex flex-col items-center gap-1 hover:shadow-md transition-all duration-200 active:scale-95"
          >
            <div className="w-10 h-10 bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg flex items-center justify-center">
              <PhoneCall className="w-5 h-5 text-white" />
            </div>
            <span className="text-xs font-medium text-gray-600">Call</span>
          </a>
          
          <a
            href={`https://wa.me/91${member.phone}`}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-white rounded-xl p-3 border border-gray-200 shadow-sm flex flex-col items-center gap-1 hover:shadow-md transition-all duration-200 active:scale-95"
          >
            <div className="w-10 h-10 bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-white" />
            </div>
            <span className="text-xs font-medium text-gray-600">WhatsApp</span>
          </a>
          
          <button
            onClick={() => router.push(`/members/${member.id}/payment`)}
            className="bg-white rounded-xl p-3 border border-gray-200 shadow-sm flex flex-col items-center gap-1 hover:shadow-md transition-all duration-200 active:scale-95"
          >
            <div className="w-10 h-10 bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-white" />
            </div>
            <span className="text-xs font-medium text-gray-600">Payment</span>
          </button>

          <button
            onClick={() => {
              const el = document.getElementById("points-section");

            if (el) {
              const yOffset = -80; // kitna upar chahiye
              const y =
                el.getBoundingClientRect().top + window.pageYOffset + yOffset;

              window.scrollTo({
                top: y,
                behavior: "smooth",
              });
            }
          }}
      
            className="bg-white rounded-xl p-3 border border-gray-200 shadow-sm flex flex-col items-center gap-1 hover:shadow-md transition-all duration-200 active:scale-95"
          >
            <div className="w-10 h-10 bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg flex items-center justify-center">
              <Star className="w-5 h-5 text-white" />
            </div>
            <span className="text-xs font-medium text-gray-600">Points</span>
          </button>
        </div>

        {!isViewOnly && (
          <>
            {/* Actions Section */}
            <div className="bg-white rounded-xl border border-gray-300 shadow-sm p-3 space-y-2">
              <p className="text-[11px] uppercase tracking-wide text-gray-600 font-semibold">Actions</p>
              <div className={`grid gap-2 ${isTrainer ? "grid-cols-2" : "grid-cols-2"}`}>
                <button
                  onClick={() => setShowAssignDietModal(true)}
                  className="px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm font-medium text-slate-800 hover:bg-slate-100 active:bg-slate-100 active:scale-95 transition-all flex items-center justify-between"
                >
                  <span className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-full bg-orange-200 text-orange-800 flex items-center justify-center">
                      <Utensils className="w-3.5 h-3.5" />
                    </span>
                    Assign Diet
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                </button>

                <button
                  onClick={() => setShowAssignWorkoutModal(true)}
                  className="px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm font-medium text-slate-800 hover:bg-slate-100 active:bg-slate-100 active:scale-95 transition-all flex items-center justify-between"
                >
                  <span className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-full bg-orange-200 text-orange-800 flex items-center justify-center">
                      <Dumbbell className="w-3.5 h-3.5" />
                    </span>
                    Assign Workout
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                </button>

                {!isTrainer && canWrite && (
                  <button
                    onClick={() => setShowAssignTrainerModal(true)}
                    className="px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm font-medium text-slate-800 hover:bg-slate-100 active:bg-slate-100 active:scale-95 transition-all flex items-center justify-between"
                  >
                    <span className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-full bg-orange-200 text-orange-800 flex items-center justify-center">
                        <Users className="w-3.5 h-3.5" />
                      </span>
                      {assignedTrainer ? "Change Trainer" : "Assign Trainer"}
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                  </button>
                )}

                {!isTrainer && canWrite && (
                  <button
                    onClick={() => setShowAssignAmenityModal(true)}
                    className="px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm font-medium text-slate-800 hover:bg-slate-100 active:bg-slate-100 active:scale-95 transition-all flex items-center justify-between"
                  >
                    <span className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-full bg-orange-200 text-orange-800 flex items-center justify-center">
                        <Package className="w-3.5 h-3.5" />
                      </span>
                      Assign Amenity
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                  </button>
                )}
              </div>
            </div>

            {/* Member Controls Section */}
            <div className="bg-white rounded-xl border border-gray-300 shadow-sm p-3 space-y-2">
              <p className="text-[11px] uppercase tracking-wide text-gray-600 font-semibold">Member Controls</p>
              <div className={`grid ${isTrainer ? 'grid-cols-1' : 'grid-cols-2'} gap-2`}>
                <button
                  onClick={() => router.push(`/members/edit?id=${member.id}`)}
                  className="px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm font-medium text-slate-800 hover:bg-slate-100 active:bg-slate-100 active:scale-95 transition-all flex items-center justify-between"
                >
                  <span className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-full bg-slate-300 text-slate-800 flex items-center justify-center">
                      <Edit className="w-3.5 h-3.5" />
                    </span>
                    Edit Member
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                </button>

                {!isTrainer && canWrite && (
                  <button
                    onClick={handleDeleteMember}
                    className="px-3 py-2.5 bg-orange-50 border border-[#f0813d] rounded-lg text-sm font-medium text-[#f0813d] hover:bg-orange-100 active:bg-orange-100 active:scale-95 transition-all flex items-center justify-between"
                  >
                    <span className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-full bg-orange-200 text-[#f0813d] flex items-center justify-center">
                        <Trash2 className="w-3.5 h-3.5" />
                      </span>
                      Delete Member
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-[#f0813d]" />
                  </button>
                )}
              </div>
            </div>

            {/* Membership Section */}
            {member.status !== "active" && (
              <div className="bg-white rounded-xl border border-gray-300 shadow-sm p-3">
                <button
                  onClick={() => setShowRenewModal(true)}
                  disabled={member.dueAmount > 0}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm font-medium text-slate-800 hover:bg-slate-100 active:bg-slate-100 active:scale-95 transition-all flex items-center justify-between disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <span className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-full bg-orange-200 text-orange-800 flex items-center justify-center">
                      <RefreshCw className="w-3.5 h-3.5" />
                    </span>
                    {member.dueAmount > 0 ? "Clear Due Before Renewal" : "Renew Membership"}
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                </button>
                {member.dueAmount > 0 && (
                  <p className="mt-2 text-xs text-[#f0813d]">
                    Renewal is blocked until current membership due is fully paid.
                  </p>
                )}
              </div>
            )}
          </>
        )}

        {/* History Section */}
        <div className="bg-white rounded-xl border border-gray-300 shadow-sm p-3">
          <p className="text-[11px] uppercase tracking-wide text-gray-600 font-semibold mb-2">History</p>
          <button
            onClick={() => setShowHistoryModal(true)}
            className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm font-medium text-slate-800 hover:bg-slate-100 active:bg-slate-100 active:scale-95 transition-all flex items-center justify-between"
          >
            <span className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-full bg-orange-200 text-orange-800 flex items-center justify-center">
                <History className="w-3.5 h-3.5" />
              </span>
              View History
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
          </button>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-1">
          <div className="flex overflow-x-auto">
            {[
              { id: "overview", label: "Overview", icon: <Eye className="w-4 h-4" /> },
              { id: "attendance", label: "Attendance", icon: <BarChart3 className="w-4 h-4" /> },
              { id: "payments", label: "Payments", icon: <CreditCard className="w-4 h-4" /> }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 min-w-[120px] py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2 ${
                  activeTab === tab.id 
                  ? "bg-gradient-to-r from-[#f0813d] to-[#f0813d] text-white shadow-sm" 
                  : "text-gray-600 hover:text-gray-900"
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === "overview" && (
          <div className="space-y-4">
            {/* Training Schedule Card - Prominent for trainers */}
            {assignedTrainer?.schedule?.length > 0 && (
              <div className="bg-gradient-to-r from-orange-50 to-orange-50 rounded-xl border border-orange-200 shadow-sm p-4">
                <h3 className="font-semibold text-orange-900 flex items-center gap-2 mb-3">
                  <Clock className="w-4 h-4 text-[#f0813d]" />
                  Training Schedule
                  {isTrainer && <span className="text-xs font-normal text-[#f0813d] ml-1">— your sessions with {member.name}</span>}
                </h3>
                <div className="space-y-2">
                  {assignedTrainer.schedule.map((s) => (
                    <div key={s.day} className="flex items-center gap-3 bg-white/70 rounded-lg px-3 py-2">
                      <span className="text-sm font-bold text-[#f0813d] w-12">{s.day.slice(0, 3)}</span>
                      <div className="flex flex-wrap gap-1.5">
                        {s.slots.map((slot) => (
                          <span
                            key={slot}
                            className="px-2.5 py-1 bg-orange-100 text-[#f0813d] text-xs font-semibold rounded-full"
                          >
                            {slot}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-4">
            <h3 className="font-semibold text-gray-900">Personal Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500">Join Date</p>
                <p className="text-sm font-medium text-gray-900">{member.joinDate}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Valid Till</p>
                <p className="text-sm font-medium text-gray-900">{member.validTill}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Plan Price</p>
                <p className="text-sm font-medium text-gray-900">₹{member.planPrice}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Current Balance</p>
                <p className={`text-sm font-medium ${member.balance >= 0 ? 'text-[#f0813d]' : 'text-[#f0813d]'}`}>
                  ₹{member.balance}
                </p>
              </div>
              {member.createdByName && (
                <div className="col-span-2">
                  <p className="text-xs text-gray-500">Created By</p>
                  <p className="text-sm font-medium text-[#f0813d]">{member.createdByName}</p>
                </div>
              )}
            </div>

            {/* Points Section */}
            <div id="points-section" className="pt-3 border-t border-gray-100">
              <MemberPointsSection
                memberId={member.id}
                gymId={member.gymId}
                userId={user?.id}
                initialPoints={member.points}
                canEdit={canWrite}
              />
            </div>

            <div className="pt-3 border-t border-gray-100">
              <h4 className="font-semibold text-gray-900 mb-3">Recent Activity</h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Last Payment</span>
                  <span className="font-medium text-gray-900">
                    {member.payments[0] ? `₹${member.payments[0].amount}` : 'No payments yet'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Last Visit</span>
                  <span className="font-medium text-gray-900">
                    {member.attendance[0] ? member.attendance[0].date : 'No visits yet'}
                  </span>
                </div>
              </div>
            </div>

            {/* Assigned Diet Plans Section */}
            <div className="pt-3 border-t border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Apple className="w-4 h-4 text-[#f0813d]" />
                  Assigned Diet Plans
                </h4>
                <button
                  onClick={() => setShowAssignDietModal(true)}
                  className="text-xs text-[#f0813d] hover:text-[#f0813d] font-medium flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add
                </button>
              </div>
              {assignedDietPlans.length === 0 ? (
                <div className="text-center py-4 bg-gray-50 rounded-lg">
                  <Apple className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No diet plans assigned</p>
                  <button
                    onClick={() => setShowAssignDietModal(true)}
                    className="mt-2 text-xs text-[#f0813d] hover:text-[#f0813d] font-medium"
                  >
                    Assign a diet plan
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {assignedDietPlans.map((plan) => (
                    <div
                      key={plan.id}
                      className="p-3 bg-gradient-to-r from-orange-50 to-orange-50 rounded-lg border border-orange-200"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-gray-900 truncate">{plan.title}</p>
                            {plan.isCustom && (
                              <span className="px-1.5 py-0.5 bg-orange-100 text-[#f0813d] text-[10px] rounded-full font-medium">
                                Custom
                              </span>
                            )}
                            {plan.isTemplate && (
                              <span className="px-1.5 py-0.5 bg-orange-100 text-[#f0813d] text-[10px] rounded-full font-medium">
                                Template
                              </span>
                            )}
                          </div>
                          {plan.description && (
                            <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{plan.description}</p>
                          )}
                          <p className="text-[10px] text-gray-400 mt-1">
                            Assigned: {new Date(plan.assignedAt).toLocaleDateString("en-IN")}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 ml-2">
                          <button
                            onClick={() => router.push(`/settings/diet-plans?view=${plan.planId}`)}
                            className="p-1.5 text-[#f0813d] hover:bg-orange-100 rounded-lg transition-colors"
                            title="View Plan"
                          >
                            <EyeIcon className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => router.push(`/settings/diet-plans?edit=${plan.planId}`)}
                            className="p-1.5 text-[#f0813d] hover:bg-orange-100 rounded-lg transition-colors"
                            title="Edit Plan"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleRemoveDietPlan(plan.id)}
                            className="p-1.5 text-[#f0813d] hover:bg-orange-100 rounded-lg transition-colors"
                            title="Remove Plan"
                          >
                            <TrashIcon className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Assigned Workout Plans Section */}
            <div className="pt-3 border-t border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Dumbbell className="w-4 h-4 text-[#f0813d]" />
                  Assigned Workout Plans
                </h4>
                <button
                  onClick={() => setShowAssignWorkoutModal(true)}
                  className="text-xs text-[#f0813d] hover:text-[#f0813d] font-medium flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add
                </button>
              </div>
              {assignedWorkoutPlans.length === 0 ? (
                <div className="text-center py-4 bg-gray-50 rounded-lg">
                  <Dumbbell className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No workout plans assigned</p>
                  <button
                    onClick={() => setShowAssignWorkoutModal(true)}
                    className="mt-2 text-xs text-[#f0813d] hover:text-[#f0813d] font-medium"
                  >
                    Assign a workout plan
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {assignedWorkoutPlans.map((plan) => (
                    <div
                      key={plan.id}
                      className="p-3 bg-gradient-to-r from-orange-50 to-orange-50 rounded-lg border border-orange-200"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-gray-900 truncate">{plan.title}</p>
                            {plan.isCustom && (
                              <span className="px-1.5 py-0.5 bg-orange-100 text-[#f0813d] text-[10px] rounded-full font-medium">
                                Custom
                              </span>
                            )}
                          </div>
                          {plan.description && (
                            <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{plan.description}</p>
                          )}
                          <p className="text-[10px] text-gray-400 mt-1">
                            Assigned: {new Date(plan.assignedAt).toLocaleDateString("en-IN")}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 ml-2">
                          <button
                            onClick={() => router.push(`/settings/workout-plans?view=${plan.planId}`)}
                            className="p-1.5 text-[#f0813d] hover:bg-orange-100 rounded-lg transition-colors"
                            title="View Plan"
                          >
                            <EyeIcon className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => router.push(`/settings/workout-plans?edit=${plan.planId}`)}
                            className="p-1.5 text-[#f0813d] hover:bg-orange-100 rounded-lg transition-colors"
                            title="Edit Plan"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleRemoveWorkoutPlan(plan.id)}
                            className="p-1.5 text-[#f0813d] hover:bg-orange-100 rounded-lg transition-colors"
                            title="Remove Plan"
                          >
                            <TrashIcon className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Assigned Trainer Section */}
            <div className="pt-3 border-t border-gray-100">
              <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#f0813d]" />
                  Assigned Trainer
                </h4>
                {!isTrainer && canWrite && (
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    {assignedTrainer && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setTrainerAssignMode("renew");
                            setShowAssignTrainerModal(true);
                          }}
                          className="text-xs text-[#f0813d] hover:text-orange-800 font-medium px-2 py-1 rounded-lg border border-orange-200 bg-orange-50"
                        >
                          Renew Trainer
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setTrainerAssignMode("change");
                            setShowAssignTrainerModal(true);
                          }}
                          className="text-xs text-[#f0813d] hover:text-orange-800 font-medium px-2 py-1 rounded-lg border border-orange-200 bg-orange-50"
                        >
                          Change Trainer
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => {
                        setTrainerAssignMode("default");
                        setShowAssignTrainerModal(true);
                      }}
                      className="text-xs text-[#f0813d] hover:text-[#f0813d] font-medium flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      {assignedTrainer ? "Assign / Update" : "Assign"}
                    </button>
                  </div>
                )}
              </div>
              {!assignedTrainer ? (
                <div className="text-center py-4 bg-gray-50 rounded-lg">
                  <Users className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No trainer assigned</p>
                  {!isTrainer && canWrite && (
                    <button
                      onClick={() => setShowAssignTrainerModal(true)}
                      className="mt-2 text-xs text-[#f0813d] hover:text-[#f0813d] font-medium"
                    >
                      Assign a trainer
                    </button>
                  )}
                </div>
              ) : (
                <div className="p-3 bg-gradient-to-r from-orange-50 to-orange-50 rounded-lg border border-orange-200">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-[#f0813d] to-[#f0813d] rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
                      {assignedTrainer.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900">{assignedTrainer.name}</p>
                      {assignedTrainer.phone && (
                        <p className="text-xs text-gray-500 flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {assignedTrainer.phone}
                        </p>
                      )}
                    </div>
                    {!isTrainer && canWrite && (
                      <button
                        onClick={() => setShowAssignTrainerModal(true)}
                        className="p-1.5 text-[#f0813d] hover:bg-orange-100 rounded-lg transition-colors"
                        title="Change Trainer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  {/* Trainer Plan Expiry */}
                  {assignedTrainer.trainerPlanDaysRemaining !== null && (
                    <div className="mt-2 pt-2 border-t border-orange-200">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5 text-[#f0813d]" />
                        <span className={`text-xs font-medium ${
                          assignedTrainer.trainerPlanDaysRemaining <= 0 
                            ? 'text-[#f0813d]' 
                            : assignedTrainer.trainerPlanDaysRemaining <= 3 
                              ? 'text-[#f0813d]' 
                              : 'text-[#f0813d]'
                        }`}>
                          {assignedTrainer.trainerPlanDaysRemaining > 0 
                            ? `Trainer plan expires in ${assignedTrainer.trainerPlanDaysRemaining} days`
                            : 'Trainer plan expired'}
                        </span>
                      </div>
                      {assignedTrainer.planEndDate && (
                        <p className="text-[10px] text-gray-400 ml-5.5 mt-0.5">
                          Valid till: {new Date(assignedTrainer.planEndDate).toLocaleDateString("en-IN")}
                        </p>
                      )}
                    </div>
                  )}

                  {(assignedTrainer.planName || assignedTrainer.planTotalAmount > 0) && (
                    <div className="mt-2 pt-2 border-t border-orange-200">
                      <p className="text-xs font-semibold text-[#f0813d] mb-2">PT Payment Status</p>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="rounded-lg border border-orange-100 bg-white/80 p-2">
                          <p className="text-[10px] uppercase tracking-wide text-gray-500">Paid</p>
                          <p className="mt-1 text-xs font-bold text-[#f0813d]">₹{Number(assignedTrainer.totalPaidAmount || 0).toLocaleString("en-IN")}</p>
                        </div>
                        <div className="rounded-lg border border-orange-100 bg-white/80 p-2">
                          <p className="text-[10px] uppercase tracking-wide text-gray-500">Due</p>
                          <p className="mt-1 text-xs font-bold text-[#f0813d]">₹{Number(assignedTrainer.pendingAmount || 0).toLocaleString("en-IN")}</p>
                        </div>
                        <div className="rounded-lg border border-orange-100 bg-white/80 p-2">
                          <p className="text-[10px] uppercase tracking-wide text-gray-500">Plan</p>
                          <p className="mt-1 text-xs font-bold text-[#f0813d]">₹{Number(assignedTrainer.planTotalAmount || 0).toLocaleString("en-IN")}</p>
                        </div>
                      </div>
                      {assignedTrainer.nextPaymentDate && Number(assignedTrainer.pendingAmount || 0) > 0 && (
                        <p className="mt-2 text-[11px] text-[#f0813d]">
                          Next PT due on {new Date(`${assignedTrainer.nextPaymentDate}T00:00:00`).toLocaleDateString("en-IN")}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Training Schedule */}
                  {assignedTrainer.schedule && assignedTrainer.schedule.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-orange-200">
                      <p className="text-xs font-semibold text-[#f0813d] mb-2 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        Training Schedule
                      </p>
                      <div className="space-y-1.5">
                        {assignedTrainer.schedule.map((s) => (
                          <div key={s.day} className="flex items-start gap-2">
                            <span className="text-xs font-semibold text-gray-700 w-20 flex-shrink-0">{s.day.slice(0, 3)}</span>
                            <div className="flex flex-wrap gap-1">
                              {s.slots.map((slot) => (
                                <span
                                  key={slot}
                                  className="px-2 py-0.5 bg-orange-100 text-[#f0813d] text-[11px] font-medium rounded-full"
                                >
                                  {slot}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Trainer assignment history (all periods; PT amounts from trainer_payments) */}
            <div className="pt-3 border-t border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                  <History className="w-4 h-4 text-gray-600" />
                  Trainer History
                </h4>
              </div>
              {trainerHistoryLoading ? (
                <p className="text-xs text-gray-500">Loading history…</p>
              ) : trainerHistory.length === 0 ? (
                <p className="text-xs text-gray-500">No past trainer assignments yet.</p>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {trainerHistory.map((row) => (
                    <div
                      key={row.id}
                      className={`rounded-lg border p-2.5 text-xs ${
                        row.is_active
                          ? "border-orange-200 bg-orange-50/80"
                          : "border-gray-200 bg-gray-50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-gray-900">{row.trainer_name}</p>
                          <p className="text-gray-600 mt-0.5">
                            {row.start_date
                              ? new Date(`${row.start_date}T00:00:00`).toLocaleDateString("en-IN")
                              : "—"}
                            {" → "}
                            {row.is_active
                              ? "Present"
                              : row.end_date
                                ? new Date(`${row.end_date}T00:00:00`).toLocaleDateString("en-IN")
                                : "—"}
                          </p>
                          {row.plan_name && (
                            <p className="text-gray-500 mt-0.5">Plan: {row.plan_name}</p>
                          )}
                        </div>
                        <div className="text-right flex-shrink-0">
                          {row.is_active && (
                            <span className="text-[10px] font-semibold text-[#f0813d] uppercase">Current</span>
                          )}
                          <p className="text-gray-700 mt-0.5">
                            {row.duration_days != null ? `${row.duration_days}d` : "—"}
                          </p>
                          <p className="font-semibold text-gray-900">
                            ₹{Number(row.amount_earned || 0).toLocaleString("en-IN")}
                          </p>
                          <p className="text-[10px] text-gray-500">PT collected</p>
                        </div>
                      </div>
                      {row.expires_within_3_days && row.is_active && (
                        <p className="text-[#f0813d] font-medium mt-1.5">Plan ends in under 3 days</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          </div>
        )}

        {activeTab === "attendance" && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Recent Attendance</h3>
            </div>
            <div className="divide-y divide-gray-100">
              {member.attendance.length > 0 ? (
                member.attendance.map((record, index) => (
                  <div
                    key={index}
                    className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{record.date}</p>
                      <p className="text-sm text-gray-500">
                        {record.checkIn} - {record.checkOut}
                      </p>
                    </div>
                    <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                      <CheckCircle className="w-4 h-4 text-white" />
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-gray-100 to-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <BarChart3 className="w-8 h-8 text-white" />
                  </div>
                  <p className="text-gray-500 text-sm">No attendance records found</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "payments" && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Payment History</h3>
             
            </div>
            <div className="divide-y divide-gray-100">
              {member.payments.length > 0 ? (
                member.payments.map((payment) => (
                  <div
                    key={payment.id}
                    className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg flex items-center justify-center">
                          <CreditCard className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            ₹{payment.amount}
                          </p>
                          <p className="text-sm text-gray-500">
                            {payment.type} • {payment.date}
                          </p>
                          {payment.payment_mode && (
                            <p className="text-xs text-gray-400 mt-1">
                              {payment.payment_mode.toUpperCase()}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-1 text-xs rounded-lg border ${
                        payment.status === 'paid' 
                          ? 'bg-orange-50 text-[#f0813d] border-orange-200' 
                          : 'bg-orange-50 text-[#f0813d] border-orange-200'
                      }`}>
                        {(payment.status || 'unknown').toLowerCase()}
                      </span>
                      {payment.status === "paid" && !isViewOnly && (
                        <button
                          type="button"
                          onClick={() => handleUpdatePaymentAmount(payment)}
                          className="px-2.5 py-1 text-xs rounded-lg border border-orange-200 bg-orange-50 text-[#f0813d] hover:bg-orange-100"
                        >
                          Edit Amount
                        </button>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-gray-100 to-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <CreditCard className="w-8 h-8 text-white" />
                  </div>
                  <p className="text-gray-500 text-sm">No payment records found</p>
                  <button
                    onClick={() => router.push(`/members/${member.id}/payment`)}
                    className="mt-4 px-4 py-2 text-[#f0813d] text-sm font-medium hover:text-[#f0813d]"
                  >
                    Add first payment
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Modals */}
      {showRenewModal && (
        <RenewMembershipModal
          member={member}
          gymId={selectedGym?.id}
          onClose={() => setShowRenewModal(false)}
          onRenew={handleRenewal}
        />
      )}

      {showHistoryModal && (
        <RenewalHistoryModal
          member={member}
          renewalHistory={renewalHistory}
          readOnly={isViewOnly}
          onClose={() => setShowHistoryModal(false)}
          onPaymentModeUpdated={() => fetchMemberDetails(params.id, selectedGym?.id)}
        />
      )}

      {showResolvePaymentModal && selectedPendingPayment && (
        <ResolvePendingPaymentModal
          payment={selectedPendingPayment}
          member={member}
          onClose={() => {
            setShowResolvePaymentModal(false);
            setSelectedPendingPayment(null);
          }}
          onResolved={handlePaymentResolved}
        />
      )}

      {showAssignDietModal && (
        <AssignDietPlanModal
          member={member}
          gymId={selectedGym?.id}
          onClose={() => setShowAssignDietModal(false)}
          onAssign={() => {
            fetchAssignedDietPlans(member.id);
          }}
        />
      )}

      {showAssignWorkoutModal && (
        <AssignWorkoutPlanModal
          member={member}
          gymId={selectedGym?.id}
          onClose={() => setShowAssignWorkoutModal(false)}
          onAssign={() => {
            fetchAssignedWorkoutPlans(member.id);
          }}
        />
      )}

      {showAssignTrainerModal && (
        <AssignTrainerModal
          isOpen={showAssignTrainerModal}
          onClose={() => {
            setShowAssignTrainerModal(false);
            setTrainerAssignMode("default");
          }}
          memberId={member?.id}
          selectedGym={selectedGym}
          currentTrainerId={assignedTrainer?.trainerId}
          assignMode={trainerAssignMode}
          onSuccess={() => {
            fetchAssignedTrainer(member.id, selectedGym?.id);
            fetchTrainerHistory(member.id);
          }}
        />
      )}

      {showAssignAmenityModal && (
        <AssignAmenityModal
          isOpen={showAssignAmenityModal}
          onClose={() => setShowAssignAmenityModal(false)}
          memberId={member?.id}
          memberName={member?.full_name}
          selectedGym={selectedGym}
          onSuccess={() => {
            fetchMemberDetails(member.id, selectedGym.id);
          }}
        />
      )}
    </div>
  );
}
