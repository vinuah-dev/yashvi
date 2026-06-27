"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useUserRole } from "@/lib/hooks/useUserRole";
import Header from "@/components/layout/Header";
import {
  Search,
  Plus,
  Filter,
  Phone,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Edit3,
  UserCheck,
  Users,
  PhoneCall,
  TrendingUp,
  AlertTriangle,
  Clock,
  X,
} from "lucide-react";

const STATUS_CONFIG = {
  new: { label: "New", color: "bg-orange-100 text-[#f0813d]", dot: "bg-[#f0813d]" },
  contacted: { label: "Contacted", color: "bg-orange-100 text-[#f0813d]", dot: "bg-[#f0813d]" },
  follow_up: { label: "Follow-Up", color: "bg-orange-100 text-[#f0813d]", dot: "bg-[#f0813d]" },
  joined: { label: "Joined", color: "bg-orange-100 text-[#f0813d]", dot: "bg-[#f0813d]" },
  not_interested: { label: "Not Interested", color: "bg-orange-100 text-[#f0813d]", dot: "bg-[#f0813d]" },
};

const PLAN_OPTIONS = ["Monthly", "Quarterly", "Half-Yearly", "Yearly", "PT", "Other"];
const PAGE_SIZE = 15;

export default function InquiriesPage() {
  const router = useRouter();
  const { isViewOnly } = useUserRole();
  const [selectedGym, setSelectedGym] = useState(null);
  const [inquiries, setInquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPlan, setFilterPlan] = useState("all");
  const [filterVisitFrom, setFilterVisitFrom] = useState("");
  const [filterVisitTo, setFilterVisitTo] = useState("");
  const [filterFollowUpFrom, setFilterFollowUpFrom] = useState("");
  const [filterFollowUpTo, setFilterFollowUpTo] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => {
    const storedGym = localStorage.getItem("selectedGym");
    if (storedGym) {
      setSelectedGym(JSON.parse(storedGym));
    } else {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedGym?.id) fetchInquiries(selectedGym.id);
  }, [selectedGym]);

  const fetchInquiries = async (gymId) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("inquiries")
        .select("*")
        .eq("gym_id", gymId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setInquiries(data || []);
    } catch (error) {
      console.error("Error fetching inquiries:", error);
    } finally {
      setLoading(false);
    }
  };

  // Stats
  const stats = useMemo(() => {
    const total = inquiries.length;
    const joined = inquiries.filter((i) => i.status === "joined").length;
    const today = new Date().toISOString().split("T")[0];
    const pendingFollowUps = inquiries.filter(
      (i) => i.follow_up_date && i.follow_up_date >= today && i.status !== "joined" && i.status !== "not_interested"
    ).length;
    const overdueFollowUps = inquiries.filter(
      (i) => i.follow_up_date && i.follow_up_date < today && i.status !== "joined" && i.status !== "not_interested"
    ).length;
    const conversionRate = total > 0 ? ((joined / total) * 100).toFixed(1) : "0.0";
    return { total, joined, pendingFollowUps, overdueFollowUps, conversionRate };
  }, [inquiries]);

  // Filtered + sorted
  const filtered = useMemo(() => {
    let result = [...inquiries];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (i) => i.full_name.toLowerCase().includes(q) || i.phone.includes(q)
      );
    }
    if (filterStatus !== "all") result = result.filter((i) => i.status === filterStatus);
    if (filterPlan !== "all") result = result.filter((i) => i.interested_plan === filterPlan);
    if (filterVisitFrom) result = result.filter((i) => i.visit_date >= filterVisitFrom);
    if (filterVisitTo) result = result.filter((i) => i.visit_date <= filterVisitTo);
    if (filterFollowUpFrom) result = result.filter((i) => i.follow_up_date && i.follow_up_date >= filterFollowUpFrom);
    if (filterFollowUpTo) result = result.filter((i) => i.follow_up_date && i.follow_up_date <= filterFollowUpTo);

    // Sort
    result.sort((a, b) => {
      if (sortBy === "newest") return new Date(b.created_at) - new Date(a.created_at);
      if (sortBy === "follow_up") return (a.follow_up_date || "9999") > (b.follow_up_date || "9999") ? 1 : -1;
      if (sortBy === "status") {
        const order = ["new", "follow_up", "contacted", "joined", "not_interested"];
        return order.indexOf(a.status) - order.indexOf(b.status);
      }
      return 0;
    });

    return result;
  }, [inquiries, searchQuery, filterStatus, filterPlan, filterVisitFrom, filterVisitTo, filterFollowUpFrom, filterFollowUpTo, sortBy]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [searchQuery, filterStatus, filterPlan, sortBy, filterVisitFrom, filterVisitTo, filterFollowUpFrom, filterFollowUpTo]);

  const handleDelete = async (id) => {
    try {
      const { error } = await supabase.from("inquiries").delete().eq("id", id);
      if (error) throw error;
      setInquiries((prev) => prev.filter((i) => i.id !== id));
      setDeleteConfirm(null);
    } catch (error) {
      console.error("Error deleting inquiry:", error);
      alert("Failed to delete inquiry.");
    }
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      const { error } = await supabase
        .from("inquiries")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      setInquiries((prev) => prev.map((i) => (i.id === id ? { ...i, status: newStatus, updated_at: new Date().toISOString() } : i)));
    } catch (error) {
      console.error("Error updating status:", error);
      alert("Failed to update status.");
    }
  };

  const formatDate = (d) => {
    if (!d) return "—";
    return new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  };

  const clearFilters = () => {
    setFilterStatus("all");
    setFilterPlan("all");
    setFilterVisitFrom("");
    setFilterVisitTo("");
    setFilterFollowUpFrom("");
    setFilterFollowUpTo("");
    setSortBy("newest");
    setSearchQuery("");
  };

  const hasActiveFilters = filterStatus !== "all" || filterPlan !== "all" || filterVisitFrom || filterVisitTo || filterFollowUpFrom || filterFollowUpTo || sortBy !== "newest";

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 pb-24">
        <Header title="Inquiries" />
        <div className="flex items-center justify-center h-96">
          <div className="w-10 h-10 border-4 border-[#f0813d] border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Header title="Inquiries" />

      <main className="px-4 py-4 space-y-4">
        {/* Dashboard Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <StatCard icon={<Users className="w-5 h-5" />} label="Total" value={stats.total} color="blue" />
          <StatCard icon={<UserCheck className="w-5 h-5" />} label="Joined" value={stats.joined} color="green" />
          <StatCard icon={<Clock className="w-5 h-5" />} label="Pending F/U" value={stats.pendingFollowUps} color="orange" />
          <StatCard icon={<AlertTriangle className="w-5 h-5" />} label="Overdue" value={stats.overdueFollowUps} color="red" />
          <StatCard icon={<TrendingUp className="w-5 h-5" />} label="Conversion" value={`${stats.conversionRate}%`} color="orange" />
        </div>

        {/* Quick Action Buttons */}
        <div className="flex gap-2 flex-wrap">
          {!isViewOnly && (
            <button
              onClick={() => router.push("/inquiries/add")}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#f0813d] text-white rounded-xl text-sm font-semibold hover:bg-[#f0813d] active:scale-95 transition-all shadow-sm"
            >
              <Plus className="w-4 h-4" /> New Inquiry
            </button>
          )}
          <button
            onClick={() => router.push("/inquiries/follow-ups")}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#f0813d] text-white rounded-xl text-sm font-semibold hover:bg-[#f0813d] active:scale-95 transition-all shadow-sm"
          >
            <PhoneCall className="w-4 h-4" /> Follow-Up Calls
          </button>
        </div>

        {/* Search + Filter Bar */}
        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name or phone..."
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#f0813d] focus:border-[#f0813d] outline-none"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-medium border transition ${
                showFilters || hasActiveFilters
                  ? "bg-orange-50 border-[#f0813d] text-[#f0813d]"
                  : "bg-white border-gray-200 text-gray-600"
              }`}
            >
              <Filter className="w-4 h-4" />
              {hasActiveFilters && <span className="w-2 h-2 bg-[#f0813d] rounded-full"></span>}
            </button>
          </div>

          {/* Status Quick Filters */}
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {[{ key: "all", label: "All" }, ...Object.entries(STATUS_CONFIG).map(([key, v]) => ({ key, label: v.label }))].map(
              (s) => (
                <button
                  key={s.key}
                  onClick={() => setFilterStatus(s.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                    filterStatus === s.key
                      ? "bg-gray-900 text-white"
                      : "bg-white text-gray-600 border border-gray-200"
                  }`}
                >
                  {s.label}
                </button>
              )
            )}
          </div>

          {/* Expanded Filters */}
          {showFilters && (
            <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-700">Advanced Filters</p>
                {hasActiveFilters && (
                  <button onClick={clearFilters} className="text-xs text-[#f0813d] font-medium">Clear All</button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Plan</label>
                  <select
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#f0813d]"
                    value={filterPlan}
                    onChange={(e) => setFilterPlan(e.target.value)}
                  >
                    <option value="all">All Plans</option>
                    {PLAN_OPTIONS.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Sort By</label>
                  <select
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#f0813d]"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                  >
                    <option value="newest">Newest First</option>
                    <option value="follow_up">Follow-Up Date</option>
                    <option value="status">Status</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Visit From</label>
                  <input type="date" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none" value={filterVisitFrom} onChange={(e) => setFilterVisitFrom(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Visit To</label>
                  <input type="date" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none" value={filterVisitTo} onChange={(e) => setFilterVisitTo(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Follow-Up From</label>
                  <input type="date" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none" value={filterFollowUpFrom} onChange={(e) => setFilterFollowUpFrom(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Follow-Up To</label>
                  <input type="date" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none" value={filterFollowUpTo} onChange={(e) => setFilterFollowUpTo(e.target.value)} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Result Count */}
        <p className="text-xs text-gray-500">{filtered.length} inquiries found</p>

        {/* Inquiry Cards */}
        <div className="space-y-3">
          {paginated.length === 0 ? (
            <div className="bg-white rounded-xl p-12 text-center border border-gray-100">
              <div className="w-16 h-16 bg-orange-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-white" />
              </div>
              <p className="text-gray-500 font-medium">No inquiries found</p>
              <p className="text-sm text-gray-400 mt-1">Add your first inquiry to get started</p>
              <button
                onClick={() => router.push("/inquiries/add")}
                className="mt-4 px-4 py-2 bg-[#f0813d] text-white text-sm rounded-lg font-medium"
              >
                + Add Inquiry
              </button>
            </div>
          ) : (
            paginated.map((inquiry) => {
              const sc = STATUS_CONFIG[inquiry.status] || STATUS_CONFIG.new;
              const today = new Date().toISOString().split("T")[0];
              const isOverdue =
                inquiry.follow_up_date &&
                inquiry.follow_up_date < today &&
                inquiry.status !== "joined" &&
                inquiry.status !== "not_interested";

              return (
                <div
                  key={inquiry.id}
                  className={`bg-white rounded-xl border p-4 transition hover:shadow-md ${
                    isOverdue ? "border-orange-200 bg-orange-50/30" : "border-gray-100"
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-gray-900 truncate">{inquiry.full_name}</h3>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${sc.color}`}>
                          {sc.label}
                        </span>
                        {isOverdue && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-[#f0813d]">
                            Overdue
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Phone className="w-3.5 h-3.5 text-gray-400" />
                        <a href={`tel:${inquiry.phone}`} className="text-sm text-[#f0813d] font-medium">{inquiry.phone}</a>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs mb-3">
                    <div>
                      <p className="text-gray-400">Visit</p>
                      <p className="text-gray-700 font-medium">{formatDate(inquiry.visit_date)}</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Follow-Up</p>
                      <p className={`font-medium ${isOverdue ? "text-[#f0813d]" : "text-gray-700"}`}>
                        {formatDate(inquiry.follow_up_date)}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-400">Plan</p>
                      <p className="text-gray-700 font-medium">{inquiry.interested_plan || "—"}</p>
                    </div>
                  </div>

                  {inquiry.notes && (
                    <p className="text-xs text-gray-500 mb-3 line-clamp-2 bg-gray-50 rounded-lg p-2">{inquiry.notes}</p>
                  )}

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 flex-wrap border-t border-gray-100 pt-3">
                    {!isViewOnly && (
                      <button
                        onClick={() => router.push(`/inquiries/${inquiry.id}/edit`)}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
                      >
                        <Edit3 className="w-3.5 h-3.5" /> Edit
                      </button>
                    )}
                    {!isViewOnly && inquiry.status !== "joined" && (
                      <button
                        onClick={() => handleStatusChange(inquiry.id, "joined")}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-[#f0813d] bg-orange-100 rounded-lg hover:bg-orange-200 transition"
                      >
                        <UserCheck className="w-3.5 h-3.5" /> Mark Joined
                      </button>
                    )}
                    {!isViewOnly && inquiry.status !== "contacted" && inquiry.status !== "joined" && (
                      <button
                        onClick={() => handleStatusChange(inquiry.id, "contacted")}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-[#f0813d] bg-orange-100 rounded-lg hover:bg-orange-200 transition"
                      >
                        <PhoneCall className="w-3.5 h-3.5" /> Contacted
                      </button>
                    )}
                    <button
                      onClick={() => setDeleteConfirm(inquiry.id)}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-[#f0813d] bg-orange-50 rounded-lg hover:bg-orange-100 transition ml-auto"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 rounded-lg bg-white border border-gray-200 disabled:opacity-40 transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm text-gray-600">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-2 rounded-lg bg-white border border-gray-200 disabled:opacity-40 transition"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </main>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Inquiry</h3>
            <p className="text-sm text-gray-600 mb-6">Are you sure you want to delete this inquiry? This action cannot be undone.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 py-2.5 bg-[#f0813d] text-white rounded-xl font-medium"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, color }) {
  const colors = {
    blue: "bg-orange-50 text-[#f0813d]",
    green: "bg-orange-50 text-[#f0813d]",
    orange: "bg-orange-50 text-[#f0813d]",
    red: "bg-orange-50 text-[#f0813d]",
    orange: "bg-orange-50 text-[#f0813d]",
  };
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-3 space-y-1">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${colors[color]}`}>
        {icon}
      </div>
      <p className="text-xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}
