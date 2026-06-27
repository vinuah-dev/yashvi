"use client";

import { useAuthContext } from "@/contexts/AuthContext";
import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/layout/Header";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/contexts/ToastContext";
import {
  Search,
  User,
  Phone,
  CheckCircle,
  Users,
  Loader2,
  AlertCircle,
  Save,
  Check,
  Clock,
  CalendarDays,
  Tag,
  Award,
  Plus,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  X
} from "lucide-react";

const PAYMENT_MODE_OPTIONS = ["cash", "upi", "card", "bank"];

const roundCurrency = (value) => Math.round((Number(value) || 0) * 100) / 100;

const getDefaultPlanStartDate = (planEndDate) => {
  const baseDate = new Date();
  baseDate.setHours(0, 0, 0, 0);

  if (planEndDate) {
    const endDate = new Date(`${planEndDate}T00:00:00`);
    endDate.setHours(0, 0, 0, 0);

    if (endDate >= baseDate) {
      endDate.setDate(endDate.getDate() + 1);
      return endDate.toISOString().split("T")[0];
    }
  }

  return baseDate.toISOString().split("T")[0];
};

export default function AssignMembersPage({ params }) {
  const router = useRouter();
  const { id } = use(params);
  const { showSuccess, showError } = useToast();

  // Core data
  const [trainer, setTrainer] = useState(null);
  const [allMembers, setAllMembers] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { selectedGym } = useAuthContext();
  const [success, setSuccess] = useState(false);

  // Trainer schedule & plans
  const [trainerPlans, setTrainerPlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [bookedSlotsMap, setBookedSlotsMap] = useState({});
  const [fetchingSlots, setFetchingSlots] = useState(false);
  const [trainerAvailableDays, setTrainerAvailableDays] = useState([]);
  const [trainerAvailableTimeSlots, setTrainerAvailableTimeSlots] = useState({});

  // Assignment tracking
  const [assignedMemberIds, setAssignedMemberIds] = useState(new Set());
  const [memberTrainerMap, setMemberTrainerMap] = useState({});
  const [existingAssignments, setExistingAssignments] = useState({});
  const [currentActiveAssignments, setCurrentActiveAssignments] = useState({});

  // Per-member configuration
  const [memberConfigs, setMemberConfigs] = useState({});
  const [expandedMemberId, setExpandedMemberId] = useState(null);
  const [activeDay, setActiveDay] = useState("");
  // Track members marked for unassignment
  const [unassignSet, setUnassignSet] = useState(new Set());

  // gym now comes from AuthContext


  useEffect(() => {
    if (id && selectedGym?.id) fetchData();
  }, [id, selectedGym?.id]);

  const fetchData = async () => {
    if (!selectedGym?.id || !id) return;
    setLoading(true);

    try {
      // Fetch trainer details with schedule info
      const { data: trainerData, error: trainerError } = await supabase
        .from("gym_trainers")
        .select(`
          id, profile_id,
          profiles:profile_id (
            first_name, last_name, phone, trainer_cost,
            available_days, available_time_slots
          )
        `)
        .eq("id", id)
        .eq("gym_id", selectedGym.id)
        .single();

      if (trainerError) throw trainerError;

      const profileData = trainerData.profiles;
      setTrainer({
        id: trainerData.id,
        profileId: trainerData.profile_id,
        name: `${profileData?.first_name || ""} ${profileData?.last_name || ""}`.trim(),
        phone: profileData?.phone || "",
        cost: profileData?.trainer_cost ? parseFloat(profileData.trainer_cost) : null,
      });
      setTrainerAvailableDays(profileData?.available_days || []);
      setTrainerAvailableTimeSlots(profileData?.available_time_slots || {});

      // Fetch plans & booked slots
      await fetchTrainerPlans(trainerData.profile_id);
      await fetchAllBookedSlots(trainerData.profile_id);

      // Fetch all members
      const { data: membersData } = await supabase
        .from("members")
        .select(`id, full_name, phone, profile_image, memberships (status, end_date)`)
        .eq("gym_id", selectedGym.id)
        .order("full_name", { ascending: true });

      setAllMembers(
        membersData?.map((m) => ({
          id: m.id,
          name: m.full_name,
          phone: m.phone,
          profileImage: m.profile_image,
          status: m.memberships?.[0]?.status || "inactive",
        })) || []
      );

      // Fetch current assignments for this trainer (with plan info)
      const { data: assignmentsData } = await supabase
        .from("trainer_member_assignments")
        .select(`
          id, member_id, trainer_plan_id, plan_start_date, plan_end_date,
          trainer_plans:trainer_plan_id (id, name, price, duration_days)
        `)
        .eq("trainer_id", trainerData.profile_id)
        .eq("gym_id", selectedGym.id)
        .eq("is_active", true);

      const assigned = new Set();
      const existingMap = {};
      (assignmentsData || []).forEach((a) => {
        assigned.add(a.member_id);
        existingMap[a.member_id] = {
          assignmentId: a.id,
          planId: a.trainer_plan_id,
          planName: a.trainer_plans?.name,
          planPrice: a.trainer_plans?.price ? parseFloat(a.trainer_plans.price) : null,
          planDuration: a.trainer_plans?.duration_days,
          planStartDate: a.plan_start_date,
          planEndDate: a.plan_end_date,
        };
      });
      setAssignedMemberIds(assigned);
      setExistingAssignments(existingMap);

      // Fetch ALL active assignments (for other-trainer warnings)
      const { data: allAssignments } = await supabase
        .from("trainer_member_assignments")
        .select(`
          member_id,
          trainer_id,
          plan_start_date,
          plan_end_date,
          trainer_plan_id,
          plan_total_amount,
          total_paid_amount,
          pending_amount,
          next_payment_date,
          profiles:trainer_id (first_name, last_name)
        `)
        .eq("gym_id", selectedGym.id)
        .eq("is_active", true);

      const trainerMap = {};
      const currentAssignmentMap = {};
      (allAssignments || []).forEach((a) => {
        currentAssignmentMap[a.member_id] = {
          trainerId: a.trainer_id,
          trainerName: `${a.profiles?.first_name || ""} ${a.profiles?.last_name || ""}`.trim() || "Unknown",
          planStartDate: a.plan_start_date,
          planEndDate: a.plan_end_date,
          trainerPlanId: a.trainer_plan_id,
          planTotalAmount: a.plan_total_amount ? parseFloat(a.plan_total_amount) : 0,
          totalPaidAmount: a.total_paid_amount ? parseFloat(a.total_paid_amount) : 0,
          pendingAmount: a.pending_amount ? parseFloat(a.pending_amount) : 0,
          nextPaymentDate: a.next_payment_date || null,
        };

        if (a.trainer_id !== trainerData.profile_id) {
          const name = `${a.profiles?.first_name || ""} ${a.profiles?.last_name || ""}`.trim() || "Unknown";
          if (!trainerMap[a.member_id]) trainerMap[a.member_id] = [];
          trainerMap[a.member_id].push(name);
        }
      });
      setMemberTrainerMap(trainerMap);
      setCurrentActiveAssignments(currentAssignmentMap);
    } catch (err) {
      console.error("Error fetching data:", err);
      showError("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const fetchTrainerPlans = async (trainerId) => {
    if (!selectedGym?.id || !trainerId) return;
    setPlansLoading(true);
    try {
      const { data, error } = await supabase
        .from("trainer_plans")
        .select("*")
        .eq("gym_id", selectedGym.id)
        .eq("trainer_id", trainerId)
        .eq("is_active", true)
        .order("duration_days", { ascending: true });

      if (error) throw error;
      setTrainerPlans((data || []).map((p) => ({ ...p, price: parseFloat(p.price) })));
    } catch (err) {
      console.error("Error fetching trainer plans:", err);
      setTrainerPlans([]);
    } finally {
      setPlansLoading(false);
    }
  };

  const fetchAllBookedSlots = async (trainerId) => {
    if (!selectedGym?.id || !trainerId) return;
    setFetchingSlots(true);
    try {
      const { data, error } = await supabase
        .from("trainer_bookings")
        .select("time_slot, member_id, day")
        .eq("trainer_id", trainerId)
        .eq("gym_id", selectedGym.id)
        .eq("is_active", true);

      if (error) throw error;
      const map = {};
      (data || []).forEach((b) => {
        if (!map[b.day]) map[b.day] = [];
        map[b.day].push({ time_slot: b.time_slot, member_id: b.member_id });
      });
      setBookedSlotsMap(map);
    } catch (err) {
      console.error("Error fetching slots:", err);
      setBookedSlotsMap({});
    } finally {
      setFetchingSlots(false);
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

  const getDefaultConfig = () => ({
    planId: null,
    selectedSlots: {},
    paymentMode: "cash",
    useCustomPrice: false,
    customPrice: "",
    customStartDate: "",
    amountReceived: "",
    nextPaymentDate: "",
    confirmed: false,
  });

  const getMemberConfig = (memberId) => memberConfigs[memberId] || getDefaultConfig();

  const updateMemberConfig = (memberId, updates) => {
    setMemberConfigs((prev) => ({
      ...prev,
      [memberId]: { ...(prev[memberId] || getDefaultConfig()), ...updates },
    }));
  };

  const toggleMemberExpand = (memberId) => {
    if (expandedMemberId === memberId) {
      setExpandedMemberId(null);
      setActiveDay("");
    } else {
      setExpandedMemberId(memberId);
      setActiveDay("");

      // Pre-fill config from existing assignment if already assigned and no config yet
      if (assignedMemberIds.has(memberId) && !memberConfigs[memberId]) {
        const existingSlots = {};
        Object.entries(bookedSlotsMap).forEach(([day, bookings]) => {
          const memberSlots = bookings
            .filter((b) => b.member_id === memberId)
            .map((b) => b.time_slot);
          if (memberSlots.length > 0) existingSlots[day] = memberSlots;
        });

        updateMemberConfig(memberId, {
          planId: existingAssignments[memberId]?.planId || null,
          selectedSlots: existingSlots,
          confirmed: true,
        });
      }
    }
  };

  const confirmMemberConfig = (memberId) => {
    updateMemberConfig(memberId, { confirmed: true });
    // Remove from unassign set if it was there
    setUnassignSet((prev) => {
      const next = new Set(prev);
      next.delete(memberId);
      return next;
    });
    setExpandedMemberId(null);
    setActiveDay("");
  };

  const removeMemberConfig = (memberId) => {
    setMemberConfigs((prev) => {
      const next = { ...prev };
      delete next[memberId];
      return next;
    });
    setExpandedMemberId(null);
    setActiveDay("");
  };

  const toggleUnassign = (memberId) => {
    setUnassignSet((prev) => {
      const next = new Set(prev);
      if (next.has(memberId)) {
        next.delete(memberId);
      } else {
        next.add(memberId);
      }
      return next;
    });
    setExpandedMemberId(null);
    setActiveDay("");
  };

  // Compute counts for summary
  const newConfiguredCount = Object.entries(memberConfigs).filter(
    ([mid, c]) => c.confirmed && !assignedMemberIds.has(mid)
  ).length;
  const unassignCount = unassignSet.size;
  const hasChanges = newConfiguredCount > 0 || unassignCount > 0;

  const handleSave = async () => {
    if (!trainer?.profileId || !selectedGym?.id) return;

    // Validate all new configs have at least a plan if plans exist
    const newConfigs = Object.entries(memberConfigs).filter(
      ([mid, c]) => c.confirmed && !assignedMemberIds.has(mid)
    );

    // Check for members assigned to other trainers
    const membersWithOtherTrainers = newConfigs.filter(
      ([mid]) => memberTrainerMap[mid]?.length > 0
    );

    if (membersWithOtherTrainers.length > 0) {
      const memberNames = membersWithOtherTrainers
        .map(([mid]) => {
          const member = allMembers.find((m) => m.id === mid);
          const trainers = memberTrainerMap[mid];
          return `• ${member?.name} (assigned to ${trainers.join(", ")})`;
        })
        .join("\n");

      const confirmed = window.confirm(
        `⚠️ Warning: These members are assigned to other trainers:\n\n${memberNames}\n\n` +
          `They will be reassigned to ${trainer.name}.\n\nContinue?`
      );
      if (!confirmed) return;
    }

    setSaving(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const assignedBy = authData?.user?.id;

      // Process new assignments
      for (const [memberId, config] of newConfigs) {
        // Deactivate all existing assignments for this member
        const closeDate = new Date().toISOString().split("T")[0];
        await supabase
          .from("trainer_member_assignments")
          .update({ is_active: false, end_date: closeDate })
          .eq("member_id", memberId)
          .eq("gym_id", selectedGym.id)
          .eq("is_active", true);

        // Delete existing bookings for this member
        await supabase
          .from("trainer_bookings")
          .delete()
          .eq("member_id", memberId)
          .eq("gym_id", selectedGym.id);

        // Build assignment data
        const selectedPlan = trainerPlans.find((p) => p.id === config.planId);
        const assignmentData = {
          gym_id: selectedGym.id,
          trainer_id: trainer.profileId,
          member_id: memberId,
          assigned_by: assignedBy,
          is_active: true,
        };

        if (selectedPlan) {
          const planStartDate = config.customStartDate || getDefaultPlanStartDate(currentActiveAssignments[memberId]?.planEndDate);
          const planTotalAmount = roundCurrency(
            config.useCustomPrice && config.customPrice
              ? parseFloat(config.customPrice)
              : selectedPlan.price
          );
          const receivedAmountValue = roundCurrency(config.amountReceived);
          const pendingAmount = roundCurrency(Math.max(0, planTotalAmount - receivedAmountValue));

          if (receivedAmountValue < 0 || receivedAmountValue > planTotalAmount) {
            showError(`Amount received must be between ₹0 and ₹${planTotalAmount.toLocaleString("en-IN")}`);
            setSaving(false);
            return;
          }

          if (pendingAmount > 0 && !config.nextPaymentDate) {
            showError("Please select the next due date for the remaining PT amount");
            setSaving(false);
            return;
          }

          assignmentData.trainer_plan_id = selectedPlan.id;
          assignmentData.plan_start_date = planStartDate;
          const endDate = new Date(`${planStartDate}T00:00:00`);
          endDate.setDate(endDate.getDate() + selectedPlan.duration_days);
          assignmentData.plan_end_date = endDate.toISOString().split("T")[0];
          assignmentData.plan_total_amount = planTotalAmount;
          assignmentData.total_paid_amount = receivedAmountValue;
          assignmentData.pending_amount = pendingAmount;
          assignmentData.next_payment_date = pendingAmount > 0 ? config.nextPaymentDate : null;
          assignmentData.start_date = planStartDate;
          assignmentData.end_date = null;
        } else {
          assignmentData.start_date = closeDate;
          assignmentData.end_date = null;
        }

        const { data: assignmentResult, error: insertError } = await supabase
          .from("trainer_member_assignments")
          .insert(assignmentData)
          .select("id")
          .single();

        if (insertError) throw insertError;

        // Handle bookings
        const totalSelectedSlots = Object.values(config.selectedSlots).flat().length;
        if (totalSelectedSlots > 0) {
          const bookingRows = [];
          for (const [day, slots] of Object.entries(config.selectedSlots)) {
            for (const slot of slots) {
              bookingRows.push({
                trainer_id: trainer.profileId,
                member_id: memberId,
                gym_id: selectedGym.id,
                day,
                time_slot: slot,
                is_active: true,
              });
            }
          }

          const { error: bookingError } = await supabase
            .from("trainer_bookings")
            .insert(bookingRows);

          if (bookingError) {
            if (bookingError.code === "23505") {
              showError("One or more selected slots are duplicated for this member. Please review and try again.");
              await fetchAllBookedSlots(trainer.profileId);
              setSaving(false);
              return;
            }
            throw bookingError;
          }
        }

        // Handle payment if plan selected
        if (selectedPlan) {
          const receivedAmountValue = roundCurrency(config.amountReceived);

          if (receivedAmountValue > 0) {
            const gymAmount = roundCurrency(receivedAmountValue / 2);
            const trainerAmount = roundCurrency(receivedAmountValue - gymAmount);
            const paymentTimestamp = new Date().toISOString();

            await supabase.from("payments").insert({
              gym_id: selectedGym.id,
              member_id: memberId,
              amount: gymAmount,
              payment_mode: config.paymentMode,
              status: "paid",
              paid_at: paymentTimestamp,
              created_at: paymentTimestamp,
              notes: `PT installment - ${selectedPlan.name}`,
            });

            await supabase.from("trainer_earnings").insert({
              gym_id: selectedGym.id,
              trainer_id: trainer.profileId,
              member_id: memberId,
              trainer_plan_id: selectedPlan.id,
              assignment_id: assignmentResult?.id || null,
              total_amount: receivedAmountValue,
              trainer_amount: trainerAmount,
              gym_amount: gymAmount,
              payment_mode: config.paymentMode,
              notes: `PT installment - ${selectedPlan.name} (${formatDuration(selectedPlan.duration_days)})`,
              created_at: paymentTimestamp,
            });
          }
        }
      }

      // Process unassignments
      for (const memberId of unassignSet) {
        const unassignClose = new Date().toISOString().split("T")[0];
        await supabase
          .from("trainer_member_assignments")
          .update({ is_active: false, end_date: unassignClose })
          .eq("trainer_id", trainer.profileId)
          .eq("gym_id", selectedGym.id)
          .eq("member_id", memberId);

        await supabase
          .from("trainer_bookings")
          .delete()
          .eq("member_id", memberId)
          .eq("trainer_id", trainer.profileId)
          .eq("gym_id", selectedGym.id);
      }

      setSuccess(true);
      showSuccess("Assignments saved successfully!");
      setTimeout(() => router.push(`/settings/trainers/${id}`), 1000);
    } catch (err) {
      console.error("Error saving:", err);
      showError("Failed to save assignments");
    } finally {
      setSaving(false);
    }
  };

  const filteredMembers = allMembers.filter(
    (m) =>
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.phone?.includes(searchQuery)
  );

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 text-center max-w-sm w-full shadow-lg">
          <div className="w-16 h-16 bg-[#f0813d]/15 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Assignments Saved!</h2>
          <p className="text-gray-500">Redirecting back...</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 pb-24">
        <Header title="Assign Members" />
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#9c4400]"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      <Header title={`Assign to ${trainer?.name || "Trainer"}`} />

      <main className={`px-4 py-4 space-y-4 ${hasChanges ? "pb-40" : "pb-4"}`}>
        {/* Stats */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900">
                {assignedMemberIds.size - unassignCount + newConfiguredCount} member
                {assignedMemberIds.size - unassignCount + newConfiguredCount !== 1 ? "s" : ""} assigned
              </h3>
              <p className="text-sm text-gray-500">
                {newConfiguredCount > 0 && (
                  <span className="text-[#f0813d] mr-1">+{newConfiguredCount} new</span>
                )}
                {unassignCount > 0 && (
                  <span className="text-[#f0813d] mr-1">-{unassignCount} removed</span>
                )}
                <span>{allMembers.length} total members in gym</span>
              </p>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search members..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#f0813d]/20 focus:border-transparent bg-white"
          />
        </div>

        {/* Members List */}
        <div className="space-y-2">
          {filteredMembers.length === 0 ? (
            <div className="bg-white rounded-xl p-8 shadow-sm text-center">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="font-semibold text-gray-900 mb-1">No Members Found</h3>
              <p className="text-gray-500 text-sm">
                {searchQuery ? "Try a different search term" : "No members in this gym yet"}
              </p>
            </div>
          ) : (
            filteredMembers.map((member) => {
              const isAssigned = assignedMemberIds.has(member.id);
              const config = memberConfigs[member.id];
              const isConfigured = config?.confirmed && !isAssigned;
              const isExpanded = expandedMemberId === member.id;
              const isMarkedForUnassign = unassignSet.has(member.id);
              const assignedToOtherTrainers = memberTrainerMap[member.id];

              return (
                <div key={member.id}>
                  {/* Member Card */}
                  <div
                    onClick={() => toggleMemberExpand(member.id)}
                    className={`bg-white rounded-xl p-4 shadow-sm cursor-pointer transition-all ${
                      isExpanded
                        ? "ring-2 ring-[#f0813d] rounded-b-none"
                        : isMarkedForUnassign
                        ? "ring-2 ring-[#f0813d]/40 bg-[#f0813d]/10 opacity-60"
                        : isConfigured
                        ? "ring-2 ring-[#f0813d] bg-[#f0813d]/10"
                        : isAssigned
                        ? "ring-1 ring-[#f0813d]/20 bg-[#f0813d]/10"
                        : "hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {/* Status Icon */}
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                          isMarkedForUnassign
                            ? "bg-[#f0813d]"
                            : isConfigured
                            ? "bg-[#9c4400]"
                            : isAssigned
                            ? "bg-[#9c4400]"
                            : "border-2 border-gray-300"
                        }`}
                      >
                        {isMarkedForUnassign ? (
                          <X className="w-4 h-4 text-white" />
                        ) : (isConfigured || isAssigned) ? (
                          <Check className="w-4 h-4 text-white" />
                        ) : null}
                      </div>

                      {/* Avatar */}
                      <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                        {member.profileImage ? (
                          <img src={member.profileImage} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <User className="w-5 h-5 text-gray-400" />
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-medium text-gray-900 truncate">{member.name}</h4>
                          {isMarkedForUnassign && (
                            <span className="px-1.5 py-0.5 bg-[#f0813d]/15 text-[#9c4400] text-xs rounded-full">
                              Will Remove
                            </span>
                          )}
                          {isAssigned && !isMarkedForUnassign && (
                            <span className="px-1.5 py-0.5 bg-[#f0813d]/15 text-[#9c4400] text-xs rounded-full">
                              Assigned
                            </span>
                          )}
                          {isConfigured && (
                            <span className="px-1.5 py-0.5 bg-[#f0813d]/15 text-[#9c4400] text-xs rounded-full">
                              Configured
                            </span>
                          )}
                          {assignedToOtherTrainers?.length > 0 && (
                            <span className="px-1.5 py-0.5 bg-[#f0813d]/15 text-[#9c4400] text-xs rounded-full flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              {assignedToOtherTrainers.join(", ")}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <Phone className="w-3 h-3" />
                          <span>{member.phone}</span>
                          {isConfigured && config.planId && (
                            <span className="text-[#f0813d] font-medium">
                              · {trainerPlans.find((p) => p.id === config.planId)?.name}
                            </span>
                          )}
                          {isAssigned && existingAssignments[member.id]?.planName && !isMarkedForUnassign && (
                            <span className="text-[#f0813d] font-medium">
                              · {existingAssignments[member.id].planName}
                            </span>
                          )}
                          <span
                            className={`px-1.5 py-0.5 rounded-full ${
                              member.status === "active"
                                ? "bg-[#f0813d]/15 text-[#9c4400]"
                                : "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {member.status}
                          </span>
                        </div>
                      </div>

                      {/* Expand Indicator */}
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-gray-400 flex-shrink-0" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />
                      )}
                    </div>
                  </div>

                  {/* Expanded Configuration Panel */}
                  {isExpanded && (
                    <MemberConfigPanel
                      member={member}
                      config={getMemberConfig(member.id)}
                      isAssigned={isAssigned}
                      existingAssignment={existingAssignments[member.id]}
                      currentActiveAssignment={currentActiveAssignments[member.id]}
                      trainerPlans={trainerPlans}
                      plansLoading={plansLoading}
                      trainerAvailableDays={trainerAvailableDays}
                      trainerAvailableTimeSlots={trainerAvailableTimeSlots}
                      bookedSlotsMap={bookedSlotsMap}
                      fetchingSlots={fetchingSlots}
                      activeDay={activeDay}
                      setActiveDay={setActiveDay}
                      onUpdateConfig={(updates) => updateMemberConfig(member.id, updates)}
                      onConfirm={() => confirmMemberConfig(member.id)}
                      onRemove={() => removeMemberConfig(member.id)}
                      onUnassign={() => toggleUnassign(member.id)}
                      onCancel={() => {
                        setExpandedMemberId(null);
                        setActiveDay("");
                      }}
                      formatDuration={formatDuration}
                      trainerId={id}
                    />
                  )}
                </div>
              );
            })
          )}
        </div>
      </main>

      {/* Fixed Bottom Save Button */}
      {hasChanges && (
        <div className="fixed bottom-20 left-0 right-0 px-4 pb-4 bg-gradient-to-t from-gray-50 via-gray-50 to-transparent pt-8 pointer-events-none">
          <div className="max-w-screen-md mx-auto">
            <div className="bg-white rounded-xl p-4 shadow-lg border border-gray-200 pointer-events-auto">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm text-gray-600">
                  {newConfiguredCount > 0 && (
                    <span className="text-[#f0813d] mr-2">+{newConfiguredCount} new</span>
                  )}
                  {unassignCount > 0 && (
                    <span className="text-[#f0813d]">-{unassignCount} removed</span>
                  )}
                </div>
              </div>
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full py-3 bg-gradient-to-r from-[#f0813d] to-[#9c4400] text-white rounded-xl font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    Save All Assignments
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Per-Member Configuration Panel ─────────────────────────────────────────

function MemberConfigPanel({
  member,
  config,
  isAssigned,
  existingAssignment,
  currentActiveAssignment,
  trainerPlans,
  plansLoading,
  trainerAvailableDays,
  trainerAvailableTimeSlots,
  bookedSlotsMap,
  fetchingSlots,
  activeDay,
  setActiveDay,
  onUpdateConfig,
  onConfirm,
  onRemove,
  onUnassign,
  onCancel,
  formatDuration,
  trainerId,
}) {
  const router = useRouter();
  const {
    selectedSlots,
    planId: selectedPlanId,
    paymentMode,
    useCustomPrice,
    customPrice,
    customStartDate,
    amountReceived,
    nextPaymentDate,
  } = config;
  const selectedPlan = trainerPlans.find((plan) => plan.id === selectedPlanId);
  const resolvedStartDate = customStartDate || getDefaultPlanStartDate(currentActiveAssignment?.planEndDate);
  const planTotalAmount = roundCurrency(
    useCustomPrice && customPrice ? parseFloat(customPrice) : selectedPlan?.price || 0
  );
  const receivedAmountValue = roundCurrency(amountReceived);
  const pendingAmount = roundCurrency(Math.max(0, planTotalAmount - receivedAmountValue));

  // Available slots for active day
  const activeDaySlots = activeDay ? trainerAvailableTimeSlots[activeDay] || [] : [];

  // Active slot usage for the selected day by other members.
  const activeDayAssignmentsByOthers = (bookedSlotsMap[activeDay] || []).filter(
    (b) => b.member_id !== member.id
  );
  const activeDayAssignedCountMap = activeDayAssignmentsByOthers.reduce((acc, booking) => {
    acc[booking.time_slot] = (acc[booking.time_slot] || 0) + 1;
    return acc;
  }, {});

  // This member's existing slots for active day
  const memberExistingSlots = (bookedSlotsMap[activeDay] || [])
    .filter((b) => b.member_id === member.id)
    .map((b) => b.time_slot);

  const totalSelections = Object.entries(selectedSlots)
    .filter(([, slots]) => slots.length > 0)
    .reduce((sum, [, slots]) => sum + slots.length, 0);

  return (
    <div className="bg-white border-2 border-[#f0813d] border-t-0 rounded-b-xl shadow-sm overflow-hidden">
      {/* Already assigned info */}
      {isAssigned && existingAssignment && (
        <div className="p-4 bg-[#f0813d]/10 border-b border-[#f0813d]/10">
          <div className="flex items-center gap-2 mb-1">
            <Check className="w-4 h-4 text-[#f0813d]" />
            <span className="text-sm font-semibold text-[#9c4400]">Already Assigned</span>
          </div>
          {existingAssignment.planName && (
            <p className="text-xs text-[#f0813d]">
              Plan: {existingAssignment.planName} · ₹
              {(existingAssignment.planPrice || 0).toLocaleString("en-IN")}
              {existingAssignment.planDuration && (
                <span> · {formatDuration(existingAssignment.planDuration)}</span>
              )}
            </p>
          )}
          {existingAssignment.planEndDate && (
            <p className="text-xs text-gray-500 mt-0.5">
              Ends: {new Date(existingAssignment.planEndDate).toLocaleDateString("en-IN")}
            </p>
          )}
        </div>
      )}

      {/* Plan Selection (for new assignments) */}
      {!isAssigned && (
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
              <Tag className="w-4 h-4" />
              Select Plan
            </h3>
            <button
              type="button"
              onClick={() => router.push(`/settings/trainers/${trainerId}?tab=plans`)}
              className="text-xs text-[#f0813d] font-medium flex items-center gap-1 hover:text-[#9c4400] px-2 py-1 bg-[#f0813d]/10 rounded-lg"
            >
              <Plus className="w-3 h-3" />
              Create Plan
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>

          {plansLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-5 h-5 text-[#f0813d] animate-spin" />
              <span className="ml-2 text-sm text-gray-500">Loading plans...</span>
            </div>
          ) : trainerPlans.length === 0 ? (
            <div className="text-center py-5 bg-gray-50 rounded-xl">
              <Tag className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No plans available</p>
              <button
                type="button"
                onClick={() => router.push(`/settings/trainers/${trainerId}?tab=plans`)}
                className="mt-2 text-xs text-[#f0813d] font-medium flex items-center gap-1 mx-auto hover:text-[#9c4400]"
              >
                <Plus className="w-3 h-3" />
                Create a plan first
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {trainerPlans.map((plan) => {
                const isSelected = selectedPlanId === plan.id;
                return (
                  <div
                    key={plan.id}
                    onClick={() => {
                      const nextSelected = isSelected ? null : plan.id;
                      onUpdateConfig({
                        planId: nextSelected,
                        useCustomPrice: false,
                        customPrice: nextSelected ? plan.price.toString() : "",
                        customStartDate: nextSelected ? getDefaultPlanStartDate(currentActiveAssignment?.planEndDate) : "",
                        amountReceived: nextSelected ? plan.price.toString() : "",
                        nextPaymentDate: "",
                      });
                    }}
                    className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${
                      isSelected
                        ? "border-[#f0813d] bg-gradient-to-r from-[#f0813d]/10 to-[#f0813d]/10 shadow-sm"
                        : "border-gray-100 bg-gray-50/50 hover:border-gray-300"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                          isSelected ? "border-[#f0813d] bg-[#f0813d]" : "border-gray-300 bg-white"
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <div
                        className={`w-9 h-9 rounded-lg flex items-center justify-center text-white flex-shrink-0 ${
                          isSelected
                            ? "bg-gradient-to-br from-[#f0813d] to-[#9c4400]"
                            : "bg-gradient-to-br from-gray-400 to-gray-500"
                        }`}
                      >
                        <Award className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-gray-900 text-sm truncate">{plan.name}</h4>
                        <p className="text-xs text-gray-500 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDuration(plan.duration_days)}
                        </p>
                      </div>
                      <p className="text-base font-bold text-gray-900 flex-shrink-0">
                        ₹{plan.price.toLocaleString("en-IN")}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Payment Split + Mode (when plan selected) */}
          {selectedPlanId && (
            <div className="mt-3 space-y-3">
              <div className="bg-gray-50 rounded-xl p-3 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
                  <CalendarDays className="w-4 h-4 text-[#f0813d]" />
                  Start Date
                </div>
                <input
                  type="date"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#f0813d]/20 outline-none text-sm"
                  value={resolvedStartDate}
                  onChange={(e) => onUpdateConfig({ customStartDate: e.target.value })}
                />
                {selectedPlan && (
                  <p className="text-xs text-[#f0813d]">
                    Validity: {new Date(`${resolvedStartDate}T00:00:00`).toLocaleDateString("en-IN")} to {(() => {
                      const endDate = new Date(`${resolvedStartDate}T00:00:00`);
                      endDate.setDate(endDate.getDate() + selectedPlan.duration_days);
                      return endDate.toLocaleDateString("en-IN");
                    })()}
                  </p>
                )}
              </div>

              {/* Custom Price Toggle */}
              <div className="bg-gray-50 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900 text-sm">Custom Price</span>
                  <button
                    type="button"
                    onClick={() => {
                      const newVal = !useCustomPrice;
                      const updates = { useCustomPrice: newVal };
                      if (newVal) {
                        const plan = trainerPlans.find((p) => p.id === selectedPlanId);
                        if (plan) updates.customPrice = plan.price.toString();
                      }
                      onUpdateConfig(updates);
                    }}
                    className={`w-10 h-5 rounded-full transition ${
                      useCustomPrice ? "bg-[#f0813d]" : "bg-gray-300"
                    }`}
                  >
                    <div
                      className={`w-4 h-4 bg-white rounded-full shadow transition transform ${
                        useCustomPrice ? "translate-x-5" : "translate-x-0.5"
                      }`}
                    ></div>
                  </button>
                </div>
                {useCustomPrice && (
                  <input
                    type="text"
                    inputMode="decimal"
                    pattern="[0-9]*\.?[0-9]*"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#f0813d]/20 outline-none text-sm"
                    placeholder="Enter custom price"
                    value={customPrice}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === "" || /^\d*\.?\d*$/.test(value)) {
                        onUpdateConfig({ customPrice: value });
                      }
                    }}
                  />
                )}
              </div>

              <div className="bg-gray-50 rounded-xl p-3 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
                  <Tag className="w-4 h-4 text-[#f0813d]" />
                  Amount Received
                </div>
                <input
                  type="text"
                  inputMode="decimal"
                  pattern="[0-9]*\.?[0-9]*"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#f0813d]/20 outline-none text-sm"
                  placeholder="Enter amount received"
                  value={amountReceived}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === "" || /^\d*\.?\d*$/.test(value)) {
                      onUpdateConfig({ amountReceived: value });
                    }
                  }}
                />
                <p className="text-xs text-gray-500">Plan amount: ₹{planTotalAmount.toLocaleString("en-IN")}</p>
              </div>

              {pendingAmount > 0 && (
                <div className="bg-gray-50 rounded-xl p-3 space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
                    <CalendarDays className="w-4 h-4 text-[#f0813d]" />
                    Next Due Date
                  </div>
                  <input
                    type="date"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#f0813d]/20 outline-none text-sm"
                    value={nextPaymentDate}
                    onChange={(e) => onUpdateConfig({ nextPaymentDate: e.target.value })}
                    min={resolvedStartDate}
                  />
                </div>
              )}

              {/* Payment Split */}
              <div className="bg-gradient-to-r from-[#f0813d]/10 to-[#f0813d]/10 border border-[#f0813d]/10 rounded-xl p-3">
                <p className="text-xs font-semibold text-[#9c4400] mb-2">Payment Summary:</p>
                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-white rounded-lg p-2 text-center border border-[#f0813d]/10">
                    <p className="text-[10px] text-gray-500 uppercase">Collected</p>
                    <p className="text-sm font-bold text-[#9c4400]">₹{receivedAmountValue.toLocaleString("en-IN")}</p>
                  </div>
                  <div className="text-gray-400 text-xs">+</div>
                  <div className="flex-1 bg-white rounded-lg p-2 text-center border border-[#f0813d]/10">
                    <p className="text-[10px] text-gray-500 uppercase">Remaining</p>
                    <p className="text-sm font-bold text-[#9c4400]">₹{pendingAmount.toLocaleString("en-IN")}</p>
                  </div>
                  <div className="text-gray-400 text-xs">=</div>
                  <div className="flex-1 bg-white rounded-lg p-2 text-center border border-[#f0813d]/10">
                    <p className="text-[10px] text-gray-500 uppercase">Contract</p>
                    <p className="text-sm font-bold text-[#9c4400]">₹{planTotalAmount.toLocaleString("en-IN")}</p>
                  </div>
                </div>
              </div>

              {/* Payment Mode */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Payment Mode
                </label>
                <div className="flex gap-2">
                  {PAYMENT_MODE_OPTIONS.map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => onUpdateConfig({ paymentMode: mode })}
                      className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all border ${
                        paymentMode === mode
                          ? "border-[#f0813d] bg-[#f0813d]/10 text-[#9c4400]"
                          : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      {mode.charAt(0).toUpperCase() + mode.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Schedule Selection */}
      {trainerAvailableDays.length > 0 && (
        <div className="p-4 space-y-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
            <CalendarDays className="w-4 h-4" />
            Select Schedule
            {totalSelections > 0 && (
              <span className="ml-auto text-xs bg-[#f0813d]/15 text-[#9c4400] px-2 py-0.5 rounded-full font-medium">
                {totalSelections} slot{totalSelections > 1 ? "s" : ""} selected
              </span>
            )}
          </h3>

          {/* Day Tabs */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Day</label>
            <div className="flex flex-wrap gap-1.5">
              {trainerAvailableDays.map((day) => {
                const dayCount = (selectedSlots[day] || []).length;
                const isActive = activeDay === day;
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => setActiveDay(isActive ? "" : day)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all relative ${
                      isActive
                        ? "bg-[#9c4400] text-white shadow-sm"
                        : dayCount > 0
                        ? "bg-[#f0813d]/10 text-[#9c4400] border border-[#f0813d]/20"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {day.slice(0, 3)}
                    {dayCount > 0 && (
                      <span
                        className={`ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold ${
                          isActive ? "bg-white text-[#f0813d]" : "bg-[#9c4400] text-white"
                        }`}
                      >
                        {dayCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Time Slots */}
          {activeDay && (
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1.5 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                Time Slots — {activeDay}
                <span className="text-gray-400 ml-1">(tap to toggle)</span>
              </label>

              {fetchingSlots ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="w-5 h-5 text-[#f0813d] animate-spin" />
                  <span className="ml-2 text-sm text-gray-500">Checking availability...</span>
                </div>
              ) : activeDaySlots.length === 0 ? (
                <div className="text-center py-6 bg-gray-50 rounded-xl">
                  <Clock className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No slots for {activeDay}</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {activeDaySlots.map((slot) => {
                    const assignedCount = activeDayAssignedCountMap[slot] || 0;
                    const hasAssignedMembers = assignedCount > 0;
                    const isMemberSlot = memberExistingSlots.includes(slot);
                    const isSlotSelected = (selectedSlots[activeDay] || []).includes(slot);

                    return (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => {
                          const daySlots = selectedSlots[activeDay] || [];
                          const updated = daySlots.includes(slot)
                            ? daySlots.filter((s) => s !== slot)
                            : [...daySlots, slot];
                          onUpdateConfig({
                            selectedSlots: { ...selectedSlots, [activeDay]: updated },
                          });
                        }}
                        className={`px-2 py-2 rounded-lg text-xs font-medium transition-all text-center ${
                          isSlotSelected
                            ? "bg-[#9c4400] text-white shadow-md scale-[1.02]"
                            : isMemberSlot
                            ? "bg-[#f0813d]/10 text-[#9c4400] border-2 border-[#f0813d]/30 hover:bg-[#f0813d]/15"
                            : hasAssignedMembers
                            ? "bg-[#f0813d]/10 text-[#9c4400] border border-[#f0813d]/20 hover:bg-[#f0813d]/15"
                            : "bg-white text-gray-700 border border-gray-200 hover:border-[#f0813d]/30 hover:bg-[#f0813d]/10"
                        }`}
                        title={
                          hasAssignedMembers
                            ? `${assignedCount} member${assignedCount > 1 ? "s" : ""} already assigned`
                            : isMemberSlot
                            ? "Current slot"
                            : "Available"
                        }
                      >
                        {slot}
                        {hasAssignedMembers && (
                          <span className="block text-[9px] mt-0.5">
                            {assignedCount} member{assignedCount > 1 ? "s" : ""}
                          </span>
                        )}
                        {isMemberSlot && !isSlotSelected && (
                          <span className="block text-[9px] text-[#f0813d] mt-0.5">Current</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Legend */}
              <div className="flex items-center gap-4 mt-3 text-[10px] text-gray-500">
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-sm bg-white border border-gray-200" /> Available
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-sm bg-[#f0813d]/10 border border-[#f0813d]/20" /> Assigned (shared)
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-sm bg-[#9c4400]" /> Selected
                </span>
              </div>
            </div>
          )}

          {/* Selected Slots Summary */}
          {totalSelections > 0 && (
            <div className="p-3 bg-[#f0813d]/10 border border-[#f0813d]/10 rounded-xl">
              <p className="text-xs font-semibold text-[#9c4400] mb-1.5">Selected Schedule:</p>
              <div className="space-y-1">
                {Object.entries(selectedSlots)
                  .filter(([, slots]) => slots.length > 0)
                  .map(([day, slots]) => (
                    <p key={day} className="text-xs text-[#9c4400]">
                      <span className="font-medium">{day}:</span> {slots.join(", ")}
                    </p>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="p-4 flex gap-3">
        <button
          onClick={onCancel}
          className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium text-sm hover:bg-gray-200 transition-colors"
        >
          Cancel
        </button>
        {isAssigned ? (
          <button
            onClick={onUnassign}
            className="flex-1 px-4 py-2.5 bg-gradient-to-r from-[#f0813d]/10 to-[#f0813d]/10 border border-[#f0813d]/20 text-[#f0813d] rounded-xl font-medium text-sm flex items-center justify-center gap-2 hover:from-[#f0813d]/15 hover:to-[#f0813d]/15 transition-colors"
          >
            <X className="w-4 h-4" />
            Unassign
          </button>
        ) : (
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2.5 bg-gradient-to-r from-[#f0813d] to-[#9c4400] text-white rounded-xl font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
          >
            <Check className="w-4 h-4" />
            Confirm
          </button>
        )}
      </div>
    </div>
  );
}
