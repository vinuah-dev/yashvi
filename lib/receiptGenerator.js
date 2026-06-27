"use client";

import jsPDF from "jspdf";
import { supabase } from "./supabaseClient";

/**
 * Receipt Generator Utility
 * Generates professional PDF receipts for membership payments
 */

// Generate a unique receipt number
export const generateReceiptNumber = async (gymId) => {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  
  // Get count of receipts created today for this gym
  const { count } = await supabase
    .from("payment_receipts")
    .select("*", { count: "exact", head: true })
    .eq("gym_id", gymId)
    .gte("created_at", today.toISOString().slice(0, 10));
  
  const dailyCount = (count || 0) + 1;
  return `RCP-${dateStr}-${String(dailyCount).padStart(4, '0')}`;
};

/**
 * Generate PDF Receipt - Professional Layout
 * @param {Object} receiptData - Receipt details
 * @returns {Promise<{pdf: jsPDF, blob: Blob, base64: string}>}
 */
export const generateReceiptPDF = async (receiptData) => {
  const {
    gymName = "FITNESS CENTER",
    gymAddress = "",
    gymPhone = "",
    memberName,
    memberPhone,
    memberEmail,
    memberAddress,
    planName,
    planDuration,
    validityStart,
    validityEnd,
    amount,
    balanceAmount = 0,
    paymentMode,
    receiptNumber,
    paymentDate = new Date(),
  } = receiptData;

    // Landscape A4
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = 297;
  const pageHeight = 210;
  const margin = 12;
  const contentWidth = pageWidth - margin * 2;

  // Colors
  const navy = [20, 40, 80];
  const darkText = [30, 30, 30];
  const grayText = [100, 100, 100];
  const lightGray = [240, 240, 240];
  const white = [255, 255, 255];
  const green = [0, 130, 60];
  const red = [200, 30, 30];
  const tableBorder = [180, 180, 180];

  const formatAmt = (v) => {
    const n = Number(v) || 0;
    return String(n.toLocaleString("en-IN"));
  };
  const fmtDate = (d) => {
    if (!d) return "N/A";
    return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  };

  // ───────── OUTER BORDER ─────────
  doc.setDrawColor(...navy);
  doc.setLineWidth(0.8);
  doc.rect(6, 6, pageWidth - 12, pageHeight - 12);
  doc.setLineWidth(0.3);
  doc.rect(8, 8, pageWidth - 16, pageHeight - 16);

  // ───────── HEADER BAR ─────────
  let y = margin + 2;
  doc.setFillColor(...navy);
  doc.rect(margin, y, contentWidth, 18, "F");

  doc.setTextColor(...white);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(String(gymName).toUpperCase(), margin + 6, y + 12);

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text("PAYMENT RECEIPT", pageWidth - margin - 6, y + 12, { align: "right" });

  y += 22;

  // ───────── RECEIPT INFO ROW ─────────
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...grayText);
  doc.text(`Receipt No: ${receiptNumber}`, margin + 2, y);
  doc.text(`Date: ${fmtDate(paymentDate)}`, pageWidth - margin - 2, y, { align: "right" });

  if (gymAddress || gymPhone) {
    y += 5;
    const info = [];
    if (gymAddress) info.push(String(gymAddress));
    if (gymPhone) info.push(String(gymPhone));
    doc.text(info.join("  |  "), margin + 2, y);
  }

  y += 8;
  doc.setDrawColor(...tableBorder);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  // ───────── TWO-COLUMN LAYOUT ─────────
  const leftColX = margin + 2;
  const rightColX = margin + contentWidth / 2 + 5;
  const colWidth = contentWidth / 2 - 7;

  // ===== LEFT COLUMN: Member + Plan Details =====
  const leftStartY = y;

  // Member section label
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...navy);
  doc.text("MEMBER DETAILS", leftColX, y);
  y += 6;

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...darkText);
  doc.text(String(memberName || "N/A"), leftColX, y);
  y += 5;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...grayText);
  if (memberPhone) { doc.text(`Phone: ${memberPhone}`, leftColX, y); y += 4.5; }
  if (memberEmail) { doc.text(`Email: ${memberEmail}`, leftColX, y); y += 4.5; }
  if (memberAddress) { doc.text(`Address: ${memberAddress}`, leftColX, y); y += 4.5; }

  y += 4;

  // Plan details section
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...navy);
  doc.text("PLAN DETAILS", leftColX, y);
  y += 6;

  // Plan details as a mini table
  const planRows = [
    ["Plan", String(planName || "N/A")],
    ["Duration", planDuration ? `${planDuration} days` : "N/A"],
    ["Validity", `${fmtDate(validityStart)}  to  ${fmtDate(validityEnd)}`],
    ["Payment Mode", String(paymentMode || "CASH").toUpperCase()],
  ];

  const labelX = leftColX;
  const valueX = leftColX + 35;
  doc.setFontSize(9);

  planRows.forEach(([label, value]) => {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...grayText);
    doc.text(`${label}:`, labelX, y);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...darkText);
    doc.text(value, valueX, y);
    y += 6;
  });

  // Trainer (if present)
  if (receiptData.traineeName) {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...grayText);
    doc.text("Trainer:", labelX, y);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...darkText);
    doc.text(String(receiptData.traineeName), valueX, y);
    y += 6;
  }

  // ===== RIGHT COLUMN: Payment Summary =====
  let ry = leftStartY;

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...navy);
  doc.text("PAYMENT SUMMARY", rightColX, ry);
  ry += 8;

  // Payment summary box
  const boxX = rightColX;
  const boxW = colWidth;
  const rowH = 14;
  const totalAmount = Number(amount) + Number(balanceAmount);

  // Row backgrounds alternate
  const paymentRows = [
    { label: "Total Amount", value: formatAmt(totalAmount), color: darkText },
    { label: "Paid Amount", value: formatAmt(amount), color: green },
    { label: "Balance Due", value: formatAmt(balanceAmount), color: Number(balanceAmount) > 0 ? red : green },
  ];

  paymentRows.forEach((row, i) => {
    const rowY = ry + i * rowH;

    // Alternate row background
    doc.setFillColor(i % 2 === 0 ? 245 : 255, i % 2 === 0 ? 245 : 255, i % 2 === 0 ? 245 : 255);
    doc.setDrawColor(...tableBorder);
    doc.setLineWidth(0.2);
    doc.rect(boxX, rowY, boxW, rowH, "FD");

    // Label
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...grayText);
    doc.text(row.label, boxX + 5, rowY + 9);

    // Rupee symbol + value
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...row.color);
    doc.text(`Rs. ${row.value}/-`, boxX + boxW - 5, rowY + 10, { align: "right" });
  });

  ry += paymentRows.length * rowH + 8;

  // Payment mode badge
  doc.setFillColor(...navy);
  doc.rect(boxX, ry, boxW, 10, "F");
  doc.setTextColor(...white);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(`Payment Mode: ${String(paymentMode || "CASH").toUpperCase()}`, boxX + boxW / 2, ry + 7, { align: "center" });

  // ───────── TERMS & CONDITIONS ─────────
  const termsY = Math.max(y, ry + 14) + 4;
  doc.setDrawColor(...tableBorder);
  doc.setLineWidth(0.3);
  doc.line(margin, termsY, pageWidth - margin, termsY);

  let ty = termsY + 5;
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...navy);
  doc.text("Terms & Conditions", margin + 2, ty);
  ty += 5;

  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...grayText);
  const terms = [
    "Fees are non-refundable and must be paid in advance.",
    "Membership is non-transferable and cannot be extended.",
    "Members must use equipment carefully and exercise at their own risk.",
    "Members with health issues should consult a doctor before exercising.",
    `${gymName} is not responsible for injuries or lost belongings.`,
    "Management decision will be final.",
  ];
  terms.forEach((t, i) => {
    doc.text(`•  ${t}`, margin + 2, ty + i * 4);
  });

  // ───────── FOOTER ─────────
  const footerY = pageHeight - 14;
  doc.setDrawColor(...navy);
  doc.setLineWidth(0.3);
  doc.line(margin, footerY, pageWidth - margin, footerY);

  doc.setFontSize(7);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(...grayText);
  doc.text("This is a computer-generated receipt. No signature required.", pageWidth / 2, footerY + 5, { align: "center" });

  // Generate outputs
  const blob = doc.output("blob");
  const base64 = doc.output("datauristring");

  return { pdf: doc, blob, base64 };
};

// ========== ALL REMAINING FUNCTIONS EXACTLY AS ORIGINAL ==========

/**
 * Upload receipt PDF to Supabase storage
 * @param {Blob} pdfBlob - PDF blob
 * @param {string} gymId - Gym ID
 * @param {string} receiptNumber - Receipt number
 * @returns {Promise<{url: string, path: string}>}
 */
export const uploadReceiptToStorage = async (pdfBlob, gymId, receiptNumber) => {
  const fileName = `${gymId}/${receiptNumber}.pdf`;
  
  const { data, error } = await supabase.storage
    .from("payment-receipts")
    .upload(fileName, pdfBlob, {
      contentType: "application/pdf",
      upsert: true
    });

  if (error) {
    console.error("Error uploading receipt:", error);
    throw error;
  }

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from("payment-receipts")
    .getPublicUrl(fileName);

  return { url: publicUrl, path: fileName };
};

/**
 * Save receipt record to database
 * @param {Object} receiptData - Receipt details for database
 * @returns {Promise<Object>} - Created receipt record
 */
export const saveReceiptRecord = async (receiptData) => {
  const { data, error } = await supabase
    .from("payment_receipts")
    .insert({
      payment_id: receiptData.paymentId,
      member_id: receiptData.memberId,
      gym_id: receiptData.gymId,
      receipt_number: receiptData.receiptNumber,
      receipt_url: receiptData.receiptUrl,
      file_path: receiptData.filePath,
      amount: receiptData.amount,
      payment_mode: receiptData.paymentMode,
      plan_name: receiptData.planName,
      plan_duration: receiptData.planDuration,
      validity_start: receiptData.validityStart,
      validity_end: receiptData.validityEnd,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days from now
    })
    .select()
    .single();

  if (error) {
    console.error("Error saving receipt record:", error);
    throw error;
  }

  return data;
};

/**
 * Generate, upload and save a complete receipt
 * @param {Object} paymentData - Complete payment details
 * @returns {Promise<Object>} - Complete receipt with URL
 */
export const createPaymentReceipt = async (paymentData) => {
  const {
    gymId,
    gymName,
    gymAddress,
    gymPhone,
    memberId,
    memberName,
    memberPhone,
    memberEmail,
    memberAddress = "",
    planName,
    planDuration,
    validityStart,
    validityEnd,
    amount,
    paymentMode,
    paymentId,
    paymentDate = new Date(),
    traineeName = "",
    balanceAmount = 0,
  } = paymentData;

  try {
    // 1. Generate receipt number
    const receiptNumber = await generateReceiptNumber(gymId);

    // 2. Generate PDF
    const { pdf, blob } = await generateReceiptPDF({
      gymName,
      gymAddress,
      gymPhone,
      memberName,
      memberPhone,
      memberEmail,
      memberAddress,
      planName,
      planDuration,
      validityStart,
      validityEnd,
      amount,
      balanceAmount,
      paymentMode,
      receiptNumber,
      paymentDate,
      traineeName
    });

    // 3. Upload to storage
    const { url, path } = await uploadReceiptToStorage(blob, gymId, receiptNumber);

    // 4. Save record to database
    const receiptRecord = await saveReceiptRecord({
      paymentId,
      memberId,
      gymId,
      receiptNumber,
      receiptUrl: url,
      filePath: path,
      amount,
      paymentMode,
      planName,
      planDuration,
      validityStart,
      validityEnd
    });

    return {
      success: true,
      receipt: receiptRecord,
      url,
      receiptNumber
    };
  } catch (error) {
    console.error("Error creating payment receipt:", error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Get latest receipt for a member
 * @param {string} memberId - Member ID
 * @returns {Promise<Object|null>} - Latest receipt or null
 */
export const getLatestMemberReceipt = async (memberId) => {
  const { data, error } = await supabase
    .from("payment_receipts")
    .select("*")
    .eq("member_id", memberId)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== "PGRST116") { // PGRST116 = no rows found
    console.error("Error fetching receipt:", error);
    return null;
  }

  return data;
};

/**
 * Generate WhatsApp share message with receipt
 * @param {Object} receiptData - Receipt details
 * @returns {string} - WhatsApp share URL
 */
export const generateWhatsAppShareLink = (receiptData) => {
  const {
    memberName,
    memberPhone,
    gymName,
    planName,
    amount,
    balanceAmount = 0,
    validityEnd,
    receiptUrl
  } = receiptData;

  // Clean phone number (remove +91 or any prefix for display)
  const cleanPhone = memberPhone?.replace(/^\+?91/, '').replace(/\D/g, '') || '';
  
  // Format validity date
  const validTill = validityEnd 
    ? new Date(validityEnd).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    : "N/A";

  const totalAmount = Number(amount) + Number(balanceAmount);
  const formattedTotalAmount = Number(totalAmount).toLocaleString("en-IN");
  const formattedAmountPaid = Number(amount).toLocaleString("en-IN");
  const formattedBalanceAmount = Number(balanceAmount).toLocaleString("en-IN");

  // Create message - Plain text without emojis for better compatibility
  const message = `*${gymName}*

Hello ${memberName}!

Thank you for your membership payment.

*Membership Details*
- Plan: ${planName}
- Plan Amount: Rs. ${formattedTotalAmount}/-
- Amount Paid: Rs. ${formattedAmountPaid}/-
- Balance Amount: Rs. ${formattedBalanceAmount}/-
- Valid Till: ${validTill}

*Download Receipt*
${receiptUrl}

Stay fit, stay healthy!

_This receipt is valid for 7 days._`;

  // Create WhatsApp link
  const encodedMessage = encodeURIComponent(message);
  const whatsappNumber = cleanPhone ? `91${cleanPhone}` : '';
  
  // If we have a phone number, open chat with that number; otherwise open WhatsApp to choose contact
  if (whatsappNumber) {
    return `https://wa.me/${whatsappNumber}?text=${encodedMessage}`;
  }
  return `https://wa.me/?text=${encodedMessage}`;
};

/**
 * Share receipt via WhatsApp
 * @param {Object} receiptData - Receipt details
 */
export const shareReceiptOnWhatsApp = (receiptData) => {
  const shareUrl = generateWhatsAppShareLink(receiptData);
  window.open(shareUrl, '_blank');
};

/**
 * Download receipt PDF
 * @param {string} receiptUrl - URL of the receipt
 * @param {string} receiptNumber - Receipt number for filename
 */
export const downloadReceipt = async (receiptUrl, receiptNumber) => {
  try {
    const response = await fetch(receiptUrl);
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${receiptNumber}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Error downloading receipt:", error);
    // Fallback: open in new tab
    window.open(receiptUrl, '_blank');
  }
};

export default {
  generateReceiptPDF,
  createPaymentReceipt,
  getLatestMemberReceipt,
  shareReceiptOnWhatsApp,
  downloadReceipt,
  generateWhatsAppShareLink
};