"use client";

import { useAuthContext } from "@/contexts/AuthContext";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Header from "@/components/layout/Header";
import { FinancePageSkeleton } from "@/components/shared/Skeleton";
import { useToast } from "@/contexts/ToastContext";
import { useUserRole } from "@/lib/hooks/useUserRole";
import { 
  DollarSign, 
  TrendingUp, 
  Clock, 
  AlertCircle,
  CreditCard,
  Wallet,
  Calendar,
  Filter,
  ChevronRight,
  Plus,
  Download,
  Receipt,
  Users,
  BarChart3,
  History,
  Search,
  Phone,
  Mail,
  FileText,
  Zap,
  Home,
  Briefcase,
  Wrench,
  Pill,
  Megaphone,
  Package,
  IndianRupee,
  X,
  Pencil,
  Save,
  Loader2,
  Trash2
} from "lucide-react";

const EXPENSE_EXCEL_AMOUNT_FORMAT = "#,##0.##";

const EXPENSE_CATEGORY_META = {
  rent: { name: "Rent", icon: <Home className="w-4 h-4" /> },
  electricity: { name: "Electricity", icon: <Zap className="w-4 h-4" /> },
  salary: { name: "Salary", icon: <Briefcase className="w-4 h-4" /> },
  equipment: { name: "Equipment", icon: <IndianRupee className="w-4 h-4" /> },
  maintenance: { name: "Maintenance", icon: <Wrench className="w-4 h-4" /> },
  supplements: { name: "Supplements", icon: <Pill className="w-4 h-4" /> },
  marketing: { name: "Marketing", icon: <Megaphone className="w-4 h-4" /> },
  other: { name: "Other", icon: <Package className="w-4 h-4" /> },
};

function getExpenseExportFileName(gymName, title) {
  const safeGymName = (gymName || "Gym").replace(/\s+/g, "_");
  const safeTitle = title.replace(/\s+/g, "_");
  return `${safeGymName}_${safeTitle}.xlsx`;
}

function formatExpenseExportDate(value) {
  if (!value) return "";

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-GB").replace(/\//g, "-");
}

function styleExpenseExportSheet(sheet, rowCount) {
  sheet["!cols"] = [{ wch: 44 }, { wch: 14 }, { wch: 16 }];
  sheet["!rows"] = [{ hpx: 26 }, { hpx: 12 }];
  sheet["!autofilter"] = { ref: `A1:C${Math.max(rowCount, 2)}` };

  ["A1", "B1", "C1"].forEach((cellRef) => {
    if (!sheet[cellRef]) return;
    sheet[cellRef].s = {
      font: { bold: true, color: { rgb: "000000" }, sz: 14 },
      fill: { fgColor: { rgb: "18A7D8" } },
      alignment: { horizontal: "left", vertical: "center" },
      border: {
        top: { style: "thin", color: { rgb: "18A7D8" } },
        bottom: { style: "thin", color: { rgb: "18A7D8" } },
      },
    };
  });

  for (let row = 3; row <= rowCount; row += 1) {
    const descriptionCell = sheet[`A${row}`];
    const amountCell = sheet[`B${row}`];
    const dateCell = sheet[`C${row}`];

    if (descriptionCell) {
      descriptionCell.s = {
        font: { sz: 12 },
        alignment: { vertical: "center", wrapText: true },
      };
    }

    if (amountCell) {
      amountCell.z = EXPENSE_EXCEL_AMOUNT_FORMAT;
      amountCell.s = {
        font: { sz: 12, bold: true },
        alignment: { horizontal: "right", vertical: "center" },
      };
    }

    if (dateCell) {
      dateCell.s = {
        font: { sz: 12 },
        alignment: { horizontal: "right", vertical: "center" },
      };
    }
  }
}

function buildExpenseExportRows(expenses, exportTitle) {
  return [
    [exportTitle, "AMOUNT", "DATE"],
    [],
    ...expenses.map((expense) => [
      expense.notes?.trim() || expense.categoryName,
      Number(expense.amount || 0),
      formatExpenseExportDate(expense.expenseDate),
    ]),
  ];
}

function formatFinanceTransactionDate(dateString) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long"
  });
}

function getDateInputValue(value) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().split("T")[0];
}

function parseDateOnly(value) {
  if (!value) return null;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 0, 0, 0, 0);
  }

  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day, 0, 0, 0, 0);
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 0, 0, 0, 0);
}

function mergeDateWithOriginalTime(dateValue, originalDateTime) {
  if (!dateValue) return null;
  const fallbackTime = "12:00:00.000Z";

  if (originalDateTime) {
    const original = new Date(originalDateTime);
    if (!Number.isNaN(original.getTime())) {
      const timePart = original.toISOString().split("T")[1] || fallbackTime;
      return `${dateValue}T${timePart}`;
    }
  }

  return `${dateValue}T${fallbackTime}`;
}

function mapExpenseRecord(expense) {
  return {
    id: expense.id,
    category: expense.category,
    categoryName: EXPENSE_CATEGORY_META[expense.category]?.name || expense.category,
    amount: parseFloat(expense.amount),
    expenseDate: expense.expense_date,
    date: new Date(expense.expense_date).toLocaleDateString("en-IN", {
      month: "short",
      day: "numeric"
    }),
    fullDate: new Date(expense.expense_date).toLocaleDateString("en-IN", {
      weekday: "short",
      month: "short",
      day: "numeric"
    }),
    icon: EXPENSE_CATEGORY_META[expense.category]?.icon || <Package className="w-4 h-4" />,
    notes: expense.notes,
  };
}

// getStoredGym removed — gym comes from AuthContext

function getLocalCollectorName() {
  if (typeof window === "undefined") return null;

  try {
    const storedUser = localStorage.getItem("gymUser");
    if (!storedUser) return null;

    const user = JSON.parse(storedUser);
    if (!user || typeof user !== "object") return null;

    const fullName = `${user.first_name || ""} ${user.last_name || ""}`.trim();
    return user.name || user.full_name || fullName || null;
  } catch {
    return null;
  }
}

export default function FinancePage() {
  const router = useRouter();
  const { canViewFinance, isViewOnly } = useUserRole();
  const { showSuccess, showError } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const [dateFilter, setDateFilter] = useState("month");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const { selectedGym, user } = useAuthContext();
  const [loading, setLoading] = useState(() => Boolean(selectedGym));
  const [financialData, setFinancialData] = useState({
    todayCollection: 0,
    monthlyRevenue: 0,
    pendingDues: 0,
    monthlyExpenses: 0,
  }); 
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [pendingPayments, setPendingPayments] = useState([]);
  const [pendingTrainerInstallments, setPendingTrainerInstallments] = useState([]);
  const [pendingSearchInput, setPendingSearchInput] = useState("");
  const [pendingSearch, setPendingSearch] = useState("");
  const [pendingSection, setPendingSection] = useState("members");
  const [pendingDateFilterStart, setPendingDateFilterStart] = useState("");
  const [pendingDateFilterEnd, setPendingDateFilterEnd] = useState("");
  const [paymentModes, setPaymentModes] = useState([]);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [transactionDetailsLoading, setTransactionDetailsLoading] = useState(false);
  const [transactionEditMode, setTransactionEditMode] = useState(false);
  const [transactionSaving, setTransactionSaving] = useState(false);
  const [transactionEditValues, setTransactionEditValues] = useState({
    amount: "",
    paymentMode: "cash",
    paidDate: "",
    notes: "",
  });
  const lastFetchParamsRef = useRef(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setPendingSearch(pendingSearchInput.trim().toLowerCase());
    }, 100);

    return () => clearTimeout(timer);
  }, [pendingSearchInput]);

  const effectivePendingDateFilterStart =
    pendingDateFilterStart || (dateFilter === "custom" ? customStartDate : "");
  const effectivePendingDateFilterEnd =
    pendingDateFilterEnd || (dateFilter === "custom" ? customEndDate : "");

  const filteredPendingPayments = useMemo(() => {
    let result = pendingPayments;

    // Apply date range filter
    if (effectivePendingDateFilterStart || effectivePendingDateFilterEnd) {
      result = result.filter((member) => {
        const dueDate = parseDateOnly(member.nextPaymentDate || member.dueDate);
        if (!dueDate) return false;

        if (effectivePendingDateFilterStart) {
          const startDate = parseDateOnly(effectivePendingDateFilterStart);
          if (!startDate) return false;
          if (dueDate < startDate) return false;
        }
        if (effectivePendingDateFilterEnd) {
          const endDate = parseDateOnly(effectivePendingDateFilterEnd);
          if (!endDate) return false;
          endDate.setHours(23, 59, 59, 999);
          if (dueDate > endDate) return false;
        }
        return true;
      });
    }

    // Apply search filter
    if (!pendingSearch) return result;

    return result.filter((member) => {
      const name = String(member.name || "").toLowerCase();
      const phone = String(member.phone || "").toLowerCase();
      return name.includes(pendingSearch) || phone.includes(pendingSearch);
    });
  }, [
    pendingPayments,
    pendingSearch,
    effectivePendingDateFilterStart,
    effectivePendingDateFilterEnd,
  ]);

  const filteredPendingTrainerInstallments = useMemo(() => {
    let result = pendingTrainerInstallments;

    if (effectivePendingDateFilterStart || effectivePendingDateFilterEnd) {
      result = result.filter((item) => {
        const dueDate = parseDateOnly(item.nextPaymentDate);
        if (!dueDate) return false;

        if (effectivePendingDateFilterStart) {
          const startDate = parseDateOnly(effectivePendingDateFilterStart);
          if (!startDate) return false;
          if (dueDate < startDate) return false;
        }

        if (effectivePendingDateFilterEnd) {
          const endDate = parseDateOnly(effectivePendingDateFilterEnd);
          if (!endDate) return false;
          endDate.setHours(23, 59, 59, 999);
          if (dueDate > endDate) return false;
        }

        return true;
      });
    }

    if (!pendingSearch) return result;

    return result.filter((item) => {
      const memberName = String(item.memberName || "").toLowerCase();
      const memberPhone = String(item.memberPhone || "").toLowerCase();
      const trainerName = String(item.trainerName || "").toLowerCase();
      const planName = String(item.planName || "").toLowerCase();

      return (
        memberName.includes(pendingSearch) ||
        memberPhone.includes(pendingSearch) ||
        trainerName.includes(pendingSearch) ||
        planName.includes(pendingSearch)
      );
    });
  }, [
    pendingTrainerInstallments,
    pendingSearch,
    effectivePendingDateFilterStart,
    effectivePendingDateFilterEnd,
  ]);

  const filteredPendingDuesTotal = useMemo(() => {
    return filteredPendingPayments.reduce((sum, member) => sum + (member.amount || 0), 0);
  }, [filteredPendingPayments]);

  const filteredPendingTrainerTotal = useMemo(() => {
    return filteredPendingTrainerInstallments.reduce(
      (sum, item) => sum + (item.pendingAmount || 0),
      0
    );
  }, [filteredPendingTrainerInstallments]);

  const fetchFinancialData = useCallback(async (gymId) => {
    setLoading(true);
    try {
      const now = new Date();

      // Build proper start/end as full ISO timestamps (start of day → end of day)
      let periodStart, periodEnd;

      if (dateFilter === "today") {
        periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        periodEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      } else if (dateFilter === "week") {
        const weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 6); // last 7 days including today
        periodStart = new Date(weekAgo.getFullYear(), weekAgo.getMonth(), weekAgo.getDate(), 0, 0, 0, 0);
        periodEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      } else if (dateFilter === "month") {
        periodStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        periodEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      } else if (dateFilter === "custom") {
        if (!customStartDate || !customEndDate) {
          setLoading(false);
          return;
        }
        const [sy, sm, sd] = customStartDate.split('-').map(Number);
        const [ey, em, ed] = customEndDate.split('-').map(Number);
        periodStart = new Date(sy, sm - 1, sd, 0, 0, 0, 0);
        periodEnd = new Date(ey, em - 1, ed, 23, 59, 59, 999);
      } else {
        // fallback: today
        periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        periodEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      }

      const startISO = periodStart.toISOString();
      const endISO = periodEnd.toISOString();

      const { data: authData } = await supabase.auth.getUser();
      const currentUserId = authData?.user?.id || null;
      if (!currentUserId) {
        throw new Error("Missing authenticated user");
      }

      // Single RPC call replaces 5-6 separate queries
      // Use same-origin API proxy so backend can validate tenant isolation
      let result, rpcError;
      try {
        const businessTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata";
        const res = await fetch('/api/finance/data', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': String(currentUserId),
          },
          body: JSON.stringify({
            p_gym_id: gymId,
            p_period_start: startISO,
            p_period_end: endISO,
            p_business_tz: businessTimeZone,
          }),
        });
        const json = await res.json();
        if (!res.ok) {
          rpcError = { message: json.error };
        } else {
          result = json.data;
        }
      } catch (apiErr) {
        rpcError = { message: apiErr?.message || "API request failed" };
      }

      if (rpcError || !result) {
        console.error("Error fetching finance data:", rpcError);
        setLoading(false);
        return;
      }

      const payments = result.payments || [];
      const paidPayments = payments.filter(
        (payment) => String(payment.status || "").toLowerCase() === "paid"
      );
      const localCollectorName = getLocalCollectorName();
      const membersWithDues = result.members_with_dues || [];
      const expensesTotal = parseFloat(result.expenses_total || 0);
      const paymentsWithNextDate = result.payments_with_next_date || [];
      const trainerInstallmentsPending = result.pending_trainer_installments || [];
      const periodStartDateOnly = parseDateOnly(periodStart);
      const periodEndDateOnly = parseDateOnly(periodEnd);

      const paymentWithDateByMemberId = new Map(
        paymentsWithNextDate.map((item) => [item.member_id, item])
      );

      // Revenue cards and transaction list should only include paid entries
      const totalRevenue = paidPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

      // Today's collection: for "today" filter it equals totalRevenue;
      // for other filters, compute from today's subset
      let todayCollection;
      if (dateFilter === "today") {
        todayCollection = totalRevenue;
      } else if (dateFilter === "custom") {
        todayCollection = totalRevenue; // show full period total in the card
      } else {
        const todayStr = new Date().toDateString();
        todayCollection = paidPayments
          .filter(p => new Date(p.paid_at || p.created_at).toDateString() === todayStr)
          .reduce((sum, p) => sum + (p.amount || 0), 0);
      }

      const pendingDuesForSelectedPeriod = membersWithDues.reduce((sum, member) => {
        const activeMembership = member.memberships?.find((m) => m.status === "active");
        const memberPaymentWithDate = paymentWithDateByMemberId.get(member.id);
        const dueDate = parseDateOnly(
          memberPaymentWithDate?.next_payment_date || activeMembership?.end_date || null
        );

        if (!dueDate || !periodStartDateOnly || !periodEndDateOnly) {
          return sum;
        }

        if (dueDate < periodStartDateOnly || dueDate > periodEndDateOnly) {
          return sum;
        }

        return sum + (member.balance || 0);
      }, 0);

      setFinancialData({
        todayCollection,
        monthlyRevenue: totalRevenue,
        pendingDues: pendingDuesForSelectedPeriod,
        monthlyExpenses: expensesTotal,
      });

      // Build recent transactions (collector_name resolved by RPC via profiles join)
      const transformedTransactions = paidPayments.slice(0, 10).map((payment) => {
        const collectorName = payment.collector_name || payment.collected_by_name || localCollectorName || null;
        
        return {
          id: payment.id,
          name: payment.member_full_name || "Unknown",
          memberPhone: payment.member_phone || "",
          type: payment.membership_id ? "membership" : "personal_training",
          amount: payment.amount,
          mode: payment.payment_mode,
          date: formatFinanceTransactionDate(payment.paid_at || payment.created_at),
          paidAtRaw: payment.paid_at || null,
          createdAtRaw: payment.created_at,
          status: payment.status,
          collectedBy: collectorName || null,
          collectedByFallback: payment.collected_by || null,
        };
      });
      setRecentTransactions(transformedTransactions);

      // Build payment mode stats
      const modeStats = paidPayments.reduce((acc, payment) => {
        const mode = payment.payment_mode?.toUpperCase() || "UNKNOWN";
        acc[mode] = (acc[mode] || 0) + (payment.amount || 0);
        return acc;
      }, {});

      const totalAmount = Object.values(modeStats).reduce((sum, amount) => sum + amount, 0);
      const modesArray = Object.entries(modeStats).map(([mode, amount]) => ({
        mode,
        amount,
        percentage: totalAmount > 0 ? Math.round((amount / totalAmount) * 100) : 0,
      }));
      setPaymentModes(modesArray);

      // Build pending payments
      const pendingData = membersWithDues.map((member) => {
        const activeMembership = member.memberships?.find(m => m.status === "active");
        const memberPaymentWithDate = paymentWithDateByMemberId.get(member.id);
        
        // Use next_payment_date if available, otherwise fall back to membership end_date
        const nextPaymentDate = memberPaymentWithDate?.next_payment_date;
        const dueDate = nextPaymentDate || activeMembership?.end_date || null;
        
        const daysOverdue = dueDate ? 
          Math.ceil((new Date() - new Date(dueDate)) / (1000 * 60 * 60 * 24)) : 0;

        return {
          id: member.id,
          name: member.full_name,
          phone: member.phone,
          amount: member.balance,
          dueDate: dueDate ? new Date(dueDate).toLocaleDateString("en-IN") : "No due date",
          nextPaymentDate: nextPaymentDate,
          remainingAmount: memberPaymentWithDate?.remaining_amount || member.balance,
          daysOverdue: Math.max(0, daysOverdue),
          isOverdue: daysOverdue > 0,
        };
      });
      setPendingPayments(pendingData);

      const pendingTrainerData = trainerInstallmentsPending.map((assignment) => {
        const dueDate = assignment.next_payment_date || assignment.plan_end_date || null;
        const daysOverdue = dueDate
          ? Math.ceil((new Date() - new Date(dueDate)) / (1000 * 60 * 60 * 24))
          : 0;

        return {
          assignmentId: assignment.assignment_id,
          memberId: assignment.member_id,
          memberName: assignment.member_full_name || "Unknown",
          memberPhone: assignment.member_phone || "",
          trainerName: assignment.trainer_full_name || "Trainer",
          planName: assignment.plan_name || "PT Plan",
          planTotalAmount: parseFloat(assignment.plan_total_amount || 0),
          totalPaidAmount: parseFloat(assignment.total_paid_amount || 0),
          pendingAmount: parseFloat(assignment.pending_amount || 0),
          nextPaymentDate: assignment.next_payment_date || null,
          dueDate: dueDate ? new Date(dueDate).toLocaleDateString("en-IN") : "No due date",
          daysOverdue: Math.max(0, daysOverdue),
          isOverdue: daysOverdue > 0,
        };
      });
      setPendingTrainerInstallments(pendingTrainerData);

    } catch (err) {
      console.error("Error fetching financial data:", err);
    }
    setLoading(false);
  }, [customEndDate, customStartDate, dateFilter]);

  useEffect(() => {
    if (!selectedGym?.id) {
      return;
    }

    const fetchKey = `${selectedGym.id}-${dateFilter}-${customStartDate}-${customEndDate}`;
    if (lastFetchParamsRef.current === fetchKey) return;
    lastFetchParamsRef.current = fetchKey;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchFinancialData(selectedGym.id);
  }, [customEndDate, customStartDate, dateFilter, fetchFinancialData, selectedGym]);

  const formatCurrency = (amount) => {
    // If user can't view finance, mask the values
    if (!canViewFinance) {
      return '*****';
    }
    // Round to 2 decimal places before formatting
    const roundedAmount = Math.round(parseFloat(amount || 0) * 100) / 100;
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(roundedAmount);
  };

  const getPaymentModeIcon = (mode) => {
    switch(mode?.toLowerCase()) {
      case 'cash': return <Wallet className="w-4 h-4" />;
      case 'upi': return <CreditCard className="w-4 h-4" />;
      case 'card': return <CreditCard className="w-4 h-4" />;
      default: return <IndianRupee className="w-4 h-4" />;
    }
  };

  const closeTransactionModal = () => {
    setSelectedTransaction(null);
    setTransactionEditMode(false);
    setTransactionDetailsLoading(false);
    setTransactionSaving(false);
    setTransactionEditValues({
      amount: "",
      paymentMode: "cash",
      paidDate: "",
      notes: "",
    });
  };

  const handleTransactionClick = async (txn) => {
    if (!txn?.id) return;

    setSelectedTransaction(txn);
    setTransactionEditMode(false);
    setTransactionDetailsLoading(true);

    try {
      const { data, error } = await supabase
        .from("payments")
        .select(`
          id,
          amount,
          payment_mode,
          status,
          paid_at,
          created_at,
          notes,
          next_payment_date,
          remaining_amount,
          membership_id,
          collected_by,
          collected_by_name,
          collector:profiles!collected_by(
            gym_id,
            first_name,
            last_name
          ),
          members (
            full_name,
            phone
          )
        `)
        .eq("id", txn.id)
        .single();

      if (error) throw error;

      const collectorName =
        data?.collector?.gym_id && data.collector.gym_id === selectedGym?.id
          ? `${data.collector.first_name || ""} ${data.collector.last_name || ""}`.trim() || null
          : data?.collected_by_name || null;
      const localCollectorName = getLocalCollectorName();

      const detailedTxn = {
        ...txn,
        name: data?.members?.full_name || txn.name,
        memberPhone: data?.members?.phone || txn.memberPhone || "",
        amount: Number(data?.amount || txn.amount || 0),
        mode: data?.payment_mode || txn.mode || "cash",
        status: data?.status || txn.status || "paid",
        paidAtRaw: data?.paid_at || txn.paidAtRaw || null,
        createdAtRaw: data?.created_at || txn.createdAtRaw || null,
        notes: data?.notes || "",
        nextPaymentDate: data?.next_payment_date || null,
        remainingAmount: Number(data?.remaining_amount || 0),
        membershipId: data?.membership_id || null,
        collectedBy: collectorName || txn.collectedBy || localCollectorName || null,
      };

      setSelectedTransaction(detailedTxn);
      setTransactionEditValues({
        amount: String(detailedTxn.amount || ""),
        paymentMode: detailedTxn.mode || "cash",
        paidDate: getDateInputValue(detailedTxn.paidAtRaw || detailedTxn.createdAtRaw),
        notes: detailedTxn.notes || "",
      });
    } catch (error) {
      console.error("Error loading transaction details:", error);
      showError("Failed to load transaction details");
    } finally {
      setTransactionDetailsLoading(false);
    }
  };

  const handleSaveTransactionEdit = async () => {
    if (!selectedTransaction?.id || !selectedGym?.id) return;

    if (!transactionEditValues.paidDate) {
      showError("Please select a valid payment date");
      return;
    }

    try {
      setTransactionSaving(true);

      const updatedPaidAt = mergeDateWithOriginalTime(
        transactionEditValues.paidDate,
        selectedTransaction.paidAtRaw || selectedTransaction.createdAtRaw
      );

      const payload = {
        payment_mode: transactionEditValues.paymentMode,
        paid_at: updatedPaidAt,
        notes: transactionEditValues.notes.trim() || null,
      };

      const { error } = await supabase
        .from("payments")
        .update(payload)
        .eq("id", selectedTransaction.id)
        .eq("gym_id", selectedGym.id);

      if (error) throw error;

      showSuccess("Transaction updated successfully");
      setTransactionEditMode(false);
      await fetchFinancialData(selectedGym.id);

      setSelectedTransaction((current) => current ? ({
        ...current,
        mode: transactionEditValues.paymentMode,
        paidAtRaw: updatedPaidAt,
        notes: transactionEditValues.notes.trim(),
        date: formatFinanceTransactionDate(updatedPaidAt),
      }) : current);
    } catch (error) {
      console.error("Error updating transaction:", error);
      showError("Failed to update transaction");
    } finally {
      setTransactionSaving(false);
    }
  };

  if (loading) {
    return <FinancePageSkeleton />;
  }

  if (!selectedGym) {
    return (
      <div className="min-h-screen bg-[#f6f3f1] text-[#1a1c1c] safe-area-inset-bottom">
        <Header title="Finance" showBack={false} />
        <main className="px-4 py-4">
          <div className="text-center py-12">
            <div className="w-20 h-20 bg-gradient-to-br from-[#f0813d] to-[#f0813d] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <IndianRupee className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">No Gym Selected</h2>
            <p className="text-gray-500 text-sm mb-6 px-4">
              Please select a gym to view financial data
            </p>
            <button
              onClick={() => router.push("/admin/dashboard")}
              className="px-6 py-3 bg-gradient-to-r from-[#f0813d] to-[#f0813d] text-white rounded-xl font-semibold text-sm active:scale-95 transition-transform"
              style={{ minHeight: '44px' }}
            >
              Go to Dashboard
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 safe-area-inset-bottom">
      <Header title="Finance" showBack={false} />

      <main className="px-3 md:px-8 lg:px-12 py-3 md:py-6 space-y-4 max-w-7xl mx-auto w-full">
        {/* Date Filter - Mobile Optimized */}
        <div className="relative overflow-hidden bg-white rounded-[28px] p-4 mx-1 border border-[#ececec] shadow-[0_10px_35px_rgba(0,0,0,0.06)]">
  <div className="absolute top-0 right-0 w-28 h-28 bg-gradient-to-br from-[#f0813d]/10 to-transparent rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Period</span>
          </div>
          <div className="flex space-x-2 overflow-x-auto pb-1 -mx-1 px-1 no-scrollbar">
            {["today", "week", "month", "custom"].map((filter) => (
              <button
                key={filter}
                onClick={() => setDateFilter(filter)}
                className={`flex-shrink-0 px-4 py-2.5 rounded-lg text-xs font-medium transition-all duration-200 capitalize flex items-center gap-2 ${
                  dateFilter === filter
                    ? "bg-gradient-to-r from-[#f0813d] to-[#9c4400] text-white shadow-md"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
                style={{ minHeight: '36px' }}
              >
                <Calendar className="w-3.5 h-3.5" />
                {filter}
              </button>
            ))}
          </div>
          
          {/* Custom Date Range Picker */}
          {dateFilter === "custom" && (
            <div className="mt-3 pt-3 border-t border-gray-200">
              <div className="space-y-2">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Start Date</label>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    max={customEndDate || new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#f0813d] focus:border-transparent"
                    
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">End Date</label>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    min={customStartDate}
                    max={new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#f0813d] focus:border-transparent"
                
                  />
                </div>
              </div>
              {/* Display selected date range */}
              {customStartDate && customEndDate && (
                <div className="mt-3 p-2.5 bg-gradient-to-r from-orange-50 to-orange-50 border border-orange-200 rounded-lg">
                  <p className="text-xs text-gray-600">
                    <span className="font-medium">Selected Period:</span>{" "}
                    <span className="font-semibold text-orange-900">
                      {new Date(customStartDate + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} 
                      {" "}-{" "}
                      {new Date(customEndDate + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Stats Cards - Mobile Optimized */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 px-1">
          <div className="relative overflow-hidden bg-white rounded-[24px] p-4 border border-[#ececec] shadow-[0_10px_30px_rgba(0,0,0,0.05)]">
  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-[#f0813d]/10 to-transparent rounded-full blur-2xl pointer-events-none" />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 font-medium">
                  {dateFilter === "custom" ? "Period Collection" : "Today's Collection"}
                </p>
                <p className="text-xl font-bold  text-[#f0813d] mt-0.5">
                  {formatCurrency(financialData.todayCollection)}
                </p>
              </div>
              <div className="w-10 h-10 bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg flex items-center justify-center">
                <IndianRupee className="w-5 h-5" />
              </div>
            </div>
          </div>

          <div className="relative overflow-hidden bg-white rounded-[24px] p-4 border border-[#ececec] shadow-[0_10px_30px_rgba(0,0,0,0.05)]">
  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-[#f0813d]/10 to-transparent rounded-full blur-2xl pointer-events-none" />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 font-medium">
                  {dateFilter === "today" ? "Today" : dateFilter === "week" ? "Weekly" : dateFilter === "custom" ? "Custom" : "Monthly"} Revenue
                </p>
                <p className="text-xl font-bold text-[#f0813d] mt-0.5">
                  {formatCurrency(financialData.monthlyRevenue)}
                </p>
              </div>
              <div className="w-10 h-10 bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>

          <div className="relative overflow-hidden bg-white rounded-[24px] p-4 border border-[#ececec] shadow-[0_10px_30px_rgba(0,0,0,0.05)]">
  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-[#f0813d]/10 to-transparent rounded-full blur-2xl pointer-events-none" />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 font-medium">Pending Dues</p>
                <p className="text-xl font-bold text-[#f0813d] mt-0.5">
                  {formatCurrency(financialData.pendingDues)}
                </p>
              </div>
              <div className="w-10 h-10 bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg flex items-center justify-center">
                <Clock className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>

          <div className="relative overflow-hidden bg-white rounded-[24px] p-4 border border-[#ececec] shadow-[0_10px_30px_rgba(0,0,0,0.05)]">
  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-[#f0813d]/10 to-transparent rounded-full blur-2xl pointer-events-none" />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 font-medium">Net Profit</p>
                <p className={`text-xl font-bold mt-0.5 ${
                  (financialData.monthlyRevenue - financialData.monthlyExpenses) >= 0 
                    ? 'text-[#f0813d]' 
                    : 'text-[#f0813d]'
                }`}>
                  {formatCurrency(financialData.monthlyRevenue - financialData.monthlyExpenses)}
                </p>
              </div>
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                (financialData.monthlyRevenue - financialData.monthlyExpenses) >= 0
                  ? 'bg-gradient-to-br from-orange-50 to-orange-100'
                  : 'bg-gradient-to-br from-orange-50 to-orange-100'
              }`}>
                 <IndianRupee className={`w-5 h-5 ${
                  (financialData.monthlyRevenue - financialData.monthlyExpenses) >= 0
                    ? 'text-[#f0813d]'
                    : 'text-[#f0813d]'
                }`} />
              </div>
            </div>
          </div>
        </div>

        {/* Finance Insights Quick Link */}
        {/* Finance Insights Quick Link */}
<button
  onClick={() => router.push("/finance/insights")}
  className="relative overflow-hidden w-full bg-gradient-to-br from-[#1f1f1f] via-[#2b2b2b] to-[#111111] rounded-[30px] p-5 mx-1 shadow-[0_20px_50px_rgba(0,0,0,0.18)] flex items-center justify-between text-white active:scale-[0.98] transition-transform"
  style={{ maxWidth: 'calc(100% - 8px)' }}
>
  <div className="absolute -right-10 -top-10 w-40 h-40 bg-[#f0813d]/20 rounded-full blur-3xl" />

  <div className="absolute bottom-0 right-0 opacity-10 text-[120px] font-black leading-none">
    ₹
  </div>

  <div className="flex items-center gap-3 relative z-10">
    <div className="w-10 h-10 bg-[#f0813d]/20 border border-[#f0813d]/20 rounded-lg flex items-center justify-center">
      <BarChart3 className="w-5 h-5 text-white" />
    </div>

    <div className="text-left">
      <p className="text-sm font-semibold">Finance Insights</p>
      <p className="text-xs text-white/80">
        All-time stats & monthly breakdown
      </p>
    </div>
  </div>

  <ChevronRight className="w-5 h-5 text-white/70 relative z-10" />
</button>
        {/* Tabs - Mobile Optimized */}
        <div className="bg-white rounded-[28px] p-4 mx-1 border border-[#ececec] shadow-[0_10px_35px_rgba(0,0,0,0.06)]">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">View</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: "overview", label: "Overview", icon: <BarChart3 className="w-4 h-4" /> },
              { id: "pending", label: "Pending", icon: <Clock className="w-4 h-4" /> },
              { id: "expenses", label: "Expenses", icon: <Receipt className="w-4 h-4" /> }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col items-center justify-center py-3 rounded-lg text-xs font-medium transition-all duration-200 ${
                  activeTab === tab.id
                    ? "bg-gradient-to-r from-[#f0813d] to-[#9c4400] text-white shadow-md"
                    : "bg-[#f5f5f5] text-[#5f5f5f] hover:bg-[#ece7e2]"
                }`}
                style={{ minHeight: '64px' }}
              >
                <div className="mb-1">
                  {tab.icon}
                </div>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div className="space-y-3 pb-20">
            {/* Payment Modes Breakdown */}
            <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm mx-1">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900 text-sm">Payment Modes</h3>
                <span className="text-xs text-gray-500">
                  {paymentModes.reduce((sum, item) => sum + item.amount, 0) > 0 
                    ? formatCurrency(paymentModes.reduce((sum, item) => sum + item.amount, 0))
                    : 'No data'}
                </span>
              </div>
              
              <div className="space-y-3">
                {paymentModes.length === 0 ? (
                  <div className="text-center py-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-gray-100 to-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                      <CreditCard className="w-6 h-6 text-white" />
                    </div>
                    <p className="text-gray-500 text-sm">No payment data available</p>
                  </div>
                ) : (
                  paymentModes.map((item) => (
                    <div key={item.mode} className="space-y-1">
                      <div className="flex justify-between items-center text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-orange-50 rounded-lg flex items-center justify-center">
                            {getPaymentModeIcon(item.mode)}
                          </div>
                          <span className="text-gray-600 font-medium">{item.mode}</span>
                        </div>
                        <span className="font-semibold text-gray-900">
                          {formatCurrency(item.amount)}
                        </span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[#f0813d] to-[#f0813d]"
                          style={{ width: `${item.percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Recent Transactions - Hidden for trainers */}
            {canViewFinance && (
              <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm mx-1">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-900 text-sm">Recent Transactions</h3>
                  <button
                    onClick={() => router.push("/finance/transactions")}
                    className="text-xs text-[#f0813d] font-medium active:scale-95 transition-transform flex-shrink-0"
                  >
                    View All
                  </button>
                </div>
                
                <div className="space-y-2">
                  {recentTransactions.length === 0 ? (
                    <div className="text-center py-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-gray-100 to-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                        <Receipt className="w-6 h-6 text-white" />
                      </div>
                      <p className="text-gray-500 text-sm">No recent transactions</p>
                    </div>
                  ) : (
                    recentTransactions.map((txn) => {
                      const collectorDisplayName = txn.collectedBy || "—";
                      const collectorLine = txn.collectedBy
                        ? txn.type === "trainer"
                          ? `${formatCurrency(txn.amount)} collected by trainer (${collectorDisplayName})`
                          : `${formatCurrency(txn.amount)} collected by ${collectorDisplayName}`
                        : `${formatCurrency(txn.amount)} collected by —`;

                      return (
                      <div
                        key={txn.id}
                        onClick={() => handleTransactionClick(txn)}
                        className="p-3 hover:bg-gray-50 rounded-lg transition-all active:scale-95 cursor-pointer"
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            txn.collectedBy 
                              ? "bg-gradient-to-br from-orange-50 to-orange-100"
                              : "bg-gradient-to-br from-orange-50 to-orange-100"
                          }`}>
                            <IndianRupee className={`w-5 h-5 ${txn.collectedBy ? "text-[#f0813d]" : "text-[#f0813d]"}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2 mb-1.5">
                              <p className="font-medium text-gray-900 text-sm leading-tight">
                                {txn.name}
                              </p>
                              <p className="font-bold text-[#f0813d] text-base flex-shrink-0">
                                +{formatCurrency(txn.amount)}
                              </p>
                            </div>
                            
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                                <span className="capitalize">
                                  {txn.type.replace("_", " ")}
                                </span>
                                <span className="text-gray-400">•</span>
                                <span className="lowercase">{txn.mode}</span>
                              </div>

                              <p className="text-xs text-[#f0813d] font-medium truncate">
                                {collectorLine}
                              </p>
                              
                              <p className="text-xs text-gray-500">{txn.date}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Pending Tab */}
        {activeTab === "pending" && (
          <div className="space-y-3 pb-20">
            <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm mx-1">
              <label className="text-xs font-medium text-gray-600 mb-2 block">Search Pending</label>
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={pendingSearchInput}
                  onChange={(e) => setPendingSearchInput(e.target.value)}
                  placeholder="Search by member, phone, trainer, plan"
                  className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#f0813d] focus:border-transparent"
                />
              </div>
            </div>

            {/* Pending Date Range Filter */}
            <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm mx-1">
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="w-4 h-4 text-gray-500" />
                <span className="text-xs font-medium text-gray-700">Filter by Expiry Date</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Start Date</label>
                  <input
                    type="date"
                    value={effectivePendingDateFilterStart}
                    onChange={(e) => setPendingDateFilterStart(e.target.value)}
                    max={effectivePendingDateFilterEnd || new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-[#f0813d] focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">End Date</label>
                  <input
                    type="date"
                    value={effectivePendingDateFilterEnd}
                    onChange={(e) => setPendingDateFilterEnd(e.target.value)}
                    min={effectivePendingDateFilterStart}
                    max={new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-[#f0813d] focus:border-transparent"
                  />
                </div>
              </div>
              {(effectivePendingDateFilterStart || effectivePendingDateFilterEnd) && (
                <div className="mt-2 p-2 bg-orange-50 border border-orange-200 rounded-lg">
                  <p className="text-xs text-orange-900">
                    <span className="font-medium">Showing:</span>{" "}
                    {effectivePendingDateFilterStart && effectivePendingDateFilterEnd 
                      ? `${new Date(effectivePendingDateFilterStart + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} to ${new Date(effectivePendingDateFilterEnd + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`
                      : effectivePendingDateFilterStart
                      ? `from ${new Date(effectivePendingDateFilterStart + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`
                      : `until ${new Date(effectivePendingDateFilterEnd + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`
                    }
                  </p>
                </div>
              )}
              {(pendingDateFilterStart || pendingDateFilterEnd) && (
                <button
                  onClick={() => {
                    setPendingDateFilterStart("");
                    setPendingDateFilterEnd("");
                  }}
                  className="mt-2 w-full px-3 py-1.5 bg-gray-100 text-gray-700 text-xs font-medium rounded-lg active:scale-95 transition-transform"
                >
                  Clear Filters
                </button>
              )}
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-2 shadow-sm mx-1">
              <div className="grid grid-cols-2 gap-2">
                {[
                  {
                    id: "members",
                    label: "Pending Payments",
                    hint: `${filteredPendingPayments.length} members`,
                    amount: formatCurrency(filteredPendingDuesTotal),
                    activeClasses: "bg-orange-50 text-orange-900 border-[#f0813d] shadow-sm",
                    inactiveClasses: "bg-white text-gray-700 border-gray-200 hover:bg-gray-50",
                  },
                  {
                    id: "trainers",
                    label: "Trainer Installments",
                    hint: `${filteredPendingTrainerInstallments.length} PT assignments`,
                    amount: formatCurrency(filteredPendingTrainerTotal),
                    activeClasses: "bg-orange-50 text-orange-900 border-[#f0813d] shadow-sm",
                    inactiveClasses: "bg-white text-gray-700 border-gray-200 hover:bg-gray-50",
                  },
                ].map((section) => (
                  <button
                    key={section.id}
                    onClick={() => setPendingSection(section.id)}
                    className={`text-left rounded-lg border p-2.5 transition-all active:scale-[0.99] ${
                      pendingSection === section.id ? section.activeClasses : section.inactiveClasses
                    }`}
                  >
                    <p className="text-xs font-semibold">{section.label}</p>
                    <p className={`mt-1 text-[11px] ${pendingSection === section.id ? "text-gray-700" : "text-gray-500"}`}>
                      {section.hint}
                    </p>
                    <p className={`mt-1 text-sm font-bold ${pendingSection === section.id ? "text-gray-900" : "text-gray-800"}`}>
                      {section.amount}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {pendingSection === "members" && (
            <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm mx-1">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900 text-sm">Pending Payments</h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {filteredPendingPayments.length} members with dues
                  </p>
                </div>
                <span className="text-xs font-semibold text-[#f0813d]">
                  {formatCurrency(filteredPendingDuesTotal)}
                </span>
              </div>
              
              <div className="space-y-2">
                {filteredPendingPayments.length === 0 ? (
                  <div className="text-center py-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-gray-100 to-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                      <Clock className="w-6 h-6 text-white" />
                    </div>
                    <p className="text-gray-500 text-sm">
                      {pendingSearch ? "No matching pending payments" : "No pending payments"}
                    </p>
                  </div>
                ) : (
                  filteredPendingPayments.map((member) => (
                    <div
                      key={member.id}
                      className="bg-gradient-to-br from-orange-50 to-orange-100 border border-orange-200 rounded-lg p-3 hover:shadow-sm transition-all"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 text-sm">{member.name}</p>
                          <div className="flex items-center gap-1 mt-1">
                            <Phone className="w-3 h-3 text-gray-400" />
                            <span className="text-xs text-gray-500">{member.phone}</span>
                          </div>
                          {/* Next Payment Date Display */}
                          {member.nextPaymentDate && (
                            <div className="mt-2 px-2 py-1 bg-white/70 rounded border border-orange-200 inline-block">
                              <p className="text-xs text-orange-800">
                                <span className="font-medium">Due:</span> {formatCurrency(member.amount)} on{" "}
                                <span className="font-semibold">
                                  {new Date(member.nextPaymentDate).toLocaleDateString("en-IN", {
                                    day: "2-digit",
                                    month: "short",
                                    year: "numeric"
                                  })}
                                </span>
                              </p>
                            </div>
                          )}
                        </div>
                        <p className="text-lg font-bold text-[#f0813d]">
                          {formatCurrency(member.amount)}
                        </p>
                      </div>
                      
                      <div className="flex items-center justify-between mt-3">
                        <span
                          className={`px-2.5 py-1 text-xs rounded-lg font-medium ${
                            member.isOverdue
                              ? "bg-gradient-to-br from-orange-50 to-orange-100 text-[#f0813d] border border-orange-200"
                              : "bg-gradient-to-br from-orange-50 to-orange-100 text-[#f0813d] border border-orange-200"
                          }`}
                        >
                          {member.isOverdue
                            ? `${member.daysOverdue} days overdue`
                            : member.nextPaymentDate
                              ? `Due: ${new Date(member.nextPaymentDate).toLocaleDateString("en-IN")}`
                              : `Due: ${member.dueDate}`}
                        </span>
                        
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const gymName = selectedGym?.name || "Our Gym";
                              const dueDateText = member.nextPaymentDate 
                                ? new Date(member.nextPaymentDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
                                : member.dueDate;
                              const message = `Dear ${member.name},

Greetings from *${gymName}*! 🏋️‍♂️

We hope you're making great progress with your fitness journey! This is a friendly reminder regarding your pending membership payment.

💳 *Pending Amount:* ${formatCurrency(member.amount)}
${member.isOverdue ? `⏰ *Overdue by:* ${member.daysOverdue} days` : `📅 *Payment Due Date:* ${dueDateText}`}

We kindly request you to clear the payment at your earliest convenience to continue enjoying uninterrupted access to our facilities.

You can make the payment through:
• Cash at the reception
• UPI/Card at the gym
• Bank transfer

Feel free to reach out if you have any questions or need assistance.

Thank you for your cooperation! 💪

Best regards,
*${gymName} Team*`;
                              
                              const encodedMessage = encodeURIComponent(message);
                              window.open(`https://wa.me/91${member.phone}?text=${encodedMessage}`);
                            }}
                            className="px-3 py-1.5 bg-orange-100 text-[#f0813d] text-xs font-medium rounded-lg active:scale-95 transition-transform flex items-center gap-1"
                            style={{ minHeight: '32px' }}
                          >
                            Remind
                          </button>
                          
                          {!isViewOnly && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(`/members/${member.id}/payment`);
                              }}
                              className="px-3 py-1.5 bg-gradient-to-r from-[#f0813d] to-[#f0813d] text-white text-xs font-medium rounded-lg active:scale-95 transition-transform flex items-center gap-1"
                              style={{ minHeight: '32px' }}
                            >
                              Collect
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
            )}

            {pendingSection === "trainers" && (
            <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm mx-1">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900 text-sm">Pending Trainer Installments</h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {filteredPendingTrainerInstallments.length} PT assignments with balance left
                  </p>
                </div>
                <span className="text-xs font-semibold text-[#f0813d]">
                  {formatCurrency(pendingTrainerInstallments.reduce((sum, item) => sum + item.pendingAmount, 0))}
                </span>
              </div>

              <div className="space-y-2">
                {filteredPendingTrainerInstallments.length === 0 ? (
                  <div className="text-center py-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-gray-100 to-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                      <Users className="w-6 h-6 text-white" />
                    </div>
                    <p className="text-gray-500 text-sm">
                      {pendingSearch ? "No matching pending trainer installments" : "No pending trainer installments"}
                    </p>
                  </div>
                ) : (
                  filteredPendingTrainerInstallments.map((item) => (
                    <div
                      key={item.assignmentId}
                      className="bg-gradient-to-br from-orange-50 to-orange-100 border border-orange-200 rounded-lg p-3 hover:shadow-sm transition-all"
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 text-sm truncate">{item.memberName}</p>
                          <div className="flex items-center gap-1 mt-1">
                            <Phone className="w-3 h-3 text-gray-400" />
                            <span className="text-xs text-gray-500">{item.memberPhone}</span>
                          </div>
                          <p className="text-xs text-[#f0813d] font-medium mt-1">
                            {item.planName} with {item.trainerName}
                          </p>
                          <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                            <div className="rounded-md bg-white/80 border border-orange-100 px-2 py-1.5">
                              <p className="text-[10px] uppercase tracking-wide text-gray-500">Paid</p>
                              <p className="mt-1 text-xs font-bold text-[#f0813d]">₹{item.totalPaidAmount.toLocaleString("en-IN")}</p>
                            </div>
                            <div className="rounded-md bg-white/80 border border-orange-100 px-2 py-1.5">
                              <p className="text-[10px] uppercase tracking-wide text-gray-500">Due</p>
                              <p className="mt-1 text-xs font-bold text-[#f0813d]">₹{item.pendingAmount.toLocaleString("en-IN")}</p>
                            </div>
                            <div className="rounded-md bg-white/80 border border-orange-100 px-2 py-1.5">
                              <p className="text-[10px] uppercase tracking-wide text-gray-500">Plan</p>
                              <p className="mt-1 text-xs font-bold text-gray-900">₹{item.planTotalAmount.toLocaleString("en-IN")}</p>
                            </div>
                          </div>
                        </div>
                        <p className="text-lg font-bold text-[#f0813d] shrink-0">
                          {formatCurrency(item.pendingAmount)}
                        </p>
                      </div>

                      <div className="flex flex-col gap-2 mt-3 sm:flex-row sm:items-center sm:justify-between">
                        <span
                          className={`px-2.5 py-1 text-xs rounded-lg font-medium w-fit ${
                            item.isOverdue
                              ? "bg-gradient-to-br from-orange-50 to-orange-100 text-[#f0813d] border border-orange-200"
                              : "bg-gradient-to-br from-orange-50 to-orange-100 text-[#f0813d] border border-orange-200"
                          }`}
                        >
                          {item.isOverdue
                            ? `${item.daysOverdue} days overdue`
                            : item.nextPaymentDate
                              ? `Due: ${new Date(item.nextPaymentDate).toLocaleDateString("en-IN")}`
                              : `Due: ${item.dueDate}`}
                        </span>

                        <div className="flex items-center gap-2 self-stretch sm:self-auto">
                          <button
                            onClick={() => {
                              const gymName = selectedGym?.name || "Our Gym";
                              const dueDateText = item.nextPaymentDate
                                ? new Date(item.nextPaymentDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
                                : item.dueDate;
                              const message = `Dear ${item.memberName},

Greetings from *${gymName}*! 🏋️

This is a reminder for your pending *trainer installment*.

💳 *Pending PT Amount:* ${formatCurrency(item.pendingAmount)}
👤 *Trainer:* ${item.trainerName}
📋 *Plan:* ${item.planName}
${item.isOverdue ? `⏰ *Overdue by:* ${item.daysOverdue} days` : `📅 *Next Due Date:* ${dueDateText}`}

Please clear the installment to continue your PT plan smoothly.

Thank you,
*${gymName} Team*`;
                              window.open(`https://wa.me/91${item.memberPhone}?text=${encodeURIComponent(message)}`);
                            }}
                            className="px-3 py-1.5 bg-orange-100 text-[#f0813d] text-xs font-medium rounded-lg active:scale-95 transition-transform flex items-center gap-1"
                            style={{ minHeight: '32px' }}
                          >
                            Remind
                          </button>
                          {!isViewOnly && (
                            <button
                              onClick={() => router.push(`/members/${item.memberId}`)}
                              className="px-3 py-1.5 bg-gradient-to-r from-[#f0813d] to-[#f0813d] text-white text-xs font-medium rounded-lg active:scale-95 transition-transform flex items-center gap-1"
                              style={{ minHeight: '32px' }}
                            >
                              Collect
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
            )}
          </div>
        )}

        {/* Expenses Tab */}
        {activeTab === "expenses" && (
          <ExpensesSection 
            router={router} 
            selectedGym={selectedGym}
          />
        )}
      </main>

      {/* Add Payment FAB */}
    

      {/* Export FAB */}
      {selectedTransaction && (
        <div className="fixed inset-0 z-50 mb-15 bg-black/50 flex items-end sm:items-center sm:justify-center p-3">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900">Transaction Details</h3>
              <button
                onClick={closeTransactionModal}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {transactionDetailsLoading ? (
              <div className="p-6 flex items-center justify-center gap-2 text-gray-600 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading details...
              </div>
            ) : (
              <div className="p-4 space-y-4">
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                  <p className="text-sm font-semibold text-gray-900">{selectedTransaction.name}</p>
                  <p className="text-xs text-gray-500 mt-1">{selectedTransaction.memberPhone || "Phone not available"}</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-gray-200 p-3">
                    <p className="text-xs text-gray-500">Type</p>
                    <p className="text-sm font-medium text-gray-900 capitalize">{selectedTransaction.type}</p>
                  </div>
                  <div className="rounded-lg border border-gray-200 p-3">
                    <p className="text-xs text-gray-500">Status</p>
                    <p className="text-sm font-medium text-gray-900 capitalize">{selectedTransaction.status || "paid"}</p>
                  </div>
                  <div className="rounded-lg border border-gray-200 p-3">
                    <p className="text-xs text-gray-500">Created</p>
                    <p className="text-sm font-medium text-gray-900">
                      {selectedTransaction.createdAtRaw
                        ? new Date(selectedTransaction.createdAtRaw).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "numeric",
                            year: "2-digit",
                          })
                        : "N/A"}
                    </p>
                  </div>
                  <div className="rounded-lg border border-gray-200 p-3">
                    <p className="text-xs text-gray-500">Paid Date</p>
                    <p className="text-sm font-medium text-gray-900">
                      {selectedTransaction.paidAtRaw
                        ? new Date(selectedTransaction.paidAtRaw).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "numeric",
                            year: "2-digit",
                          })
                        : "N/A"}
                    </p>
                  </div>
                </div>

                {transactionEditMode ? (
                  <div className="space-y-3 rounded-xl border border-orange-200 bg-orange-50 p-3">
                    <div className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2">
                      <p className="text-xs font-medium text-orange-800">
                        Amount changes are disabled here.
                      </p>
                      <p className="mt-1 text-xs text-[#f0813d]">
                        To update amount, open that member and go to Payments.
                      </p>
                      <p className="mt-2 text-sm font-semibold text-gray-900">
                        Current Amount: +{formatCurrency(selectedTransaction.amount)}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Payment Mode</label>
                        <select
                          value={transactionEditValues.paymentMode}
                          onChange={(e) => setTransactionEditValues((prev) => ({ ...prev, paymentMode: e.target.value }))}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-[#f0813d] focus:border-transparent"
                        >
                          <option value="cash">Cash</option>
                          <option value="upi">UPI</option>
                          <option value="card">Card</option>
                          <option value="bank">Bank</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Payment Date</label>
                        <input
                          type="date"
                          value={transactionEditValues.paidDate}
                          onChange={(e) => setTransactionEditValues((prev) => ({ ...prev, paidDate: e.target.value }))}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-[#f0813d] focus:border-transparent"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Notes</label>
                      <textarea
                        rows={2}
                        value={transactionEditValues.notes}
                        onChange={(e) => setTransactionEditValues((prev) => ({ ...prev, notes: e.target.value }))}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-[#f0813d] focus:border-transparent resize-none"
                        placeholder="Optional notes"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-gray-200 p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-gray-500">Amount</p>
                      <p className="text-lg font-bold text-[#f0813d]">+{formatCurrency(selectedTransaction.amount)}</p>
                    </div>
                    <div className="mt-2 text-xs text-gray-500">
                      Mode: <span className="font-medium text-gray-800 uppercase">{selectedTransaction.mode || "cash"}</span>
                    </div>
                    {selectedTransaction.notes ? (
                      <div className="mt-2 text-xs text-gray-600">Notes: {selectedTransaction.notes}</div>
                    ) : null}
                  </div>
                )}

                {!isViewOnly && (
                <div className="flex items-center gap-2">
                  {transactionEditMode ? (
                    <>
                      <button
                        onClick={() => setTransactionEditMode(false)}
                        disabled={transactionSaving}
                        className="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveTransactionEdit}
                        disabled={transactionSaving}
                        className="flex-1 rounded-lg bg-[#f0813d] py-2 text-sm font-semibold text-white flex items-center justify-center gap-1 disabled:opacity-60"
                      >
                        {transactionSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        {transactionSaving ? "Saving..." : "Save Changes"}
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setTransactionEditMode(true)}
                      className="w-full rounded-lg bg-gradient-to-r from-[#f0813d] to-[#f0813d] py-2 text-sm font-semibold text-white flex items-center justify-center gap-1"
                    >
                      <Pencil className="w-4 h-4" />
                      Edit Transaction
                    </button>
                  )}
                </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
      
    </div>
  );
}

// Expenses Section Component
function ExpensesSection({ router, selectedGym }) {
  const { canViewFinance, isViewOnly } = useUserRole();
  const { showSuccess, showError } = useToast();
  const getCurrentMonthValue = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  };
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [overallExporting, setOverallExporting] = useState(false);
  const [selectedExpenseMonth, setSelectedExpenseMonth] = useState(getCurrentMonthValue);
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [expenseSaving, setExpenseSaving] = useState(false);
  const [expenseDeleting, setExpenseDeleting] = useState(false);
  const [deletingExpenseId, setDeletingExpenseId] = useState(null);
  const [expenseEditValues, setExpenseEditValues] = useState({
    category: "",
    amount: "",
    expenseDate: "",
    notes: "",
  });

  const fetchExpenses = useCallback(async (gymId) => {
    try {
      setLoading(true);

      const formatLocalDate = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
      };

      const [yearString, monthString] = selectedExpenseMonth.split("-");
      const year = Number(yearString);
      const monthIndex = Number(monthString) - 1;

      const monthStart = new Date(year, monthIndex, 1);
      const monthEnd = new Date(year, monthIndex + 1, 0);
      const today = new Date();

      const isCurrentMonth =
        today.getFullYear() === year && today.getMonth() === monthIndex;

      const startDate = formatLocalDate(monthStart);
      const endDate = formatLocalDate(isCurrentMonth ? today : monthEnd);

      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .eq("gym_id", gymId)
        .gte("expense_date", startDate)
        .lte("expense_date", endDate)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const formattedExpenses = (data || []).map(mapExpenseRecord);

      setExpenses(formattedExpenses);
      const total = formattedExpenses.reduce((sum, e) => sum + e.amount, 0);
      setTotalExpenses(total);
    } catch (error) {
      console.error("Error fetching expenses:", error);
    } finally {
      setLoading(false);
    }
  }, [selectedExpenseMonth]);

  useEffect(() => {
    if (selectedGym) {
      fetchExpenses(selectedGym.id);
    }
  }, [selectedGym, selectedExpenseMonth, fetchExpenses]);

  const handleExportMonthExcel = async () => {
    if (!selectedGym?.name || expenses.length === 0) {
      showError("No expenses available to export");
      return;
    }

    setExporting(true);
    try {
      const XLSX = await import("xlsx");
      const [yearString, monthString] = selectedExpenseMonth.split("-");
      const exportMonth = new Date(Number(yearString), Number(monthString) - 1, 1);
      const exportTitle = `${exportMonth.toLocaleDateString("en-IN", { month: "long", year: "numeric" }).toUpperCase()} EXPENSES`;
      const rows = buildExpenseExportRows(expenses, exportTitle);

      const workbook = XLSX.utils.book_new();
      const sheet = XLSX.utils.aoa_to_sheet(rows);

      styleExpenseExportSheet(sheet, rows.length);
      XLSX.utils.book_append_sheet(workbook, sheet, "Expenses");
      XLSX.writeFile(workbook, getExpenseExportFileName(selectedGym.name, exportTitle));
      showSuccess("Expenses exported to Excel");
    } catch (error) {
      console.error("Error exporting expenses workbook:", error);
      showError("Failed to export expenses. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  const handleExportOverallExcel = async () => {
    if (!selectedGym?.id || !selectedGym?.name) {
      showError("Please select a gym first");
      return;
    }

    setOverallExporting(true);
    try {
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .eq("gym_id", selectedGym.id)
        .order("expense_date", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      const allExpenses = (data || []).map(mapExpenseRecord);

      if (allExpenses.length === 0) {
        showError("No expenses available to export");
        return;
      }

      const XLSX = await import("xlsx");
      const exportTitle = "OVERALL EXPENSES";
      const rows = buildExpenseExportRows(allExpenses, exportTitle);
      const workbook = XLSX.utils.book_new();
      const sheet = XLSX.utils.aoa_to_sheet(rows);

      styleExpenseExportSheet(sheet, rows.length);
      XLSX.utils.book_append_sheet(workbook, sheet, "Overall Expenses");
      XLSX.writeFile(workbook, getExpenseExportFileName(selectedGym.name, exportTitle));
      showSuccess("Overall expenses exported to Excel");
    } catch (error) {
      console.error("Error exporting overall expenses workbook:", error);
      showError("Failed to export overall expenses. Please try again.");
    } finally {
      setOverallExporting(false);
    }
  };

  const formatCurrency = (amount) => {
    // If user can't view finance, mask the values
    if (!canViewFinance) {
      return '*****';
    }
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const getMonthName = () => {
    const [yearString, monthString] = selectedExpenseMonth.split("-");
    const monthDate = new Date(Number(yearString), Number(monthString) - 1, 1);
    return monthDate.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
  };

  const openExpenseEditor = (expense) => {
    if (!expense) return;

    setSelectedExpense(expense);
    setExpenseEditValues({
      category: expense.category || "",
      amount: String(expense.amount || ""),
      expenseDate: expense.expenseDate || "",
      notes: expense.notes || "",
    });
  };

  const closeExpenseEditor = () => {
    setSelectedExpense(null);
    setExpenseSaving(false);
    setExpenseDeleting(false);
    setDeletingExpenseId(null);
    setExpenseEditValues({
      category: "",
      amount: "",
      expenseDate: "",
      notes: "",
    });
  };

  const handleSaveExpenseEdit = async () => {
    if (!selectedExpense?.id || !selectedGym?.id) return;

    const parsedAmount = parseFloat(expenseEditValues.amount);
    if (!parsedAmount || parsedAmount <= 0) {
      showError("Please enter a valid amount");
      return;
    }

    if (!expenseEditValues.category) {
      showError("Please select a category");
      return;
    }

    if (!expenseEditValues.expenseDate) {
      showError("Please select a valid date");
      return;
    }

    try {
      setExpenseSaving(true);

      const { error } = await supabase
        .from("expenses")
        .update({
          category: expenseEditValues.category,
          amount: parsedAmount,
          expense_date: expenseEditValues.expenseDate,
          notes: expenseEditValues.notes.trim() || null,
        })
        .eq("id", selectedExpense.id)
        .eq("gym_id", selectedGym.id);

      if (error) throw error;

      showSuccess("Expense updated successfully");
      await fetchExpenses(selectedGym.id);
      closeExpenseEditor();
    } catch (error) {
      console.error("Error updating expense:", error);
      showError("Failed to update expense");
    } finally {
      setExpenseSaving(false);
    }
  };

  const handleDeleteExpense = async (expenseOverride = null) => {
    const targetExpense = expenseOverride || selectedExpense;
    if (!targetExpense?.id || !selectedGym?.id) return;

    const shouldDelete = window.confirm("Delete this expense? This action cannot be undone.");
    if (!shouldDelete) return;

    try {
      setExpenseDeleting(true);
      setDeletingExpenseId(targetExpense.id);

      const { error } = await supabase
        .from("expenses")
        .delete()
        .eq("id", targetExpense.id)
        .eq("gym_id", selectedGym.id);

      if (error) throw error;

      showSuccess("Expense deleted successfully");
      await fetchExpenses(selectedGym.id);
      if (!expenseOverride) {
        closeExpenseEditor();
      }
    } catch (error) {
      console.error("Error deleting expense:", error);
      showError("Failed to delete expense");
    } finally {
      setExpenseDeleting(false);
      setDeletingExpenseId(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3 pb-20">
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm mx-1 text-center">
          <p className="text-gray-500 text-sm">Loading expenses...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 pb-20">
      {/* Expense Summary */}
      <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm mx-1">
        <div className="flex justify-between items-center gap-3 flex-wrap">
          <div>
            <p className="text-xs text-gray-500 font-medium">
              Total Expenses ({getMonthName()})
            </p>
            <p className="text-xl font-bold text-[#f0813d] mt-0.5">
              {formatCurrency(totalExpenses)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 font-medium">Month</label>
            <input
              type="month"
              value={selectedExpenseMonth}
              max={getCurrentMonthValue()}
              onChange={(e) => setSelectedExpenseMonth(e.target.value || getCurrentMonthValue())}
              className="px-3 py-2 border border-gray-200 rounded-lg text-xs font-medium text-gray-700 bg-white outline-none focus:ring-2 focus:ring-[#f0813d] focus:border-[#f0813d]"
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {canViewFinance && (
              <>
                <button
                  onClick={handleExportOverallExcel}
                  disabled={overallExporting}
                  className="px-4 py-2 bg-orange-50 text-[#f0813d] border border-orange-200 rounded-lg text-xs font-medium active:scale-95 transition-transform flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ minHeight: '36px' }}
                >
                  <Download className="w-4 h-4" />
                  {overallExporting ? "Exporting..." : "Overall Excel"}
                </button>
                <button
                  onClick={handleExportMonthExcel}
                  disabled={exporting || expenses.length === 0}
                  className="px-4 py-2 bg-orange-50 text-[#f0813d] border border-orange-200 rounded-lg text-xs font-medium active:scale-95 transition-transform flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ minHeight: '36px' }}
                >
                  <Download className="w-4 h-4" />
                  {exporting ? "Exporting..." : "This Period"}
                </button>
              </>
            )}
            {!isViewOnly && (
              <button
                onClick={() => router.push("/finance/expenses/add")}
                className="px-4 py-2 bg-gradient-to-r from-[#f0813d] to-[#f0813d] text-white rounded-lg text-xs font-medium active:scale-95 transition-transform flex items-center gap-2"
                style={{ minHeight: '36px' }}
              >
                <Plus className="w-4 h-4" />
                Add
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Expense List */}
      <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm mx-1">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900 text-sm">Recent Expenses</h3>
          <span className="text-xs text-gray-500">
            {expenses.length} items
          </span>
        </div>
        
        {expenses.length === 0 ? (
          <div className="text-center py-6">
            <div className="w-14 h-14 bg-gradient-to-br from-gray-100 to-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Receipt className="w-6 h-6 text-white" />
            </div>
            <p className="text-gray-500 text-sm mb-4">No expenses recorded yet</p>
            {!isViewOnly && (
              <button
                onClick={() => router.push("/finance/expenses/add")}
                className="px-4 py-2.5 bg-gradient-to-r from-[#f0813d] to-[#f0813d] text-white rounded-lg text-xs font-medium active:scale-95 transition-transform"
                style={{ minHeight: '36px' }}
              >
                Add First Expense
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {expenses.map((expense) => (
              <div
                key={expense.id}
                className="flex items-start justify-between gap-3 p-3 rounded-xl border border-gray-100 bg-white hover:border-gray-200 hover:shadow-sm transition"
              >
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-50 to-orange-100 flex items-center justify-center shrink-0">
                    <div className="text-white">
                      {expense.icon}
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900 text-sm wrap-break-word">{expense.categoryName}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-xs text-gray-500">{expense.fullDate}</span>
                    </div>
                    {expense.notes && (
                      <div className="mt-2 rounded-md bg-gray-50 border border-gray-100 px-2.5 py-2">
                        <p className="text-sm text-gray-700 leading-5 wrap-break-word whitespace-pre-wrap line-clamp-3 sm:line-clamp-4">
                          {expense.notes}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
                <div className="shrink-0 flex flex-col items-end gap-2">
                  <p className="font-semibold text-[#f0813d] text-sm text-right pt-0.5">
                    -{formatCurrency(expense.amount)}
                  </p>
                  {canViewFinance && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openExpenseEditor(expense)}
                        className="px-2.5 py-1.5 rounded-md border border-gray-200 bg-gray-50 text-[11px] font-medium text-gray-700 hover:text-[#f0813d] hover:border-orange-200 hover:bg-orange-50 transition flex items-center gap-1.5"
                        aria-label="Edit expense"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteExpense(expense)}
                        disabled={expenseDeleting}
                        className="px-2.5 py-1.5 rounded-md border border-orange-200 bg-orange-50 text-[11px] font-medium text-[#f0813d] hover:text-[#f0813d] hover:bg-orange-100 transition flex items-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed"
                        aria-label="Delete expense"
                      >
                        {expenseDeleting && deletingExpenseId === expense.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedExpense && canViewFinance && (
        <div className="fixed inset-0 mb-20 z-50 flex items-end sm:items-center justify-center bg-black/50 p-3">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">Edit Expense</h3>
              <button
                type="button"
                onClick={closeExpenseEditor}
                disabled={expenseSaving || expenseDeleting}
                className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-4 max-h-[80vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-2">Category</label>
                <select
                  value={expenseEditValues.category}
                  onChange={(e) => setExpenseEditValues((prev) => ({ ...prev, category: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#f0813d] focus:border-[#f0813d]"
                >
                  {Object.entries(EXPENSE_CATEGORY_META).map(([key, value]) => (
                    <option key={key} value={key}>{value.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-2">Amount</label>
                <input
                  type="text"
                  inputMode="decimal"
                  pattern="[0-9]*\.?[0-9]*"
                  value={expenseEditValues.amount}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === "" || /^\d*\.?\d*$/.test(value)) {
                      setExpenseEditValues((prev) => ({ ...prev, amount: value }));
                    }
                  }}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#f0813d] focus:border-[#f0813d]"
                  placeholder="Enter amount"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-2">Date</label>
                <input
                  type="date"
                  value={expenseEditValues.expenseDate}
                  onChange={(e) => setExpenseEditValues((prev) => ({ ...prev, expenseDate: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#f0813d] focus:border-[#f0813d]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-2">Notes</label>
                <textarea
                  rows={3}
                  value={expenseEditValues.notes}
                  onChange={(e) => setExpenseEditValues((prev) => ({ ...prev, notes: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none resize-none focus:ring-2 focus:ring-[#f0813d] focus:border-[#f0813d]"
                  placeholder="Expense details..."
                />
              </div>
            </div>

            <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={handleDeleteExpense}
                disabled={expenseSaving || expenseDeleting}
                className="px-3 py-2 rounded-lg border border-orange-200 bg-orange-50 text-[#f0813d] text-xs font-medium flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {expenseDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                {expenseDeleting ? "Deleting..." : "Delete"}
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={closeExpenseEditor}
                  disabled={expenseSaving || expenseDeleting}
                  className="px-3 py-2 rounded-lg border border-gray-200 text-gray-600 text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveExpenseEdit}
                  disabled={expenseSaving || expenseDeleting}
                  className="px-3 py-2 rounded-lg bg-linear-to-r from-[#f0813d] to-[#f0813d] text-white text-xs font-medium flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {expenseSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {expenseSaving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

