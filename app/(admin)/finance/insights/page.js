"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/layout/Header";
import { Skeleton } from "@/components/shared/Skeleton";
import {
  TrendingUp,
  IndianRupee,
  Users,
  Wallet,
  PiggyBank,
  BarChart3,
  UserPlus,
  Activity,
  RefreshCw,
  ArrowLeft,
  X,
  Phone,
  ChevronRight,
  Calendar,
  ChevronDown,
  ChevronUp,
  Download,
  Loader2,
  FileText,
} from "lucide-react";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const REPORT_START_YEAR = 2024;

const EXCEL_CURRENCY_FORMAT = '"₹"#,##0.00';

function formatCurrency(value) {
  const num = Number(value) || 0;
  if (num >= 10000000) {
    return "₹" + (num / 10000000).toFixed(2) + " Cr";
  }
  if (num >= 100000) {
    return "₹" + (num / 100000).toFixed(2) + " L";
  }
  return "₹" + num.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

function formatExcelDate(value) {
  if (!value) return "-";

  const date = new Date(value.length <= 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatExcelDateTime(value) {
  if (!value) return "-";

  const date = new Date(value.length <= 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── Week/Day Breakdown Helpers ───────────────────────────────

function getWeeksForMonth(month, year) {
  // month is 0-indexed
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const weeks = [];
  let weekStart = new Date(firstDay);
  let weekNum = 1;

  while (weekStart <= lastDay) {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    // Clamp to end of month
    const clampedEnd = weekEnd > lastDay ? new Date(lastDay) : weekEnd;
    weeks.push({
      num: weekNum,
      start: new Date(weekStart),
      end: new Date(clampedEnd),
      label: `Week ${weekNum}`,
      range: `${formatShortDate(weekStart)} – ${formatShortDate(clampedEnd)}`,
    });
    weekStart = new Date(clampedEnd);
    weekStart.setDate(weekStart.getDate() + 1);
    weekNum++;
  }
  return weeks;
}

function formatShortDate(d) {
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function isDateInRange(dateStr, start, end) {
  // dateStr can be "2026-03-01" or ISO timestamp
  const d = new Date(dateStr.length <= 10 ? dateStr + "T00:00:00" : dateStr);
  d.setHours(0, 0, 0, 0);
  const s = new Date(start);
  s.setHours(0, 0, 0, 0);
  const e = new Date(end);
  e.setHours(23, 59, 59, 999);
  return d >= s && d <= e;
}

function isDateOnDay(dateStr, targetDate) {
  const d = new Date(dateStr.length <= 10 ? dateStr + "T00:00:00" : dateStr);
  return (
    d.getFullYear() === targetDate.getFullYear() &&
    d.getMonth() === targetDate.getMonth() &&
    d.getDate() === targetDate.getDate()
  );
}

function getPaymentDate(p) {
  return p.paid_at || p.created_at;
}

function getRenewalEventDate(renewal) {
  return renewal.start_date || renewal.renewed_at || renewal.created_at;
}

function getSelectedMonthRenewals(renewals, selectedMonth, selectedYear) {
  return (renewals || []).filter((renewal) => {
    const renewalDate = new Date(getRenewalEventDate(renewal));
    return (
      !Number.isNaN(renewalDate.getTime()) &&
      renewalDate.getMonth() === selectedMonth &&
      renewalDate.getFullYear() === selectedYear
    );
  });
}

function computeWeekData(data, weekStart, weekEnd) {
  const revenueList = (data?.month_revenue_list || []).filter((p) =>
    isDateInRange(getPaymentDate(p), weekStart, weekEnd)
  );
  const newJoinsList = (data?.month_new_joins_list || []).filter((m) =>
    isDateInRange(m.join_date, weekStart, weekEnd)
  );
  const renewalsList = (data?.month_renewals_list || []).filter((r) =>
    isDateInRange(getRenewalEventDate(r), weekStart, weekEnd)
  );
  const revenue = revenueList.reduce((s, p) => s + Number(p.amount || 0), 0);
  return { revenue, revenueList, newJoinsList, renewalsList };
}

function getDaysInRange(start, end) {
  const days = [];
  const d = new Date(start);
  while (d <= end) {
    days.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return days;
}

function computeDayData(data, day) {
  const revenueList = (data?.month_revenue_list || []).filter((p) =>
    isDateOnDay(getPaymentDate(p), day)
  );
  const newJoinsList = (data?.month_new_joins_list || []).filter((m) =>
    isDateOnDay(m.join_date, day)
  );
  const renewalsList = (data?.month_renewals_list || []).filter((r) =>
    isDateOnDay(getRenewalEventDate(r), day)
  );
  const revenue = revenueList.reduce((s, p) => s + Number(p.amount || 0), 0);
  return { revenue, revenueList, newJoinsList, renewalsList };
}

function getFinanceExportBaseName(gymName, year, monthIndex) {
  return `${gymName.replace(/\s+/g, "_")}_Finance_Insights_${year}_${String(monthIndex + 1).padStart(2, "0")}`;
}

function getFinanceOverallExportBaseName(gymName) {
  return `${gymName.replace(/\s+/g, "_")}_Finance_Overall_Report`;
}

function getReportYears(currentYear) {
  const years = [];
  for (let year = REPORT_START_YEAR; year <= currentYear; year += 1) {
    years.push(year);
  }
  return years;
}

function summarizeOverallRevenueHistory(yearlyHistory) {
  const populatedYears = yearlyHistory.filter((entry) => entry.totalRevenue > 0);
  const sourceYears = populatedYears.length ? populatedYears : yearlyHistory;

  const bestYear = sourceYears.reduce((best, current) => {
    if (!best || current.totalRevenue > best.totalRevenue) {
      return current;
    }
    return best;
  }, null);

  const bestMonth = yearlyHistory
    .flatMap((yearEntry) => yearEntry.months.map((monthEntry) => ({
      year: yearEntry.year,
      ...monthEntry,
    })))
    .reduce((best, current) => {
      if (!best || current.revenue > best.revenue) {
        return current;
      }
      return best;
    }, null);

  return {
    yearsCovered: yearlyHistory.length,
    activeYears: populatedYears.length,
    bestYear,
    bestMonth,
  };
}

function buildOverviewRows(data, gymName, monthName, year, generatedAt, selectedMonth) {
  const monthRenewalsList = getSelectedMonthRenewals(data?.month_renewals_list, selectedMonth, year);

  return [
    [`${gymName} Finance Insights`],
    ["Gym", gymName],
    ["Report Month", `${monthName} ${year}`],
    ["Generated At", generatedAt],
    [],
    ["All Time Summary"],
    ["Metric", "Value"],
    ["Total Revenue", Number(data?.total_revenue_all_time || 0)],
    ["Salary Paid", Number(data?.total_salary_paid_all_time || 0)],
    ["Pending Dues", Number(data?.total_dues_all_time || 0)],
    ["Net Profit", Number(data?.net_profit_all_time || 0)],
    ["Average Monthly Revenue", Number(data?.avg_monthly_revenue || 0)],
    [],
    ["Selected Month Summary"],
    ["Metric", "Value"],
    ["Month Revenue", Number(data?.month_revenue || 0)],
    ["New Joins", Number(data?.month_new_joins || 0)],
    ["Renewals", monthRenewalsList.length],
    ["Active Members", Number(data?.month_active_members || 0)],
  ];
}

function buildWeeklyRows(data, selectedMonth, selectedYear) {
  return [
    ["Week", "Range", "Revenue", "New Joins", "Renewals"],
    ...getWeeksForMonth(selectedMonth, selectedYear).map((week) => {
      const weekData = computeWeekData(data, week.start, week.end);
      return [
        week.label,
        week.range,
        Number(weekData.revenue || 0),
        weekData.newJoinsList.length,
        weekData.renewalsList.length,
      ];
    }),
  ];
}

function buildSummaryChartRows(data, selectedMonth, selectedYear, gymName, monthName) {
  const weeklyRows = buildWeeklyRows(data, selectedMonth, selectedYear);
  const monthRenewalsList = getSelectedMonthRenewals(data?.month_renewals_list, selectedMonth, selectedYear);

  return [
    [`${gymName} Finance Summary`],
    [`${monthName} ${selectedYear}`],
    [],
    ["KPI", "Value"],
    ["Month Revenue", Number(data?.month_revenue || 0)],
    ["Total Revenue", Number(data?.total_revenue_all_time || 0)],
    ["Net Profit", Number(data?.net_profit_all_time || 0)],
    ["Pending Dues", Number(data?.total_dues_all_time || 0)],
    ["New Joins", String(data?.month_new_joins || 0)],
    ["Renewals", String(monthRenewalsList.length)],
    ["Active Members", String(data?.month_active_members || 0)],
    [],
    ["Weekly Revenue Chart Data"],
    ["Week", "Revenue", "New Joins", "Renewals"],
    ...weeklyRows.slice(1).map((row) => [row[0], row[2], row[3], row[4]]),
  ];
}

function buildRevenueRows(data) {
  return [
    ["Member Name", "Phone", "Amount", "Payment Mode", "Paid At"],
    ...(data?.month_revenue_list?.length
      ? data.month_revenue_list.map((payment) => [
          payment.member_name || "Unknown",
          payment.phone || "-",
          Number(payment.amount || 0),
          payment.payment_mode || "-",
          formatExcelDate(getPaymentDate(payment)),
        ])
      : [["No revenue records found", "", "", "", ""]]),
  ];
}

function buildNewJoinRows(data) {
  return [
    ["Member Name", "Phone", "Plan", "Join Date", "End Date", "Payment Mode", "Payment Amount"],
    ...(data?.month_new_joins_list?.length
      ? data.month_new_joins_list.map((member) => [
          member.full_name || "Unknown",
          member.phone || "-",
          member.plan_name || "-",
          formatExcelDate(member.join_date),
          formatExcelDate(member.end_date),
          member.payment_mode || "-",
          Number(member.payment_amount || 0),
        ])
      : [["No new joins found", "", "", "", "", "", ""]]),
  ];
}

function buildRenewalRows(data) {
  const renewalRows = data?.month_renewals_list || [];

  return [
    ["Member Name", "Phone", "Plan", "Renewed At", "Start Date", "End Date", "Created At", "Payment Amount"],
    ...(renewalRows.length
      ? renewalRows.map((renewal) => [
          renewal.member_name || "Unknown",
          renewal.phone || "-",
          renewal.plan_name || "-",
          formatExcelDate(getRenewalEventDate(renewal)),
          formatExcelDate(renewal.start_date),
          formatExcelDate(renewal.end_date),
          formatExcelDate(renewal.created_at),
          Number(renewal.payment_amount || 0),
        ])
      : [["No renewals found", "", "", "", "", "", "", ""]]),
  ];
}

// Skeleton loader for the page
function InsightsSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      <div className="px-4 py-4 space-y-5">
        {/* Summary Cards Skeleton */}
        <div>
          <Skeleton className="h-5 w-36 mb-3" />
          <div className="grid grid-cols-2 gap-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                <Skeleton className="w-9 h-9 rounded-xl mb-3" />
                <Skeleton className="h-3 w-20 mb-2" />
                <Skeleton className="h-7 w-24" />
              </div>
            ))}
          </div>
        </div>
        {/* Month Selector Skeleton */}
        <Skeleton className="h-12 w-full rounded-xl" />
        {/* Month Breakdown Skeleton */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <Skeleton className="h-5 w-40 mb-4" />
          <div className="space-y-4">
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}

function FinanceSparkline({ points = [] }) {
  const normalized = points.length ? points : [0, 0, 0, 0, 0];
  const maxValue = Math.max(...normalized, 1);
  const polylinePoints = normalized
    .map((value, index) => {
      const x = normalized.length === 1 ? 100 : (index / (normalized.length - 1)) * 100;
      const y = 92 - (Number(value || 0) / maxValue) * 72;
      return `${x},${y}`;
    })
    .join(" ");

  const areaPoints = `0,100 ${polylinePoints} 100,100`;

  return (
    <svg viewBox="0 0 100 100" className="h-24 w-full overflow-visible" preserveAspectRatio="none">
      <defs>
        <linearGradient id="financeSparkArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f0813d" stopOpacity="0.32" />
          <stop offset="100%" stopColor="#f0813d" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill="url(#financeSparkArea)" />
      <polyline
        points={polylinePoints}
        fill="none"
        stroke="#f0813d"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FinanceMetricPill({ icon, label, value }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/10 p-3 backdrop-blur">
      <div className="mb-2 flex items-center gap-2 text-white/70">
        {icon}
        <span className="text-[10px] font-bold uppercase tracking-[0.18em]">{label}</span>
      </div>
      <p className="text-lg font-black text-white">{value}</p>
    </div>
  );
}

export default function FinanceInsightsPage() {
  const router = useRouter();
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth()); // 0-indexed
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedGym, setSelectedGym] = useState(null);
  const [loading, setLoading] = useState(true);
  const [monthLoading, setMonthLoading] = useState(false);
  const [data, setData] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [pdfExporting, setPdfExporting] = useState(false);
  const [overallPdfExporting, setOverallPdfExporting] = useState(false);
  const [overallExcelExporting, setOverallExcelExporting] = useState(false);
  const [drillDown, setDrillDown] = useState(null); // null | "new_joins" | "revenue" | "renewals"

  // Week & Day drill-down state
  const [weekModal, setWeekModal] = useState(null); // { week, type: "revenue"|"new_joins"|"renewals"|null }
  const [dayModal, setDayModal] = useState(null);   // { day: Date, type: "revenue"|"new_joins"|"renewals" }

  useEffect(() => {
    const storedGym = localStorage.getItem("selectedGym");
    if (storedGym) {
      try {
        setSelectedGym(JSON.parse(storedGym));
      } catch {
        setSelectedGym(null);
      }
    } else {
      setLoading(false);
    }
  }, []);

  const requestInsights = useCallback(async (gymId, month, year) => {
    let userId = null;
    let userGymId = null;
    const storedUser = localStorage.getItem("gymUser");
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        userId = parsedUser?.id || null;
        userGymId = parsedUser?.gym_id || null;
      } catch {
        userId = null;
        userGymId = null;
      }
    }

    console.log("[TenantCheck] Finance insights request user.gym_id:", userGymId, "selectedGym.id:", gymId);

    const res = await fetch("/api/finance/insights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        p_gym_id: gymId,
        p_month: month + 1,
        p_year: year,
        p_user_id: userId,
      }),
    });

    const json = await res.json();
    if (!res.ok || !json.data) {
      throw new Error(json.error || "Failed to fetch finance insights");
    }

    return json.data;
  }, []);

  const fetchInsights = useCallback(
    async (gymId, month, year, isMonthChange = false) => {
      if (isMonthChange) {
        setMonthLoading(true);
      } else {
        setLoading(true);
      }

      try {
        const result = await requestInsights(gymId, month, year);
        setData(result);
      } catch (err) {
        console.error("Error fetching insights:", err);
      } finally {
        setLoading(false);
        setMonthLoading(false);
      }
    },
    [requestInsights]
  );

  useEffect(() => {
    if (selectedGym?.id) {
      fetchInsights(selectedGym.id, selectedMonth, selectedYear);
    }
  }, [selectedGym, fetchInsights]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleMonthChange = (monthIndex) => {
    setSelectedMonth(monthIndex);
    if (selectedGym?.id) {
      fetchInsights(selectedGym.id, monthIndex, selectedYear, true);
    }
  };

  const handleYearChange = (year) => {
    setSelectedYear(year);
    // If switching to current year and selected month is in the future, reset to current month
    const newMonth = (year === now.getFullYear() && selectedMonth > now.getMonth())
      ? now.getMonth()
      : selectedMonth;
    setSelectedMonth(newMonth);
    if (selectedGym?.id) {
      fetchInsights(selectedGym.id, newMonth, year, true);
    }
  };

  const monthRenewalsList = getSelectedMonthRenewals(data?.month_renewals_list, selectedMonth, selectedYear);
  const monthRenewalsCount = monthRenewalsList.length;

  const handleExportExcel = async () => {
    if (!data || !selectedGym?.name) return;

    setExporting(true);
    try {
      const XLSX = await import("xlsx");
      const workbook = XLSX.utils.book_new();
      const monthName = MONTHS[selectedMonth];
      const generatedAt = new Date().toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

      const addSheet = (name, rows, cols = [], currencyColumns = [], currencyStartRow = 1) => {
        const sheet = XLSX.utils.aoa_to_sheet(rows);
        if (cols.length > 0) sheet["!cols"] = cols;
        if (currencyColumns.length > 0) {
          const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
          for (let row = currencyStartRow; row <= range.e.r; row += 1) {
            currencyColumns.forEach((columnIndex) => {
              const cellRef = XLSX.utils.encode_cell({ r: row, c: columnIndex });
              const cell = sheet[cellRef];
              if (cell && typeof cell.v === "number") {
                cell.z = EXCEL_CURRENCY_FORMAT;
              }
            });
          }
        }
        XLSX.utils.book_append_sheet(workbook, sheet, name);
      };

      const chartSummaryRows = buildSummaryChartRows(
        data,
        selectedMonth,
        selectedYear,
        selectedGym.name,
        monthName
      );
      const overviewRows = buildOverviewRows(data, selectedGym.name, monthName, selectedYear, generatedAt, selectedMonth);
      const weeklyRows = buildWeeklyRows(data, selectedMonth, selectedYear);
      const revenueRows = buildRevenueRows(data);
      const newJoinRows = buildNewJoinRows(data);
      const renewalRows = buildRenewalRows({ ...data, month_renewals_list: monthRenewalsList });

      addSheet(
        "Summary Chart",
        chartSummaryRows,
        [{ wch: 24 }, { wch: 18 }, { wch: 14 }, { wch: 14 }],
        [1],
        4
      );

      addSheet(
        "Overview",
        overviewRows,
        [{ wch: 28 }, { wch: 18 }],
        [1],
        7
      );

      addSheet(
        "Weekly Breakdown",
        weeklyRows,
        [{ wch: 12 }, { wch: 22 }, { wch: 14 }, { wch: 12 }, { wch: 12 }],
        [2]
      );

      addSheet(
        "Revenue Payments",
        revenueRows,
        [{ wch: 28 }, { wch: 18 }, { wch: 14 }, { wch: 16 }, { wch: 18 }],
        [2]
      );

      addSheet(
        "New Joins",
        newJoinRows,
        [{ wch: 28 }, { wch: 18 }, { wch: 22 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 16 }],
        [6]
      );

      addSheet(
        "Renewals",
        renewalRows,
        [{ wch: 28 }, { wch: 18 }, { wch: 22 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 16 }],
        [7]
      );

      XLSX.writeFile(
        workbook,
        `${getFinanceExportBaseName(selectedGym.name, selectedYear, selectedMonth)}.xlsx`
      );
    } catch (error) {
      console.error("Error exporting finance insights workbook:", error);
      window.alert("Failed to export Excel file. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  const handleExportPdf = async () => {
    if (!data || !selectedGym?.name) return;

    setPdfExporting(true);
    try {
      const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
        import("jspdf"),
        import("jspdf-autotable"),
      ]);

      const monthName = MONTHS[selectedMonth];
      const generatedAt = new Date().toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

      const overviewRows = buildOverviewRows(data, selectedGym.name, monthName, selectedYear, generatedAt, selectedMonth);
      const weeklyRows = buildWeeklyRows(data, selectedMonth, selectedYear);
      const revenueRows = buildRevenueRows(data);
      const newJoinRows = buildNewJoinRows(data);
      const renewalRows = buildRenewalRows({ ...data, month_renewals_list: monthRenewalsList });
      const summaryPdfRows = [
        ["Total Revenue", formatCurrency(data?.total_revenue_all_time)],
        ["Salary Paid", formatCurrency(data?.total_salary_paid_all_time)],
        ["Pending Dues", formatCurrency(data?.total_dues_all_time)],
        ["Net Profit", formatCurrency(data?.net_profit_all_time)],
        ["Month Revenue", formatCurrency(data?.month_revenue)],
        ["New Joins", String(data?.month_new_joins || 0)],
        ["Renewals", String(monthRenewalsCount)],
        ["Active Members", String(data?.month_active_members || 0)],
      ];
      const weeklyPdfRows = weeklyRows.slice(1).map((row) => [
        row[0],
        row[1],
        formatCurrency(row[2]),
        String(row[3]),
        String(row[4]),
      ]);
      const revenuePdfRows = revenueRows.slice(1).map((row) => [
        row[0],
        row[1],
        typeof row[2] === "number" ? formatCurrency(row[2]) : row[2],
        row[3],
        row[4],
      ]);

      const doc = new jsPDF("l", "mm", "a4");
      const pageWidth = doc.internal.pageSize.getWidth();

      doc.setFillColor(16, 185, 129);
      doc.rect(0, 0, pageWidth, 28, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.text("Finance Insights Report", 14, 12);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(selectedGym.name, 14, 19);
      doc.text(`${monthName} ${selectedYear}`, 14, 24);

      doc.setTextColor(80, 80, 80);
      doc.setFontSize(9);
      doc.text(`Generated: ${generatedAt}`, pageWidth - 14, 19, { align: "right" });

      autoTable(doc, {
        startY: 34,
        head: [["Metric", "Value"]],
        body: summaryPdfRows,
        theme: "striped",
        headStyles: { fillColor: [37, 99, 235] },
        columnStyles: {
          0: { cellWidth: 85 },
          1: { halign: "right", cellWidth: 50 },
        },
        styles: { fontSize: 9 },
      });

      autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 8,
        head: [weeklyRows[0]],
        body: weeklyPdfRows,
        theme: "striped",
        headStyles: { fillColor: [99, 102, 241] },
        styles: { fontSize: 8 },
        columnStyles: {
          2: { halign: "right" },
          3: { halign: "center" },
          4: { halign: "center" },
        },
      });

      autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 8,
        head: [revenueRows[0]],
        body: revenuePdfRows,
        theme: "striped",
        headStyles: { fillColor: [16, 185, 129] },
        styles: { fontSize: 8 },
        columnStyles: { 2: { halign: "right" } },
      });

      autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 8,
        head: [newJoinRows[0]],
        body: newJoinRows.slice(1),
        theme: "striped",
        headStyles: { fillColor: [139, 92, 246] },
        styles: { fontSize: 8 },
      });

      autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 8,
        head: [renewalRows[0]],
        body: renewalRows.slice(1),
        theme: "striped",
        headStyles: { fillColor: [59, 130, 246] },
        styles: { fontSize: 8 },
      });

      doc.save(`${getFinanceExportBaseName(selectedGym.name, selectedYear, selectedMonth)}.pdf`);
    } catch (error) {
      console.error("Error exporting finance insights PDF:", error);
      window.alert("Failed to export PDF file. Please try again.");
    } finally {
      setPdfExporting(false);
    }
  };

  const handleExportOverallPdf = async () => {
  if (!selectedGym?.id || !selectedGym?.name || !data) return;

  setOverallPdfExporting(true);
  try {
    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
      import("jspdf"),
      import("jspdf-autotable"),
    ]);

    const years = getReportYears(now.getFullYear());
    const yearlyHistory = [];

    for (const year of years) {
      const monthLimit = year === now.getFullYear() ? now.getMonth() + 1 : 12;
      const monthResponses = await Promise.all(
        Array.from({ length: monthLimit }, (_, monthIndex) =>
          requestInsights(selectedGym.id, monthIndex, year)
        )
      );

      const months = monthResponses.map((monthData, monthIndex) => ({
        monthIndex,
        monthName: MONTHS[monthIndex],
        revenue: Number(monthData?.month_revenue || 0),
        newJoins: Number(monthData?.month_new_joins || 0),
        renewals: Number(monthData?.month_renewals || 0),
        activeMembers: Number(monthData?.month_active_members || 0),
      }));

      yearlyHistory.push({
        year,
        totalRevenue: months.reduce((sum, month) => sum + month.revenue, 0),
        totalNewJoins: months.reduce((sum, m) => sum + m.newJoins, 0),
        totalRenewals: months.reduce((sum, m) => sum + m.renewals, 0),
        months,
      });
    }

    const overallSummary = summarizeOverallRevenueHistory(yearlyHistory);
    const generatedAt = new Date().toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const doc = new jsPDF("l", "mm", "a4");
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14;
    const usableWidth = pageWidth - margin * 2;

    // ===== Helper to add footer on all pages =====
    const addPageFooter = () => {
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(120, 120, 120);
        doc.text(selectedGym.name, margin, pageHeight - 8);
        doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin, pageHeight - 8, {
          align: "right",
        });
      }
    };

    // ===== Header =====
    doc.setFillColor(20, 30, 50);
    doc.rect(0, 0, pageWidth, 22, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("Overall Revenue Report", margin, 12);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(selectedGym.name, margin, 18);
    doc.text(
      `${REPORT_START_YEAR} – ${now.getFullYear()}  •  Generated: ${generatedAt}`,
      pageWidth - margin,
      16,
      { align: "right" }
    );

    // ===== 1. Two‑column KPI tables =====
    const kpiLeft = [
      ["All‑Time Revenue", formatCurrency(data?.total_revenue_all_time)],
      ["Salary Paid", formatCurrency(data?.total_salary_paid_all_time)],
      ["Net Profit", formatCurrency(data?.net_profit_all_time)],
      ["Pending Dues", formatCurrency(data?.total_dues_all_time)],
    ];
    const kpiRight = [
      ["Avg Monthly Revenue", formatCurrency(data?.avg_monthly_revenue)],
      [
        "Best Revenue Year",
        overallSummary.bestYear
          ? `${overallSummary.bestYear.year} (${formatCurrency(
              overallSummary.bestYear.totalRevenue
            )})`
          : "-",
      ],
      [
        "Best Revenue Month",
        overallSummary.bestMonth
          ? `${overallSummary.bestMonth.monthName} ${overallSummary.bestMonth.year} (${formatCurrency(
              overallSummary.bestMonth.revenue
            )})`
          : "-",
      ],
      ["Years with Revenue", `${overallSummary.activeYears} of ${overallSummary.yearsCovered}`],
    ];

    const tableWidthHalf = usableWidth / 2 - 4; // gap between columns

    autoTable(doc, {
      startY: 28,
      margin: { left: margin },
      head: [["Metric", "Value"]],
      body: kpiLeft,
      theme: "grid",
      headStyles: { fillColor: [40, 50, 70], fontSize: 9, fontStyle: "bold", cellPadding: 3 },
      bodyStyles: { fontSize: 9, cellPadding: 3 },
      alternateRowStyles: { fillColor: [245, 245, 250] },
      tableWidth: tableWidthHalf,
      columnStyles: {
        0: { cellWidth: tableWidthHalf * 0.6 }, // Metric column wider
        1: { cellWidth: tableWidthHalf * 0.4, halign: "right", fontStyle: "bold" },
      },
    });
    const leftEndY = doc.lastAutoTable.finalY;

    autoTable(doc, {
      startY: 28,
      margin: { left: margin + tableWidthHalf + 8 },
      head: [["Metric", "Value"]],
      body: kpiRight,
      theme: "grid",
      headStyles: { fillColor: [40, 50, 70], fontSize: 9, fontStyle: "bold", cellPadding: 3 },
      bodyStyles: { fontSize: 9, cellPadding: 3 },
      alternateRowStyles: { fillColor: [245, 245, 250] },
      tableWidth: tableWidthHalf,
      columnStyles: {
        0: { cellWidth: tableWidthHalf * 0.6 },
        1: { cellWidth: tableWidthHalf * 0.4, halign: "right", fontStyle: "bold" },
      },
    });
    const kpiEndY = Math.max(leftEndY, doc.lastAutoTable.finalY);

    // ===== 2. Year‑wise summary table with explicit column widths =====
    autoTable(doc, {
      startY: kpiEndY + 12,
      margin: { left: margin, right: margin },
      head: [["Year", "Total Revenue", "New Joins", "Renewals", "Avg Revenue / Month"]],
      body: yearlyHistory.map((ye) => [
        String(ye.year),
        formatCurrency(ye.totalRevenue),
        ye.totalNewJoins.toString(),
        ye.totalRenewals.toString(),
        formatCurrency(ye.months.length ? ye.totalRevenue / ye.months.length : 0),
      ]),
      theme: "grid",
      headStyles: { fillColor: [0, 100, 150], fontSize: 9.5, fontStyle: "bold", cellPadding: 4 },
      bodyStyles: { fontSize: 9.5, cellPadding: 3.5 },
      alternateRowStyles: { fillColor: [240, 248, 255] },
      columnStyles: {
        0: { cellWidth: 20, halign: "center", fontStyle: "bold" }, // Year
        1: { cellWidth: 45, halign: "right", fontStyle: "bold" }, // Total Revenue
        2: { cellWidth: 25, halign: "center" }, // New Joins
        3: { cellWidth: 25, halign: "center" }, // Renewals
        4: { cellWidth: 45, halign: "right" }, // Avg Revenue / Month
      },
    });

    // ===== 3. Monthly breakdown per year =====
    const yearColors = [
      [55, 65, 81],
      [29, 78, 216],
      [147, 51, 234],
      [220, 38, 38],
      [5, 150, 105],
    ];

    yearlyHistory.forEach((yearEntry, yi) => {
      const color = yearColors[yi % yearColors.length];
      if (yi > 0) doc.addPage();

      // Year header
      const headerY = yi === 0 ? doc.lastAutoTable.finalY + 15 : 15;
      doc.setFillColor(...color);
      doc.rect(margin, headerY, usableWidth, 9, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text(
        `${yearEntry.year}  —  Total: ${formatCurrency(
          yearEntry.totalRevenue
        )}  |  Joins: ${yearEntry.totalNewJoins}  |  Renewals: ${yearEntry.totalRenewals}`,
        margin + 4,
        headerY + 6
      );

      autoTable(doc, {
        startY: headerY + 12,
        margin: { left: margin, right: margin },
        head: [["Month", "Revenue", "New Joins", "Renewals", "Active Members"]],
        body: yearEntry.months.map((m) => [
          m.monthName,
          formatCurrency(m.revenue),
          m.newJoins.toString(),
          m.renewals.toString(),
          m.activeMembers.toString(),
        ]),
        theme: "grid",
        headStyles: {
          fillColor: color,
          fontSize: 9,
          fontStyle: "bold",
          cellPadding: 3.5,
          textColor: 255,
        },
        bodyStyles: { fontSize: 9, cellPadding: 3 },
        alternateRowStyles: { fillColor: [250, 250, 255] },
        columnStyles: {
          0: { cellWidth: 28, fontStyle: "bold" }, // Month name
          1: { cellWidth: 35, halign: "right", fontStyle: "bold" }, // Revenue
          2: { cellWidth: 22, halign: "center" }, // New Joins
          3: { cellWidth: 22, halign: "center" }, // Renewals
          4: { cellWidth: 28, halign: "center" }, // Active Members
        },
        didParseCell: (data) => {
          if (data.section === "body" && data.column.index === 1) {
            const monthEntry = yearEntry.months[data.row.index];
            if (monthEntry && monthEntry.revenue > 0) {
              data.cell.styles.textColor = [0, 100, 0];
            }
          }
        },
      });
    });

    addPageFooter();
    doc.save(`${getFinanceOverallExportBaseName(selectedGym.name)}.pdf`);
  } catch (error) {
    console.error("Error exporting overall revenue PDF:", error);
    window.alert("Failed to export overall PDF. Please try again.");
  } finally {
    setOverallPdfExporting(false);
  }
};

  const handleExportOverallExcel = async () => {
    if (!selectedGym?.id || !selectedGym?.name || !data) return;

    setOverallExcelExporting(true);
    try {
      const XLSX = await import("xlsx");
      const workbook = XLSX.utils.book_new();

      const years = getReportYears(now.getFullYear());
      const yearlyHistory = [];
      const detailedTransactions = [];
      const dayRollupMap = new Map();

      for (const year of years) {
        const monthLimit = year === now.getFullYear() ? now.getMonth() + 1 : 12;
        const monthResponses = await Promise.all(
          Array.from({ length: monthLimit }, (_, monthIndex) =>
            requestInsights(selectedGym.id, monthIndex, year)
          )
        );

        const months = monthResponses.map((monthData, monthIndex) => {
          const revenue = Number(monthData?.month_revenue || 0);
          const newJoins = Number(monthData?.month_new_joins || 0);
          const renewals = Number(monthData?.month_renewals || 0);
          const activeMembers = Number(monthData?.month_active_members || 0);

          const payments = monthData?.month_revenue_list || [];
          payments.forEach((payment) => {
            const dateValue = getPaymentDate(payment);
            const date = new Date(dateValue);
            if (Number.isNaN(date.getTime())) return;

            const rowYear = date.getFullYear();
            const rowMonthIndex = date.getMonth();
            const rowMonth = MONTHS[rowMonthIndex];
            const rowDay = date.getDate();
            const rowDate = `${rowYear}-${String(rowMonthIndex + 1).padStart(2, "0")}-${String(rowDay).padStart(2, "0")}`;
            const amount = Number(payment.amount || 0);

            const dayKey = `${rowYear}-${String(rowMonthIndex + 1).padStart(2, "0")}-${String(rowDay).padStart(2, "0")}`;
            const existingDay = dayRollupMap.get(dayKey);
            if (existingDay) {
              existingDay.txnCount += 1;
              existingDay.revenue += amount;
            } else {
              dayRollupMap.set(dayKey, {
                year: rowYear,
                monthIndex: rowMonthIndex,
                month: rowMonth,
                day: rowDay,
                date: rowDate,
                txnCount: 1,
                revenue: amount,
              });
            }

            detailedTransactions.push({
              year: rowYear,
              monthIndex: rowMonthIndex,
              month: rowMonth,
              day: rowDay,
              date: rowDate,
              memberName: payment.member_name || "Unknown",
              phone: payment.phone || "-",
              amount,
              paymentMode: payment.payment_mode || "-",
              status: payment.status || "paid",
              collectedBy: payment.collected_by_name || "-",
              paidAt: formatExcelDateTime(dateValue),
            });
          });

          return {
            monthIndex,
            monthName: MONTHS[monthIndex],
            revenue,
            newJoins,
            renewals,
            activeMembers,
          };
        });

        yearlyHistory.push({
          year,
          totalRevenue: months.reduce((sum, month) => sum + month.revenue, 0),
          totalNewJoins: months.reduce((sum, m) => sum + m.newJoins, 0),
          totalRenewals: months.reduce((sum, m) => sum + m.renewals, 0),
          months,
        });
      }

      const overallSummary = summarizeOverallRevenueHistory(yearlyHistory);
      const generatedAt = new Date().toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

      const overviewRows = [
        ["Overall Finance Report"],
        ["Gym", selectedGym.name],
        ["Generated At", generatedAt],
        ["Reporting Range", `${REPORT_START_YEAR} - ${now.getFullYear()}`],
        [],
        ["KPI", "Value"],
        ["All-Time Revenue", Number(data?.total_revenue_all_time || 0)],
        ["Salary Paid", Number(data?.total_salary_paid_all_time || 0)],
        ["Pending Dues", Number(data?.total_dues_all_time || 0)],
        ["Net Profit", Number(data?.net_profit_all_time || 0)],
        ["Average Monthly Revenue", Number(data?.avg_monthly_revenue || 0)],
        ["Years Covered", overallSummary.yearsCovered],
        ["Active Revenue Years", overallSummary.activeYears],
      ];

      const yearMonthRows = [
        ["Year", "Month", "Revenue", "New Joins", "Renewals", "Active Members"],
        ...yearlyHistory.flatMap((yearEntry) =>
          yearEntry.months.map((monthEntry) => [
            yearEntry.year,
            monthEntry.monthName,
            Number(monthEntry.revenue || 0),
            Number(monthEntry.newJoins || 0),
            Number(monthEntry.renewals || 0),
            Number(monthEntry.activeMembers || 0),
          ])
        ),
      ];

      const dayRollupRows = [
        ["Year", "Month", "Day", "Date", "Transactions", "Revenue"],
        ...Array.from(dayRollupMap.values())
          .sort((a, b) => {
            if (a.year !== b.year) return a.year - b.year;
            if (a.monthIndex !== b.monthIndex) return a.monthIndex - b.monthIndex;
            return a.day - b.day;
          })
          .map((dayEntry) => [
            dayEntry.year,
            dayEntry.month,
            dayEntry.day,
            dayEntry.date,
            dayEntry.txnCount,
            Number(dayEntry.revenue || 0),
          ]),
      ];

      const detailedRows = [
        ["Year", "Month", "Day", "Date", "Member", "Phone", "Amount", "Mode", "Status", "Collected By", "Paid At"],
        ...detailedTransactions
          .sort((a, b) => {
            if (a.year !== b.year) return a.year - b.year;
            if (a.monthIndex !== b.monthIndex) return a.monthIndex - b.monthIndex;
            if (a.day !== b.day) return a.day - b.day;
            return a.memberName.localeCompare(b.memberName);
          })
          .map((tx) => [
            tx.year,
            tx.month,
            tx.day,
            tx.date,
            tx.memberName,
            tx.phone,
            Number(tx.amount || 0),
            tx.paymentMode,
            tx.status,
            tx.collectedBy,
            tx.paidAt,
          ]),
      ];

      const addSheet = (name, rows, cols = [], currencyColumns = [], currencyStartRow = 1) => {
        const sheet = XLSX.utils.aoa_to_sheet(rows);
        if (cols.length > 0) sheet["!cols"] = cols;
        if (currencyColumns.length > 0) {
          const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
          for (let row = currencyStartRow; row <= range.e.r; row += 1) {
            currencyColumns.forEach((columnIndex) => {
              const cellRef = XLSX.utils.encode_cell({ r: row, c: columnIndex });
              const cell = sheet[cellRef];
              if (cell && typeof cell.v === "number") {
                cell.z = EXCEL_CURRENCY_FORMAT;
              }
            });
          }
        }
        XLSX.utils.book_append_sheet(workbook, sheet, name);
      };

      addSheet(
        "Overview",
        overviewRows,
        [{ wch: 30 }, { wch: 24 }],
        [1],
        6
      );

      addSheet(
        "Year-Month",
        yearMonthRows,
        [{ wch: 10 }, { wch: 12 }, { wch: 16 }, { wch: 12 }, { wch: 12 }, { wch: 14 }],
        [2],
        1
      );

      addSheet(
        "Year-Month-Day",
        dayRollupRows,
        [{ wch: 10 }, { wch: 12 }, { wch: 8 }, { wch: 14 }, { wch: 14 }, { wch: 16 }],
        [5],
        1
      );

      addSheet(
        "Transactions",
        detailedRows,
        [
          { wch: 10 },
          { wch: 12 },
          { wch: 8 },
          { wch: 14 },
          { wch: 24 },
          { wch: 16 },
          { wch: 14 },
          { wch: 12 },
          { wch: 12 },
          { wch: 20 },
          { wch: 22 },
        ],
        [6],
        1
      );

      XLSX.writeFile(workbook, `${getFinanceOverallExportBaseName(selectedGym.name)}.xlsx`);
    } catch (error) {
      console.error("Error exporting overall revenue Excel:", error);
      window.alert("Failed to export overall Excel. Please try again.");
    } finally {
      setOverallExcelExporting(false);
    }
  };


  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
        <Header title="Finance Insights" showBack backUrl="/finance" />
        <InsightsSkeleton />
      </div>
    );
  }

  if (!selectedGym) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
        <Header title="Finance Insights" showBack backUrl="/finance" />
        <main className="px-4 py-4">
          <div className="text-center py-12">
            <div className="w-20 h-20 bg-gradient-to-br from-[#f0813d] to-[#f0813d] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <BarChart3 className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">No Gym Selected</h2>
            <p className="text-gray-500 text-sm mb-6 px-4">
              Please select a gym to view finance insights
            </p>
            <button
              onClick={() => router.push("/admin/dashboard")}
              className="px-6 py-3 bg-gradient-to-r from-[#f0813d] to-[#f0813d] text-white rounded-xl font-semibold text-sm active:scale-95 transition-transform"
            >
              Go to Dashboard
            </button>
          </div>
        </main>
      </div>
    );
  }

  const summaryCards = [
    {
      label: "Total Revenue",
      value: formatCurrency(data?.total_revenue_all_time),
      icon: <IndianRupee className="w-5 h-5" />,
      color: "from-[#f0813d] to-[#9c4400]",
textColor: "text-[#f0813d]",
bgColor: "bg-[#f0813d]/10",
    },
    {
      label: "Salary Paid",
      value: formatCurrency(data?.total_salary_paid_all_time),
      icon: <Wallet className="w-5 h-5" />,
      color: "from-[#1f1f1f] to-[#2b2b2b]",
textColor: "text-[#1f1f1f]",
bgColor: "bg-[#1f1f1f]/5",
    },
    {
      label: "Pending Dues",
      value: formatCurrency(data?.total_dues_all_time),
      icon: <PiggyBank className="w-5 h-5" />,
      color: "from-[#3a3a3a] to-[#1f1f1f]",
textColor: "text-[#1f1f1f]",
bgColor: "bg-[#1f1f1f]/5",
    },
    {
      label: "Net Profit",
      value: formatCurrency(data?.net_profit_all_time),
      icon: <TrendingUp className="w-5 h-5" />,
      color: "from-[#f0813d] to-[#9c4400]",
textColor: "text-[#f0813d]",
bgColor: "bg-[#f0813d]/10",
    },
    {
      label: "Avg Monthly Revenue",
      value: formatCurrency(data?.avg_monthly_revenue),
      icon: <BarChart3 className="w-5 h-5" />,
      color: "from-[#1f1f1f] to-[#2b2b2b]",
textColor: "text-[#1f1f1f]",
bgColor: "bg-[#1f1f1f]/5",
    },
  ];

  const weeklyFinanceData = data
    ? getWeeksForMonth(selectedMonth, selectedYear).map((week) => ({
        ...week,
        ...computeWeekData(data, week.start, week.end),
      }))
    : [];
  const maxWeeklyRevenue = Math.max(
    ...weeklyFinanceData.map((week) => Number(week.revenue || 0)),
    1
  );
  const monthRevenue = Number(data?.month_revenue || 0);
  const avgMonthlyRevenue = Number(data?.avg_monthly_revenue || 0);
  const revenueTarget = Math.max(monthRevenue, avgMonthlyRevenue, 1);
  const revenuePace = Math.min(100, Math.round((monthRevenue / revenueTarget) * 100));
  const bestWeek = weeklyFinanceData.reduce(
    (best, week) => (Number(week.revenue || 0) > Number(best?.revenue || 0) ? week : best),
    null
  );
  const cashFlowRevenue = Number(data?.total_revenue_all_time || 0);
  const cashFlowSalary = Number(data?.total_salary_paid_all_time || 0);
  const cashFlowDues = Number(data?.total_dues_all_time || 0);
  const cashFlowProfit = Math.max(Number(data?.net_profit_all_time || 0), 0);
  const cashFlowTotal = Math.max(cashFlowRevenue + cashFlowSalary + cashFlowDues + cashFlowProfit, 1);
  const profitSlice = Math.round((cashFlowProfit / cashFlowTotal) * 100);
  const salarySlice = Math.round((cashFlowSalary / cashFlowTotal) * 100);
  const duesSlice = Math.round((cashFlowDues / cashFlowTotal) * 100);
  const cashFlowGradient = `conic-gradient(#f0813d 0 ${profitSlice}%, #1f1f1f ${profitSlice}% ${
    profitSlice + salarySlice
  }%, #9c4400 ${profitSlice + salarySlice}% ${
    profitSlice + salarySlice + duesSlice
  }%, #f6d0b8 ${profitSlice + salarySlice + duesSlice}% 100%)`;
  const memberMovementMax = Math.max(
    Number(data?.month_new_joins || 0),
    monthRenewalsCount,
    Number(data?.month_active_members || 0),
    1
  );
  const memberMovement = [
    {
      label: "New joins",
      value: Number(data?.month_new_joins || 0),
      icon: <UserPlus className="w-4 h-4" />,
      color: "bg-[#f0813d]",
    },
    {
      label: "Renewals",
      value: monthRenewalsCount,
      icon: <RefreshCw className="w-4 h-4" />,
      color: "bg-[#1f1f1f]",
    },
    {
      label: "Active",
      value: Number(data?.month_active_members || 0),
      icon: <Activity className="w-4 h-4" />,
      color: "bg-[#92c83e]",
    },
  ];

  return (
    <div className="min-h-screen bg-[#f6f3f1] text-[#1a1c1c] safe-area-inset-bottom pb-32">
      <Header title="Finance Insights" showBack backUrl="/finance" />

      <main className="px-3 md:px-8 lg:px-12 py-3 md:py-6 space-y-5 max-w-7xl mx-auto w-full">
        {/* ─── All Time Summary ─── */}
        <section>
          <div className="flex items-center justify-between gap-3 mb-3 px-1">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
              All Time Overview
            </h2>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleExportOverallExcel}
                disabled={overallExcelExporting || loading || monthLoading || !data}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-orange-50 text-[#f0813d] border border-orange-200 hover:bg-orange-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-1.5"
                title="Export overall multi-year report as Excel"
              >
                {overallExcelExporting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                <span className="hidden sm:inline">Export Overall Excel</span>
                <span className="sm:hidden">Overall Excel</span>
              </button>

              <button
                onClick={handleExportOverallPdf}
                disabled={overallPdfExporting || loading || monthLoading || !data}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-orange-50 text-[#f0813d] border border-orange-200 hover:bg-orange-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-1.5"
                title="Export overall multi-year revenue report"
              >
                {overallPdfExporting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <FileText className="w-3.5 h-3.5" />
                )}
                <span className="hidden sm:inline">Export Overall PDF</span>
                <span className="sm:hidden">Overall PDF</span>
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {summaryCards.map((card, idx) => (
              <div
  key={idx}
  className={`relative overflow-hidden bg-white rounded-[28px] p-5 border border-[#ece7e2] shadow-[0_10px_35px_rgba(0,0,0,0.06)] hover:shadow-[0_18px_45px_rgba(0,0,0,0.08)] transition-all duration-300 ${
    idx === summaryCards.length - 1 ? "col-span-2 sm:col-span-1" : ""
  }`}
>
  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-[#f0813d]/10 to-transparent rounded-full blur-2xl pointer-events-none" />

  <div
    className={`w-9 h-9 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center mb-3 shadow-sm`}
  >
                  <span className="text-white">{card.icon}</span>
                </div>
                <p className="text-xs font-medium text-[#7b746f] mb-1">{card.label}</p>
                <p className={`text-xl font-bold ${card.textColor}`}>{card.value}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ─── Year & Month Selector ─── */}
        <section>
          <div className="flex items-center justify-between mb-3 px-1">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
              Monthly Breakdown
            </h2>
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleExportPdf}
                disabled={pdfExporting || monthLoading || !data}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#f0813d]/10 text-[#f0813d] border border-[#f0813d]/20 hover:bg-[#f0813d]/15 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-1.5 shadow-sm"
              >
                {pdfExporting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <FileText className="w-3.5 h-3.5" />
                )}
                <span className="hidden sm:inline">Export PDF</span>
              </button>
              <button
                onClick={handleExportExcel}
                disabled={exporting || monthLoading || !data}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#f0813d]/10 text-[#f0813d] border border-[#f0813d]/20 hover:bg-[#f0813d]/15 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-1.5 shadow-sm"
              >
                {exporting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                <span className="hidden sm:inline">Export Excel</span>
              </button>
              {(() => {
                const startYear = 2024;
                const years = [];
                for (let y = startYear; y <= now.getFullYear(); y++) years.push(y);
                return years.map((y) => (
                  <button
                    key={y}
                    onClick={() => handleYearChange(y)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                      y === selectedYear
                        ? "bg-[#f0813d]/15 text-[#f0813d] border border-[#f0813d]/20 shadow-sm"
                        : "bg-white text-[#7b746f] border border-[#ece7e2] hover:bg-[#f5f2ef] active:scale-95"
                    }`}
                  >
                    {y}
                  </button>
                ));
              })()}
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3">
            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
              {MONTHS.map((m, idx) => {
                const isSelected = idx === selectedMonth;
                const isFuture =
                  selectedYear === now.getFullYear() && idx > now.getMonth();
                return (
                  <button
                    key={m}
                    disabled={isFuture}
                    onClick={() => handleMonthChange(idx)}
                    className={`flex-shrink-0 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 ${
                      isSelected
                        ? "bg-gradient-to-r from-[#1f1f1f] to-[#2b2b2b] text-white shadow-md scale-105"
                        : isFuture
                        ? "bg-gray-50 text-gray-300 cursor-not-allowed"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200 active:scale-95"
                    }`}
                    style={{ minWidth: "52px" }}
                  >
                    {m}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* ─── Month Wise Breakdown ─── */}
        {!monthLoading && data && (
          <section className="space-y-3">
            <div className="relative overflow-hidden rounded-[28px] bg-[#151515] p-5 text-white shadow-[0_24px_70px_rgba(0,0,0,0.24)]">
              <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-[#f0813d]/35 to-transparent" />
              <div className="relative grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
                <div>
                  <div className="mb-5 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#f7b27c]">Finance command center</p>
                      <h2 className="mt-2 text-3xl font-black leading-none sm:text-4xl">{MONTHS[selectedMonth]} pulse</h2>
                    </div>
                    <button
                      onClick={() => (data?.month_revenue_list?.length > 0) && setDrillDown("revenue")}
                      disabled={!data?.month_revenue_list?.length}
                      className="rounded-2xl bg-white px-4 py-3 text-xs font-black uppercase tracking-wide text-[#1f1f1f] shadow-lg transition active:scale-95 disabled:opacity-50"
                    >
                      View cash
                    </button>
                  </div>
                  <div className="rounded-[24px] border border-white/10 bg-white/[0.08] p-4">
                    <div className="mb-4 flex items-end justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold text-white/55">This month revenue</p>
                        <p className="mt-1 text-4xl font-black tracking-normal text-white">{formatCurrency(monthRevenue)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-white/55">Pace</p>
                        <p className="text-2xl font-black text-[#f7b27c]">{revenuePace}%</p>
                      </div>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full rounded-full bg-gradient-to-r from-[#f0813d] via-[#ffb36f] to-white transition-all duration-700" style={{ width: `${revenuePace}%` }} />
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-2">
                      <FinanceMetricPill icon={<Users className="w-3.5 h-3.5" />} label="Active" value={data?.month_active_members ?? 0} />
                      <FinanceMetricPill icon={<UserPlus className="w-3.5 h-3.5" />} label="Joins" value={data?.month_new_joins ?? 0} />
                      <FinanceMetricPill icon={<RefreshCw className="w-3.5 h-3.5" />} label="Renew" value={monthRenewalsCount} />
                    </div>
                  </div>
                </div>
                <div className="rounded-[24px] border border-white/10 bg-white/[0.07] p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-white/55">Weekly revenue wave</p>
                      <p className="text-sm font-black text-white">
                        Best: {bestWeek ? `${bestWeek.label} ${formatCurrency(bestWeek.revenue)}` : "No revenue yet"}
                      </p>
                    </div>
                    <BarChart3 className="h-5 w-5 text-[#f7b27c]" />
                  </div>
                  <FinanceSparkline points={weeklyFinanceData.map((week) => week.revenue)} />
                  <div className="mt-3 overflow-x-auto pb-1">
                    <div className="flex h-28 min-w-[320px] items-end gap-2">
                      {weeklyFinanceData.map((week) => {
                        const height = Math.max(10, Math.round((Number(week.revenue || 0) / maxWeeklyRevenue) * 100));
                        return (
                          <button
                            key={week.num}
                            onClick={() => setWeekModal({ week, type: null })}
                            className="group flex min-w-[52px] flex-1 flex-col items-center gap-2 rounded-xl p-1 transition hover:bg-white/10 active:scale-95"
                            title={`${week.label}: ${formatCurrency(week.revenue)}`}
                          >
                            <span className="w-full rounded-t-2xl bg-gradient-to-t from-[#f0813d] to-[#ffd0a7] shadow-[0_8px_24px_rgba(240,129,61,0.28)] transition-all group-hover:brightness-110" style={{ height: `${height}%` }} />
                            <span className="text-[10px] font-black text-white/60">W{week.num}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="grid gap-3 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="rounded-[24px] border border-[#ece7e2] bg-white p-5 shadow-[0_14px_45px_rgba(0,0,0,0.06)]">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#f0813d]">Cash-flow mix</p>
                    <h3 className="text-xl font-black text-[#1f1f1f]">Profit, salary and dues</h3>
                  </div>
                  <IndianRupee className="h-5 w-5 text-[#f0813d]" />
                </div>
                <div className="flex items-center gap-5">
                  <div className="relative grid h-36 w-36 shrink-0 place-items-center rounded-full" style={{ background: cashFlowGradient }}>
                    <div className="grid h-24 w-24 place-items-center rounded-full bg-white text-center shadow-inner">
                      <div>
                        <p className="text-[10px] font-bold uppercase text-[#7b746f]">Net profit</p>
                        <p className="text-lg font-black text-[#1f1f1f]">{formatCurrency(data?.net_profit_all_time)}</p>
                      </div>
                    </div>
                  </div>
                  <div className="min-w-0 flex-1 space-y-3">
                    {[
                      ["Revenue", data?.total_revenue_all_time, "bg-[#f6d0b8]"],
                      ["Salary", data?.total_salary_paid_all_time, "bg-[#1f1f1f]"],
                      ["Dues", data?.total_dues_all_time, "bg-[#9c4400]"],
                    ].map(([label, value, color]) => (
                      <div key={label} className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className={`h-3 w-3 rounded-full ${color}`} />
                          <span className="text-xs font-bold text-[#7b746f]">{label}</span>
                        </div>
                        <span className="text-sm font-black text-[#1f1f1f]">{formatCurrency(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="rounded-[24px] border border-[#ece7e2] bg-white p-5 shadow-[0_14px_45px_rgba(0,0,0,0.06)]">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#f0813d]">Member movement</p>
                    <h3 className="text-xl font-black text-[#1f1f1f]">Joins, renewals and active base</h3>
                  </div>
                  <Users className="h-5 w-5 text-[#f0813d]" />
                </div>
                <div className="space-y-4">
                  {memberMovement.map((item) => {
                    const width = Math.max(7, Math.round((item.value / memberMovementMax) * 100));
                    return (
                      <button
                        key={item.label}
                        onClick={() => {
                          if (item.label === "New joins" && data?.month_new_joins_list?.length) setDrillDown("new_joins");
                          if (item.label === "Renewals" && monthRenewalsList.length) setDrillDown("renewals");
                        }}
                        className="w-full rounded-2xl border border-[#f0ebe6] bg-[#faf8f6] p-3 text-left transition active:scale-[0.99]"
                      >
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 text-[#1f1f1f]">
                            {item.icon}
                            <span className="text-sm font-black">{item.label}</span>
                          </div>
                          <span className="text-lg font-black text-[#1f1f1f]">{item.value}</span>
                        </div>
                        <div className="h-3 overflow-hidden rounded-full bg-[#e8e1db]">
                          <div className={`h-full rounded-full ${item.color}`} style={{ width: `${width}%` }} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>
        )}

        <section>
          {monthLoading ? (
            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm space-y-4">
              <Skeleton className="h-5 w-40 mb-2" />
              <Skeleton className="h-20 w-full rounded-xl" />
              <Skeleton className="h-20 w-full rounded-xl" />
            </div>
          ) : (
            <div className="space-y-3">
              {/* Revenue Card - Clickable */}
              <div
                onClick={() => (data?.month_revenue_list?.length > 0) && setDrillDown("revenue")}
                className={`bg-white rounded-2xl p-5 border border-gray-100 shadow-sm ${data?.month_revenue_list?.length > 0 ? "cursor-pointer active:scale-[0.98] transition-transform" : ""}`}
              >
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#f0813d] to-[#f0813d] flex items-center justify-center shadow-sm">
                    <IndianRupee className="w-4 h-4 text-white" />
                  </div>
                  <h3 className="text-sm font-semibold text-gray-700">Revenue</h3>
                  <span className="ml-auto text-xs font-medium text-gray-400">
                    {MONTHS[selectedMonth]} {selectedYear}
                  </span>
                </div>
                <div className="bg-gradient-to-r from-orange-50 to-orange-50 rounded-xl p-4 border border-orange-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-[#f0813d] mb-1">Total Revenue</p>
                      <p className="text-2xl font-bold text-[#f0813d]">
                        {formatCurrency(data?.month_revenue)}
                      </p>
                    </div>
                    {data?.month_revenue_list?.length > 0 && (
                      <ChevronRight className="w-5 h-5 text-[#f0813d]" />
                    )}
                  </div>
                </div>
              </div>

              {/* Members Card */}
              <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#f0813d] to-[#f0813d] flex items-center justify-center shadow-sm">
                    <Users className="w-4 h-4 text-white" />
                  </div>
                  <h3 className="text-sm font-semibold text-gray-700">Members</h3>
                  <span className="ml-auto text-xs font-medium text-gray-400">
                    {MONTHS[selectedMonth]} {selectedYear}
                  </span>
                </div>

                {/* New Joins - Clickable */}
                <div
                  onClick={() => (data?.month_new_joins_list?.length > 0) && setDrillDown("new_joins")}
                  className={`bg-gradient-to-r from-orange-50 to-orange-50 rounded-xl p-4 border border-orange-200 mb-3 ${data?.month_new_joins_list?.length > 0 ? "cursor-pointer active:scale-[0.98] transition-transform" : ""}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <UserPlus className="w-4 h-4 text-[#f0813d]" />
                    <p className="text-xs font-semibold text-[#f0813d] uppercase tracking-wide">
                      New Joins
                    </p>
                    {data?.month_new_joins_list?.length > 0 && (
                      <ChevronRight className="w-4 h-4 text-[#f0813d] ml-auto" />
                    )}
                  </div>
                  <p className="text-3xl font-extrabold text-[#f0813d]">
                    {data?.month_new_joins ?? 0}
                  </p>
                  <p className="text-xs text-[#f0813d] mt-1">
                    Members joined in {MONTHS[selectedMonth]}
                  </p>
                </div>

                {/* Renewals & Active - Secondary */}
                <div className="grid grid-cols-2 gap-3">
                  {/* Renewals - Clickable */}
                  <div
                    onClick={() => monthRenewalsList.length > 0 && setDrillDown("renewals")}
                    className={`bg-gray-50 rounded-xl p-3 border border-gray-100 ${monthRenewalsList.length > 0 ? "cursor-pointer active:scale-[0.98] transition-transform" : ""}`}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <RefreshCw className="w-3.5 h-3.5 text-[#f0813d]" />
                      <p className="text-xs font-medium text-gray-500">Renewals</p>
                      {monthRenewalsList.length > 0 && (
                        <ChevronRight className="w-3 h-3 text-gray-400 ml-auto" />
                      )}
                    </div>
                    <p className="text-xl font-bold text-gray-900">
                      {monthRenewalsCount}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Activity className="w-3.5 h-3.5 text-[#f0813d]" />
                      <p className="text-xs font-medium text-gray-500">Active</p>
                    </div>
                    <p className="text-lg font-bold text-gray-800">
                      {data?.month_active_members ?? 0}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* ─── Week Breakdown ─── */}
        {!monthLoading && data && (
          <section className="mb-30">
            <div className="flex items-center gap-2 mb-3 px-1">
              <Calendar className="w-4 h-4 text-gray-400" />
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
                Week Breakdown
              </h2>
              <span className="text-xs text-gray-400 ml-auto">
                {MONTHS[selectedMonth]} {selectedYear}
              </span>
            </div>
            <div className="space-y-3">
              {getWeeksForMonth(selectedMonth, selectedYear).map((week) => {
                const wd = computeWeekData(data, week.start, week.end);
                const hasData = wd.revenue > 0 || wd.newJoinsList.length > 0 || wd.renewalsList.length > 0;
                return (
                  <div
                    key={week.num}
                    className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
                  >
                    {/* Week Header */}
                    <div
                      className={`p-4 ${hasData ? "cursor-pointer active:scale-[0.99] transition-transform" : ""}`}
                      onClick={() => hasData && setWeekModal({ week, type: null })}
                    >
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <div className="w-8 h-8 shrink-0 rounded-lg bg-gradient-to-br from-[#f0813d] to-[#f0813d] flex items-center justify-center shadow-sm">
                            <span className="text-white text-xs font-bold">W{week.num}</span>
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-800">{week.label}</p>
                            <p className="truncate text-xs text-gray-400">{week.range}</p>
                          </div>
                        </div>
                        {hasData && <ChevronRight className="w-4 h-4 shrink-0 text-gray-400" />}
                      </div>
                      {/* Week Stats */}
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                        <div className="min-w-0 bg-orange-50 rounded-xl p-2.5 border border-orange-100 text-center">
                          <p className="text-[10px] font-medium text-[#f0813d] uppercase">Revenue</p>
                          <p className="truncate text-sm font-bold text-[#f0813d]">{formatCurrency(wd.revenue)}</p>
                        </div>
                        <div className="min-w-0 bg-orange-50 rounded-xl p-2.5 border border-orange-100 text-center">
                          <p className="text-[10px] font-medium text-[#f0813d] uppercase">New Joins</p>
                          <p className="text-sm font-bold text-[#f0813d]">{wd.newJoinsList.length}</p>
                        </div>
                        <div className="min-w-0 bg-orange-50 rounded-xl p-2.5 border border-orange-100 text-center">
                          <p className="text-[10px] font-medium text-[#f0813d] uppercase">Renewals</p>
                          <p className="text-sm font-bold text-[#f0813d]">{wd.renewalsList.length}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </main>

      {/* ─── Drill-Down Modal ─── */}
      {drillDown && (
        <div className="fixed inset-0 mb-3 bg-black/50 z-50 flex items-end sm:items-center justify-center" onClick={() => setDrillDown(null)}>
          <div
            className="bg-white w-full max-w-lg max-h-[85vh] rounded-t-2xl sm:rounded-2xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className={`p-4 flex items-center gap-3 border-b border-gray-100 ${
              drillDown === "revenue" ? "bg-gradient-to-r from-orange-50 to-orange-50" :
              drillDown === "new_joins" ? "bg-gradient-to-r from-orange-50 to-orange-50" :
              "bg-gradient-to-r from-orange-50 to-orange-50"
            }`}>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm ${
                drillDown === "revenue" ? "bg-gradient-to-br from-[#f0813d] to-[#f0813d]" :
                drillDown === "new_joins" ? "bg-gradient-to-br from-[#f0813d] to-[#f0813d]" :
                "bg-gradient-to-br from-[#f0813d] to-[#f0813d]"
              }`}>
                {drillDown === "revenue" && <IndianRupee className="w-5 h-5 text-white" />}
                {drillDown === "new_joins" && <UserPlus className="w-5 h-5 text-white" />}
                {drillDown === "renewals" && <RefreshCw className="w-5 h-5 text-white" />}
              </div>
              <div className="flex-1 ">
                <h3 className="font-bold text-[#1f1f1f] text-base">
                  {drillDown === "revenue" && "Revenue Details"}
                  {drillDown === "new_joins" && "New Members"}
                  {drillDown === "renewals" && "Renewals"}
                </h3>
                <p className="text-xs text-gray-500">{MONTHS[selectedMonth]} {selectedYear}</p>
              </div>
              <button
                onClick={() => setDrillDown(null)}
                className=" icon-badge w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 active:scale-90 transition-all"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-4 mb-15 space-y-2">
              {/* Revenue Drill-Down */}
              {drillDown === "revenue" && (
                <>
                  <div className="flex items-center justify-between mb-3 px-1">
                    <span className="text-xs font-medium text-gray-500">
                      {data?.month_revenue_list?.length || 0} payments
                    </span>
                    <span className="text-sm font-bold text-[#f0813d]">
                      Total: {formatCurrency(data?.month_revenue)}
                    </span>
                  </div>
                  {(data?.month_revenue_list || []).map((p, i) => (
                    <div key={p.id || i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#f0813d] to-[#f0813d] flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                        {(p.member_name || "?").charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-[#1f1f1f] text-sm truncate">{p.member_name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {p.phone && (
                            <span className="text-xs text-gray-500 flex items-center gap-1">
                              <Phone className="w-3 h-3" />{p.phone}
                            </span>
                          )}
                          <span className="text-xs text-gray-400 capitalize">• {p.payment_mode}</span>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {new Date(p.paid_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                        </p>
                      </div>
                      <p className="font-bold text-[#f0813d] text-sm whitespace-nowrap">
                        ₹{Number(p.amount).toLocaleString("en-IN")}
                      </p>
                    </div>
                  ))}
                </>
              )}

              {/* New Joins Drill-Down */}
              {drillDown === "new_joins" && (
                <>
                  <div className="flex items-center justify-between mb-5 px-1">
                    <span className="text-xs font-medium text-gray-500">
                      {data?.month_new_joins_list?.length || 0} members
                    </span>
                  </div>
                  {(data?.month_new_joins_list || []).map((m, i) => (
                    <div
                      key={m.id || i}
                      onClick={() => router.push(`/members/${m.id}`)}
                      className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100 cursor-pointer active:scale-[0.98] transition-transform"
                    >
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#f0813d] to-[#f0813d] flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                        {(m.full_name || "?").charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-[#1f1f1f] text-sm truncate">{m.full_name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {m.phone && (
                            <span className="text-xs text-gray-500 flex items-center gap-1">
                              <Phone className="w-3 h-3" />{m.phone}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">
                          Joined {new Date(m.join_date + 'T00:00:00').toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          Valid till {formatExcelDate(m.end_date)} • {m.payment_mode || "-"}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs font-medium text-[#f0813d]">{m.plan_name}</p>
                        <ChevronRight className="w-4 h-4 text-gray-400 ml-auto mt-1" />
                      </div>
                    </div>
                  ))}
                </>
              )}

              {/* Renewals Drill-Down */}
              {drillDown === "renewals" && (
                <>
                  <div className="flex items-center justify-between mb-3 px-1">
                    <span className="text-xs font-medium text-gray-500">
                      {monthRenewalsCount} renewals
                    </span>
                  </div>
                  {monthRenewalsList.map((r, i) => (
                    <div key={r.id || i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#f0813d] to-[#f0813d] flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                        {(r.member_name || "?").charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-[#1f1f1f] text-sm truncate">{r.member_name}</p>
                        {r.phone && (
                          <span className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                            <Phone className="w-3 h-3" />{r.phone}
                          </span>
                        )}
                        <p className="text-xs text-[#f0813d] mt-0.5 font-medium">
                          Renewed on {new Date(getRenewalEventDate(r)).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          Valid {new Date(r.start_date + 'T00:00:00').toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                          {" → "}
                          {new Date(r.end_date + 'T00:00:00').toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span className="px-2 py-1 bg-orange-50 text-[#f0813d] text-xs font-medium rounded-lg border border-orange-100">
                          {r.plan_name}
                        </span>
                      </div>
                    </div>
                  ))}
                </>
              )}

              {/* Empty state */}
              {((drillDown === "revenue" && !(data?.month_revenue_list?.length)) ||
                (drillDown === "new_joins" && !(data?.month_new_joins_list?.length)) ||
                (drillDown === "renewals" && !monthRenewalsList.length)) && (
                <div className="text-center py-8">
                  <p className="text-gray-500 text-sm">No data found</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── Week Drill-Down Modal ─── */}
      {weekModal && (() => {
        const week = weekModal.week;
        const wd = computeWeekData(data, week.start, week.end);
        const days = getDaysInRange(week.start, week.end);
        return (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center" onClick={() => setWeekModal(null)}>
            <div
              className="bg-white w-full mb-20 max-w-lg max-h-[90vh] rounded-t-2xl sm:rounded-2xl overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="p-4 flex items-center gap-3 border-b border-gray-100 bg-gradient-to-r from-orange-50 to-orange-50">
                <div className="w-10 h-10 shrink-0 rounded-xl bg-gradient-to-br from-[#f0813d] to-[#f0813d] flex items-center justify-center shadow-sm">
                  <span className="text-white text-sm font-bold">W{week.num}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-gray-900 text-base">{week.label}</h3>
                  <p className="truncate text-xs text-gray-500">{week.range}</p>
                </div>
                <button
                  onClick={() => setWeekModal(null)}
                  className=" icon-badge w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 active:scale-90 transition-all"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Week Summary Stats */}
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <div
                    onClick={() => wd.revenueList.length > 0 && setWeekModal({ week, type: "revenue" })}
                    className={`min-w-0 bg-orange-50 rounded-xl p-3 border border-orange-100 text-center ${wd.revenueList.length > 0 ? "cursor-pointer active:scale-95 transition-transform" : ""}`}
                  >
                    <IndianRupee className="w-4 h-4 text-[#f0813d] mx-auto mb-1" />
                    <p className="text-[10px] font-medium text-[#f0813d] uppercase">Revenue</p>
                    <p className="truncate text-sm font-bold text-[#f0813d]">{formatCurrency(wd.revenue)}</p>
                  </div>
                  <div
                    onClick={() => wd.newJoinsList.length > 0 && setWeekModal({ week, type: "new_joins" })}
                    className={`min-w-0 bg-orange-50 rounded-xl p-3 border border-orange-100 text-center ${wd.newJoinsList.length > 0 ? "cursor-pointer active:scale-95 transition-transform" : ""}`}
                  >
                    <UserPlus className="w-4 h-4 text-[#f0813d] mx-auto mb-1" />
                    <p className="text-[10px] font-medium text-[#f0813d] uppercase">New Joins</p>
                    <p className="text-sm font-bold text-[#f0813d]">{wd.newJoinsList.length}</p>
                  </div>
                  <div
                    onClick={() => wd.renewalsList.length > 0 && setWeekModal({ week, type: "renewals" })}
                    className={`min-w-0 bg-orange-50 rounded-xl p-3 border border-orange-100 text-center ${wd.renewalsList.length > 0 ? "cursor-pointer active:scale-95 transition-transform" : ""}`}
                  >
                    <RefreshCw className="w-4 h-4 text-[#f0813d] mx-auto mb-1" />
                    <p className="text-[10px] font-medium text-[#f0813d] uppercase">Renewals</p>
                    <p className="text-sm font-bold text-[#f0813d]">{wd.renewalsList.length}</p>
                  </div>
                </div>

                {/* Week Lists (if a type is selected) */}
                {weekModal.type === "revenue" && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between px-1 mb-2">
                      <span className="text-xs font-medium text-gray-500">{wd.revenueList.length} payments</span>
                      <span className="text-sm font-bold text-[#f0813d]">Total: {formatCurrency(wd.revenue)}</span>
                    </div>
                    {wd.revenueList.map((p, i) => (
                      <div key={p.id || i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#f0813d] to-[#f0813d] flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                          {(p.member_name || "?").charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 text-sm truncate">{p.member_name}</p>
                          {p.phone && <span className="text-xs text-gray-500 flex items-center gap-1"><Phone className="w-3 h-3" />{p.phone}</span>}
                          <p className="text-xs text-gray-400 mt-0.5">{new Date(getPaymentDate(p)).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })} • {p.payment_mode}</p>
                        </div>
                        <p className="font-bold text-[#f0813d] text-sm whitespace-nowrap">₹{Number(p.amount).toLocaleString("en-IN")}</p>
                      </div>
                    ))}
                  </div>
                )}
                {weekModal.type === "new_joins" && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between px-1 mb-2">
                      <span className="text-xs font-medium text-gray-500">{wd.newJoinsList.length} members</span>
                    </div>
                    {wd.newJoinsList.map((m, i) => (
                      <div key={m.id || i} onClick={() => router.push(`/members/${m.id}`)} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100 cursor-pointer active:scale-[0.98] transition-transform">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#f0813d] to-[#f0813d] flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                          {(m.full_name || "?").charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 text-sm truncate">{m.full_name}</p>
                          {m.phone && <span className="text-xs text-gray-500 flex items-center gap-1"><Phone className="w-3 h-3" />{m.phone}</span>}
                          <p className="text-xs text-gray-400 mt-0.5">Joined {new Date(m.join_date + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-xs font-medium text-[#f0813d]">{m.plan_name}</p>
                          <ChevronRight className="w-4 h-4 text-gray-400 ml-auto mt-1" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {weekModal.type === "renewals" && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between px-1 mb-2">
                      <span className="text-xs font-medium text-gray-500">{wd.renewalsList.length} renewals</span>
                    </div>
                    {wd.renewalsList.map((r, i) => (
                      <div key={r.id || i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#f0813d] to-[#f0813d] flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                          {(r.member_name || "?").charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 text-sm truncate">{r.member_name}</p>
                          {r.phone && <span className="text-xs text-gray-500 flex items-center gap-1 mt-0.5"><Phone className="w-3 h-3" />{r.phone}</span>}
                          <p className="text-xs text-[#f0813d] mt-0.5 font-medium">
                            Renewed on {new Date(getRenewalEventDate(r)).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            Valid {new Date(r.start_date + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                            {" → "}
                            {new Date(r.end_date + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                          </p>
                        </div>
                        <span className="px-2 py-1 bg-orange-50 text-[#f0813d] text-xs font-medium rounded-lg border border-orange-100">{r.plan_name}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Day-wise Breakdown */}
                {!weekModal.type && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 px-1 flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5" />
                      Day-wise Breakdown
                    </h4>
                    <div className="space-y-2">
                      {days.map((day) => {
                        const dd = computeDayData(data, day);
                        const dayHasData = dd.revenue > 0 || dd.newJoinsList.length > 0 || dd.renewalsList.length > 0;
                        const dayLabel = day.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
                        return (
                          <div
                            key={day.toISOString()}
                            className={`rounded-xl border border-gray-100 p-3 ${dayHasData ? "bg-white cursor-pointer active:scale-[0.98] transition-transform" : "bg-gray-50"}`}
                            onClick={() => dayHasData && setDayModal({ day, type: null })}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-sm font-semibold text-gray-800">{dayLabel}</p>
                              {dayHasData && <ChevronRight className="w-4 h-4 text-gray-400" />}
                            </div>
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                              <div className="min-w-0 text-center">
                                <p className="text-[10px] text-[#f0813d] font-medium">Revenue</p>
                                <p className="truncate text-xs font-bold text-[#f0813d]">{dd.revenue > 0 ? formatCurrency(dd.revenue) : "₹0"}</p>
                              </div>
                              <div className="min-w-0 text-center">
                                <p className="text-[10px] text-[#f0813d] font-medium">New Joins</p>
                                <p className="text-xs font-bold text-[#f0813d]">{dd.newJoinsList.length}</p>
                              </div>
                              <div className="min-w-0 text-center">
                                <p className="text-[10px] text-[#f0813d] font-medium">Renewals</p>
                                <p className="text-xs font-bold text-[#f0813d]">{dd.renewalsList.length}</p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ─── Day Detail Modal ─── */}
      {dayModal && (() => {
        const dd = computeDayData(data, dayModal.day);
        const dayStr = dayModal.day.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short", year: "numeric" });
        return (
          <div className="fixed inset-0 bg-black/50 z-[60] flex items-end sm:items-center justify-center" onClick={() => setDayModal(null)}>
            <div
              className="bg-white w-full max-w-lg max-h-[85vh] rounded-t-2xl sm:rounded-2xl overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="p-4 flex items-center gap-3 border-b border-gray-100 bg-gradient-to-r from-orange-50 to-orange-50">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#f0813d] to-[#f0813d] flex items-center justify-center shadow-sm">
                  <Calendar className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-gray-900 text-base">Day Details</h3>
                  <p className="text-xs text-gray-500">{dayStr}</p>
                </div>
                <button
                  onClick={() => setDayModal(null)}
                  className=" icon-badge w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 active:scale-90 transition-all"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Day Summary */}
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <div
                    onClick={() => dd.revenueList.length > 0 && setDayModal({ day: dayModal.day, type: "revenue" })}
                    className={`min-w-0 bg-orange-50 rounded-xl p-3 border border-orange-100 text-center ${dd.revenueList.length > 0 ? "cursor-pointer active:scale-95 transition-transform" : ""}`}
                  >
                    <IndianRupee className="w-4 h-4 text-[#f0813d] mx-auto mb-1" />
                    <p className="text-[10px] font-medium text-[#f0813d] uppercase">Revenue</p>
                    <p className="truncate text-sm font-bold text-[#f0813d]">{formatCurrency(dd.revenue)}</p>
                  </div>
                  <div
                    onClick={() => dd.newJoinsList.length > 0 && setDayModal({ day: dayModal.day, type: "new_joins" })}
                    className={`min-w-0 bg-orange-50 rounded-xl p-3 border border-orange-100 text-center ${dd.newJoinsList.length > 0 ? "cursor-pointer active:scale-95 transition-transform" : ""}`}
                  >
                    <UserPlus className="w-4 h-4 text-[#f0813d] mx-auto mb-1" />
                    <p className="text-[10px] font-medium text-[#f0813d] uppercase">New Joins</p>
                    <p className="text-sm font-bold text-[#f0813d]">{dd.newJoinsList.length}</p>
                  </div>
                  <div
                    onClick={() => dd.renewalsList.length > 0 && setDayModal({ day: dayModal.day, type: "renewals" })}
                    className={`min-w-0 bg-orange-50 rounded-xl p-3 border border-orange-100 text-center ${dd.renewalsList.length > 0 ? "cursor-pointer active:scale-95 transition-transform" : ""}`}
                  >
                    <RefreshCw className="w-4 h-4 text-[#f0813d] mx-auto mb-1" />
                    <p className="text-[10px] font-medium text-[#f0813d] uppercase">Renewals</p>
                    <p className="text-sm font-bold text-[#f0813d]">{dd.renewalsList.length}</p>
                  </div>
                </div>

                {/* Day Detail Lists */}
                {dayModal.type === "revenue" && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between px-1 mb-2">
                      <span className="text-xs font-medium text-gray-500">{dd.revenueList.length} payments</span>
                      <span className="text-sm font-bold text-[#f0813d]">Total: {formatCurrency(dd.revenue)}</span>
                    </div>
                    {dd.revenueList.map((p, i) => (
                      <div key={p.id || i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#f0813d] to-[#f0813d] flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                          {(p.member_name || "?").charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 text-sm truncate">{p.member_name}</p>
                          {p.phone && <span className="text-xs text-gray-500 flex items-center gap-1"><Phone className="w-3 h-3" />{p.phone}</span>}
                          <p className="text-xs text-gray-400 mt-0.5 capitalize">{p.payment_mode}</p>
                        </div>
                        <p className="font-bold text-[#f0813d] text-sm whitespace-nowrap">₹{Number(p.amount).toLocaleString("en-IN")}</p>
                      </div>
                    ))}
                  </div>
                )}
                {dayModal.type === "new_joins" && (
                  <div className="space-y-2">
                    <div className="px-1 mb-2">
                      <span className="text-xs font-medium text-gray-500">{dd.newJoinsList.length} members</span>
                    </div>
                    {dd.newJoinsList.map((m, i) => (
                      <div key={m.id || i} onClick={() => router.push(`/members/${m.id}`)} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100 cursor-pointer active:scale-[0.98] transition-transform">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#f0813d] to-[#f0813d] flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                          {(m.full_name || "?").charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 text-sm truncate">{m.full_name}</p>
                          {m.phone && <span className="text-xs text-gray-500 flex items-center gap-1"><Phone className="w-3 h-3" />{m.phone}</span>}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-xs font-medium text-[#f0813d]">{m.plan_name}</p>
                          <ChevronRight className="w-4 h-4 text-gray-400 ml-auto mt-1" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {dayModal.type === "renewals" && (
                  <div className="space-y-2">
                    <div className="px-1 mb-2">
                      <span className="text-xs font-medium text-gray-500">{dd.renewalsList.length} renewals</span>
                    </div>
                    {dd.renewalsList.map((r, i) => (
                      <div key={r.id || i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#f0813d] to-[#f0813d] flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                          {(r.member_name || "?").charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 text-sm truncate">{r.member_name}</p>
                          {r.phone && <span className="text-xs text-gray-500 flex items-center gap-1 mt-0.5"><Phone className="w-3 h-3" />{r.phone}</span>}
                          <p className="text-xs text-[#f0813d] mt-0.5 font-medium">
                            Renewed on {new Date(getRenewalEventDate(r)).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            Valid {new Date(r.start_date + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                            {" → "}
                            {new Date(r.end_date + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                          </p>
                        </div>
                        <span className="px-2 py-1 bg-orange-50 text-[#f0813d] text-xs font-medium rounded-lg border border-orange-100">{r.plan_name}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Empty state for day with no details selected yet */}
                {!dayModal.type && (
                  <div className="text-center py-4">
                    <p className="text-gray-400 text-xs">Tap a stat above to see details</p>
                  </div>
                )}

                {/* Empty state for selected type with no data */}
                {dayModal.type && (
                  (dayModal.type === "revenue" && dd.revenueList.length === 0) ||
                  (dayModal.type === "new_joins" && dd.newJoinsList.length === 0) ||
                  (dayModal.type === "renewals" && dd.renewalsList.length === 0)
                ) && (
                  <div className="text-center py-8">
                    <p className="text-gray-500 text-sm">No data found</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
