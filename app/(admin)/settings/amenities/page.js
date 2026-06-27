"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/layout/Header";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/contexts/ToastContext";
import {
  Plus,
  Edit2,
  Trash2,
  CheckCircle,
  XCircle,
  IndianRupee,
  Package,
  Loader2,
  X,
  AlertCircle,
  Users,
  Search,
} from "lucide-react";

export default function AmenitiesSettingsPage() {
  const router = useRouter();
  const { showSuccess, showError } = useToast();
  const [amenities, setAmenities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedGym, setSelectedGym] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingAmenity, setEditingAmenity] = useState(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  // Form state
  const [form, setForm] = useState({ name: "", description: "", cost: "" });

  useEffect(() => {
    const storedGym = localStorage.getItem("selectedGym");
    if (storedGym) {
      const gym = JSON.parse(storedGym);
      setSelectedGym(gym);
      fetchAmenities(gym.id);
    } else {
      setLoading(false);
    }
  }, []);

  const fetchAmenities = async (gymId) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("gym_amenities")
        .select("*")
        .eq("gym_id", gymId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Also get subscriber counts
      const { data: assignData } = await supabase
        .from("member_amenities")
        .select("amenity_id")
        .eq("gym_id", gymId)
        .eq("is_active", true);

      const counts = {};
      (assignData || []).forEach((a) => {
        counts[a.amenity_id] = (counts[a.amenity_id] || 0) + 1;
      });

      setAmenities(
        (data || []).map((a) => ({
          ...a,
          cost: parseFloat(a.cost),
          subscribers: counts[a.id] || 0,
        }))
      );
    } catch (err) {
      console.error("Error fetching amenities:", err);
      showError("Failed to load amenities");
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setEditingAmenity(null);
    setForm({ name: "", description: "", cost: "" });
    setShowModal(true);
  };

  const openEditModal = (amenity) => {
    setEditingAmenity(amenity);
    setForm({
      name: amenity.name,
      description: amenity.description || "",
      cost: amenity.cost.toString(),
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      showError("Please enter amenity name");
      return;
    }
    if (!form.cost || parseFloat(form.cost) < 0) {
      showError("Please enter a valid cost");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        gym_id: selectedGym.id,
        name: form.name.trim(),
        description: form.description.trim() || null,
        cost: parseFloat(form.cost),
        updated_at: new Date().toISOString(),
      };

      if (editingAmenity) {
        const { error } = await supabase
          .from("gym_amenities")
          .update(payload)
          .eq("id", editingAmenity.id);
        if (error) throw error;
        showSuccess("Amenity updated");
      } else {
        const { error } = await supabase.from("gym_amenities").insert(payload);
        if (error) throw error;
        showSuccess("Amenity created");
      }

      setShowModal(false);
      fetchAmenities(selectedGym.id);
    } catch (err) {
      console.error("Error saving amenity:", err);
      showError("Failed to save amenity");
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (amenity) => {
    try {
      const { error } = await supabase
        .from("gym_amenities")
        .update({
          is_active: !amenity.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq("id", amenity.id);
      if (error) throw error;
      setAmenities((prev) =>
        prev.map((a) =>
          a.id === amenity.id ? { ...a, is_active: !a.is_active } : a
        )
      );
      showSuccess(amenity.is_active ? "Amenity deactivated" : "Amenity activated");
    } catch (err) {
      console.error("Error toggling amenity:", err);
      showError("Failed to update status");
    }
  };

  const handleDelete = async (amenity) => {
    if (amenity.subscribers > 0) {
      showError("Cannot delete amenity with active members. Deactivate it instead.");
      return;
    }
    if (!confirm(`Delete "${amenity.name}"?`)) return;

    try {
      const { error } = await supabase
        .from("gym_amenities")
        .delete()
        .eq("id", amenity.id);
      if (error) throw error;
      setAmenities((prev) => prev.filter((a) => a.id !== amenity.id));
      showSuccess("Amenity deleted");
    } catch (err) {
      console.error("Error deleting amenity:", err);
      showError("Failed to delete amenity");
    }
  };

  const filtered = amenities.filter((a) =>
    a.name.toLowerCase().includes(search.toLowerCase())
  );

  const activeCount = amenities.filter((a) => a.is_active).length;

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Header title="Gym Amenities" />

      <main className="px-4 py-4 space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white rounded-xl p-3 shadow-sm text-center">
            <Package className="w-5 h-5 text-[#f0813d] mx-auto mb-1" />
            <p className="text-xl font-bold text-gray-900">{amenities.length}</p>
            <p className="text-[10px] text-gray-500">Total</p>
          </div>
          <div className="bg-white rounded-xl p-3 shadow-sm text-center">
            <CheckCircle className="w-5 h-5 text-[#f0813d] mx-auto mb-1" />
            <p className="text-xl font-bold text-gray-900">{activeCount}</p>
            <p className="text-[10px] text-gray-500">Active</p>
          </div>
          <div className="bg-white rounded-xl p-3 shadow-sm text-center">
            <Users className="w-5 h-5 text-[#f0813d] mx-auto mb-1" />
            <p className="text-xl font-bold text-gray-900">
              {amenities.reduce((sum, a) => sum + a.subscribers, 0)}
            </p>
            <p className="text-[10px] text-gray-500">Assigned</p>
          </div>
        </div>

        {/* Search + Add */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search amenities..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#f0813d]/20 focus:border-transparent outline-none"
            />
          </div>
          <button
            onClick={openAddModal}
            className="px-4 py-2.5 bg-gradient-to-r from-[#f0813d] to-[#9c4400] text-white rounded-xl font-medium hover:shadow-lg transition-all duration-200 active:scale-95 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add
          </button>
        </div>

        {/* Amenities List */}
        {loading ? (
          <div className="bg-white rounded-xl p-12 shadow-sm text-center">
            <Loader2 className="w-8 h-8 text-[#f0813d] animate-spin mx-auto" />
            <p className="text-gray-500 text-sm mt-3">Loading amenities...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl p-12 shadow-sm text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-[#f0813d]/10 to-[#f0813d]/15 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Package className="w-8 h-8 text-white" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-1">
              {search ? "No results" : "No Amenities Yet"}
            </h3>
            <p className="text-gray-500 text-sm">
              {search
                ? "Try a different search"
                : "Create amenities like Locker, Towel, Parking, etc."}
            </p>
            {!search && (
              <button
                onClick={openAddModal}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-[#9c4400] text-white rounded-lg text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Create Amenity
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((amenity) => (
              <div
                key={amenity.id}
                className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:shadow-md transition-all"
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-11 h-11 rounded-xl flex items-center justify-center text-white shadow-sm flex-shrink-0 ${
                      amenity.is_active
                        ? "bg-gradient-to-br from-[#f0813d] to-[#9c4400]"
                        : "bg-gradient-to-br from-gray-400 to-gray-500"
                    }`}
                  >
                    <Package className="w-5 h-5" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-semibold text-gray-900 text-sm truncate">
                        {amenity.name}
                      </h4>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1 ${
                          amenity.is_active
                            ? "bg-[#f0813d]/10 text-[#9c4400]"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {amenity.is_active ? (
                          <CheckCircle className="w-3 h-3" />
                        ) : (
                          <XCircle className="w-3 h-3" />
                        )}
                        {amenity.is_active ? "Active" : "Inactive"}
                      </span>
                    </div>
                    {amenity.description && (
                      <p className="text-gray-500 text-xs mt-0.5 line-clamp-1">
                        {amenity.description}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500">
                      <span className="flex items-center gap-1 font-semibold text-[#9c4400]">
                        <IndianRupee className="w-3 h-3" />
                        ₹{amenity.cost.toLocaleString("en-IN")}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {amenity.subscribers} member{amenity.subscribers !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => openEditModal(amenity)}
                      className="p-2 hover:bg-[#f0813d]/10 rounded-lg text-[#f0813d] transition-colors"
                      title="Edit"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => toggleStatus(amenity)}
                      className={`p-2 rounded-lg transition-colors ${
                        amenity.is_active
                          ? "hover:bg-[#f0813d]/10 text-[#f0813d]"
                          : "hover:bg-[#f0813d]/10 text-[#f0813d]"
                      }`}
                      title={amenity.is_active ? "Deactivate" : "Activate"}
                    >
                      {amenity.is_active ? (
                        <XCircle className="w-4 h-4" />
                      ) : (
                        <CheckCircle className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={() => handleDelete(amenity)}
                      className="p-2 hover:bg-[#f0813d]/10 rounded-lg text-[#f0813d] transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => !saving && setShowModal(false)}
          />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden animate-slideUp">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-[#f0813d] to-[#9c4400] p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  <Package className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">
                    {editingAmenity ? "Edit Amenity" : "Add Amenity"}
                  </h2>
                  <p className="text-white/75 text-sm opacity-90">
                    {editingAmenity ? "Update amenity details" : "Create a new gym amenity"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => !saving && setShowModal(false)}
                className="p-2 hover:bg-white/20 rounded-full transition-all"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Amenity Name *
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g., Locker, Towel, Parking"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#f0813d]/20 focus:border-transparent outline-none text-sm"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  placeholder="Optional description"
                  rows={2}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#f0813d]/20 focus:border-transparent outline-none text-sm resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cost (₹) *
                </label>
                <div className="relative">
                  <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    inputMode="decimal"
                    pattern="[0-9]*\.?[0-9]*"
                    value={form.cost}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === "" || /^\d*\.?\d*$/.test(value)) {
                        setForm({ ...form, cost: value });
                      }
                    }}
                    placeholder="0"
                    className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#f0813d]/20 focus:border-transparent outline-none text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-5 pb-5 flex gap-3">
              <button
                onClick={() => !saving && setShowModal(false)}
                disabled={saving}
                className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-all active:scale-[0.98] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-[#f0813d] to-[#9c4400] text-white rounded-xl font-medium hover:shadow-lg transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    {editingAmenity ? "Update" : "Create"}
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
