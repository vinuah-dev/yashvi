"use client";

import { useAuthContext } from "@/contexts/AuthContext";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/layout/Header";
import { supabase } from "@/lib/supabaseClient";
import { useUserRole } from "@/lib/hooks/useUserRole";
import {
  User,
  Mail,
  Phone,
  Lock,
  Briefcase,
  FileText,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle,
  Eye,
  EyeOff,
  CalendarDays,
  Clock,
  Plus,
  X as XIcon
} from "lucide-react";
import {
  DAYS_OF_WEEK,
  ALL_TIME_SLOTS,
  buildTimeSlotsForDays
} from "@/lib/constants/trainerSchedule";

export default function AddTrainerPage() {
  const router = useRouter();
  const { canCreateTrainer, loading: roleLoading } = useUserRole();
  const { selectedGym, user } = useAuthContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    specialization: "",
    bio: "",
    monthlySalary: "",
    availableDays: [],
    availableTimeSlots: {}
  });

  const [errors, setErrors] = useState({});

  // Redirect if no gym selected
  useEffect(() => {
    if (!selectedGym) {
      router.push("/settings/trainers");
    }
  }, [selectedGym, router]);

  const validateForm = () => {
    const newErrors = {};

    if (!formData.firstName.trim()) {
      newErrors.firstName = "First name is required";
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = "Last name is required";
    }

    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(formData.email)) {
      newErrors.email = "Invalid email format (e.g., example@email.com)";
    }

    if (!formData.phone.trim()) {
      newErrors.phone = "Phone number is required";
    } else {
      const phoneDigits = formData.phone.replace(/\D/g, "");
      if (phoneDigits.length !== 10) {
        newErrors.phone = "Phone number must be exactly 10 digits";
      }
    }

    if (!formData.password) {
      newErrors.password = "Password is required";
    } else if (formData.password.length < 6) {
      newErrors.password = "Password must be at least 6 characters";
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    if (formData.monthlySalary.trim()) {
      const monthlySalary = Number(formData.monthlySalary);
      if (!Number.isFinite(monthlySalary) || monthlySalary < 0) {
        newErrors.monthlySalary = "Monthly salary must be a valid amount";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    if (!selectedGym?.id) {
      setError("No gym selected");
      return;
    }

    setLoading(true);
    setError("");

    try {
      let createdBy = user?.id || null;
      if (createdBy) {
        const { data: creatorProfile } = await supabase
          .from("profiles")
          .select("id")
          .eq("id", createdBy)
          .maybeSingle();

        createdBy = creatorProfile?.id || null;
      }

      const availableDays = formData.availableDays.length > 0 ? formData.availableDays : null;
      const availableTimeSlots = formData.availableDays.length > 0 ? formData.availableTimeSlots : null;

      // Single RPC call – profile + gym_trainers in one transaction
      const { data, error: rpcError } = await supabase.rpc("add_trainer_with_gym", {
        p_gym_id: selectedGym.id,
        p_first_name: formData.firstName.trim(),
        p_last_name: formData.lastName.trim(),
        p_email: formData.email.trim().toLowerCase(),
        p_phone: formData.phone.trim(),
        p_password: formData.password,
        p_specialization: formData.specialization.trim() || null,
        p_bio: formData.bio.trim() || null,
        p_monthly_salary: formData.monthlySalary.trim() ? Number(formData.monthlySalary) : null,
        p_created_by: createdBy || null,
        p_available_days: availableDays,
        p_available_time_slots: availableTimeSlots
      });

      if (rpcError) {
        // Parse structured errors from the RPC
        const msg = rpcError.message || "";
        if (msg.includes("DUPLICATE_EMAIL:")) {
          throw new Error(msg.split("DUPLICATE_EMAIL:")[1]);
        }
        if (msg.includes("DUPLICATE_PHONE:")) {
          throw new Error(msg.split("DUPLICATE_PHONE:")[1]);
        }
        throw new Error(msg || "Failed to add trainer");
      }

      setSuccess(true);
      setTimeout(() => {
        router.push("/settings/trainers");
      }, 1500);
    } catch (err) {
      console.error("Error creating trainer:", err);
      setError(err.message || "Failed to add trainer. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: "" }));
    }
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

  const specializations = [
    "Weight Training",
    "Cardio & HIIT",
    "CrossFit",
    "Yoga",
    "Pilates",
    "Functional Training",
    "Bodybuilding",
    "Strength & Conditioning",
    "Sports Training",
    "Rehabilitation",
    "Group Fitness",
    "Personal Training"
  ];

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 text-center max-w-sm w-full shadow-lg">
          <div className="w-16 h-16 bg-[#f0813d]/15 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Trainer Added!</h2>
          <p className="text-gray-500">Redirecting to trainers list...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Header title="Add Trainer" />

      <main className="px-4 py-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-[#f0813d]/10 border border-[#f0813d]/20 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-[#f0813d] flex-shrink-0 mt-0.5" />
              <p className="text-[#9c4400] text-sm">{error}</p>
            </div>
          )}

          {/* Personal Information */}
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-4">Personal Information</h3>
            
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  First Name *
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => handleChange("firstName", e.target.value)}
                    className={`w-full pl-10 pr-4 py-3 rounded-xl border ${
                      errors.firstName ? "border-[#f0813d]/30 bg-[#f0813d]/10" : "border-gray-200"
                    } focus:ring-2 focus:ring-[#f0813d]/20 focus:border-transparent`}
                    placeholder="First name"
                  />
                </div>
                {errors.firstName && (
                  <p className="text-[#f0813d] text-xs mt-1">{errors.firstName}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Last Name *
                </label>
                <input
                  type="text"
                  value={formData.lastName}
                  onChange={(e) => handleChange("lastName", e.target.value)}
                  className={`w-full px-4 py-3 rounded-xl border ${
                    errors.lastName ? "border-[#f0813d]/30 bg-[#f0813d]/10" : "border-gray-200"
                  } focus:ring-2 focus:ring-[#f0813d]/20 focus:border-transparent`}
                  placeholder="Last name"
                />
                {errors.lastName && (
                  <p className="text-[#f0813d] text-xs mt-1">{errors.lastName}</p>
                )}
              </div>
            </div>

            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Address *
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleChange("email", e.target.value)}
                  className={`w-full pl-10 pr-4 py-3 rounded-xl border ${
                    errors.email ? "border-[#f0813d]/30 bg-[#f0813d]/10" : "border-gray-200"
                  } focus:ring-2 focus:ring-[#f0813d]/20 focus:border-transparent`}
                  placeholder="trainer@email.com"
                />
              </div>
              {errors.email && (
                <p className="text-[#f0813d] text-xs mt-1">{errors.email}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number * <span className="text-gray-500 text-xs">(10 digits)</span>
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, "").slice(0, 10);
                    handleChange("phone", value);
                  }}
                  maxLength="10"
                  inputMode="numeric"
                  className={`w-full pl-10 pr-4 py-3 rounded-xl border ${
                    errors.phone ? "border-[#f0813d]/30 bg-[#f0813d]/10" : "border-gray-200"
                  } focus:ring-2 focus:ring-[#f0813d]/20 focus:border-transparent`}
                  placeholder="9876543210"
                />
              </div>
              <div className="flex items-center justify-between mt-1">
                <p className="text-gray-500 text-xs">Enter 10 digit mobile number</p>
                {formData.phone && (
                  <p className={`text-xs ${formData.phone.length === 10 ? "text-[#f0813d]" : "text-[#f0813d]"}`}>
                    {formData.phone.length}/10 digits
                  </p>
                )}
              </div>
              {errors.phone && (
                <p className="text-[#f0813d] text-xs mt-1">{errors.phone}</p>
              )}
            </div>
          </div>

          {/* Login Credentials */}
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-4">Login Credentials</h3>
            
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password *
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={(e) => handleChange("password", e.target.value)}
                  className={`w-full pl-10 pr-12 py-3 rounded-xl border ${
                    errors.password ? "border-[#f0813d]/30 bg-[#f0813d]/10" : "border-gray-200"
                  } focus:ring-2 focus:ring-[#f0813d]/20 focus:border-transparent`}
                  placeholder="Minimum 6 characters"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-[#f0813d] text-xs mt-1">{errors.password}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Confirm Password *
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={formData.confirmPassword}
                  onChange={(e) => handleChange("confirmPassword", e.target.value)}
                  className={`w-full pl-10 pr-4 py-3 rounded-xl border ${
                    errors.confirmPassword ? "border-[#f0813d]/30 bg-[#f0813d]/10" : "border-gray-200"
                  } focus:ring-2 focus:ring-[#f0813d]/20 focus:border-transparent`}
                  placeholder="Re-enter password"
                />
              </div>
              {errors.confirmPassword && (
                <p className="text-[#f0813d] text-xs mt-1">{errors.confirmPassword}</p>
              )}
            </div>
          </div>

          {/* Professional Details */}
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-4">Professional Details</h3>
            
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Specialization
              </label>
              <div className="relative">
                <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <select
                  value={formData.specialization}
                  onChange={(e) => handleChange("specialization", e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#f0813d]/20 focus:border-transparent appearance-none bg-white"
                >
                  <option value="">Select specialization</option>
                  {specializations.map((spec) => (
                    <option key={spec} value={spec}>{spec}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Bio / Description
              </label>
              <div className="relative">
                <FileText className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <textarea
                  value={formData.bio}
                  onChange={(e) => handleChange("bio", e.target.value)}
                  rows={3}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#f0813d]/20 focus:border-transparent resize-none"
                  placeholder="Brief description about the trainer..."
                />
              </div>
            </div>

            <div className="mt-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Monthly Salary
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium">₹</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={formData.monthlySalary}
                  onChange={(e) => handleChange("monthlySalary", e.target.value)}
                  className={`w-full pl-8 pr-4 py-3 rounded-xl border ${
                    errors.monthlySalary ? "border-[#f0813d]/30 bg-[#f0813d]/10" : "border-gray-200"
                  } focus:ring-2 focus:ring-[#f0813d]/20 focus:border-transparent`}
                  placeholder="25000"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">Used in monthly trainer payroll reports</p>
              {errors.monthlySalary && (
                <p className="text-[#f0813d] text-xs mt-1">{errors.monthlySalary}</p>
              )}
            </div>


          </div>

          {/* Availability Schedule */}
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <CalendarDays className="w-5 h-5 text-[#f0813d]" />
              <h3 className="font-semibold text-gray-900">Availability Schedule</h3>
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
            disabled={loading}
            className="w-full py-4 bg-gradient-to-r from-[#f0813d] to-[#9c4400] text-white rounded-xl font-semibold flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transition-shadow disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Creating Trainer...
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                Add Trainer
              </>
            )}
          </button>
        </form>
      </main>
    </div>
  );
}
