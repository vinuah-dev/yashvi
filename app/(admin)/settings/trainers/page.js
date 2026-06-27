"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuthContext } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import Header from "@/components/layout/Header";
import { supabase } from "@/lib/supabaseClient";
import { useUserRole } from "@/lib/hooks/useUserRole";
import {
  Users,
  Plus,
  Search,
  UserCheck,
  Dumbbell,
  Apple,
  MoreVertical,
  ChevronRight,
  Phone,
  Mail,
  Calendar,
  Edit2,
  Trash2,
  UserPlus,
  AlertCircle,
  CheckCircle,
  IndianRupee,
  CalendarDays,
  Wallet,
  Clock,
  Download,
} from "lucide-react";
import { formatHoursLabel } from "@/lib/utils/trainerAttendance";

function formatTrainerExportDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-GB").replace(/\//g, "-");
}

function getTrainerExportMonthKey(value) {
  if (!value) return "UNSCHEDULED";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "UNSCHEDULED";
  return date.toLocaleDateString("en-IN", { month: "long" }).toUpperCase();
}

export default function TrainersPage() {
  const router = useRouter();
  const { canCreateTrainer, user } = useUserRole();
  const [trainers, setTrainers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const { selectedGym } = useAuthContext();
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [payrollMonth, setPayrollMonth] = useState(new Date().toISOString().slice(0, 7));
  const [payrollLoading, setPayrollLoading] = useState(false);
  const [exportingOverallTrainerExcel, setExportingOverallTrainerExcel] = useState(false);
  const [payrollData, setPayrollData] = useState({ summary: null, trainers: [] });
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    totalAssignments: 0
  });

  // gym now comes from AuthContext (no localStorage read needed)

  const fetchTrainers = useCallback(async () => {
    if (!selectedGym?.id) return;
    setLoading(true);

    try {
      // Single RPC call replaces 6+ separate queries
      const response = await fetch("/api/trainers/list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ p_gym_id: selectedGym.id }),
      });

      const result = await response.json();

      if (!response.ok || result.error) {
        console.error("Error fetching trainers:", result.error);
        setTrainers([]);
        return;
      }

      const { trainers: trainersData, stats: rpcStats } = result.data;

      // Map trainers from RPC response
      const enrichedTrainers = (trainersData || []).map(t => ({
        id: t.id,
        profileId: t.profile_id,
        name: `${t.first_name || ""} ${t.last_name || ""}`.trim(),
        email: t.email,
        phone: t.phone,
        specialization: t.specialization,
        bio: t.bio,
        isActive: t.is_active,
        hireDate: t.hire_date,
        monthlySalary: t.monthly_salary || 0,
        assignedMembers: t.assigned_members || 0,
        dietPlans: t.diet_plans || 0,
        workoutPlans: t.workout_plans || 0
      }));

      setTrainers(enrichedTrainers);
      setStats({
        total: rpcStats?.total || 0,
        active: rpcStats?.active || 0,
        totalAssignments: rpcStats?.total_assignments || 0
      });
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedGym?.id]);

  const fetchPayroll = useCallback(async () => {
    if (!selectedGym?.id) return;

    setPayrollLoading(true);
    try {
      const response = await fetch("/api/trainers/payroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          p_gym_id: selectedGym.id,
          p_month: `${payrollMonth}-01`,
        }),
      });

      const result = await response.json();

      if (!response.ok || result.error) {
        console.error("Error fetching trainer payroll:", result.error);
        setPayrollData({ summary: null, trainers: [] });
        return;
      }

      setPayrollData({
        summary: result.data?.summary || null,
        trainers: result.data?.trainers || [],
      });
    } catch (error) {
      console.error("Error fetching trainer payroll:", error);
      setPayrollData({ summary: null, trainers: [] });
    } finally {
      setPayrollLoading(false);
    }
  }, [selectedGym?.id, payrollMonth]);

  useEffect(() => {
    if (!selectedGym?.id) return;

    fetchTrainers();
    if (canCreateTrainer) {
      fetchPayroll();
    } else {
      setPayrollData({ summary: null, trainers: [] });
    }
  }, [selectedGym?.id, canCreateTrainer, fetchTrainers, fetchPayroll]);

  const handleDeleteTrainer = async (trainer) => {
    setDeleting(true);
    try {
      // 0) Revoke all sessions for this trainer (forces logout on their devices)
      try {
        await fetch("/api/trainers/revoke", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-user-id": String(user?.id || ""),
          },
          body: JSON.stringify({ trainerProfileId: trainer.profileId }),
        });
      } catch (err) {
        console.warn("Session revoke request failed", err);
      }

      // 1) Remove member assignments for this trainer
      await supabase
        .from("trainer_member_assignments")
        .delete()
        .eq("trainer_id", trainer.profileId);

      // 2) Clear trainer references on diet/workout plans
      await supabase
        .from("diet_plans")
        .update({ trainer_id: null })
        .eq("trainer_id", trainer.profileId);

      await supabase
        .from("workout_plans")
        .update({ trainer_id: null })
        .eq("trainer_id", trainer.profileId);

      // 3) Delete gym_trainers record
      const { error } = await supabase
        .from("gym_trainers")
        .delete()
        .eq("id", trainer.id);

      if (error) throw error;

      // 4) Delete the trainer profile so it doesn't get re-synced
      const { error: profileError } = await supabase
        .from("profiles")
        .delete()
        .eq("id", trainer.profileId);

      if (profileError) {
        console.warn("Profile deletion failed (may have FK constraints):", profileError);
      }
      
      fetchTrainers();
      setDeleteConfirm(null);
    } catch (err) {
      console.error("Error deleting trainer:", err);
      alert("Failed to delete trainer");
    } finally {
      setDeleting(false);
    }
  };

  const filteredTrainers = trainers.filter(trainer =>
    trainer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    trainer.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    trainer.phone?.includes(searchQuery) ||
    trainer.specialization?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleExportOverallTrainerExcel = async () => {
    if (!selectedGym?.id || !selectedGym?.name) {
      alert("Please select a gym first");
      return;
    }

    setExportingOverallTrainerExcel(true);
    try {
      const XLSX = await import("xlsx");

      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from("trainer_member_assignments")
        .select(
          "id, member_id, trainer_id, plan_start_date, plan_end_date, assigned_at, plan_total_amount, total_paid_amount, pending_amount, next_payment_date"
        )
        .eq("gym_id", selectedGym.id)
        .order("plan_start_date", { ascending: true, nullsFirst: false })
        .order("assigned_at", { ascending: true });

      if (assignmentsError) throw assignmentsError;

      const assignments = assignmentsData || [];
      if (assignments.length === 0) {
        alert("No trainer plan assignments found to export");
        return;
      }

      const memberIds = Array.from(new Set(assignments.map((item) => item.member_id).filter(Boolean)));
      const trainerIds = Array.from(new Set(assignments.map((item) => item.trainer_id).filter(Boolean)));
      const assignmentIds = Array.from(new Set(assignments.map((item) => item.id).filter(Boolean)));

      const [{ data: membersData, error: membersError }, { data: profilesData, error: profilesError }, { data: earningsData, error: earningsError }] = await Promise.all([
        memberIds.length
          ? supabase
              .from("members")
              .select("id, full_name")
              .eq("gym_id", selectedGym.id)
              .in("id", memberIds)
          : Promise.resolve({ data: [], error: null }),
        trainerIds.length
          ? supabase
              .from("profiles")
              .select("id, first_name, last_name")
              .in("id", trainerIds)
          : Promise.resolve({ data: [], error: null }),
        assignmentIds.length
          ? supabase
              .from("trainer_earnings")
              .select("assignment_id, member_id, trainer_id, total_amount, payment_mode, created_at")
              .eq("gym_id", selectedGym.id)
              .in("assignment_id", assignmentIds)
              .order("created_at", { ascending: true })
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (membersError) throw membersError;
      if (profilesError) throw profilesError;
      if (earningsError) throw earningsError;

      const membersById = (membersData || []).reduce((acc, member) => {
        acc[member.id] = member.full_name || "Member";
        return acc;
      }, {});

      const trainersById = (profilesData || []).reduce((acc, profile) => {
        const fullName = `${profile.first_name || ""} ${profile.last_name || ""}`.trim();
        acc[profile.id] = fullName || "Trainer";
        return acc;
      }, {});

      const earningsByAssignmentId = (earningsData || []).reduce((acc, earning) => {
        if (!acc[earning.assignment_id]) {
          acc[earning.assignment_id] = [];
        }
        acc[earning.assignment_id].push(earning);
        return acc;
      }, {});

      const detailRows = [];
      assignments.forEach((assignment) => {
        const startDateRaw = assignment.plan_start_date || assignment.assigned_at || null;
        const dueDateRaw = assignment.next_payment_date || assignment.plan_end_date || null;
        const monthKey = getTrainerExportMonthKey(startDateRaw);
        const trainerName = trainersById[assignment.trainer_id] || "Trainer";
        const clientName = membersById[assignment.member_id] || "Member";
        const amount = Number(assignment.plan_total_amount || 0);
        const balance = Number(assignment.pending_amount || 0);
        const assignmentPayments = earningsByAssignmentId[assignment.id] || [];

        if (assignmentPayments.length === 0) {
          detailRows.push({
            monthKey,
            sortDate: startDateRaw ? new Date(startDateRaw).getTime() : Number.MAX_SAFE_INTEGER,
            trainerName,
            clientName,
            amount,
            startDate: formatTrainerExportDate(startDateRaw),
            dueDate: formatTrainerExportDate(dueDateRaw),
            balance,
            status: balance > 0 ? "PENDING" : "PAID",
            payment: "",
            paymentMode: "-",
            time: "",
          });
          return;
        }

        assignmentPayments.forEach((payment) => {
          detailRows.push({
            monthKey,
            sortDate: startDateRaw ? new Date(startDateRaw).getTime() : Number.MAX_SAFE_INTEGER,
            trainerName,
            clientName,
            amount,
            startDate: formatTrainerExportDate(startDateRaw),
            dueDate: formatTrainerExportDate(dueDateRaw),
            balance,
            status: balance > 0 ? "PARTIAL" : "PAID",
            payment: Number(payment.total_amount || 0),
            paymentMode: String(payment.payment_mode || "cash").toUpperCase(),
            time: formatTrainerExportDate(payment.created_at),
          });
        });
      });

      detailRows.sort((leftRow, rightRow) => {
        if (leftRow.sortDate !== rightRow.sortDate) return leftRow.sortDate - rightRow.sortDate;
        if (leftRow.trainerName !== rightRow.trainerName) return leftRow.trainerName.localeCompare(rightRow.trainerName);
        return leftRow.clientName.localeCompare(rightRow.clientName);
      });

      const groupedRows = new Map();
      detailRows.forEach((row) => {
        if (!groupedRows.has(row.monthKey)) groupedRows.set(row.monthKey, []);
        groupedRows.get(row.monthKey).push(row);
      });

      const header = [
        "TRAINER NAME",
        "CLIENT NAME",
        "AMOUNT",
        "START DATE",
        "DUE DATE",
        "BALANCE",
        "STATUS",
        "PAYMENT",
        "PAYMENT MODE",
        "TIME",
      ];

      const rows = [];
      const monthHeaderRows = [];
      const columnHeaderRows = [];

      groupedRows.forEach((monthRows, monthKey) => {
        rows.push([monthKey]);
        monthHeaderRows.push(rows.length);
        rows.push(header);
        columnHeaderRows.push(rows.length);

        monthRows.forEach((row) => {
          rows.push([
            row.trainerName,
            row.clientName,
            row.amount,
            row.startDate,
            row.dueDate,
            row.balance,
            row.status,
            row.payment,
            row.paymentMode,
            row.time,
          ]);
        });

        rows.push([]);
      });

      const sheet = XLSX.utils.aoa_to_sheet(rows);
      sheet["!cols"] = [
        { wch: 20 },
        { wch: 24 },
        { wch: 12 },
        { wch: 14 },
        { wch: 14 },
        { wch: 12 },
        { wch: 12 },
        { wch: 12 },
        { wch: 14 },
        { wch: 14 },
      ];

      monthHeaderRows.forEach((rowNum) => {
        const cellRef = `A${rowNum}`;
        if (!sheet[cellRef]) return;
        sheet[cellRef].s = {
          font: { bold: true, color: { rgb: "111827" }, sz: 12 },
          fill: { fgColor: { rgb: "FFF200" } },
          alignment: { horizontal: "center", vertical: "center" },
        };
      });

      columnHeaderRows.forEach((rowNum) => {
        for (let colIndex = 0; colIndex < header.length; colIndex += 1) {
          const ref = XLSX.utils.encode_cell({ r: rowNum - 1, c: colIndex });
          if (!sheet[ref]) continue;
          sheet[ref].s = {
            font: { bold: true, color: { rgb: "1F2937" }, sz: 11 },
            fill: { fgColor: { rgb: "DCEEFF" } },
            alignment: { horizontal: "center", vertical: "center" },
          };
        }
      });

      for (let row = 1; row <= rows.length; row += 1) {
        const amountRef = `C${row}`;
        const balanceRef = `F${row}`;
        const paymentRef = `H${row}`;
        if (sheet[amountRef] && typeof sheet[amountRef].v === "number") {
          sheet[amountRef].z = "#,##0";
        }
        if (sheet[balanceRef] && typeof sheet[balanceRef].v === "number") {
          sheet[balanceRef].z = "#,##0";
        }
        if (sheet[paymentRef] && typeof sheet[paymentRef].v === "number") {
          sheet[paymentRef].z = "#,##0";
        }
      }

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, sheet, "TRAINER+PT");

      const safeGymName = (selectedGym.name || "Gym").replace(/\s+/g, "_");
      XLSX.writeFile(workbook, `${safeGymName}_Trainer_PT_Overall_${new Date().toISOString().split("T")[0]}.xlsx`);

      alert("Overall trainer Excel exported successfully");
    } catch (error) {
      console.error("Error exporting overall trainer excel:", error);
      alert("Failed to export overall trainer Excel. Please try again.");
    } finally {
      setExportingOverallTrainerExcel(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Header title="Trainer Management" />

      <main className="px-4 py-4 space-y-4">
        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-4 h-4 text-[#f0813d]" />
              <span className="text-xs text-gray-500">Total</span>
            </div>
            <p className="text-xl font-bold text-gray-900">{stats.total}</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle className="w-4 h-4 text-[#f0813d]" />
              <span className="text-xs text-gray-500">Active</span>
            </div>
            <p className="text-xl font-bold text-gray-900">{stats.active}</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <UserCheck className="w-4 h-4 text-[#f0813d]" />
              <span className="text-xs text-gray-500">Assigned</span>
            </div>
            <p className="text-xl font-bold text-gray-900">{stats.totalAssignments}</p>
          </div>
        </div>

        {/* Search and Add */}
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search trainers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#f0813d]/20 focus:border-transparent"
            />
          </div>
          {canCreateTrainer && (
            <button
              onClick={() => router.push("/settings/trainers/add")}
              className="px-4 py-3 bg-gradient-to-r from-[#f0813d] to-[#9c4400] text-white rounded-xl flex items-center gap-2 font-medium shadow-md hover:shadow-lg transition-shadow"
            >
              <Plus className="w-5 h-5" />
              <span className="hidden sm:inline">Add</span>
            </button>
          )}
        </div>

        {canCreateTrainer && (
          <div className="bg-white rounded-xl p-4 shadow-sm space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h3 className="font-semibold text-gray-900">Monthly Payroll Dashboard</h3>
                <p className="text-xs text-gray-500">Attendance-based salary, PT charges, and total payable by trainer.</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportOverallTrainerExcel}
                  disabled={exportingOverallTrainerExcel || payrollLoading}
                  className="px-3 py-2 bg-[#f0813d]/10 text-[#9c4400] border border-[#f0813d]/20 rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <Download className="w-4 h-4" />
                  {exportingOverallTrainerExcel ? "Exporting..." : "Overall Excel"}
                </button>
                <div className="relative">
                  <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="month"
                    value={payrollMonth}
                    onChange={(e) => setPayrollMonth(e.target.value)}
                    className="pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#f0813d]/20 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                <div className="flex items-center gap-2 text-gray-700 text-xs font-medium uppercase tracking-wide">
                  <Clock className="w-4 h-4" />
                  Worked Hours
                </div>
                <p className="mt-2 text-lg font-bold text-gray-900">
                  {formatHoursLabel(Number(payrollData.summary?.total_worked_hours || 0) * 60)}
                </p>
              </div>
              <div className="rounded-xl border border-[#f0813d]/10 bg-[#f0813d]/10 p-3">
                <div className="flex items-center gap-2 text-[#9c4400] text-xs font-medium uppercase tracking-wide">
                  <IndianRupee className="w-4 h-4" />
                  Salary Earned
                </div>
                <p className="mt-2 text-lg font-bold text-[#9c4400]">
                  ₹{Number(payrollData.summary?.total_salary_earned || 0).toLocaleString("en-IN")}
                </p>
              </div>
              <div className="rounded-xl border border-[#f0813d]/10 bg-[#f0813d]/10 p-3">
                <div className="flex items-center gap-2 text-[#9c4400] text-xs font-medium uppercase tracking-wide">
                  <Wallet className="w-4 h-4" />
                  PT Charges
                </div>
                <p className="mt-2 text-lg font-bold text-[#9c4400]">
                  ₹{Number(payrollData.summary?.total_pt_charges || 0).toLocaleString("en-IN")}
                </p>
              </div>
              <div className="rounded-xl border border-[#f0813d]/10 bg-[#f0813d]/10 p-3">
                <div className="flex items-center gap-2 text-[#9c4400] text-xs font-medium uppercase tracking-wide">
                  <IndianRupee className="w-4 h-4" />
                  Total Payable
                </div>
                <p className="mt-2 text-lg font-bold text-[#9c4400]">
                  ₹{Number(payrollData.summary?.total_payable || 0).toLocaleString("en-IN")}
                </p>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Trainer</th>
                    <th className="px-4 py-3 text-left font-medium">Hours</th>
                    <th className="px-4 py-3 text-left font-medium">Salary Earned</th>
                    <th className="px-4 py-3 text-left font-medium">PT</th>
                    <th className="px-4 py-3 text-left font-medium">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {payrollLoading ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-gray-500">Loading payroll...</td>
                    </tr>
                  ) : payrollData.trainers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-gray-500">No payroll data for this month.</td>
                    </tr>
                  ) : (
                    payrollData.trainers.map((row) => (
                      <tr key={row.gym_trainer_id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <button
                            onClick={() => router.push(`/settings/trainers/${row.gym_trainer_id}?tab=attendance`)}
                            className="text-left"
                          >
                            <p className="font-medium text-gray-900">{row.trainer_name}</p>
                            <p className="text-xs text-gray-500">
                              Salary ₹{Number(row.monthly_salary || 0).toLocaleString("en-IN")}
                              {row.specialization ? ` • ${row.specialization}` : ""}
                            </p>
                          </button>
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          <p>{formatHoursLabel(Number(row.worked_hours || 0) * 60)} / {formatHoursLabel(Number(row.expected_hours || 0) * 60)}</p>
                          <p className="text-xs text-gray-500">{Number(row.working_days || 0).toLocaleString("en-IN")} working days</p>
                        </td>
                        <td className="px-4 py-3 font-medium text-[#9c4400]">₹{Number(row.salary_earned || 0).toLocaleString("en-IN")}</td>
                        <td className="px-4 py-3 font-medium text-[#9c4400]">₹{Number(row.pt_charges || 0).toLocaleString("en-IN")}</td>
                        <td className="px-4 py-3 font-semibold text-[#9c4400]">₹{Number(row.total_payable || 0).toLocaleString("en-IN")}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Trainers List */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-xl p-4 shadow-sm animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gray-200 rounded-full" />
                  <div className="flex-1">
                    <div className="h-4 bg-gray-200 rounded w-1/3 mb-2" />
                    <div className="h-3 bg-gray-200 rounded w-1/2" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredTrainers.length === 0 ? (
          <div className="bg-white rounded-xl p-8 shadow-sm text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {searchQuery ? "No trainers found" : "No trainers yet"}
            </h3>
            <p className="text-gray-500 mb-4">
              {searchQuery 
                ? "Try a different search term" 
                : canCreateTrainer ? "Add your first trainer to get started" : "No trainers have been added yet"}
            </p>
            {!searchQuery && canCreateTrainer && (
              <button
                onClick={() => router.push("/settings/trainers/add")}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#9c4400] text-white rounded-lg font-medium"
              >
                <UserPlus className="w-4 h-4" />
                Add Trainer
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredTrainers.map((trainer) => (
              <div
                key={trainer.id}
                className="bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg ${
                    trainer.isActive 
                      ? "bg-gradient-to-br from-[#f0813d] to-[#9c4400]" 
                      : "bg-gray-400"
                  }`}>
                    {trainer.name.charAt(0).toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-gray-900 truncate">
                        {trainer.name}
                      </h3>
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
                      <p className="text-sm text-[#f0813d] font-medium mb-1">
                        {trainer.specialization}
                      </p>
                    )}

                    <p className="text-xs text-[#9c4400] font-medium mb-2">
                      Monthly Salary: ₹{Number(trainer.monthlySalary || 0).toLocaleString("en-IN")}
                    </p>

                    <div className="flex flex-wrap gap-2 text-xs text-gray-500 mb-2">
                      {trainer.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {trainer.phone}
                        </span>
                      )}
                      {trainer.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {trainer.email}
                        </span>
                      )}
                    </div>

                    {/* Stats */}
                    <div className="flex gap-4 text-sm">
                      <div className="flex items-center gap-1">
                        <UserCheck className="w-4 h-4 text-[#f0813d]" />
                        <span className="text-gray-600">
                          <strong>{trainer.assignedMembers}</strong> members
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Apple className="w-4 h-4 text-[#f0813d]" />
                        <span className="text-gray-600">
                          <strong>{trainer.dietPlans}</strong> diets
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Dumbbell className="w-4 h-4 text-[#f0813d]" />
                        <span className="text-gray-600">
                          <strong>{trainer.workoutPlans}</strong> workouts
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => router.push(`/settings/trainers/${trainer.id}`)}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      title="View Details"
                    >
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    </button>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                  <button
                    onClick={() => router.push(`/settings/trainers/${trainer.id}`)}
                    className="flex-1 py-2 text-sm font-medium text-[#f0813d] bg-[#f0813d]/10 rounded-lg hover:bg-[#f0813d]/15 transition-colors"
                  >
                    View Details
                  </button>
                  <button
                    onClick={() => router.push(`/settings/trainers/${trainer.id}/assign`)}
                    className="flex-1 py-2 text-sm font-medium text-[#f0813d] bg-[#f0813d]/10 rounded-lg hover:bg-[#f0813d]/15 transition-colors"
                  >
                    Assign Members
                  </button>
                  {canCreateTrainer && (
                    <button
                      onClick={() => setDeleteConfirm(trainer)}
                      className="py-2 px-3 text-sm font-medium text-[#f0813d] bg-[#f0813d]/10 rounded-lg hover:bg-[#f0813d]/15 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteConfirm && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-[#f0813d]/15 rounded-full">
                  <AlertCircle className="w-6 h-6 text-[#f0813d]" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Delete Trainer</h3>
                  <p className="text-sm text-gray-500">This action cannot be undone</p>
                </div>
              </div>
              
              <p className="text-gray-600 mb-6">
                Are you sure you want to remove <strong>{deleteConfirm.name}</strong> from your gym?
                {deleteConfirm.assignedMembers > 0 && (
                  <span className="block mt-2 text-[#f0813d] text-sm">
                    ⚠️ This trainer has {deleteConfirm.assignedMembers} assigned member(s).
                  </span>
                )}
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 py-2 px-4 border border-gray-200 rounded-xl font-medium text-gray-700 hover:bg-gray-50"
                  disabled={deleting}
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteTrainer(deleteConfirm)}
                  className="flex-1 py-2 px-4 bg-[#9c4400] text-white rounded-xl font-medium hover:bg-[#9c4400] disabled:opacity-50"
                  disabled={deleting}
                >
                  {deleting ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
