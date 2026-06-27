"use client";

import { useState, useCallback } from "react";

function formatExportDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-GB").replace(/\//g, "-");
}

function formatExportMonth(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date
    .toLocaleDateString("en-IN", { month: "short" })
    .toUpperCase();
}

export function useExcelExport(selectedGym) {
  const [exporting, setExporting] = useState(false);

  const exportExcel = useCallback(async () => {
    if (!selectedGym?.id || !selectedGym?.name) {
      alert("Please select a gym first");
      return;
    }

    setExporting(true);
    try {
      const XLSX = await import("xlsx");

      const res = await fetch("/api/dashboard/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ p_gym_id: selectedGym.id }),
      });

      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error || "Failed to fetch export data");
      }

      const payload = json.data || {};
      const dashboard = payload.dashboard || {};
      const members = dashboard.members || [];
      const payments = payload.payments_export || dashboard.payments || [];
      const attendance = dashboard.attendance || [];
      const expenses = payload.expenses || [];
      const trainerAssignments = payload.trainer_assignments || [];
      const trainerEarnings = payload.trainer_earnings || [];
      const exportMembers = payload.members || [];
      const exportTrainers = payload.trainers || [];

      const memberNameById = Object.fromEntries(
        exportMembers.map((m) => [m.id, m.full_name || "Member"])
      );
      const trainerNameById = Object.fromEntries(
        exportTrainers.map((t) => [
          t.id,
          `${t.first_name || ""} ${t.last_name || ""}`.trim() || "Trainer",
        ])
      );
      const earningsByAssignment = trainerEarnings.reduce((acc, item) => {
        (acc[item.assignment_id] ||= []).push(item);
        return acc;
      }, {});

      const buildSheet = (title, headers, dataRows, colWidths, numericCols = []) => {
        const rows = [
          [title],
          ["Gym", selectedGym.name],
          ["Generated On", new Date().toLocaleString("en-IN")],
          [],
          headers,
          ...(dataRows.length
            ? dataRows
            : [headers.map((_, i) => (i === 0 ? "No records found" : ""))]),
        ];

        const sheet = XLSX.utils.aoa_to_sheet(rows);
        sheet["!cols"] = colWidths;

        const titleCell = sheet.A1;
        if (titleCell) {
          titleCell.s = {
            font: { bold: true, color: { rgb: "111827" }, sz: 13 },
            fill: { fgColor: { rgb: "FFF200" } },
            alignment: { horizontal: "left", vertical: "center" },
          };
        }

        const headerRow = 5;
        for (let c = 0; c < headers.length; c += 1) {
          const ref = XLSX.utils.encode_cell({ r: headerRow - 1, c });
          if (!sheet[ref]) continue;
          sheet[ref].s = {
            font: { bold: true, color: { rgb: "1F2937" }, sz: 11 },
            fill: { fgColor: { rgb: "DCEEFF" } },
            alignment: { horizontal: "center", vertical: "center" },
          };
        }

        for (let rowNum = 6; rowNum <= rows.length; rowNum += 1) {
          numericCols.forEach((colIndex) => {
            const ref = XLSX.utils.encode_cell({ r: rowNum - 1, c: colIndex });
            if (sheet[ref] && typeof sheet[ref].v === "number") {
              sheet[ref].z = "#,##0";
            }
          });
        }

        sheet["!autofilter"] = {
          ref: XLSX.utils.encode_range({
            s: { r: headerRow - 1, c: 0 },
            e: { r: Math.max(headerRow, rows.length) - 1, c: headers.length - 1 },
          }),
        };

        return sheet;
      };

      // Summary
      const totalMembers = members.length;
      const activeMembers = members.filter((m) =>
        m.memberships?.some((ms) => ms.status === "active")
      ).length;
      const totalRevenue = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
      const totalPending = members.reduce((s, m) => s + Number(m.balance || 0), 0);

      const summaryRows = [
        ["Total Members", totalMembers],
        ["Active Members", activeMembers],
        ["Today Attendance", attendance.length],
        ["Overall Revenue", totalRevenue],
        ["Pending Dues", totalPending],
      ];

      // Admissions
      const admissionsRows = [...members]
        .sort((a, b) => new Date(a.join_date || a.created_at || 0) - new Date(b.join_date || b.created_at || 0))
        .map((member) => {
          const activeMembership = member.memberships?.[0] || null;
          const joinDate = member.join_date || member.created_at;
          const admissionType = (member.memberships?.length || 0) > 1 ? "Renewal" : "New Admission";
          const status = activeMembership?.status || "inactive";
          return [
            formatExportDate(joinDate),
            formatExportMonth(joinDate),
            member.full_name || "Member",
            member.phone ?? "",
            admissionType,
            String(status).toUpperCase(),
            Number(member.balance || 0),
          ];
        });

      // Fees
      const feeRows = [...payments]
        .sort((a, b) => new Date(a.paid_at || a.created_at) - new Date(b.paid_at || b.created_at))
        .map((payment) => {
          const date = payment.paid_at || payment.created_at;
          const paymentMode = String(payment.payment_mode || payment.mode || "cash").toUpperCase();
          const balance = Number(payment.remaining_amount ?? payment.member_balance ?? payment.balance ?? 0);
          return [
            formatExportDate(date),
            formatExportMonth(date),
            payment.member_name || "Member",
            Number(payment.amount || 0),
            paymentMode,
            balance,
          ];
        });

      // Trainer
      const trainerRows = [];
      trainerAssignments.forEach((assignment) => {
        const trainerName = trainerNameById[assignment.trainer_id] || "Trainer";
        const clientName = memberNameById[assignment.member_id] || "Member";
        const earnings = earningsByAssignment[assignment.id] || [];
        const startDate = assignment.plan_start_date || assignment.assigned_at;
        const dueDate = assignment.next_payment_date || assignment.plan_end_date;

        if (earnings.length === 0) {
          trainerRows.push([
            trainerName, clientName, Number(assignment.plan_total_amount || 0),
            formatExportDate(startDate), formatExportDate(dueDate),
            Number(assignment.pending_amount || 0), "", "",
          ]);
          return;
        }

        earnings.forEach((earning) => {
          trainerRows.push([
            trainerName, clientName, Number(assignment.plan_total_amount || 0),
            formatExportDate(startDate), formatExportDate(dueDate),
            Number(assignment.pending_amount || 0),
            Number(earning.total_amount || 0), formatExportDate(earning.created_at),
          ]);
        });
      });

      // Expenses
      const expenseRows = [...expenses]
        .sort((a, b) => new Date(a.expense_date || a.created_at) - new Date(b.expense_date || b.created_at))
        .map((expense) => {
          const date = expense.expense_date || expense.created_at;
          return [
            formatExportDate(date),
            formatExportMonth(date),
            expense.notes || String(expense.category || "").toUpperCase(),
            Number(expense.amount || 0),
            "",
          ];
        });

      // Attendance
      const attendanceRows = attendance.map((item) => [
        item.member_name || "Member",
        item.check_in_time || "",
        item.check_out_time || "",
        item.check_out_time ? "LEFT" : "ACTIVE",
      ]);

      // Build workbook
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, buildSheet("DASHBOARD SUMMARY", ["Metric", "Value"], summaryRows, [{ wch: 26 }, { wch: 16 }], [1]), "Summary");
      XLSX.utils.book_append_sheet(workbook, buildSheet("ADMISSIONS", ["DATE", "MONTH", "NAME", "MOBILE", "ADMISSION TYPE", "STATUS", "BALANCE"], admissionsRows, [{ wch: 14 }, { wch: 10 }, { wch: 30 }, { wch: 16 }, { wch: 16 }, { wch: 12 }, { wch: 12 }], [6]), "Admissions");
      XLSX.utils.book_append_sheet(workbook, buildSheet("FEES", ["DATE", "MONTH", "NAME OF CLIENT", "AMOUNT", "PAYMENT MODE", "BALANCE"], feeRows, [{ wch: 14 }, { wch: 10 }, { wch: 34 }, { wch: 12 }, { wch: 16 }, { wch: 12 }], [3, 5]), "Fees");
      XLSX.utils.book_append_sheet(workbook, buildSheet("TRAINER+PT", ["TRAINER NAME", "CLIENT NAME", "AMOUNT", "START DATE", "DUE DATE", "BALANCE", "PAYMENT", "TIME"], trainerRows, [{ wch: 20 }, { wch: 28 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 14 }], [2, 5, 6]), "Trainer+PT");
      XLSX.utils.book_append_sheet(workbook, buildSheet("EXPENSES", ["DATE", "MONTH", "PARTICULAR", "AMOUNT", "CASH/ONLINE"], expenseRows, [{ wch: 14 }, { wch: 10 }, { wch: 42 }, { wch: 12 }, { wch: 16 }], [3]), "Expenses");
      XLSX.utils.book_append_sheet(workbook, buildSheet("ATTENDANCE (TODAY)", ["MEMBER NAME", "CHECK-IN", "CHECK-OUT", "STATUS"], attendanceRows, [{ wch: 30 }, { wch: 14 }, { wch: 14 }, { wch: 12 }]), "Attendance");

      const safeGymName = (selectedGym.name || "Gym").replace(/\s+/g, "_");
      XLSX.writeFile(workbook, `${safeGymName}_Business_Export_${new Date().toISOString().split("T")[0]}.xlsx`);
    } catch (error) {
      console.error("Error exporting dashboard excel:", error);
      alert("Failed to export dashboard Excel. Please try again.");
    } finally {
      setExporting(false);
    }
  }, [selectedGym]);

  return { exporting, exportExcel };
}
