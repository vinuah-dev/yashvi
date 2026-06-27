"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/layout/Header";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/contexts/ToastContext";
import { useUserRole } from "@/lib/hooks/useUserRole";
import {
  Plus,
  X,
  Building,
  Bell,
  ChevronRight,
  Dumbbell,
  Package,
} from "lucide-react";
import { compressMemberImage, fileToDataUrl, validateMemberImage } from "@/lib/utils/memberImageUpload";

const TRAINER_IMAGE = "https://tse4.mm.bing.net/th/id/OIP.9JOpiI5vM2oeFguZ6WXhPQHaF4?r=0&cb=thfvnextfalcon&w=872&h=693&rs=1&pid=ImgDetMain&o=7&rm=3";
const AMENITIES_IMAGE = "https://tse4.mm.bing.net/th/id/OIP.K28hjULOuNukcO4HB2VA-wHaE8?r=0&cb=thfvnextfalcon&rs=1&pid=ImgDetMain&o=7&rm=3";

export default function GymSettingsPage() {
  const router = useRouter();
  const { showSuccess, showError } = useToast();
  const { canCreateTrainer, isLoading: roleLoading, user } = useUserRole();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [gymId, setGymId] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    address: "",
    phone: "",
    email: "",
    website: "",
    logoUrl: "",
    newLogoBase64: null,
    weekdayMorningStart: "06:00",
    weekdayMorningEnd: "12:00",
    weekdayEveningStart: "16:00",
    weekdayEveningEnd: "22:00",
    weekendMorningStart: "06:00",
    weekendMorningEnd: "12:00",
    weekendEveningStart: "16:00",
    weekendEveningEnd: "22:00",
    sundayOff: false,
    qrEnabled: true,
    qrType: "dynamic",
  });

  const managementCards = [
    {
      title: "Personal Trainers",
      description: "Add trainers, salary, assignments, attendance and payroll.",
      href: "/settings/trainers",
      image: TRAINER_IMAGE,
      icon: Dumbbell,
    },
    {
      title: "Gym Amenities",
      description: "Create paid amenities, update pricing and manage active status.",
      href: "/settings/amenities",
      image: AMENITIES_IMAGE,
      icon: Package,
    },
    {
      title: "Notifications",
      description: "Control WhatsApp, SMS, push, attendance and payment alerts.",
      href: "/settings/notifications",
      image: null,
      icon: Bell,
    },
  ];

  // Redirect only roles that cannot manage gym settings.
  useEffect(() => {
    if (roleLoading) return;

    const storedUser = localStorage.getItem("gymUser");
    let localUser = null;
    if (storedUser) {
      try {
        localUser = JSON.parse(storedUser);
      } catch (error) {
        console.warn("Could not parse stored gym user", error);
      }
    }
    const role = user?.role || localUser?.role;
    const canManageGym = canCreateTrainer || role === "admin" || role === "superadmin";

    if (!canManageGym) {
      router.push("/admin/dashboard");
    }
  }, [canCreateTrainer, roleLoading, router, user?.role]);

  useEffect(() => {
    fetchGymData();
  }, []);

  const fetchGymData = async () => {
    try {
      setFetching(true);
      console.log("[GymSettings] fetchGymData: start");
      
      // Get gym ID from localStorage
      const storedGym = localStorage.getItem("selectedGym");
      console.log("[GymSettings] localStorage.selectedGym:", storedGym);
      if (!storedGym) {
        console.log("[GymSettings] No gym selected in localStorage");
        console.error("No gym selected");
        router.push("/admin/dashboard");
        return;
      }

      const gym = JSON.parse(storedGym);
      console.log("[GymSettings] Parsed gym:", gym);
      setGymId(gym.id);

      // Fetch gym data from database
      const { data: gymData, error } = await supabase
        .from("gyms")
        .select("*")
        .eq("id", gym.id)
        .single();

      if (error) {
        console.error("[GymSettings] supabase fetch error:", error);
        throw error;
      }

      if (gymData) {
        console.log("[GymSettings] Fetched gymData:", gymData);
        setFormData({
          name: gymData.name || "",
          address: gymData.address || "",
          phone: gymData.phone || "",
          email: gymData.email || "",
          website: gymData.website || "",
          logoUrl: gymData.logo_url || "",
          newLogoBase64: null,
          weekdayMorningStart: gymData.weekday_morning_start || "06:00",
          weekdayMorningEnd: gymData.weekday_morning_end || "12:00",
          weekdayEveningStart: gymData.weekday_evening_start || "16:00",
          weekdayEveningEnd: gymData.weekday_evening_end || "22:00",
          weekendMorningStart: gymData.weekend_morning_start || "06:00",
          weekendMorningEnd: gymData.weekend_morning_end || "12:00",
          weekendEveningStart: gymData.weekend_evening_start || "16:00",
          weekendEveningEnd: gymData.weekend_evening_end || "22:00",
          sundayOff: gymData.sunday_off || false,
          qrEnabled: gymData.qr_enabled !== null ? gymData.qr_enabled : true,
          qrType: gymData.qr_type || "dynamic",
        });
      }
    } catch (error) {
      console.error("[GymSettings] Error fetching gym data:", error);
      showError("Failed to load gym settings");
    } finally {
      console.log("[GymSettings] fetchGymData: end");
      setFetching(false);
    }
  };

  const updateForm = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!gymId) return;
    console.log("[GymSettings] handleSubmit: start", { gymId, formData });

    // Validate phone number if provided
    if (formData.phone && formData.phone.trim() !== '') {
      const phoneDigits = formData.phone.replace(/\D/g, '');
      if (phoneDigits.length !== 10) {
        showError("Please enter a valid 10-digit phone number");
        return;
      }
    }

    // Validate email format if provided
    if (formData.email && formData.email.trim() !== '') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        showError("Please enter a valid email address");
        return;
      }
    }

    setLoading(true);
    try {
      // Check if gym name already exists (excluding current gym)
      const { data: existingGym, error: checkError } = await supabase
        .from("gyms")
        .select("id, name")
        .eq("name", formData.name.trim())
        .neq("id", gymId)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        // PGRST116 means no rows found, which is what we want
        throw checkError;
      }

      if (existingGym) {
        showError("Gym name already exists. Please choose a different name.");
        setLoading(false);
        return;
      }
      // Get current user for updated_by
      const storedUser = localStorage.getItem("gymUser");
      const user = storedUser ? JSON.parse(storedUser) : null;
      console.log("[GymSettings] current user:", user);

      // Clean phone number (remove non-digits)
      const cleanPhone = formData.phone ? formData.phone.replace(/\D/g, '') : null;
      console.log("[GymSettings] cleanPhone:", cleanPhone);

      let finalLogoUrl = formData.logoUrl;
      
      if (formData.newLogoBase64) {
        try {
          const response = await fetch(formData.newLogoBase64);
          const blob = await response.blob();
          const fileExt = blob.type.split('/')[1] || 'png';
          const fileName = `gym-logo-${gymId}-${Date.now()}.${fileExt}`;
          const filePath = `gyms/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from("member-images")
            .upload(filePath, blob, { cacheControl: "3600", upsert: true });

          if (uploadError) {
            console.error("Logo upload error:", uploadError);
            showError("Failed to upload gym logo");
          } else {
            const { data: urlData } = supabase.storage
              .from("member-images")
              .getPublicUrl(filePath);
            finalLogoUrl = urlData.publicUrl;
          }
        } catch (imgError) {
          console.error("Error processing logo image:", imgError);
        }
      }

      const updatePayload = {
        name: formData.name,
        address: formData.address,
        phone: cleanPhone || null,
        email: formData.email?.trim() || null,
        website: formData.website?.trim() || null,
        logo_url: finalLogoUrl || null,
        weekday_morning_start: formData.weekdayMorningStart,
        weekday_morning_end: formData.weekdayMorningEnd,
        weekday_evening_start: formData.weekdayEveningStart,
        weekday_evening_end: formData.weekdayEveningEnd,
        weekend_morning_start: formData.weekendMorningStart,
        weekend_morning_end: formData.weekendMorningEnd,
        weekend_evening_start: formData.weekendEveningStart,
        weekend_evening_end: formData.weekendEveningEnd,
        sunday_off: formData.sundayOff,
        qr_enabled: formData.qrEnabled,
        qr_type: formData.qrType,
        updated_by: user?.id || null,
      };
      console.log("[GymSettings] update payload:", updatePayload);

      const { error } = await supabase
        .from("gyms")
        .update(updatePayload)
        .eq("id", gymId);

      if (error) {
        console.error("[GymSettings] supabase update error:", error);
        throw error;
      }
      console.log("[GymSettings] update success for gym:", gymId);

      // Update localStorage with new gym name
      const storedGym = localStorage.getItem("selectedGym");
      if (storedGym) {
        const gym = JSON.parse(storedGym);
        gym.name = formData.name;
        gym.logo_url = finalLogoUrl;
        localStorage.setItem("selectedGym", JSON.stringify(gym));
        console.log("[GymSettings] localStorage.selectedGym updated:", gym);
      }

      showSuccess("Settings saved successfully!");
    } catch (error) {
      console.error("[GymSettings] Error saving gym settings:", error);
      showError("Failed to save settings. Please try again.");
    } finally {
      console.log("[GymSettings] handleSubmit: end");
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="min-h-screen bg-gray-50 pb-24">
        <Header title="Gym Settings" showBack={true} />
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#f0813d]"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Header title="Gym Settings" showBack={true} />

      <form onSubmit={handleSubmit} className="px-4 py-4 space-y-4">
        <section className="relative overflow-hidden rounded-2xl border border-[#f0813d]/20 bg-[#1a1c1c] p-5 shadow-xl">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(240,129,61,0.38),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.08),transparent_46%)]" />
          <div className="relative">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <p className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-white/60">
                  Gym control center
                </p>
                <h2 className="max-w-[16rem] text-2xl font-black leading-tight text-white">
                  Update gym profile, services and member alerts.
                </h2>
              </div>
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-[#1a1c1c] shadow-lg">
                <Building className="h-6 w-6" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {managementCards.map((card) => {
                const Icon = card.icon;
                return (
                  <button
                    key={card.title}
                    type="button"
                    onClick={() => router.push(card.href)}
                    className="group overflow-hidden rounded-xl border border-white/15 bg-white/10 text-left backdrop-blur active:scale-95"
                  >
                    {card.image ? (
                      <img
                        src={card.image}
                        alt={card.title}
                        className="h-16 w-full object-cover opacity-85 transition group-hover:opacity-100"
                      />
                    ) : (
                      <div className="flex h-16 w-full items-center justify-center bg-gradient-to-br from-[#f0813d] to-[#9c4400]">
                        <Icon className="h-7 w-7 text-white" />
                      </div>
                    )}
                    <div className="p-2">
                      <p className="truncate text-[11px] font-black text-white">{card.title}</p>
                      <div className="mt-1 flex items-center text-[10px] font-bold text-white/65">
                        Open
                        <ChevronRight className="ml-0.5 h-3 w-3" />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black text-gray-900">Quick Management</h3>
              <p className="text-xs font-medium text-gray-500">
                Trainer, amenity and notification functions are available here too.
              </p>
            </div>
          </div>
          <div className="space-y-3">
            {managementCards.map((card) => {
              const Icon = card.icon;
              return (
                <button
                  key={card.href}
                  type="button"
                  onClick={() => router.push(card.href)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-gray-200 bg-white p-3 text-left shadow-sm transition hover:border-[#f0813d]/30 hover:shadow-lg active:scale-95"
                >
                  <div className="relative h-14 w-16 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-[#f0813d] to-[#9c4400]">
                    {card.image ? (
                      <img
                        src={card.image}
                        alt={card.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Icon className="h-6 w-6 text-white" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-[#f0813d]" />
                      <p className="truncate text-sm font-black text-gray-900">{card.title}</p>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs font-medium text-gray-500">
                      {card.description}
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-gray-400" />
                </button>
              );
            })}
          </div>
        </section>

        {/* Basic Info */}
        <div className="bg-white rounded-xl p-4 shadow-sm space-y-4">
          <h3 className="font-semibold text-gray-900">Basic Information</h3>
          
          <div className="flex flex-col items-center py-4 border-b border-gray-100">
            <div className="mb-3">
              <div className="relative group">
                <div className="w-24 h-24 rounded-2xl overflow-hidden bg-gradient-to-br from-[#f0813d] to-[#9c4400] flex items-center justify-center text-white font-bold shadow-lg">
                  {(formData.newLogoBase64 || formData.logoUrl) ? (
                    <img
                      src={formData.newLogoBase64 || formData.logoUrl}
                      alt="Gym Logo Preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Building className="w-10 h-10" />
                  )}
                </div>
                <label htmlFor="logo-upload" className="absolute -bottom-2 -right-2 w-8 h-8 bg-white rounded-full shadow-lg border border-gray-200 flex items-center justify-center cursor-pointer hover:bg-gray-50 active:scale-95 transition-all group">
                  <Plus className="w-4 h-4 text-[#f0813d]" />
                  <input
                    id="logo-upload"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;

                      const validationError = validateMemberImage(file);
                      if (validationError) {
                        showError(validationError);
                        e.target.value = "";
                        return;
                      }

                      try {
                        const compressedFile = await compressMemberImage(file);
                        const previewDataUrl = await fileToDataUrl(compressedFile);
                        updateForm("newLogoBase64", previewDataUrl);
                      } catch (error) {
                        console.error("Error compressing gym logo:", error);
                        showError("Could not compress logo. Please try another photo.");
                      }
                      e.target.value = "";
                    }}
                  />
                </label>
                {(formData.newLogoBase64 || formData.logoUrl) && (
                  <button
                    type="button"
                    onClick={() => {
                      updateForm("newLogoBase64", null);
                      updateForm("logoUrl", "");
                    }}
                    className=" icon-badge absolute -top-2 -right-2 w-6 h-6 bg-[#f0813d] rounded-full shadow-lg flex items-center justify-center hover:bg-[#9c4400] active:scale-95 transition-all"
                  >
                    <X className="w-3 h-3 text-white" />
                  </button>
                )}
              </div>
            </div>
            <p className="text-xs text-gray-500 text-center">
              Upload gym logo (Optional)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Gym Name *
            </label>
            <input
              type="text"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none"
              value={formData.name}
              onChange={(e) => updateForm("name", e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Address *
            </label>
            <textarea
              className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none resize-none"
              rows={2}
              value={formData.address}
              onChange={(e) => updateForm("address", e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone
              </label>
              <input
                type="tel"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#f0813d]/20 focus:border-[#f0813d]"
                placeholder="Enter 10-digit phone number"
                value={formData.phone}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '');
                  if (value.length <= 10) {
                    updateForm("phone", value);
                  }
                }}
                pattern="[0-9]{10}"
                maxLength="10"
                title="Please enter a valid 10-digit phone number"
              />
              <p className="text-xs text-gray-500 mt-1">Enter 10 digits only (optional)</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#f0813d]/20 focus:border-[#f0813d]"
                placeholder="example@email.com"
                value={formData.email}
                onChange={(e) => updateForm("email", e.target.value)}
              />
              <p className="text-xs text-gray-500 mt-1">Optional - for contact information</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Website
            </label>
            <input
              type="url"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none"
              placeholder="https://"
              value={formData.website}
              onChange={(e) => updateForm("website", e.target.value)}
            />
          </div>
        </div>

        {/* Operating Hours */}
        <div className="bg-white rounded-xl p-4 shadow-sm space-y-4">
          <h3 className="font-semibold text-gray-900">Operating Hours</h3>

          {/* Weekdays */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Weekdays (Mon - Fri)
            </label>
            
            {/* Morning Shift */}
            <div className="mb-3">
              <label className="text-xs font-medium text-gray-600 mb-1 block">Morning Shift</label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500">Start</label>
                  <input
                    type="time"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#f0813d]/20 focus:border-[#f0813d]"
                    value={formData.weekdayMorningStart}
                    onChange={(e) => updateForm("weekdayMorningStart", e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500">End</label>
                  <input
                    type="time"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#f0813d]/20 focus:border-[#f0813d]"
                    value={formData.weekdayMorningEnd}
                    onChange={(e) => updateForm("weekdayMorningEnd", e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Evening Shift */}
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Evening Shift</label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500">Start</label>
                  <input
                    type="time"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#f0813d]/20 focus:border-[#f0813d]"
                    value={formData.weekdayEveningStart}
                    onChange={(e) => updateForm("weekdayEveningStart", e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500">End</label>
                  <input
                    type="time"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#f0813d]/20 focus:border-[#f0813d]"
                    value={formData.weekdayEveningEnd}
                    onChange={(e) => updateForm("weekdayEveningEnd", e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Weekends */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Weekends {formData.sundayOff ? "(Saturday Only)" : "(Sat - Sun)"}
              </label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-600">Sunday Off</span>
                <button
                  type="button"
                  onClick={() => updateForm("sundayOff", !formData.sundayOff)}
                  className={`w-11 h-6 rounded-full transition ${
                    formData.sundayOff ? "bg-[#f0813d]" : "bg-gray-300"
                  }`}
                >
                  <div
                    className={`w-5 h-5 bg-white rounded-full shadow transition transform ${
                      formData.sundayOff ? "translate-x-5" : "translate-x-0.5"
                    }`}
                  ></div>
                </button>
              </div>
            </div>
            
            {/* Morning Shift */}
            <div className="mb-3">
              <label className="text-xs font-medium text-gray-600 mb-1 block">Morning Shift</label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500">Start</label>
                  <input
                    type="time"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#f0813d]/20 focus:border-[#f0813d]"
                    value={formData.weekendMorningStart}
                    onChange={(e) => updateForm("weekendMorningStart", e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500">End</label>
                  <input
                    type="time"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#f0813d]/20 focus:border-[#f0813d]"
                    value={formData.weekendMorningEnd}
                    onChange={(e) => updateForm("weekendMorningEnd", e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Evening Shift */}
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Evening Shift</label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500">Start</label>
                  <input
                    type="time"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#f0813d]/20 focus:border-[#f0813d]"
                    value={formData.weekendEveningStart}
                    onChange={(e) => updateForm("weekendEveningStart", e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500">End</label>
                  <input
                    type="time"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#f0813d]/20 focus:border-[#f0813d]"
                    value={formData.weekendEveningEnd}
                    onChange={(e) => updateForm("weekendEveningEnd", e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* QR Code Settings */}
        <div className="bg-white rounded-xl p-4 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">QR Code Attendance</h3>
            <button
              type="button"
              onClick={() => updateForm("qrEnabled", !formData.qrEnabled)}
              className={`w-12 h-6 rounded-full transition ${
                formData.qrEnabled ? "bg-[#f0813d]" : "bg-gray-300"
              }`}
            >
              <div
                className={`w-5 h-5 bg-white rounded-full shadow transition transform ${
                  formData.qrEnabled ? "translate-x-6" : "translate-x-1"
                }`}
              ></div>
            </button>
          </div>

          {formData.qrEnabled && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  QR Type
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {["static", "dynamic"].map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => updateForm("qrType", type)}
                      className={`py-3 rounded-xl text-sm font-medium capitalize ${
                        formData.qrType === type
                          ? "bg-black text-white"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  {formData.qrType === "dynamic"
                    ? "QR changes every 5 minutes for security"
                    : "Single QR code for all attendance"}
                </p>
              </div>

              {/* QR Preview */}
              <div className="bg-gray-50 rounded-xl p-6 flex flex-col items-center">
                <div className="w-32 h-32 bg-white rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center mb-3">
                  <span className="text-4xl">📱</span>
                </div>
                <button
                  type="button"
                  className="text-sm text-[#f0813d] font-medium"
                >
                  Generate New QR
                </button>
              </div>
            </>
          )}
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-black text-white rounded-xl font-medium disabled:opacity-50"
        >
          {loading ? "Saving..." : "Save Changes"}
        </button>
      </form>
    </div>
  );
}
