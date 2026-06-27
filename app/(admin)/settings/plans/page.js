"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/layout/Header";
import { supabase } from "@/lib/supabaseClient";
import { useUserRole } from "@/lib/hooks/useUserRole";
import { 
  PlusCircle, 
  Users, 
  Calendar, 
  IndianRupee, 
  Edit2, 
  Trash2, 
  CheckCircle, 
  XCircle, 
  Zap, 
  Clock,
  Filter,
  ChevronRight,
  Plus,
  X,
  AlertCircle,
  BarChart3,
  DollarSign,
  Tag,
  ArrowLeft
} from "lucide-react";

export default function PlansSettingsPage() {
  const router = useRouter();
  const { canCreateTrainer, isLoading: roleLoading } = useUserRole();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [gymId, setGymId] = useState(null);
  const [activeTab, setActiveTab] = useState("all");
  const [selectedGym, setSelectedGym] = useState(null);

  useEffect(() => {
    const storedGym = localStorage.getItem("selectedGym");
    if (storedGym) {
      const gym = JSON.parse(storedGym);
      setSelectedGym(gym);
      setGymId(gym.id);
      fetchPlans(gym.id);
    } else {
      setLoading(false);
    }
  }, []);

  const fetchPlans = async (gymId) => {
    try {
      setLoading(true);

      const { data: plansData, error: plansError } = await supabase
        .from("membership_plans")
        .select("*")
        .eq("gym_id", gymId)
        .order("duration_days", { ascending: true });

      if (plansError) throw plansError;

      const { data: membershipsData, error: membershipsError } = await supabase
        .from("memberships")
        .select("plan_id")
        .eq("gym_id", gymId)
        .eq("status", "active");

      if (membershipsError) throw membershipsError;

      const memberCounts = membershipsData.reduce((acc, m) => {
        acc[m.plan_id] = (acc[m.plan_id] || 0) + 1;
        return acc;
      }, {});

      const plansWithCounts = plansData.map((plan) => ({
        id: plan.id,
        name: plan.name,
        duration: plan.duration_days,
        price: parseFloat(plan.price),
        active: plan.is_active,
        members: memberCounts[plan.id] || 0,
        created_at: plan.created_at,
        description: plan.description || "",
      }));

      setPlans(plansWithCounts);
    } catch (error) {
      console.error("Error fetching plans:", error);
      alert("Failed to load plans");
    } finally {
      setLoading(false);
    }
  };

  const filteredPlans = plans.filter(plan => {
    if (activeTab === "active") return plan.active;
    if (activeTab === "inactive") return !plan.active;
    return true;
  });

  const togglePlanStatus = async (id) => {
    try {
      const plan = plans.find((p) => p.id === id);
      const newStatus = !plan.active;

      const { error } = await supabase
        .from("membership_plans")
        .update({ is_active: newStatus })
        .eq("id", id);

      if (error) throw error;

      setPlans((prev) =>
        prev.map((p) => (p.id === id ? { ...p, active: newStatus } : p))
      );
    } catch (error) {
      console.error("Error toggling plan status:", error);
      alert("Failed to update plan status");
    }
  };

  const handleDeletePlan = async (id) => {
    const plan = plans.find((p) => p.id === id);
    if (plan.members > 0) {
      alert("Cannot delete a plan with active members");
      return;
    }

    if (!confirm(`Are you sure you want to delete "${plan.name}"?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from("membership_plans")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setPlans((prev) => prev.filter((p) => p.id !== id));
    } catch (error) {
      console.error("Error deleting plan:", error);
      alert("Failed to delete plan");
    }
  };

  const activePlans = plans.filter(p => p.active);
  const totalMembers = plans.reduce((sum, p) => sum + p.members, 0);
  const totalRevenue = plans.reduce((sum, p) => sum + (p.price * p.members), 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 safe-area-inset-bottom flex flex-col items-center justify-center">
        <div className="relative">
          <div className="w-14 h-14 border-4 border-[#f0813d]/20 border-t-[#9c4400] rounded-full animate-spin"></div>
          <div className="absolute inset-0 w-14 h-14 border-4 border-transparent border-t-[#f0813d] rounded-full animate-spin animation-delay-200"></div>
        </div>
        <p className="mt-6 text-gray-600 font-medium text-sm">Loading plans...</p>
      </div>
    );
  }

  if (!selectedGym) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 safe-area-inset-bottom">
        <Header title="Membership Plans" showBack={true} />
        <main className="px-4 py-4">
          <div className="text-center py-12">
            <div className="w-20 h-20 bg-gradient-to-br from-[#f0813d] to-[#9c4400] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <Tag className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">No Gym Selected</h2>
            <p className="text-gray-500 text-sm mb-6 px-4">
              Please select a gym to view and manage membership plans
            </p>
            <button
              onClick={() => router.push("/admin/dashboard")}
              className="px-6 py-3 bg-gradient-to-r from-[#f0813d] to-[#9c4400] text-white rounded-xl font-semibold text-sm active:scale-95 transition-transform"
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
      <Header title="Membership Plans" showBack={false} />

      <main className="px-3 py-3 space-y-4">
        {/* Back Button */}
        <button
          onClick={() => router.push("/settings")}
          className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl border border-gray-200 shadow-sm hover:bg-gray-50 active:scale-95 transition-all text-gray-700 font-medium text-sm"
          style={{ minHeight: '44px' }}
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Settings
        </button>

        {/* Stats Cards - Mobile Optimized */}
        <div className="grid grid-cols-2 gap-2 px-1">
          <div className="bg-white rounded-xl p-3 border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 font-medium">Active Plans</p>
                <p className="text-xl font-bold text-[#f0813d] mt-0.5">{activePlans.length}</p>
                <p className="text-xs text-gray-400 mt-1">of {plans.length} total</p>
              </div>
              <div className="w-10 h-10 bg-gradient-to-br from-[#f0813d]/10 to-[#f0813d]/15 rounded-lg flex items-center justify-center">
                <Zap className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-3 border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 font-medium">Total Members</p>
                <p className="text-xl font-bold text-[#f0813d] mt-0.5">{totalMembers}</p>
                <p className="text-xs text-gray-400 mt-1">across all plans</p>
              </div>
              <div className="w-10 h-10 bg-gradient-to-br from-[#f0813d]/10 to-[#f0813d]/15 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-3 border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 font-medium">Monthly Revenue</p>
                <p className="text-xl font-bold text-[#f0813d] mt-0.5">
                  ₹{totalRevenue.toLocaleString()}
                </p>
                <p className="text-xs text-gray-400 mt-1">estimated</p>
              </div>
              <div className="w-10 h-10 bg-gradient-to-br from-[#f0813d]/10 to-[#f0813d]/15 rounded-lg flex items-center justify-center">
                <IndianRupee className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-3 border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 font-medium">Avg. Price</p>
                <p className="text-xl font-bold text-[#f0813d] mt-0.5">
                  ₹{plans.length > 0 ? (plans.reduce((sum, p) => sum + p.price, 0) / plans.length).toFixed(0) : 0}
                </p>
                <p className="text-xs text-gray-400 mt-1">per plan</p>
              </div>
              <div className="w-10 h-10 bg-gradient-to-br from-[#f0813d]/10 to-[#f0813d]/15 rounded-lg flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>
        </div>

        {/* Add Plan Button */}
        <div className="bg-white rounded-xl p-3 mx-1 border border-gray-200 shadow-sm">
          {canCreateTrainer && (
            <button
              onClick={() => setShowAddModal(true)}
              className="w-full py-3 bg-gradient-to-r from-[#f0813d] to-[#9c4400] text-white font-medium rounded-lg hover:shadow-lg active:scale-95 transition-all duration-200 flex items-center justify-center gap-2"
              style={{ minHeight: '44px' }}
            >
              <Plus className="w-5 h-5" />
              Add New Plan
            </button>
          )}
        </div>

        {/* Filter Tabs - Horizontal Scroll on Mobile */}
        <div className="bg-white rounded-xl p-3 mx-1 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Filter by Status</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: "all", label: "All", count: plans.length },
              { id: "active", label: "Active", count: activePlans.length },
              { id: "inactive", label: "Inactive", count: plans.length - activePlans.length }
            ].map((filter) => (
              <button
                key={filter.id}
                onClick={() => setActiveTab(filter.id)}
                className={`py-2.5 rounded-lg text-xs font-medium transition-all duration-200 flex flex-col items-center justify-center ${
                  activeTab === filter.id
                    ? "bg-gradient-to-r from-[#f0813d] to-[#9c4400] text-white shadow-md"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
                style={{ minHeight: '64px' }}
              >
                <span>{filter.label}</span>
                <span className={`mt-1 px-2 py-0.5 text-xs rounded-full ${
                  activeTab === filter.id 
                    ? "bg-white/20" 
                    : "bg-white text-gray-600"
                }`}>
                  {filter.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Plans List */}
        <div className="space-y-3 pb-20">
          <div className="flex items-center justify-between px-2">
            <h3 className="font-semibold text-gray-900 text-sm">Plans List</h3>
            <span className="text-xs text-gray-500">
              {filteredPlans.length} {filteredPlans.length === 1 ? 'plan' : 'plans'} found
            </span>
          </div>
          
          {filteredPlans.length === 0 ? (
            <div className="bg-white rounded-xl p-6 text-center border border-gray-200 shadow-sm mx-1">
              <div className="w-16 h-16 bg-gradient-to-br from-gray-100 to-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Tag className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-base font-semibold text-gray-900 mb-2">
                {activeTab === "all" 
                  ? "No plans yet" 
                  : `No ${activeTab} plans available`}
              </h3>
              <p className="text-gray-500 text-sm mb-4">
                {activeTab === "all" 
                  ? "Create your first membership plan to get started" 
                  : `Try changing the filter to see other plans`}
              </p>
              {canCreateTrainer && (
                <button
                  onClick={() => setShowAddModal(true)}
                  className="px-6 py-3 bg-gradient-to-r from-[#f0813d] to-[#9c4400] text-white font-medium rounded-lg hover:shadow-lg active:scale-95 transition-all duration-200 flex items-center justify-center gap-2 mx-auto"
                  style={{ minHeight: '44px' }}
                >
                  <Plus className="w-5 h-5" />
                  Create First Plan
                </button>
              )}
            </div>
          ) : (
            filteredPlans.map((plan) => (
              <div
                key={plan.id}
                className="bg-white rounded-xl border border-gray-200 p-3 hover:shadow-md transition-all duration-200 mx-1"
              >
                <div className="flex items-start gap-3">
                  {/* Plan Icon */}
                  <div className="flex-shrink-0">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-sm ${
                      plan.active 
                        ? "bg-gradient-to-br from-[#f0813d] to-[#9c4400]" 
                        : "bg-gradient-to-br from-gray-400 to-gray-500"
                    }`}>
                      <Calendar className="w-6 h-6" />
                    </div>
                  </div>

                  {/* Plan Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-1">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-gray-900 text-sm truncate">
                            {plan.name}
                          </h3>
                          <div className={`px-2 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 ${
                            plan.active
                              ? "bg-gradient-to-br from-[#f0813d]/10 to-[#f0813d]/15 border-[#f0813d]/20 text-[#9c4400]"
                              : "bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200 text-gray-700"
                          }`}>
                            {plan.active ? (
                              <CheckCircle className="w-3.5 h-3.5" />
                            ) : (
                              <XCircle className="w-3.5 h-3.5" />
                            )}
                            <span>{plan.active ? "Active" : "Inactive"}</span>
                          </div>
                        </div>
                        {plan.description && (
                          <p className="text-gray-600 text-xs mt-1 line-clamp-2">
                            {plan.description}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-gray-900">₹{plan.price}</p>
                        <p className="text-xs text-gray-500">per plan</p>
                      </div>
                    </div>

                    {/* Plan Details */}
                    <div className="mt-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-[#f0813d]/10 rounded-lg flex items-center justify-center">
                          <Calendar className="w-3.5 h-3.5 text-white" />
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Duration</p>
                          <p className="text-sm font-medium text-gray-900">
                            {plan.duration} days ({Math.round(plan.duration/30)} months)
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-[#f0813d]/10 rounded-lg flex items-center justify-center">
                          <Users className="w-3.5 h-3.5 text-white" />
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Active Members</p>
                          <p className="text-sm font-medium text-gray-900">
                            {plan.members} members
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons - Horizontal Scroll on Mobile */}
                    <div className="flex space-x-2 overflow-x-auto mt-3 pt-3 border-t border-gray-100 pb-1 -mx-1 px-1 no-scrollbar">
                      {canCreateTrainer && (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingPlan(plan);
                            }}
                            className="flex-shrink-0 px-3 py-2 bg-[#f0813d]/10 text-[#9c4400] cursor-pointer text-xs font-medium rounded-lg active:bg-[#f0813d]/15 transition-all flex items-center gap-2"
                            style={{ minHeight: '36px' }}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            Edit
                          </button>
                          
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              togglePlanStatus(plan.id);
                            }}
                            className={`flex-shrink-0 px-3 py-2 text-xs font-medium rounded-lg active:scale-95 transition-all flex items-center gap-2 ${
                              plan.active
                                ? "bg-gradient-to-r from-[#f0813d] to-[#9c4400] text-white"
                                : "bg-gradient-to-r from-[#f0813d] to-[#9c4400] text-white"
                            }`}
                            style={{ minHeight: '36px' }}
                          >
                            {plan.active ? <XCircle className="w-3.5 h-3.5" /> : <CheckCircle className="w-3.5 h-3.5" />}
                            {plan.active ? "Deactivate" : "Activate"}
                          </button>
                          
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeletePlan(plan.id);
                            }}
                            disabled={plan.members > 0}
                            className={`flex-shrink-0 px-3 py-2 text-xs font-medium rounded-lg flex items-center gap-2 ${
                              plan.members > 0
                                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                : "bg-[#f0813d]/10 text-[#9c4400] hover:bg-[#f0813d]/15 active:bg-[#f0813d]/25 transition-all"
                            }`}
                            style={{ minHeight: '36px' }}
                            title={plan.members > 0 ? "Cannot delete plan with active members" : "Delete plan"}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </main>

      {/* Add/Edit Plan Modal */}
      {(showAddModal || editingPlan) && (
        <PlanModal
          plan={editingPlan}
          gymId={gymId}
          onClose={() => {
            setShowAddModal(false);
            setEditingPlan(null);
          }}
          onSave={() => {
            fetchPlans(gymId);
            setShowAddModal(false);
            setEditingPlan(null);
          }}
        />
      )}
    </div>
  );
}

// Enhanced Plan Modal Component
function PlanModal({ plan, gymId, onClose, onSave }) {
  const [formData, setFormData] = useState({
    name: plan?.name || "",
    duration: plan?.duration || "30",
    price: plan?.price || "",
    active: plan?.active ?? true,
    description: plan?.description || "",
  });
  const [saving, setSaving] = useState(false);
  const [durationUnit, setDurationUnit] = useState("days");

  const updateForm = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const calculateDays = (value, unit) => {
    if (unit === "months") return parseInt(value) * 30;
    if (unit === "weeks") return parseInt(value) * 7;
    return parseInt(value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name || !formData.duration || !formData.price) {
      alert("Please fill all required fields");
      return;
    }

    try {
      setSaving(true);
      
      const durationInDays = calculateDays(formData.duration, durationUnit);

      if (plan) {
        const { error } = await supabase
          .from("membership_plans")
          .update({
            name: formData.name,
            duration_days: durationInDays,
            price: parseFloat(formData.price),
            is_active: formData.active,
            description: formData.description,
            updated_at: new Date().toISOString(),
          })
          .eq("id", plan.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("membership_plans")
          .insert({
            gym_id: gymId,
            name: formData.name,
            duration_days: durationInDays,
            price: parseFloat(formData.price),
            is_active: formData.active,
            description: formData.description,
          });

        if (error) throw error;
      }

      onSave();
    } catch (error) {
      console.error("Error saving plan:", error);
      alert("Failed to save plan: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 mb-17">
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl max-h-[85vh] overflow-hidden shadow-2xl animate-slide-up">
        {/* Modal Header */}
        <div className="p-4 border-b border-gray-200 sticky top-0 bg-white z-10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900">
                {plan ? "Edit Plan" : "Create New Plan"}
              </h3>
              <p className="text-gray-500 text-xs mt-0.5">
                {plan ? "Update your membership plan details" : "Add a new membership plan to your gym"}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors active:scale-95"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto max-h-[60vh] p-4">
          <div className="space-y-4">
            {/* Plan Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Plan Name *
              </label>
              <input
                type="text"
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#f0813d]/20 focus:border-[#f0813d] outline-none transition-all text-sm"
                placeholder="e.g., Monthly Premium, Quarterly Basic"
                value={formData.name}
                onChange={(e) => updateForm("name", e.target.value)}
                required
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description (Optional)
              </label>
              <textarea
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#f0813d]/20 focus:border-[#f0813d] outline-none transition-all resize-none text-sm"
                placeholder="Describe the benefits and features of this plan..."
                rows={3}
                value={formData.description}
                onChange={(e) => updateForm("description", e.target.value)}
              />
            </div>

            {/* Duration and Price */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Duration *
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    className="flex-1 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#f0813d]/20 focus:border-[#f0813d] outline-none transition-all text-sm"
                    placeholder="30"
                    value={formData.duration}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '' || /^\d+$/.test(value)) {
                        updateForm("duration", value === '' ? '' : parseInt(value));
                      }
                    }}
                    required
                  />
                  <select
                    value={durationUnit}
                    onChange={(e) => setDurationUnit(e.target.value)}
                    className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#f0813d]/20 focus:border-[#f0813d] outline-none transition-all text-sm"
                  >
                    <option value="days">Days</option>
                    <option value="weeks">Weeks</option>
                    <option value="months">Months</option>
                  </select>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  {durationUnit === "days" && `${formData.duration} days`}
                  {durationUnit === "weeks" && `${formData.duration} weeks (${formData.duration * 7} days)`}
                  {durationUnit === "months" && `${formData.duration} months (${formData.duration * 30} days)`}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Price (₹) *
                </label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                    <IndianRupee className="w-4 h-4 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    inputMode="decimal"
                    pattern="[0-9]*\.?[0-9]*"
                    className="w-full pl-9 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#f0813d]/20 focus:border-[#f0813d] outline-none transition-all text-sm"
                    placeholder="1500"
                    value={formData.price}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '' || /^\d*\.?\d*$/.test(value)) {
                        updateForm("price", value === '' ? '' : parseFloat(value));
                      }
                    }}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Status Toggle */}
            <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-900 text-sm">Plan Status</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {formData.active 
                      ? "Available for new members" 
                      : "Hidden from new members"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => updateForm("active", !formData.active)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                    formData.active ? "bg-[#f0813d]" : "bg-gray-300"
                  }`}
                >
                  <span
                    className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                      formData.active ? "translate-x-5" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>
              <div className={`mt-3 p-2 rounded-md text-xs ${formData.active ? "bg-[#f0813d]/10 text-[#9c4400]" : "bg-gray-100 text-gray-800"}`}>
                <p className="font-medium">
                  {formData.active ? "✓ Active Plan" : "✗ Inactive Plan"}
                </p>
                <p className="mt-0.5">
                  {formData.active 
                    ? "Members can purchase this plan" 
                    : "Existing members remain active"}
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-6 border-t border-gray-200 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-gray-100 text-gray-700 font-medium rounded-lg active:scale-95 transition-all duration-200 text-sm"
              disabled={saving}
              style={{ minHeight: '44px' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-3 bg-gradient-to-r from-[#f0813d] to-[#9c4400] text-white font-medium rounded-lg hover:shadow-lg active:scale-95 transition-all duration-200 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={saving}
              style={{ minHeight: '44px' }}
            >
              {saving ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  {plan ? "Saving..." : "Creating..."}
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  {plan ? "Save Changes" : "Create Plan"}
                </span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
