"use client";

import { useAuthContext } from "@/contexts/AuthContext";
import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/layout/Header";
import { supabase } from "@/lib/supabaseClient";
import {
  User,
  Mail,
  Phone,
  Calendar,
  Save,
  ArrowLeft,
  Key,
  Eye,
  EyeOff,
  Briefcase,
  FileText,
  AlertCircle,
  IndianRupee,
  CalendarDays,
  Clock
} from "lucide-react";
import {
  DAYS_OF_WEEK,
  ALL_TIME_SLOTS,
  buildTimeSlotsForDays
} from "@/lib/constants/trainerSchedule";

const SPECIALIZATIONS = [
  "Weight Training",
  "Cardio",
  "CrossFit",
  "Yoga",
  "Pilates",
  "HIIT",
  "Bodybuilding",
  "Functional Training",
  "Strength & Conditioning",
  "Nutrition",
  "Rehabilitation",
  "Sports Training"
];

export default function EditTrainerPage({ params }) {
  const router = useRouter();
  const { id } = use(params);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { selectedGym } = useAuthContext();
  const [error, setError] = useState(null);
  
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
    specialization: [],
    bio: "",
    monthlySalary: "",
    hireDate: "",
    isActive: true
  });

  // gym now comes from AuthContext


  useEffect(() => {
    if (id && selectedGym?.id) {
      fetchTrainerDetails();
    }
  }, [id, selectedGym?.id]);

  const fetchTrainerDetails = async () => {
    setLoading(true);
    try {
      const { data: trainerData, error: trainerError } = await supabase
        .from("gym_trainers")
        .select(`
          id,
          profile_id,
          specialization,
          bio,
          monthly_salary,
          is_active,
          hire_date,
          profiles:profile_id (
            id,
            first_name,
            last_name,
            email,
            phone,
            password,
            trainer_cost,
            available_days,
            available_time_slots
          )
        `)
        .eq("id", id)
        .eq("gym_id", selectedGym.id)
        .single();

      if (trainerError) throw trainerError;

      setFormData({
        firstName: trainerData.profiles?.first_name || "",
        lastName: trainerData.profiles?.last_name || "",
        email: trainerData.profiles?.email || "",
        phone: trainerData.profiles?.phone || "",
        password: trainerData.profiles?.password || "",
        specialization: trainerData.specialization || [],
        bio: trainerData.bio || "",
        monthlySalary: trainerData.monthly_salary ?? "",
        hireDate: trainerData.hire_date || "",
        isActive: trainerData.is_active ?? true,
        profileId: trainerData.profile_id,
        availableDays: trainerData.profiles?.available_days || [],
        availableTimeSlots: trainerData.profiles?.available_time_slots || {}
      });
    } catch (err) {
      console.error("Error fetching trainer:", err);
      setError("Failed to load trainer details");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value
    }));
  };

  const toggleSpecialization = (spec) => {
    setFormData(prev => ({
      ...prev,
      specialization: prev.specialization.includes(spec)
        ? prev.specialization.filter(s => s !== spec)
        : [...prev.specialization, spec]
    }));
  };

  const toggleDay = (day) => {
    setFormData(prev => {
      const newDays = prev.availableDays.includes(day)
        ? prev.availableDays.filter(d => d !== day)
        : [...prev.availableDays, day];
      const newSlots = buildTimeSlotsForDays(newDays, prev.availableTimeSlots);
      return { ...prev, availableDays: newDays, availableTimeSlots: newSlots };
    });
  };

  const toggleTimeSlot = (day, slot) => {
    setFormData(prev => {
      const daySlots = prev.availableTimeSlots[day] || [];
      const updated = daySlots.includes(slot)
        ? daySlots.filter(s => s !== slot)
        : [...daySlots, slot];
      return {
        ...prev,
        availableTimeSlots: { ...prev.availableTimeSlots, [day]: updated }
      };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      // Validate required fields
      if (!formData.firstName.trim()) {
        throw new Error("First name is required");
      }
      
      // Validate email format if provided
      if (formData.email.trim()) {
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        if (!emailRegex.test(formData.email)) {
          throw new Error("Invalid email format (e.g., example@email.com)");
        }
      }
      
      // Validate phone - must be exactly 10 digits if provided
      if (formData.phone.trim()) {
        const phoneDigits = formData.phone.replace(/\D/g, "");
        if (phoneDigits.length !== 10) {
          throw new Error("Phone number must be exactly 10 digits");
        }
      }
      
      if (!formData.email.trim() && !formData.phone.trim()) {
        throw new Error("Either email or phone is required");
      }
      if (!formData.password.trim()) {
        throw new Error("Password is required");
      }

      if (formData.monthlySalary !== "") {
        const monthlySalary = Number(formData.monthlySalary);
        if (!Number.isFinite(monthlySalary) || monthlySalary < 0) {
          throw new Error("Monthly salary must be a valid amount");
        }
      }

      // Update profile with credentials_updated_at to force trainer logout
      const availableDays = formData.availableDays.length > 0 ? formData.availableDays : null;
      const availableTimeSlots = formData.availableDays.length > 0 ? formData.availableTimeSlots : null;

      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          first_name: formData.firstName.trim(),
          last_name: formData.lastName.trim(),
          email: formData.email.trim() || null,
          phone: formData.phone.trim() || null,
          password: formData.password.trim(),
          credentials_updated_at: new Date().toISOString(),
          available_days: availableDays,
          available_time_slots: availableTimeSlots
        })
        .eq("id", formData.profileId);

      if (profileError) throw profileError;

      // Update gym_trainers
      const { error: trainerError } = await supabase
        .from("gym_trainers")
        .update({
          specialization: formData.specialization.length > 0 ? formData.specialization : null,
          bio: formData.bio.trim() || null,
          monthly_salary: formData.monthlySalary === "" ? null : Number(formData.monthlySalary),
          hire_date: formData.hireDate || null,
          is_active: formData.isActive
        })
        .eq("id", id);

      if (trainerError) throw trainerError;

      router.push(`/settings/trainers/${id}`);
    } catch (err) {
      console.error("Error updating trainer:", err);
      setError(err.message || "Failed to update trainer");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 pb-24">
        <Header title="Edit Trainer" />
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#9c4400]"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Header title="Edit Trainer" />

      <form onSubmit={handleSubmit} className="px-4 py-4 space-y-4">
        {error && (
          <div className="p-4 bg-[#f0813d]/10 border border-[#f0813d]/20 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-[#f0813d] flex-shrink-0 mt-0.5" />
            <p className="text-sm text-[#9c4400]">{error}</p>
          </div>
        )}

        {/* Personal Information */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <User className="w-5 h-5 text-[#f0813d]" />
            <h2 className="font-semibold text-gray-900">Personal Information</h2>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  First Name *
                </label>
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#f0813d]/20 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Last Name
                </label>
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#f0813d]/20 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Hire Date
              </label>
              <input
                type="date"
                name="hireDate"
                value={formData.hireDate}
                onChange={handleChange}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#f0813d]/20 focus:border-transparent"
              />
            </div>

            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
              <input
                type="checkbox"
                id="isActive"
                name="isActive"
                checked={formData.isActive}
                onChange={handleChange}
                className="w-4 h-4 rounded text-[#f0813d] focus:ring-[#f0813d]/20"
              />
              <label htmlFor="isActive" className="text-sm text-gray-700">
                Trainer is active
              </label>
            </div>
          </div>
        </div>

        {/* Login Credentials */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Key className="w-5 h-5 text-[#f0813d]" />
            <h2 className="font-semibold text-gray-900">Login Credentials</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#f0813d]/20 focus:border-transparent"
                  placeholder="trainer@example.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className="w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#f0813d]/20 focus:border-transparent"
                  placeholder="9876543210"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password *
              </label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#f0813d]/20 focus:border-transparent"
                  placeholder="Enter password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Specialization */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Briefcase className="w-5 h-5 text-[#f0813d]" />
            <h2 className="font-semibold text-gray-900">Specialization</h2>
          </div>

          <div className="flex flex-wrap gap-2">
            {SPECIALIZATIONS.map((spec) => (
              <button
                key={spec}
                type="button"
                onClick={() => toggleSpecialization(spec)}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  formData.specialization.includes(spec)
                    ? "bg-[#9c4400] text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {spec}
              </button>
            ))}
          </div>
        </div>

        {/* Bio */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-5 h-5 text-[#f0813d]" />
            <h2 className="font-semibold text-gray-900">Bio</h2>
          </div>

          <textarea
            name="bio"
            value={formData.bio}
            onChange={handleChange}
            rows={4}
            placeholder="Brief description about the trainer..."
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#f0813d]/20 focus:border-transparent resize-none"
          />
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <IndianRupee className="w-5 h-5 text-[#f0813d]" />
            <h2 className="font-semibold text-gray-900">Payroll</h2>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Monthly Salary
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium">₹</span>
              <input
                type="number"
                min="0"
                step="1"
                name="monthlySalary"
                value={formData.monthlySalary}
                onChange={handleChange}
                className="w-full pl-8 pr-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#f0813d]/20 focus:border-transparent"
                placeholder="25000"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">Used to calculate attendance-based salary earned every month.</p>
          </div>
        </div>

        {/* Availability Schedule */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <CalendarDays className="w-5 h-5 text-[#f0813d]" />
            <h2 className="font-semibold text-gray-900">Availability Schedule</h2>
          </div>

          {/* Day Selection */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Available Days
            </label>
            <div className="flex flex-wrap gap-2">
              {DAYS_OF_WEEK.map((day) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(day)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    formData.availableDays.includes(day)
                      ? "bg-[#9c4400] text-white shadow-sm"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {day.slice(0, 3)}
                </button>
              ))}
            </div>
          </div>

          {/* Time Slots Per Day */}
          {formData.availableDays.length > 0 && (
            <div className="space-y-4">
              <label className="block text-sm font-medium text-gray-700">
                <Clock className="inline w-4 h-4 mr-1 text-gray-400" />
                Time Slots (select per day)
              </label>
              {formData.availableDays.map((day) => (
                <div key={day} className="border border-gray-100 rounded-xl p-3">
                  <h4 className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
                    <CalendarDays className="w-4 h-4 text-[#f0813d]" />
                    {day}
                    <span className="text-xs text-gray-500 font-normal">
                      ({(formData.availableTimeSlots[day] || []).length} slots)
                    </span>
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {ALL_TIME_SLOTS.map((slot) => {
                      const isSelected = (formData.availableTimeSlots[day] || []).includes(slot);
                      return (
                        <button
                          key={slot}
                          type="button"
                          onClick={() => toggleTimeSlot(day, slot)}
                          className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                            isSelected
                              ? "bg-[#9c4400] text-white"
                              : "bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200"
                          }`}
                        >
                          {slot}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={saving}
          className="w-full py-3 bg-[#9c4400] text-white rounded-xl font-medium hover:bg-[#9c4400] transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {saving ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-5 h-5" />
              Save Changes
            </>
          )}
        </button>
      </form>
    </div>
  );
}
