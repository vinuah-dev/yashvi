"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Header from "@/components/layout/Header";
import { AnnouncementsPageSkeleton } from "@/components/shared/Skeleton";
import { 
  Megaphone,
  Search,
  Plus,
  Filter,
  Calendar,
  Clock,
  Eye,
  Edit2,
  Power,
  Trash2,
  CheckCircle,
  XCircle,
  Bell,
  TrendingUp,
  ChevronRight,
  X,
  AlertTriangle,
  MessageSquare
} from "lucide-react";

export default function AnnouncementsPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedGym, setSelectedGym] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    inactive: 0
  });

  // Get gym from localStorage
  useEffect(() => {
    const storedGym = localStorage.getItem("selectedGym");
    if (storedGym) {
      setSelectedGym(JSON.parse(storedGym));
    } else {
      setLoading(false);
    }
  }, []);

  // Fetch announcements directly from Supabase
  const fetchAnnouncements = async (gymId) => {
    if (!gymId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("announcements")
        .select("*")
        .eq("gym_id", gymId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching announcements:", error);
        setAnnouncements([]);
      } else {
        setAnnouncements(data || []);
      }
    } catch (err) {
      console.error("Error:", err);
      setAnnouncements([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (selectedGym?.id) {
      fetchAnnouncements(selectedGym.id);
    }
  }, [selectedGym?.id]);

  // Calculate stats when announcements change
  useEffect(() => {
    const activeCount = announcements.filter(a => a.status === "active").length;
    const inactiveCount = announcements.filter(a => a.status === "inactive").length;
    
    setStats({
      total: announcements.length,
      active: activeCount,
      inactive: inactiveCount
    });
  }, [announcements]);

  const filteredAnnouncements = announcements.filter((announcement) => {
    const matchesSearch =
      announcement.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      announcement.message.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus =
      filterStatus === "all" || announcement.status === filterStatus;

    return matchesSearch && matchesStatus;
  });

  const handleDelete = async (id, title) => {
    if (!confirm(`Are you sure you want to delete "${title}"?`)) return;

    try {
      const { error } = await supabase
        .from("announcements")
        .delete()
        .eq("id", id);

      if (error) throw error;

      // Refresh announcements data
      if (selectedGym?.id) {
        fetchAnnouncements(selectedGym.id);
      }
    } catch (error) {
      console.error("Error deleting announcement:", error);
      alert("Failed to delete announcement");
    }
  };

  const handleToggleStatus = async (id, currentStatus, title) => {
    try {
      const newStatus = currentStatus === "active" ? "inactive" : "active";
      const { error } = await supabase
        .from("announcements")
        .update({ status: newStatus })
        .eq("id", id);

      if (error) throw error;

      // Refresh announcements data
      if (selectedGym?.id) {
        fetchAnnouncements(selectedGym.id);
      }
    } catch (error) {
      console.error("Error updating announcement status:", error);
      alert("Failed to update announcement status");
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "No expiry";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
    });
  };

  const getStatusConfig = (status) => {
    switch (status) {
      case "active":
        return {
          bg: "bg-gradient-to-r from-[#f0813d] to-[#f0813d]",
          text: "text-[#f0813d]",
          lightBg: "bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200",
          label: "Active",
          icon: <CheckCircle className="w-3.5 h-3.5" />
        };
      case "inactive":
        return {
          bg: "bg-gradient-to-r from-gray-400 to-gray-300",
          text: "text-gray-700",
          lightBg: "bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200",
          label: "Inactive",
          icon: <XCircle className="w-3.5 h-3.5" />
        };
      default:
        return {
          bg: "bg-gradient-to-r from-gray-400 to-gray-300",
          text: "text-gray-700",
          lightBg: "bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200",
          label: "Inactive",
          icon: <XCircle className="w-3.5 h-3.5" />
        };
    }
  };

  if (loading) {
    return <AnnouncementsPageSkeleton />;
  }

  if (!selectedGym) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 safe-area-inset-bottom">
        <Header title="Announcements" showBack={false} />
        <main className="px-4 py-4">
          <div className="text-center py-12">
            <div className="w-20 h-20 bg-gradient-to-br from-[#f0813d] to-[#f0813d] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <Megaphone className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">No Gym Selected</h2>
            <p className="text-gray-500 text-sm mb-6 px-4">
              Please select a gym to view and manage announcements
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
      <Header title="Announcements" showBack={false} />

      <main className="px-3 py-3 space-y-4">
        {/* Stats Cards - Mobile Optimized */}
        <div className="grid grid-cols-2 gap-2 px-1">
          <div className="bg-white rounded-xl p-3 border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 font-medium">Total</p>
                <p className="text-xl font-bold text-gray-900 mt-0.5">{stats.total}</p>
              </div>
              <div className="w-10 h-10 bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg flex items-center justify-center">
                <Megaphone className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-3 border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 font-medium">Active</p>
                <p className="text-xl font-bold text-[#f0813d] mt-0.5">{stats.active}</p>
              </div>
              <div className="w-10 h-10 bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-3 border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 font-medium">Inactive</p>
                <p className="text-xl font-bold text-gray-600 mt-0.5">{stats.inactive}</p>
              </div>
              <div className="w-10 h-10 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg flex items-center justify-center">
                <Bell className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-3 border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 font-medium">Today</p>
                <p className="text-xl font-bold text-[#f0813d] mt-0.5">
                  {announcements.filter(a => {
                    const today = new Date().toDateString();
                    const announcementDate = new Date(a.announced_at).toDateString();
                    return announcementDate === today;
                  }).length}
                </p>
              </div>
              <div className="w-10 h-10 bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg flex items-center justify-center">
                <Calendar className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>
        </div>

        {/* Search and Add Member */}
        <div className="bg-white rounded-xl p-3 mx-1 border border-gray-200 shadow-sm space-y-3">
          {/* Search Bar */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search announcements by title or content..."
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#f0813d] focus:border-[#f0813d] outline-none transition-all text-sm placeholder:text-gray-400"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Add Announcement Button */}
          <button
            onClick={() => router.push("/announcements/add")}
            className="w-full py-3 bg-gradient-to-r from-[#f0813d] to-[#f0813d] text-white font-medium rounded-lg hover:shadow-lg active:scale-95 transition-all duration-200 flex items-center justify-center gap-2"
            style={{ minHeight: '44px' }}
          >
            <Plus className="w-5 h-5" />
            Add New Announcement
          </button>
        </div>

        {/* Filter Tabs - Horizontal Scroll on Mobile */}
        <div className="bg-white rounded-xl p-3 mx-1 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Filter by Status</span>
          </div>
          <div className="flex space-x-2 overflow-x-auto pb-1 -mx-1 px-1 no-scrollbar">
            {[
              { id: "all", label: "All", count: stats.total },
              { id: "active", label: "Active", count: stats.active },
              { id: "inactive", label: "Inactive", count: stats.inactive }
            ].map((filter) => (
              <button
                key={filter.id}
                onClick={() => setFilterStatus(filter.id)}
                className={`flex-shrink-0 px-4 py-2.5 rounded-lg text-xs font-medium transition-all duration-200 flex items-center gap-2 ${
                  filterStatus === filter.id
                    ? "bg-gradient-to-r from-[#f0813d] to-[#f0813d] text-white shadow-md"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
                style={{ minHeight: '36px' }}
              >
                {filter.label}
                <span className={`px-2 py-0.5 text-xs rounded-full ${
                  filterStatus === filter.id 
                    ? "bg-white/20" 
                    : "bg-white text-gray-600"
                }`}>
                  {filter.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Announcements List */}
        <div className="space-y-3 pb-20">
          {filteredAnnouncements.map((announcement) => {
            const statusConfig = getStatusConfig(announcement.status);
            const isExpired = announcement.expires_at && new Date(announcement.expires_at) < new Date();
            
            return (
              <div
                key={announcement.id}
                onClick={() => router.push(`/announcements/${announcement.id}`)}
                className="bg-white rounded-xl border border-gray-200 p-3 hover:shadow-md active:scale-95 transition-all duration-200 cursor-pointer mx-1"
              >
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#f0813d] to-[#f0813d] flex items-center justify-center text-white shadow-sm relative">
                      <Megaphone className="w-6 h-6" />
                      <div className={`absolute -bottom-1 -right-1 w-5 h-5 ${statusConfig.bg} rounded-full border-2 border-white flex items-center justify-center`}>
                        {statusConfig.icon}
                      </div>
                    </div>
                  </div>

                  {/* Announcement Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-1">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-gray-900 text-sm truncate">
                            {announcement.title}
                          </h3>
                          <div className={`px-2 py-1 rounded-lg border ${statusConfig.lightBg} ${statusConfig.text} flex items-center gap-1.5`}>
                            {statusConfig.icon}
                            <span className="text-xs font-medium">{statusConfig.label}</span>
                          </div>
                        </div>
                        <p className="text-gray-600 text-xs mt-1 line-clamp-2">
                          {announcement.message}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                    </div>

                    {/* Date Info */}
                    <div className="mt-3 space-y-1">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-orange-50 rounded-lg flex items-center justify-center">
                          <Calendar className="w-3.5 h-3.5 text-white" />
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Announced</p>
                          <p className="text-sm font-medium text-gray-900">
                            {formatDate(announcement.announced_at)}
                          </p>
                        </div>
                      </div>

                      {announcement.expires_at && (
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-orange-50 rounded-lg flex items-center justify-center">
                            <Clock className="w-3.5 h-3.5 text-white" />
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Expires</p>
                            <p className={`text-sm font-medium ${isExpired ? 'text-[#f0813d]' : 'text-gray-900'}`}>
                              {formatDate(announcement.expires_at)}
                              {isExpired && ' (Expired)'}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Action Buttons - Horizontal Scroll on Mobile */}
                    <div className="flex space-x-2 overflow-x-auto mt-3 pt-3 border-t border-gray-100 pb-1 -mx-1 px-1 no-scrollbar">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/announcements/${announcement.id}`);
                        }}
                        className="flex-shrink-0 px-3 py-2 bg-orange-50 text-[#f0813d] cursor-pointer text-xs font-medium rounded-lg active:bg-orange-100 transition-all flex items-center gap-2"
                        style={{ minHeight: '36px' }}
                      >
                        <Eye className="w-3.5 h-3.5" />
                        View
                      </button>
                      
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/announcements/${announcement.id}/edit`);
                        }}
                        className="flex-shrink-0 px-3 py-2 bg-orange-50 text-[#f0813d] cursor-pointer text-xs font-medium rounded-lg active:bg-orange-100 transition-all flex items-center gap-2"
                        style={{ minHeight: '36px' }}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        Edit
                      </button>
                      
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleStatus(announcement.id, announcement.status, announcement.title);
                        }}
                        className={`flex-shrink-0 px-3 py-2 text-xs font-medium rounded-lg active:scale-95 transition-all flex items-center gap-2 ${
                          announcement.status === "active"
                            ? "bg-gradient-to-r from-[#f0813d] to-[#f0813d] text-white"
                            : "bg-gradient-to-r from-[#f0813d] to-[#f0813d] text-white"
                        }`}
                        style={{ minHeight: '36px' }}
                      >
                        <Power className="w-3.5 h-3.5" />
                        {announcement.status === "active" ? "Deactivate" : "Activate"}
                      </button>
                      
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(announcement.id, announcement.title);
                        }}
                        className="flex-shrink-0 px-3 py-2 bg-orange-50 cursor-pointer text-[#f0813d] text-xs font-medium rounded-lg active:bg-orange-100 transition-all flex items-center gap-2"
                        style={{ minHeight: '36px' }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Empty State */}
        {filteredAnnouncements.length === 0 && (
          <div className="text-center py-8 px-4">
            <div className="w-16 h-16 bg-gradient-to-br from-gray-100 to-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Megaphone className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-base font-semibold text-gray-900 mb-2">
              {searchQuery || filterStatus !== "all" 
                ? "No announcements found" 
                : "No announcements yet"}
            </h3>
            <p className="text-gray-500 text-sm mb-4">
              {searchQuery || filterStatus !== "all" 
                ? "Try adjusting your search or filter criteria" 
                : "Add your first announcement to communicate with members"}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              {(searchQuery || filterStatus !== "all") && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setFilterStatus("all");
                  }}
                  className="px-4 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg active:scale-95 transition-transform text-sm"
                >
                  Clear filters
                </button>
              )}
              <button
                onClick={() => router.push("/announcements/add")}
                className="px-6 py-3 bg-gradient-to-r from-[#f0813d] to-[#f0813d] text-white font-medium rounded-lg hover:shadow-lg active:scale-95 transition-all duration-200 flex items-center justify-center gap-2"
                style={{ minHeight: '44px' }}
              >
                <Plus className="w-5 h-5" />
                Create First Announcement
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
