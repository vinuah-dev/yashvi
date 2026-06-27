"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Header from "@/components/layout/Header";
import { useToast } from "@/contexts/ToastContext";
import {
  MessageCircle,
  Users,
  UserCheck,
  UserX,
  Filter,
  Search,
  Send,
  ChevronRight,
  ChevronLeft,
  Phone,
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle,
  FileText,
  Plus,
  Settings,
  Sparkles,
  X,
  ExternalLink,
  RefreshCw,
  Loader2,
  Copy,
  Edit,
  Trash2,
  Save,
  Eye,
  Play,
  Pause,
  SkipForward,
} from "lucide-react";

// ══════════════════════════════════════════════════════════════
// Member Categories
// ══════════════════════════════════════════════════════════════
const MEMBER_CATEGORIES = [
  { id: "all", label: "All Members", icon: Users, color: "blue" },
  { id: "active", label: "Active Members", icon: UserCheck, color: "green" },
  { id: "inactive", label: "Inactive Members", icon: UserX, color: "orange" },
  { id: "pending", label: "Pending Payments", icon: AlertTriangle, color: "orange" },
];

// ══════════════════════════════════════════════════════════════
// Filters Configuration
// ══════════════════════════════════════════════════════════════
const FILTERS = {
  all: [
    { id: "none", label: "No Filter", description: "Show all members" },
    { id: "joined_7_days", label: "Joined Last 7 Days", description: "Recently joined members" },
    { id: "joined_30_days", label: "Joined Last 30 Days", description: "Members who joined this month" },
  ],
  active: [
    { id: "none", label: "No Filter", description: "Show all active members" },
    { id: "expiry_3_days", label: "Expiring in 3 Days", description: "Memberships expiring soon" },
    { id: "expiry_7_days", label: "Expiring in 7 Days", description: "Memberships expiring this week" },
    { id: "expiry_15_days", label: "Expiring in 15 Days", description: "Memberships expiring in 2 weeks" },
    { id: "joined_7_days", label: "Recently Joined", description: "New members this week" },
    { id: "low_attendance", label: "Low Attendance", description: "Less than 8 visits this month" },
    { id: "high_attendance", label: "High Attendance", description: "15+ visits this month" },
  ],
  inactive: [
    { id: "none", label: "No Filter", description: "Show all inactive members" },
    { id: "no_visit_7_days", label: "No Visit in 7 Days", description: "Haven't visited in a week" },
    { id: "no_visit_15_days", label: "No Visit in 15 Days", description: "Haven't visited in 2 weeks" },
    { id: "no_visit_30_days", label: "No Visit in 30 Days", description: "Haven't visited in a month" },
    { id: "expired", label: "Membership Expired", description: "Expired memberships" },
    { id: "never_visited", label: "Never Visited", description: "Joined but never came" },
  ],
  pending: [
    { id: "none", label: "No Filter", description: "Show all pending payments" },
    { id: "overdue_only", label: "Overdue Only", description: "Members with overdue dues" },
  ],
};

// ══════════════════════════════════════════════════════════════
// Default Templates
// ══════════════════════════════════════════════════════════════
const DEFAULT_TEMPLATES = [
  {
    name: "Membership Expiry Reminder",
    category: "expiry",
    content: "Hi {Name}, your membership at {GymName} expires on {ExpiryDate}. Please renew to continue your fitness journey! 💪",
  },
  {
    name: "Welcome New Member",
    category: "general",
    content: "Welcome to {GymName}, {Name}! 🎉 We're excited to have you on board. Your fitness journey starts now!",
  },
  {
    name: "Birthday Wish",
    category: "birthday",
    content: "Happy Birthday {Name}! 🎂🎉 Celebrate with a free workout session today at {GymName}!",
  },
  {
    name: "Reactivation Message",
    category: "reactivation",
    content: "Hi {Name}, we miss you at {GymName}! 🏋️ Come back and restart your fitness journey. Special offer waiting for you!",
  },
  {
    name: "Festival Greetings",
    category: "campaign",
    content: "Happy Holidays from {GymName}! 🎊 Wishing you health, happiness, and fitness in the new year!",
  },
  {
    name: "Attendance Reminder",
    category: "general",
    content: "Hi {Name}, we noticed you haven't visited {GymName} recently. Your health is important - see you soon! 💪",
  },
];

// ══════════════════════════════════════════════════════════════
// Helper Functions
// ══════════════════════════════════════════════════════════════

// Format phone number for WhatsApp (remove spaces, add country code)
function formatPhoneForWhatsApp(phone) {
  if (!phone) return null;
  // Remove all non-digit characters
  let cleaned = phone.replace(/\D/g, "");
  // Remove leading 0 if present
  if (cleaned.startsWith("0")) cleaned = cleaned.slice(1);
  // Add India country code if not present
  if (!cleaned.startsWith("91") && cleaned.length === 10) {
    cleaned = "91" + cleaned;
  }
  return cleaned;
}

// Generate WhatsApp click-to-chat URL
function generateWhatsAppURL(phone, message) {
  const formattedPhone = formatPhoneForWhatsApp(phone);
  if (!formattedPhone) return null;
  const encodedMessage = encodeURIComponent(message);
  return `https://wa.me/${formattedPhone}?text=${encodedMessage}`;
}

// Replace template variables with actual data
function personalizeMessage(template, member, gymName) {
  if (!template) return "";
  let message = template;
  
  // Format date nicely
  const formatDate = (dateStr) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  message = message.replace(/{Name}/gi, member.full_name || "Member");
  message = message.replace(/{ExpiryDate}/gi, formatDate(member.expiry_date));
  message = message.replace(/{MembershipType}/gi, member.plan_name || "Membership");
  message = message.replace(/{GymName}/gi, gymName || "Our Gym");
  message = message.replace(/{Phone}/gi, member.phone || "");
  message = message.replace(/{JoinDate}/gi, formatDate(member.join_date));
  message = message.replace(/{PendingAmount}/gi, formatCurrency(member.pending_amount || 0));
  message = message.replace(/{DueDate}/gi, formatDate(member.due_date || member.expiry_date));
  message = message.replace(/{DaysOverdue}/gi, String(member.days_overdue || 0));
  
  return message;
}

function formatCurrency(amount) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(amount || 0));
}

// ══════════════════════════════════════════════════════════════
// Main Component
// ══════════════════════════════════════════════════════════════
export default function WhatsAppMessagingPage() {
  const router = useRouter();
  const { showSuccess, showError } = useToast();

  // ─── State ───────────────────────────────────────────────────
  const [selectedGym, setSelectedGym] = useState(null);
  const [loading, setLoading] = useState(true);
  const [membersLoading, setMembersLoading] = useState(false);

  // Category & Filter
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedFilter, setSelectedFilter] = useState("none");
  const [searchQuery, setSearchQuery] = useState("");

  // Members
  const [members, setMembers] = useState([]);
  const [selectedMembers, setSelectedMembers] = useState(new Set());
  
  // Templates
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [customMessage, setCustomMessage] = useState("");
  const [showTemplates, setShowTemplates] = useState(false);
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);

  // Bulk Send Mode
  const [bulkSendMode, setBulkSendMode] = useState(false);
  const [currentSendIndex, setCurrentSendIndex] = useState(0);
  const [sendProgress, setSendProgress] = useState({ sent: 0, pending: 0, skipped: 0 });
  
  // Preview
  const [showPreview, setShowPreview] = useState(false);
  const [previewMember, setPreviewMember] = useState(null);

  // ─── Load Gym ────────────────────────────────────────────────
  useEffect(() => {
    const storedGym = localStorage.getItem("selectedGym");
    if (storedGym) {
      setSelectedGym(JSON.parse(storedGym));
    }
    setLoading(false);
  }, []);

  // ─── Create Default Templates ─────────────────────────────────
  const createDefaultTemplates = useCallback(async (gymId) => {
    try {
      const storedUser = localStorage.getItem("gymUser");
      const user = storedUser ? JSON.parse(storedUser) : null;
      
      const templatesToInsert = DEFAULT_TEMPLATES.map((t) => ({
        gym_id: gymId,
        name: t.name,
        content: t.content,
        category: t.category,
        created_by: user?.id || null,
      }));

      const { data, error } = await supabase
        .from("message_templates")
        .insert(templatesToInsert)
        .select();

      if (error) throw error;
      setTemplates(data || []);
    } catch (err) {
      console.error("Error creating default templates:", err);
      // Use defaults in memory
      setTemplates(DEFAULT_TEMPLATES.map((t, i) => ({ id: `default-${i}`, ...t })));
    }
  }, []);

  // ─── Load Templates ──────────────────────────────────────────
  const loadTemplates = useCallback(async (gymId) => {
    try {
      const { data, error } = await supabase
        .from("message_templates")
        .select("*")
        .eq("gym_id", gymId)
        .eq("is_active", true)
        .order("name");

      if (error) throw error;

      // If no templates exist, create defaults
      if (!data || data.length === 0) {
        await createDefaultTemplates(gymId);
      } else {
        setTemplates(data);
      }
    } catch (err) {
      console.error("Error loading templates:", err);
      // Use default templates in memory if DB fails
      setTemplates(DEFAULT_TEMPLATES.map((t, i) => ({ id: `default-${i}`, ...t })));
    }
  }, [createDefaultTemplates]);

  useEffect(() => {
    if (!selectedGym?.id) return;
    loadTemplates(selectedGym.id);
  }, [selectedGym?.id, loadTemplates]);

  // ─── Fetch Members ───────────────────────────────────────────
  const fetchMembers = useCallback(async () => {
    if (!selectedGym?.id) return;
    setMembersLoading(true);
    try {
      if (selectedCategory === "pending") {
        const { data: authData } = await supabase.auth.getUser();
        const currentUserId = authData?.user?.id || null;
        if (!currentUserId) {
          throw new Error("Session expired");
        }

        const now = new Date();
        const periodStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0).toISOString();
        const periodEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString();

        const res = await fetch("/api/finance/data", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-user-id": String(currentUserId),
          },
          body: JSON.stringify({
            p_gym_id: selectedGym.id,
            p_period_start: periodStart,
            p_period_end: periodEnd,
          }),
        });

        const json = await res.json();
        if (!res.ok) {
          throw new Error(json?.error || "Failed to fetch pending payments");
        }

        const result = json?.data || {};
        const membersWithDues = result.members_with_dues || [];
        const paymentsWithNextDate = result.payments_with_next_date || [];

        let pendingMembers = membersWithDues
          .map((member) => {
            const activeMembership = member.memberships?.find((m) => m.status === "active");
            const memberPaymentWithDate = paymentsWithNextDate.find((p) => p.member_id === member.id);
            const nextPaymentDate = memberPaymentWithDate?.next_payment_date;
            const dueDateRaw = nextPaymentDate || activeMembership?.end_date || null;
            const daysOverdue = dueDateRaw
              ? Math.ceil((new Date() - new Date(dueDateRaw)) / (1000 * 60 * 60 * 24))
              : 0;

            return {
              member_id: member.id,
              full_name: member.full_name,
              phone: member.phone,
              email: member.email || null,
              membership_status: "pending",
              plan_name: activeMembership?.membership_plans?.name || null,
              expiry_date: dueDateRaw,
              join_date: member.join_date || null,
              pending_amount: Number(member.balance || 0),
              due_date: dueDateRaw,
              days_overdue: Math.max(0, daysOverdue),
              is_overdue: daysOverdue > 0,
            };
          })
          .sort((a, b) => {
            if (a.is_overdue !== b.is_overdue) return a.is_overdue ? -1 : 1;
            if (b.days_overdue !== a.days_overdue) return b.days_overdue - a.days_overdue;
            return b.pending_amount - a.pending_amount;
          });

        if (selectedFilter === "overdue_only") {
          pendingMembers = pendingMembers.filter((m) => m.is_overdue);
        }

        setMembers(pendingMembers);
        return;
      }

      // Try RPC first
      const { data, error } = await supabase.rpc("get_members_for_messaging", {
        p_gym_id: selectedGym.id,
        p_category: selectedCategory,
        p_filter_type: selectedFilter === "none" ? null : selectedFilter,
        p_filter_value: null,
      });

      if (error) throw error;
      setMembers(data || []);
    } catch (err) {
      console.error("Error fetching members:", err);
      // Fallback: direct query
      try {
        const { data: fallbackData, error: fallbackError } = await supabase
          .from("members")
          .select(`
            id,
            full_name,
            phone,
            email,
            join_date,
            memberships (
              status,
              end_date,
              membership_plans (name)
            )
          `)
          .eq("gym_id", selectedGym.id)
          .order("full_name");

        if (fallbackError) throw fallbackError;

        const transformedMembers = (fallbackData || []).map((m) => {
          const latestMembership = m.memberships?.[0];
          return {
            member_id: m.id,
            full_name: m.full_name,
            phone: m.phone,
            email: m.email,
            membership_status: latestMembership?.status || "inactive",
            plan_name: latestMembership?.membership_plans?.name || null,
            expiry_date: latestMembership?.end_date || null,
            join_date: m.join_date,
          };
        });

        // Filter by category
        let filtered = transformedMembers;
        if (selectedCategory === "active") {
          filtered = transformedMembers.filter((m) => m.membership_status === "active");
        } else if (selectedCategory === "inactive") {
          filtered = transformedMembers.filter((m) => m.membership_status !== "active");
        }

        setMembers(filtered);
      } catch (fallbackErr) {
        console.error("Fallback query failed:", fallbackErr);
        setMembers([]);
      }
    } finally {
      setMembersLoading(false);
    }
  }, [selectedGym?.id, selectedCategory, selectedFilter]);

  // ─── Load Members ────────────────────────────────────────────
  useEffect(() => {
    if (!selectedGym?.id) return;
    fetchMembers();
  }, [selectedGym?.id, selectedCategory, selectedFilter, fetchMembers]);

  // ─── Filtered Members (search) ───────────────────────────────
  const filteredMembers = useMemo(() => {
    if (!searchQuery.trim()) return members;
    const query = searchQuery.toLowerCase();
    return members.filter(
      (m) =>
        m.full_name?.toLowerCase().includes(query) ||
        m.phone?.includes(query) ||
        m.email?.toLowerCase().includes(query) ||
        String(m.pending_amount || "").includes(query)
    );
  }, [members, searchQuery]);

  // ─── Get current message ─────────────────────────────────────
  const getCurrentMessage = useCallback(() => {
    if (selectedCategory === "pending") return "";
    if (customMessage.trim()) return customMessage;
    if (selectedTemplate?.content) return selectedTemplate.content;
    return "";
  }, [customMessage, selectedCategory, selectedTemplate]);

  const getPendingFinanceMessage = useCallback((member) => {
    if (!member) return "";

    const gymName = selectedGym?.name || "Our Gym";
    const dueDateText = member.due_date
      ? new Date(member.due_date).toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
      : "N/A";

    return `Dear ${member.full_name},

Greetings from *${gymName}*! 

We hope you're making great progress with your fitness journey! This is a friendly reminder regarding your pending membership payment.

 *Pending Amount:* ${formatCurrency(member.pending_amount || 0)}
${member.is_overdue ? ` *Overdue by:* ${member.days_overdue || 0} days` : ` *Payment Due Date:* ${dueDateText}`}

We kindly request you to clear the payment at your earliest convenience to continue enjoying uninterrupted access to our facilities.

You can make the payment through:
• Cash at the reception
• UPI/Card at the gym
• Bank transfer

Feel free to reach out if you have any questions or need assistance.

Thank you for your cooperation! 

Best regards,
*${gymName} Team*`;
  }, [selectedGym?.name]);

  const getMessageForMember = useCallback(
    (member) => {
      const currentMessage = getCurrentMessage();
      if (currentMessage) {
        return personalizeMessage(currentMessage, member, selectedGym?.name);
      }

      if (selectedCategory === "pending") {
        return getPendingFinanceMessage(member);
      }

      return "";
    },
    [getCurrentMessage, getPendingFinanceMessage, selectedCategory, selectedGym?.name]
  );

  // ─── Handle Select All Toggle ────────────────────────────────
  const handleSelectAll = () => {
    if (selectedMembers.size === filteredMembers.length) {
      setSelectedMembers(new Set());
    } else {
      setSelectedMembers(new Set(filteredMembers.map((m) => m.member_id)));
    }
  };

  // ─── Handle Individual Selection ─────────────────────────────
  const handleSelectMember = (memberId) => {
    const newSelected = new Set(selectedMembers);
    if (newSelected.has(memberId)) {
      newSelected.delete(memberId);
    } else {
      newSelected.add(memberId);
    }
    setSelectedMembers(newSelected);
  };

  // ─── Send Single Message ─────────────────────────────────────
  const handleSendMessage = (member) => {
    const message = getMessageForMember(member);
    if (!message) {
      showError("Please select a template or write a custom message");
      return;
    }

    const whatsappUrl = generateWhatsAppURL(member.phone, message);

    if (!whatsappUrl) {
      showError("Invalid phone number");
      return;
    }

    // Open WhatsApp
    window.open(whatsappUrl, "_blank");
  };

  // ─── Start Bulk Send ─────────────────────────────────────────
  const startBulkSend = () => {
    const message = getCurrentMessage();
    if (!message && selectedCategory !== "pending") {
      showError("Please select a template or write a custom message");
      return;
    }
    if (selectedMembers.size === 0) {
      showError("Please select at least one member");
      return;
    }

    setBulkSendMode(true);
    setCurrentSendIndex(0);
    setSendProgress({ sent: 0, pending: selectedMembers.size, skipped: 0 });
  };

  // ─── Get Members to Send ─────────────────────────────────────
  const membersToSend = useMemo(() => {
    return filteredMembers.filter((m) => selectedMembers.has(m.member_id));
  }, [filteredMembers, selectedMembers]);

  // ─── Handle Bulk Send Action ─────────────────────────────────
  const handleBulkSendNext = (action) => {
    if (action === "send") {
      const member = membersToSend[currentSendIndex];
      const message = getMessageForMember(member);
      const whatsappUrl = generateWhatsAppURL(member.phone, message);
      
      if (whatsappUrl) {
        window.open(whatsappUrl, "_blank");
        setSendProgress((p) => ({ ...p, sent: p.sent + 1, pending: p.pending - 1 }));
      } else {
        setSendProgress((p) => ({ ...p, skipped: p.skipped + 1, pending: p.pending - 1 }));
      }
    } else if (action === "skip") {
      setSendProgress((p) => ({ ...p, skipped: p.skipped + 1, pending: p.pending - 1 }));
    }

    // Move to next
    if (currentSendIndex < membersToSend.length - 1) {
      setCurrentSendIndex((i) => i + 1);
    } else {
      // Completed
      showSuccess(`Bulk send completed! Sent: ${sendProgress.sent + (action === "send" ? 1 : 0)}, Skipped: ${sendProgress.skipped + (action === "skip" ? 1 : 0)}`);
      setBulkSendMode(false);
    }
  };

  // ─── Exit Bulk Send ──────────────────────────────────────────
  const exitBulkSend = () => {
    setBulkSendMode(false);
    setCurrentSendIndex(0);
    setSendProgress({ sent: 0, pending: 0, skipped: 0 });
  };

  // ─── Save Template ───────────────────────────────────────────
  const handleSaveTemplate = async (templateData) => {
    try {
      const storedUser = localStorage.getItem("gymUser");
      const user = storedUser ? JSON.parse(storedUser) : null;

      if (editingTemplate?.id && !String(editingTemplate.id).startsWith("default-")) {
        // Update existing
        const { error } = await supabase
          .from("message_templates")
          .update({
            name: templateData.name,
            content: templateData.content,
            category: templateData.category,
            updated_by: user?.id || null,
          })
          .eq("id", editingTemplate.id);

        if (error) throw error;
        showSuccess("Template updated successfully");
      } else {
        // Create new
        const { error } = await supabase
          .from("message_templates")
          .insert({
            gym_id: selectedGym.id,
            name: templateData.name,
            content: templateData.content,
            category: templateData.category,
            created_by: user?.id || null,
          });

        if (error) throw error;
        showSuccess("Template created successfully");
      }

      await loadTemplates(selectedGym.id);
      setShowTemplateEditor(false);
      setEditingTemplate(null);
    } catch (err) {
      console.error("Error saving template:", err);
      showError("Failed to save template");
    }
  };

  // ─── Delete Template ─────────────────────────────────────────
  const handleDeleteTemplate = async (template) => {
    if (!confirm(`Delete template "${template.name}"?`)) return;
    
    try {
      if (String(template.id).startsWith("default-")) {
        // Just remove from local state
        setTemplates((t) => t.filter((x) => x.id !== template.id));
        return;
      }

      const { error } = await supabase
        .from("message_templates")
        .delete()
        .eq("id", template.id);

      if (error) throw error;
      showSuccess("Template deleted");
      await loadTemplates(selectedGym.id);
    } catch (err) {
      console.error("Error deleting template:", err);
      showError("Failed to delete template");
    }
  };

  // ─── Loading State ───────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#f0813d]" />
      </div>
    );
  }

  if (!selectedGym) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <MessageCircle className="w-16 h-16 text-gray-300 mb-4" />
        <p className="text-gray-600">Please select a gym first</p>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════
  // Bulk Send Mode UI
  // ══════════════════════════════════════════════════════════════
  if (bulkSendMode && membersToSend.length > 0) {
    const currentMember = membersToSend[currentSendIndex];
    const personalizedMsg = getMessageForMember(currentMember);

    return (
      <div className="min-h-screen bg-gray-50 pb-24">
        <Header title="Bulk Send Messages" />
        
        <div className="p-4 max-w-2xl mx-auto">
          {/* Progress Bar */}
          <div className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-600">Progress</span>
              <span className="font-medium">{currentSendIndex + 1} of {membersToSend.length}</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#f0813d] to-[#f0813d] transition-all"
                style={{ width: `${((currentSendIndex + 1) / membersToSend.length) * 100}%` }}
              />
            </div>
            
            {/* Stats */}
            <div className="grid grid-cols-3 gap-2 mt-4">
              <div className="bg-orange-50 rounded-xl p-3 text-center">
                <div className="text-lg font-bold text-[#f0813d]">{sendProgress.sent}</div>
                <div className="text-xs text-[#f0813d]">Sent</div>
              </div>
              <div className="bg-orange-50 rounded-xl p-3 text-center">
                <div className="text-lg font-bold text-[#f0813d]">{sendProgress.pending}</div>
                <div className="text-xs text-[#f0813d]">Pending</div>
              </div>
              <div className="bg-gray-50 rounded-xl p-3 text-center">
                <div className="text-lg font-bold text-gray-600">{sendProgress.skipped}</div>
                <div className="text-xs text-gray-700">Skipped</div>
              </div>
            </div>
          </div>

          {/* Current Member Card */}
          <div className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#f0813d] to-[#f0813d] flex items-center justify-center text-white font-bold text-lg">
                {currentMember.full_name?.charAt(0) || "?"}
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">{currentMember.full_name}</h3>
                <p className="text-sm text-gray-500 flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  {currentMember.phone}
                </p>
              </div>
            </div>

            {/* Message Preview */}
            <div className="bg-orange-50 border border-orange-100 rounded-xl p-4">
              <p className="text-sm text-gray-800 whitespace-pre-wrap">{personalizedMsg}</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <button
              onClick={() => handleBulkSendNext("skip")}
              className="py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium flex items-center justify-center gap-2 transition"
            >
              <SkipForward className="w-5 h-5" />
              Skip
            </button>
            <button
              onClick={() => handleBulkSendNext("send")}
              className="py-3 px-4 bg-[#f0813d] hover:bg-[#f0813d] text-white rounded-xl font-medium flex items-center justify-center gap-2 transition"
            >
              <Send className="w-5 h-5" />
              Send & Next
            </button>
          </div>

          <button
            onClick={exitBulkSend}
            className="w-full py-3 px-4 bg-orange-50 hover:bg-orange-100 text-[#f0813d] rounded-xl font-medium flex items-center justify-center gap-2 transition"
          >
            <X className="w-5 h-5" />
            Exit Bulk Send
          </button>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════
  // Main UI
  // ══════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Header title="WhatsApp Messaging" />

      <div className="p-4 space-y-4 max-w-4xl mx-auto">
        {/* ─── Category Tabs ─────────────────────────────────────── */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
          {MEMBER_CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => {
                  setSelectedCategory(cat.id);
                  setSelectedFilter("none");
                  if (cat.id === "pending") {
                    setSelectedTemplate(null);
                    setCustomMessage("");
                  }
                  setSelectedMembers(new Set());
                }}
                className={`flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition whitespace-nowrap ${
                  isSelected
                    ? cat.color === "blue"
                      ? "bg-[#f0813d] text-white"
                      : cat.color === "green"
                      ? "bg-[#f0813d] text-white"
                      : cat.color === "orange"
                      ? "bg-[#f0813d] text-white"
                      : "bg-[#f0813d] text-white"
                    : "bg-white text-gray-700 border border-gray-200"
                }`}
              >
                <Icon className="w-4 h-4" />
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* ─── Filters ───────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Filter Members</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {FILTERS[selectedCategory]?.map((filter) => (
              <button
                key={filter.id}
                onClick={() => {
                  setSelectedFilter(filter.id);
                  setSelectedMembers(new Set());
                }}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  selectedFilter === filter.id
                    ? "bg-orange-100 text-[#f0813d] border border-orange-200"
                    : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {/* ─── Template & Message ────────────────────────────────── */}
        {selectedCategory !== "pending" && (
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Message Template</span>
            </div>
            <button
              onClick={() => setShowTemplates(true)}
              className="text-sm text-[#f0813d] hover:text-[#f0813d] font-medium flex items-center gap-1"
            >
              <Settings className="w-4 h-4" />
              Manage Templates
            </button>
          </div>

          {/* Template Selection */}
          <div className="flex flex-wrap gap-2 mb-3">
            {templates.slice(0, 5).map((template) => (
              <button
                key={template.id}
                onClick={() => {
                  setSelectedTemplate(template);
                  setCustomMessage("");
                }}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  selectedTemplate?.id === template.id
                    ? "bg-orange-100 text-[#f0813d] border border-orange-200"
                    : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                }`}
              >
                {template.name}
              </button>
            ))}
            {templates.length > 5 && (
              <button
                onClick={() => setShowTemplates(true)}
                className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-50 text-gray-600 hover:bg-gray-100"
              >
                +{templates.length - 5} more
              </button>
            )}
          </div>

          {/* Custom Message Input */}
          <div className="relative">
            <textarea
              value={customMessage || selectedTemplate?.content || ""}
              onChange={(e) => {
                setCustomMessage(e.target.value);
                if (e.target.value !== selectedTemplate?.content) {
                  setSelectedTemplate(null);
                }
              }}
              placeholder="Type your message here... Use {Name}, {ExpiryDate}, {MembershipType}, {GymName} for personalization"
              rows={3}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#f0813d] focus:border-transparent resize-none"
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {["{Name}", "{ExpiryDate}", "{MembershipType}", "{GymName}"].map((v) => (
                <button
                  key={v}
                  onClick={() => setCustomMessage((prev) => prev + " " + v)}
                  className="text-xs px-2 py-1 bg-orange-50 text-[#f0813d] rounded-md hover:bg-orange-100 font-mono"
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        </div>
        )}

        {/* ─── Search & Stats ────────────────────────────────────── */}
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search members..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#f0813d]"
            />
          </div>
          <button
            onClick={fetchMembers}
            className="p-2.5 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition"
          >
            <RefreshCw className={`w-5 h-5 text-gray-500 ${membersLoading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* ─── Member Count & Select All ─────────────────────────── */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">
            {filteredMembers.length} members • {selectedMembers.size} selected
          </span>
          <button
            onClick={handleSelectAll}
            className="text-sm text-[#f0813d] hover:text-[#f0813d] font-medium"
          >
            {selectedMembers.size === filteredMembers.length ? "Deselect All" : "Select All"}
          </button>
        </div>

        {/* ─── Members List ──────────────────────────────────────── */}
        <div className="space-y-2">
          {membersLoading ? (
            <div className="bg-white rounded-2xl p-8 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-[#f0813d]" />
            </div>
          ) : filteredMembers.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No members found</p>
            </div>
          ) : (
            filteredMembers.map((member) => {
              const isSelected = selectedMembers.has(member.member_id);
              const personalizedMsg = getMessageForMember(member);

              return (
                <div
                  key={member.member_id}
                  className={`bg-white rounded-xl p-3 transition border-2 ${
                    isSelected ? "border-[#f0813d] bg-orange-50/30" : "border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* Checkbox */}
                    <button
                      onClick={() => handleSelectMember(member.member_id)}
                      className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition ${
                        isSelected
                          ? "bg-[#f0813d] border-[#f0813d]"
                          : "border-gray-300 hover:border-[#f0813d]"
                      }`}
                    >
                      {isSelected && <CheckCircle className="w-3 h-3 text-white" />}
                    </button>

                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#f0813d] to-[#f0813d] flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                      {member.full_name?.charAt(0) || "?"}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-gray-900 truncate">{member.full_name}</h4>
                        <span
                          className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                            member.membership_status === "active"
                              ? "bg-orange-100 text-[#f0813d]"
                              : member.membership_status === "pending"
                              ? "bg-orange-100 text-[#f0813d]"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {member.membership_status === "active"
                            ? "Active"
                            : member.membership_status === "pending"
                            ? "Pending"
                            : "Inactive"}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 flex items-center gap-2">
                        <Phone className="w-3 h-3" />
                        {member.phone}
                        {member.membership_status === "pending" ? (
                          <span className="text-xs text-[#f0813d]">
                            • Due: {formatCurrency(member.pending_amount || 0)}
                            {member.is_overdue
                              ? ` • ${member.days_overdue} days overdue`
                              : member.due_date
                              ? ` • ${new Date(member.due_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`
                              : ""}
                          </span>
                        ) : member.expiry_date && (
                          <span className="text-xs">
                            • Expires: {new Date(member.expiry_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                          </span>
                        )}
                      </p>
                    </div>

                    {/* Send Button */}
                    <button
                      onClick={() => handleSendMessage(member)}
                      disabled={!getCurrentMessage()}
                      className="p-2 bg-[#f0813d] hover:bg-[#f0813d] disabled:bg-gray-300 text-white rounded-lg transition"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Message Preview (if selected) */}
                  {isSelected && personalizedMsg && (
                    <div className="mt-3 ml-8 p-3 bg-orange-50 rounded-lg border border-orange-100">
                      <p className="text-xs text-gray-600 mb-1 font-medium">Preview:</p>
                      <p className="text-sm text-gray-800">{personalizedMsg}</p>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* ─── Bulk Send Button ───────────────────────────────────── */}
        {selectedMembers.size > 0 && (
          <div className="sticky bottom-20 bg-white rounded-2xl p-4 shadow-lg border border-gray-200">
            <button
              onClick={startBulkSend}
              disabled={!getCurrentMessage() && selectedCategory !== "pending"}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-[#f0813d] to-[#f0813d] hover:from-[#f0813d] hover:to-[#f0813d] disabled:from-gray-400 disabled:to-gray-400 text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition"
            >
              <MessageCircle className="w-5 h-5" />
              Send to {selectedMembers.size} Members
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════
          Templates Modal
          ══════════════════════════════════════════════════════════════ */}
      {showTemplates && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
          <div className="bg-white w-full max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[80vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white rounded-t-2xl">
              <h2 className="text-lg font-bold text-gray-900">Message Templates</h2>
              <button
                onClick={() => setShowTemplates(false)}
                className="p-2 -mr-2 hover:bg-orange-50 rounded-lg transition text-gray-700 hover:text-[#f0813d]"
                aria-label="Close"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Templates List */}
            <div className="flex-1 overflow-auto p-4 space-y-3">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className={`p-4 rounded-xl border-2 transition ${
                    selectedTemplate?.id === template.id
                      ? "border-[#f0813d] bg-orange-50"
                      : "border-gray-100 hover:border-gray-200"
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-medium text-gray-900">{template.name}</h3>
                      <span className="text-xs text-gray-500 capitalize">{template.category}</span>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => {
                          setEditingTemplate(template);
                          setShowTemplateEditor(true);
                        }}
                        className="p-1.5 hover:bg-gray-100 rounded-lg"
                      >
                        <Edit className="w-4 h-4 text-gray-500" />
                      </button>
                      <button
                        onClick={() => handleDeleteTemplate(template)}
                        className="p-1.5 hover:bg-orange-50 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4 text-[#f0813d]" />
                      </button>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 line-clamp-2">{template.content}</p>
                  <button
                    onClick={() => {
                      setSelectedTemplate(template);
                      setCustomMessage("");
                      setShowTemplates(false);
                    }}
                    className="mt-3 w-full py-2 bg-[#f0813d] hover:bg-[#f0813d] text-white text-sm font-medium rounded-lg transition"
                  >
                    Use This Template
                  </button>
                </div>
              ))}
            </div>

            {/* Add New Button */}
            <div className="p-4 border-t">
              <button
                onClick={() => {
                  setEditingTemplate(null);
                  setShowTemplateEditor(true);
                }}
                className="w-full py-3 bg-[#f0813d] hover:bg-[#f0813d] text-white font-medium rounded-xl flex items-center justify-center gap-2 transition"
              >
                <Plus className="w-5 h-5" />
                Create New Template
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          Template Editor Modal
          ══════════════════════════════════════════════════════════════ */}
      {showTemplateEditor && (
        <TemplateEditor
          template={editingTemplate}
          onSave={handleSaveTemplate}
          onClose={() => {
            setShowTemplateEditor(false);
            setEditingTemplate(null);
          }}
        />
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// Template Editor Component
// ══════════════════════════════════════════════════════════════
function TemplateEditor({ template, onSave, onClose }) {
  const [name, setName] = useState(template?.name || "");
  const [content, setContent] = useState(template?.content || "");
  const [category, setCategory] = useState(template?.category || "general");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !content.trim()) return;
    
    setSaving(true);
    await onSave({ name, content, category });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
      <div className="bg-white w-full max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[90vh] flex flex-col">
          <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white rounded-t-2xl">
            <h2 className="text-lg font-bold text-gray-900">
              {template ? "Edit Template" : "New Template"}
            </h2>
            <button 
              onClick={onClose} 
              className="p-2 -mr-2 hover:bg-orange-50 rounded-lg transition text-gray-700 hover:text-[#f0813d]"
              aria-label="Close"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-auto p-4 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Template Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Membership Expiry Reminder"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#f0813d]"
              required
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#f0813d]"
            >
              <option value="general">General</option>
              <option value="expiry">Expiry Reminder</option>
              <option value="birthday">Birthday</option>
              <option value="campaign">Campaign</option>
              <option value="reactivation">Reactivation</option>
            </select>
          </div>

          {/* Content */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Message Content</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Hi {Name}, your membership..."
              rows={5}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#f0813d] resize-none"
              required
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {["{Name}", "{ExpiryDate}", "{MembershipType}", "{GymName}", "{JoinDate}"].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setContent((prev) => prev + " " + v)}
                  className="text-xs px-2 py-1 bg-orange-50 text-[#f0813d] rounded-md hover:bg-orange-100 font-mono"
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="bg-orange-50 border border-orange-100 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">Preview:</p>
            <p className="text-sm text-gray-800">
              {content
                .replace(/{Name}/gi, "John Doe")
                .replace(/{ExpiryDate}/gi, "15 Mar 2026")
                .replace(/{MembershipType}/gi, "Monthly Premium")
                .replace(/{GymName}/gi, "Shakti Fitness")
                .replace(/{JoinDate}/gi, "1 Jan 2026")}
            </p>
          </div>
        </form>

        <div className="p-4 border-t">
          <button
            onClick={handleSubmit}
            disabled={saving || !name.trim() || !content.trim()}
            className="w-full py-3 bg-[#f0813d] hover:bg-[#f0813d] disabled:bg-gray-400 text-white font-medium rounded-xl flex items-center justify-center gap-2 transition"
          >
            {saving ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Save className="w-5 h-5" />
            )}
            {template ? "Update Template" : "Create Template"}
          </button>
        </div>
      </div>
    </div>
  );
}
