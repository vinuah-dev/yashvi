"use client";

import { useAuthContext } from "@/contexts/AuthContext";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Header from "@/components/layout/Header";
import {
  DateBandInput,
  NumberScaleInput,
  SavingReviewOverlay,
} from "@/components/shared/EngagingFormControls";
import { useToast } from "@/contexts/ToastContext";
import {
  compressMemberImage,
  fileToDataUrl,
  validateMemberImage,
} from "@/lib/utils/memberImageUpload";
import { 
  User, 
  Phone, 
  Mail, 
  CreditCard, 
  ChevronRight,
  ChevronLeft,
  Building,
  AlertCircle,
  CheckCircle,
  DollarSign,
  Save,
  Plus,
  Edit,
  Shield,
  Key,
  AlertTriangle,
  Info,
  X,
  Gift,
} from "lucide-react";

export default function AddMemberPage() {
  const router = useRouter();
  const { showSuccess, showError } = useToast();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const { selectedGym } = useAuthContext();
  const [membershipPlans, setMembershipPlans] = useState([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  
  // Helper function to get today's date string in YYYY-MM-DD format
  const getTodayString = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today.toISOString().split("T")[0];
  };

  // Helper function to check if selected date is in the past
  const isStartDateInPast = (dateString) => {
    const selectedDate = new Date(dateString + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return selectedDate < today;
  };

  // Calculate remaining days when start date is in the past
  const calculateRemainingDays = (startDateString, durationDays) => {
    const startDate = new Date(startDateString + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Calculate end date based on original start date
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + durationDays);
    
    // If end date is before today, membership would be expired
    if (endDate <= today) {
      return 0;
    }
    
    // Calculate remaining days from today to end date
    const diffTime = endDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    gender: "Male",
    age: "",
    address: "",
    emergencyContact: "",
    joinDate: new Date().toISOString().split("T")[0],
    planId: null,
    startDate: new Date().toISOString().split("T")[0],
    paymentDate: new Date().toISOString().split("T")[0],
    paymentAmount: "",
    paymentMode: "cash",
    notes: "",
    useCustomPrice: false,
    customPrice: "",
    selfPlanEditAccess: false,
    nextPaymentDate: "",
    profileImage: null,
    referralCode: "",
  });

  // gym now comes from AuthContext
  useEffect(() => {
    if (selectedGym?.id) {
      fetchMembershipPlans(selectedGym.id);
    }
  }, [selectedGym?.id]);


  const fetchMembershipPlans = async (gymId) => {
    setLoadingPlans(true);
    try {
      // Use same-origin API proxy to avoid CORS issues
      let plans = null;
      let error = null;
      try {
        const res = await fetch(`/api/members/plans?gym_id=${gymId}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'API error');
        plans = json.plans;
      } catch (apiErr) {
        console.warn("API proxy failed, falling back to direct Supabase:", apiErr);
        const result = await supabase
          .from("membership_plans")
          .select("id, name, duration_days, price, is_active")
          .eq("gym_id", gymId)
          .eq("is_active", true)
          .order("price", { ascending: true });
        plans = result.data;
        error = result.error;
      }

      if (error) {
        console.error("Error fetching plans:", error);
        setMembershipPlans([]);
      } else {
        const transformedPlans = plans?.map((plan) => ({
          id: plan.id,
          name: plan.name,
          duration: `${plan.duration_days} Days`,
          duration_days: plan.duration_days,
          price: plan.price,
        })) || [];
        setMembershipPlans(transformedPlans);
      }
    } catch (err) {
      console.error("Error:", err);
      setMembershipPlans([]);
    }
    setLoadingPlans(false);
  };

  const updateForm = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const selectedPlan = membershipPlans.find((p) => p.id === formData.planId);
  const calculatedMembershipEndDate = (() => {
    if (!selectedPlan?.duration_days || !formData.startDate) return "";
    const startDate = new Date(formData.startDate + "T00:00:00");
    if (Number.isNaN(startDate.getTime())) return "";
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + selectedPlan.duration_days);
    return endDate.toISOString().split("T")[0];
  })();

  const stepMeta = [
    { id: 1, title: "Profile", subtitle: "Photo and contact" },
    { id: 2, title: "Plan", subtitle: "Dates and package" },
    { id: 3, title: "Pay", subtitle: "Amount and receipt" },
  ];

  const formatDateLabel = (dateString) => {
    if (!dateString) return "Not set";
    return new Date(dateString + "T00:00:00").toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const startDateRemainingDays =
    formData.startDate && selectedPlan
      ? calculateRemainingDays(formData.startDate, selectedPlan.duration_days || 0)
      : null;

  const totalPlanAmount =
    formData.useCustomPrice && formData.customPrice
      ? parseFloat(formData.customPrice)
      : selectedPlan?.price || 0;

  const paymentAmountNumber = parseFloat(formData.paymentAmount || 0);
  const pendingPaymentAmount = Math.max(0, totalPlanAmount - paymentAmountNumber);

  if (loadingPlans) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 safe-area-inset-bottom flex flex-col items-center justify-center">
        <div className="relative">
          <div className="w-14 h-14 border-4 border-[#f0813d]/20 border-t-[#f0813d] rounded-full animate-spin"></div>
          <div className="absolute inset-0 w-14 h-14 border-4 border-transparent border-t-[#f0813d] rounded-full animate-spin animation-delay-200"></div>
        </div>
        <p className="mt-6 text-gray-600 font-medium text-sm">Loading membership plans...</p>
      </div>
    );
  }

  if (!selectedGym) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 safe-area-inset-bottom">
        <Header title="Add Member" />
        <main className="px-4 py-4">
          <div className="text-center py-12">
            <div className="w-20 h-20 bg-gradient-to-br from-[#f0813d] to-[#f0813d] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <Building className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">No Gym Selected</h2>
            <p className="text-gray-500 text-sm mb-6">Please select a gym first</p>
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

  if (membershipPlans.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 safe-area-inset-bottom">
        <Header title="Add Member" />
        <main className="px-4 py-4">
          <div className="text-center py-12">
            <div className="w-20 h-20 bg-gradient-to-br from-orange-100 to-orange-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">No Plans Available</h2>
            <p className="text-gray-500 text-sm mb-6">Please create membership plans first</p>
            <button
              onClick={() => router.push("/settings/plans")}
              className="px-6 py-3 bg-gradient-to-r from-[#f0813d] to-[#f0813d] text-white rounded-xl font-semibold text-sm active:scale-95 transition-transform"
              style={{ minHeight: '44px' }}
            >
              Create Plans
            </button>
          </div>
        </main>
      </div>
    );
  }

  const handleSubmit = async (addAnother = false) => {
    if (!selectedGym) {
      showError("No gym selected. Please go back to dashboard.");
      return;
    }

    setLoading(true);
    try {
      const selectedPlan = membershipPlans.find((p) => p.id === formData.planId);
      const finalPrice = formData.useCustomPrice && formData.customPrice 
        ? parseFloat(formData.customPrice) 
        : selectedPlan?.price;
      // Round to 2 decimal places to avoid floating-point precision errors
      const paymentAmount = Math.round(parseFloat(formData.paymentAmount) * 100) / 100;
      const balanceOwed = Math.round((finalPrice - paymentAmount) * 100) / 100;

      if (paymentAmount > 0 && !formData.paymentDate) {
        showError("Please select payment date");
        setLoading(false);
        return;
      }

      // Validate next payment date for partial payments
      if (balanceOwed > 0 && !formData.nextPaymentDate) {
        showError("Please select a next payment date for partial payment");
        setLoading(false);
        return;
      }

      if (!selectedPlan) {
        throw new Error("Selected plan not found");
      }
      
      if (!selectedPlan.duration_days || selectedPlan.duration_days <= 0) {
        throw new Error(`Invalid duration for plan "${selectedPlan.name}". Please ensure the plan has a valid duration_days value in the database.`);
      }

      const { data: authData } = await supabase.auth.getUser();
      const currentUser = authData?.user || null;
      const createdBy = currentUser?.id || null;
      const createdByName = currentUser?.name || null;

      if (!createdBy) {
        showError("Session expired. Please login again.");
        setLoading(false);
        return;
      }

      let collectedBy = createdBy;
      let collectedByName = createdByName;

      // ── Step 1: Run independent async operations in parallel ──
      // - Upload profile image (if any)
      // - Resolve collector fallback from auth (if needed)
      let imageUploadFailed = false;
      const uploadImagePromise = (async () => {
        if (!formData.profileImage || !formData.profileImage.startsWith('data:')) return null;
        try {
          const response = await fetch(formData.profileImage);
          const blob = await response.blob();
          const fileExt = blob.type.split('/')[1];
          const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
          const filePath = `profiles/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from("member-images")
            .upload(filePath, blob, { cacheControl: "3600", upsert: false });

          if (uploadError) {
            console.error("Image upload error:", uploadError);
            imageUploadFailed = true;
            return null;
          }
          const { data: urlData } = supabase.storage
            .from("member-images")
            .getPublicUrl(filePath);
          return urlData.publicUrl;
        } catch (imgError) {
          console.error("Error processing image:", imgError);
          imageUploadFailed = true;
          return null;
        }
      })();

      const profileImageUrl = await uploadImagePromise;

      if (imageUploadFailed) {
        showError("Failed to upload profile image, but member will be created without photo");
      }

      // ── Step 2: Calculate membership dates ──
      const startDate = new Date(formData.startDate + 'T00:00:00');
      const durationDays = selectedPlan.duration_days;
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + durationDays);
      const membershipEndDate = endDate.toISOString().split('T')[0];
      const isExpired = endDate <= new Date(new Date().setHours(0, 0, 0, 0));

      const totalPrice = formData.useCustomPrice && formData.customPrice
        ? parseFloat(formData.customPrice)
        : selectedPlan.price;
      const dueForMembership = Math.max(0, totalPrice - paymentAmount);
      const remainingAmount = totalPrice - paymentAmount;

      // ── Step 3: Single RPC call — all DB inserts in one transaction ──
      const defaultPassword = formData.phone.slice(1,2)+formData.phone.slice(3,5)+formData.phone.slice(-2) + "213";

      const rpcParams = {
        p_gym_id: selectedGym.id,
        p_full_name: formData.name,
        p_phone: formData.phone,
        p_email: formData.email || null,
        p_balance: Math.max(0, balanceOwed),
        p_join_date: formData.joinDate,
        p_created_by: createdBy,
        p_created_by_name: createdByName,
        p_self_plan_edit_access: formData.selfPlanEditAccess,
        p_profile_image: profileImageUrl,
        // Membership
        p_plan_id: formData.planId,
        p_start_date: formData.startDate,
        p_end_date: membershipEndDate,
        p_membership_status: isExpired ? "expired" : "active",
        p_custom_price: (formData.useCustomPrice && formData.customPrice) ? parseFloat(formData.customPrice) : null,
        p_due_amount: dueForMembership,
        // Payment
        p_payment_amount: paymentAmount,
        p_payment_mode: formData.paymentMode,
        p_paid_at:
          paymentAmount > 0 && formData.paymentDate
            ? new Date(formData.paymentDate + 'T00:00:00').toISOString()
            : null,
        p_payment_notes: formData.notes || null,
        p_collected_by: collectedBy,
        p_collected_by_name: collectedByName,
        p_next_payment_date: (remainingAmount > 0 && formData.nextPaymentDate) ? formData.nextPaymentDate : null,
        p_remaining_amount: (remainingAmount > 0 && formData.nextPaymentDate) ? remainingAmount : null,
        // Credentials
        p_login_value: formData.phone,
        p_default_password: defaultPassword,
      };

      // Use same-origin API proxy to avoid CORS issues, fallback to direct Supabase
      let rpcResult, rpcError;
      try {
        const res = await fetch('/api/members/add', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': String(createdBy),
          },
          body: JSON.stringify({ params: rpcParams }),
        });
        const json = await res.json();
        if (!res.ok) {
          rpcError = { message: json.error };
        } else {
          rpcResult = json.data;
        }
      } catch (apiErr) {
        rpcError = { message: apiErr?.message || "API request failed" };
      }

      if (rpcError) {
        // Handle duplicate phone error from RPC
        if (rpcError.message?.includes('DUPLICATE_PHONE')) {
          const existingName = rpcError.message.split('DUPLICATE_PHONE:')[1]?.trim() || '';
          showError(`A member with phone number ${formData.phone} already exists${existingName ? `: ${existingName}` : ''}. Please use a different phone number or edit the existing member.`);
          setLoading(false);
          return;
        }
        if (rpcError.message?.includes('PAYMENT_EXCEEDS_MEMBERSHIP_TOTAL')) {
          showError("Initial payment cannot be greater than membership total amount.");
          setLoading(false);
          return;
        }
        throw rpcError;
      }

      console.log("Member created via transaction:", rpcResult);

      // Process referral if code provided
      if (formData.referralCode?.trim() && rpcResult?.member_id) {
        try {
          const refRes = await fetch('/api/referral', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-user-id': String(createdBy) },
            body: JSON.stringify({
              action: 'process',
              new_member_id: rpcResult.member_id,
              referrer_id: formData.referralCode.trim(),
            }),
          });
          const refJson = await refRes.json();
          if (refJson.data?.success) {
            showSuccess(`Referral bonus: ${refJson.data.points_awarded} points awarded to ${refJson.data.referrer_name}!`);
          }
        } catch (refErr) {
          console.error("Referral processing error:", refErr);
        }
      }

      // Show success message with appropriate status info
      const statusMessage = isStartDateInPast(formData.startDate) 
        ? ` (${calculateRemainingDays(formData.startDate, durationDays)} days remaining)` 
        : '';
      const loginInfoMessage = ` Login: ${formData.phone} | Password: ${defaultPassword}`;
      showSuccess(`Member added successfully!${statusMessage} ${loginInfoMessage}`);
      
      if (addAnother) {
        setFormData({
          name: "",
          phone: "",
          email: "",
          gender: "Male",
          age: "",
          address: "",
          emergencyContact: "",
          joinDate: new Date().toISOString().split("T")[0],
          planId: null,
          startDate: new Date().toISOString().split("T")[0],
          paymentDate: new Date().toISOString().split("T")[0],
          paymentAmount: "",
          paymentMode: "cash",
          notes: "",
          useCustomPrice: false,
          customPrice: "",
          selfPlanEditAccess: false,
          nextPaymentDate: "",
        });
        setStep(1);
      } else {
        // Navigate and refresh to show new member
        router.push("/members");
        router.refresh();
      }

    } catch (error) {
      console.error("Error adding member:", error);
      showError("Failed to add member. Please try again.");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#f6f3f1] safe-area-inset-bottom pb-28">
      <Header title="Add New Member" />
      <SavingReviewOverlay
        open={loading}
        title="Considering the member data"
        items={[
          formData.name ? `Profile: ${formData.name}` : "Profile details",
          selectedPlan ? `Plan: ${selectedPlan.name}` : "Membership plan",
          formData.startDate ? `Start: ${formatDateLabel(formData.startDate)}` : "Membership date",
          formData.paymentAmount ? `Payment: Rs.${formData.paymentAmount}` : "Payment amount",
        ]}
      />

      <main className="px-3 py-3 space-y-4 max-w-xl mx-auto">
        <section className="relative mx-1 overflow-hidden rounded-[1.75rem] border border-black/5 bg-[#1a1c1c] text-white shadow-[0_18px_45px_rgba(26,28,28,0.22)]">
          <img
            src="/bgimages/loginbgdesktop.png"
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-35"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-black/25" />
          <div className="relative p-5">
            <div className="mb-7 flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#f0813d]">
                  Member onboarding
                </p>
                <h2 className="mt-2 text-2xl font-black leading-tight tracking-tight">
                  Build a complete profile before the first check-in.
                </h2>
              </div>
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/10 backdrop-blur">
                <User className="h-6 w-6 text-white" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {stepMeta.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => item.id < step && setStep(item.id)}
                  className={`rounded-2xl border p-3 text-left transition ${
                    step >= item.id
                      ? "border-[#f0813d]/60 bg-[#f0813d] text-black shadow-[0_10px_25px_rgba(240,129,61,0.25)]"
                      : "border-white/10 bg-white/8 text-white/65"
                  }`}
                >
                  <span className="mb-2 flex h-7 w-7 items-center justify-center rounded-xl bg-black/15 text-xs font-black">
                    {step > item.id ? <CheckCircle className="h-4 w-4" /> : item.id}
                  </span>
                  <span className="block text-xs font-black">{item.title}</span>
                  <span className="mt-0.5 block text-[9px] font-bold opacity-70">{item.subtitle}</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        <div className="sticky top-[74px] z-40 mx-1 rounded-2xl border border-black/5 bg-white/90 p-2 shadow-[0_12px_32px_rgba(15,15,15,0.08)] backdrop-blur-xl">
          <div className="flex items-center gap-2">
            {stepMeta.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => item.id < step && setStep(item.id)}
                className={`flex-1 rounded-xl px-2 py-2 text-center text-[10px] font-black uppercase tracking-wide transition ${
                  step === item.id
                    ? "bg-[#1a1c1c] text-white"
                    : step > item.id
                      ? "bg-[#f0813d]/15 text-[#9c4400]"
                      : "bg-gray-100 text-gray-400"
                }`}
              >
                {item.title}
              </button>
            ))}
          </div>
        </div>

        {/* Step 1: Personal Info */}
        {step === 1 && (
          <div className="space-y-4 pb-4">
            <div className="mx-1 overflow-hidden rounded-[1.5rem] border border-gray-200 bg-white shadow-[0_16px_40px_rgba(15,15,15,0.06)]">
              <div className="relative h-28 overflow-hidden bg-[#1a1c1c]">
                <img
                  src="/quick-actions/add-member.png"
                  alt=""
                  className="absolute right-4 top-1/2 h-24 w-24 -translate-y-1/2 object-contain opacity-90"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-[#1a1c1c] via-[#1a1c1c]/95 to-[#1a1c1c]/30" />
                <div className="relative flex h-full items-center px-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#f0813d]">
                      Step 1 of 3
                    </p>
                    <h3 className="mt-1 text-xl font-black tracking-tight text-white">
                      Personal Information
                    </h3>
                    <p className="mt-1 text-xs font-medium text-white/60">
                      Photo, contact, referral and app permissions.
                    </p>
                  </div>
                </div>
              </div>
              <div className="p-4">
              <div className="mb-4 flex items-center gap-3 rounded-2xl border border-orange-100 bg-gradient-to-r from-orange-50 to-white p-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#1a1c1c] shadow-lg">
                  <User className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-black tracking-tight text-gray-950">Identity Core</h3>
                  <p className="text-xs font-bold text-gray-500">Bold profile details for attendance, access and trainer records.</p>
                </div>
              </div>

              <div className="space-y-3">
                {/* Profile Photo Upload */}
                <div className="flex flex-col items-center rounded-2xl border border-orange-100 bg-gradient-to-r from-orange-50 to-white px-4 py-5">
                  <div className="mb-3">
                    <div className="relative group">
                      <div className="w-24 h-24 rounded-[1.75rem] overflow-hidden bg-gradient-to-br from-[#f0813d] to-[#f0813d] flex items-center justify-center text-white font-bold shadow-lg ring-4 ring-white">
                        {formData.profileImage ? (
                          <img
                            src={formData.profileImage}
                            alt="Profile preview"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <User className="w-10 h-10" />
                        )}
                      </div>
                      <label htmlFor="profile-upload" className="absolute -bottom-1 -right-1 w-8 h-8 bg-white rounded-full shadow-lg border border-gray-200 flex items-center justify-center cursor-pointer hover:bg-gray-50 active:scale-95 transition-all group">
                        <Plus className="w-4 h-4 text-[#f0813d]" />
                        <input
                          id="profile-upload"
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
                              updateForm("profileImage", previewDataUrl);
                            } catch (error) {
                              console.error("Error compressing member image:", error);
                              showError("Could not compress image. Please try another photo.");
                            }

                            e.target.value = "";
                          }}
                        />
                      </label>
                      {formData.profileImage && (
                        <button
                          type="button"
                          onClick={() => updateForm("profileImage", null)}
                          className=" icon-badge absolute -top-1 -right-1 w-6 h-6 bg-[#f0813d] rounded-full shadow-lg flex items-center justify-center hover:bg-[#f0813d] active:scale-95 transition-all"
                        >
                          <X className="w-3 h-3 text-white" />
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 text-center">
                    Upload member photo (Optional)
                  </p>
                  <p className="text-xs text-gray-400 text-center">
                    JPG, PNG or WebP • Compressed under 100KB
                  </p>
                </div>

                {/* Full Name */}
                <div className="rounded-2xl border border-orange-100 bg-gradient-to-br from-white via-orange-50/70 to-white p-4 shadow-sm">
                  <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.16em] text-gray-950">
                    Full Name <span className="text-[#f0813d]">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl bg-[#1a1c1c] text-white">
                      <User className="h-4 w-4" />
                    </span>
                    <input
                      type="text"
                      className="w-full pl-14 pr-4 py-3 text-base font-black placeholder:text-gray-400"
                      placeholder="Enter full name"
                      value={formData.name}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (/^[a-zA-Z\s]*$/.test(value) || value === '') {
                          updateForm("name", value);
                        }
                      }}
                      pattern="[a-zA-Z\s]+"
                      title="Please enter a valid name (letters and spaces only)"
                      required
                      minLength="2"
                    />
                  </div>
                  <p className="mt-2 text-[10px] font-black uppercase tracking-wide text-gray-400">Letters and spaces only</p>
                </div>

                {/* Phone Number */}
                <div className="rounded-2xl border border-orange-100 bg-gradient-to-br from-white via-orange-50/70 to-white p-4 shadow-sm">
                  <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.16em] text-gray-950">
                    Phone Number <span className="text-[#f0813d]">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl bg-[#1a1c1c] text-white">
                      <Phone className="h-4 w-4" />
                    </span>
                    <input
                      type="tel"
                      className="w-full pl-14 pr-4 py-3 text-base font-black placeholder:text-gray-400"
                      placeholder="Enter 10-digit phone"
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
                      required
                    />
                  </div>
                  <p className="mt-2 text-[10px] font-black uppercase tracking-wide text-gray-400">10 digits only - used for login</p>
                </div>

                {/* Join Date */}
              

                {/* Email Address */}
                <div className="rounded-2xl border border-orange-100 bg-gradient-to-br from-white via-orange-50/70 to-white p-4 shadow-sm">
                  <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.16em] text-gray-950">
                    Email Address
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl bg-[#1a1c1c] text-white">
                      <Mail className="h-4 w-4" />
                    </span>
                    <input
                      type="email"
                      className="w-full pl-14 pr-4 py-3 text-base font-black placeholder:text-gray-400"
                      placeholder="john@example.com"
                      value={formData.email}
                      onChange={(e) => updateForm("email", e.target.value.toLowerCase().trim())}
                      title="Please enter a valid email address"
                    />
                  </div>
                  <p className="mt-2 text-[10px] font-black uppercase tracking-wide text-gray-400">Optional - for app login</p>
                </div>

                {/* Gender and Age */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-orange-100 bg-gradient-to-br from-orange-50 via-white to-white p-4 shadow-sm">
                    <label className="mb-3 block text-[11px] font-black uppercase tracking-[0.16em] text-gray-950">
                      Gender
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {["Male", "Female", "Other"].map((genderOption) => {
                        const isActive = formData.gender === genderOption;
                        return (
                          <button
                            key={genderOption}
                            type="button"
                            onClick={() => updateForm("gender", genderOption)}
                            className={`rounded-2xl border px-2 py-3 text-[11px] font-black uppercase transition active:scale-95 ${
                              isActive
                                ? "border-[#f0813d] bg-[#1a1c1c] text-white shadow-[0_12px_26px_rgba(26,28,28,0.2)]"
                                : "border-gray-200 bg-white text-gray-500"
                            }`}
                          >
                            {genderOption}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <NumberScaleInput
                    label="Age"
                    value={formData.age}
                    min={1}
                    max={120}
                    unit="yrs"
                    helper="Drag the band or tap arrows for quick entry."
                    onChange={(value) => {
                      if (value === '' || (!isNaN(value) && parseInt(value) >= 0 && parseInt(value) <= 120)) {
                        updateForm("age", value);
                      }
                    }}
                  />
                </div>

                {/* Address */}
                <div className="rounded-2xl border border-orange-100 bg-gradient-to-br from-white via-orange-50/70 to-white p-4 shadow-sm">
                  <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.16em] text-gray-950">
                    Address
                  </label>
                  <textarea
                    className="w-full resize-none px-4 py-3 text-sm font-bold placeholder:text-gray-400"
                    rows={2}
                    placeholder="Enter address"
                    value={formData.address}
                    onChange={(e) => updateForm("address", e.target.value)}
                  />
                </div>

                {/* Emergency Contact */}
                <div className="rounded-2xl border border-orange-100 bg-gradient-to-br from-white via-orange-50/70 to-white p-4 shadow-sm">
                  <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.16em] text-gray-950">
                    Emergency Contact
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl bg-[#1a1c1c] text-white">
                      <AlertTriangle className="h-4 w-4" />
                    </span>
                    <input
                      type="tel"
                      className="w-full pl-14 pr-4 py-3 text-base font-black placeholder:text-gray-400"
                      placeholder="Emergency contact number"
                      value={formData.emergencyContact}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '');
                        if (value.length <= 10) {
                          updateForm("emergencyContact", value);
                        }
                      }}
                      pattern="[0-9]{10}"
                      maxLength="10"
                    />
                  </div>
                  <p className="mt-2 text-[10px] font-black uppercase tracking-wide text-gray-400">Optional - 10 digits only</p>
                </div>

                {/* Referral Code */}
                <div className="rounded-2xl border border-orange-100 bg-gradient-to-br from-white via-orange-50/70 to-white p-4 shadow-sm">
                  <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.16em] text-gray-950">
                    Referral Code
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl bg-[#1a1c1c] text-white">
                      <Gift className="h-4 w-4" />
                    </span>
                    <input
                      type="text"
                      className="w-full pl-14 pr-4 py-3 text-base font-black placeholder:text-gray-400"
                      placeholder="Enter referral code (member ID)"
                      value={formData.referralCode}
                      onChange={(e) => updateForm("referralCode", e.target.value.trim())}
                    />
                  </div>
                  <p className="mt-2 text-[10px] font-black uppercase tracking-wide text-gray-400">Optional - existing member ID who referred this person</p>
                </div>

                {/* Self Plan Edit Access Toggle */}
                <div className="rounded-2xl border border-black/10 bg-gradient-to-r from-[#1a1c1c] to-[#2d2926] p-4 text-white shadow-lg">
                  <div className="flex items-start gap-3">
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/10">
                      <Shield className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-black text-white">Self Plan Edit Access</p>
                        <button
                          type="button"
                          onClick={() => updateForm("selfPlanEditAccess", !formData.selfPlanEditAccess)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            formData.selfPlanEditAccess ? "bg-gradient-to-r from-[#f0813d] to-[#f0813d]" : "bg-gray-300"
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              formData.selfPlanEditAccess ? "translate-x-6" : "translate-x-1"
                            }`}
                          />
                        </button>
                      </div>
                      <p className="text-xs font-bold text-white/55">
                        Allow member to edit their workout/diet plans from the app
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              </div>
            </div>

            {/* Next Button */}
            <div className="px-1">
              <button
                onClick={() => {
                  if (!formData.name || formData.name.trim().length < 2) {
                    alert("Please enter a valid name (at least 2 characters)");
                    return;
                  }
                  if (!formData.phone || formData.phone.length !== 10) {
                    alert("Please enter a valid 10-digit phone number");
                    return;
                  }
                  if (formData.email && !formData.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
                    alert("Please enter a valid email address or leave it empty");
                    return;
                  }
                  setStep(2);
                }}
                disabled={!formData.name || !formData.phone}
                className="w-full py-3.5 bg-gradient-to-r from-[#f0813d] to-[#f0813d] text-white font-medium rounded-lg hover:shadow-lg active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                style={{ minHeight: '44px' }}
              >
                Continue to Plan Selection
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Select Plan */}
        {step === 2 && (
          <div className="space-y-4 pb-4">
            <div className="mx-1 overflow-hidden rounded-[1.5rem] border border-gray-200 bg-white shadow-[0_16px_40px_rgba(15,15,15,0.06)]">
              <div className="relative h-28 overflow-hidden bg-[#f0813d]">
                <img
                  src="/quick-actions/payment.png"
                  alt=""
                  className="absolute right-4 top-1/2 h-24 w-24 -translate-y-1/2 object-contain opacity-95"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-[#f0813d] via-[#f0813d]/95 to-[#f0813d]/35" />
                <div className="relative flex h-full items-center px-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-black/55">
                      Step 2 of 3
                    </p>
                    <h3 className="mt-1 text-xl font-black tracking-tight text-black">
                      Plan and membership dates
                    </h3>
                    <p className="mt-1 text-xs font-bold text-black/60">
                      Choose a package, then confirm start and expiry.
                    </p>
                  </div>
                </div>
              </div>
              <div className="p-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-orange-100 to-orange-100 rounded-lg flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Select Membership Plan</h3>
                  <p className="text-xs text-gray-500">Choose a plan for the member</p>
                </div>
              </div>

              {/* Plans Grid */}
              <div className="grid grid-cols-1 gap-3 mb-4">
                {membershipPlans.map((plan) => (
                  <div
                    key={plan.id}
                    onClick={() => {
                      updateForm("planId", plan.id);
                      updateForm("customPrice", plan.price.toString());
                    }}
                    className={`p-4 rounded-2xl border cursor-pointer transition-all active:scale-95 ${
                      formData.planId === plan.id
                        ? "border-[#f0813d] bg-gradient-to-r from-orange-50 to-white shadow-[0_10px_24px_rgba(240,129,61,0.12)]"
                        : "border-gray-200 hover:border-gray-300 bg-white"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-black text-gray-900 text-sm">{plan.name}</p>
                        <p className="mt-1 text-xs font-semibold text-gray-500">{plan.duration}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-900 text-sm">₹{plan.price}</p>
                        <div className={`w-4 h-4 rounded-full border ${formData.planId === plan.id ? 'border-[#f0813d] bg-[#f0813d]' : 'border-gray-300'} mt-1 ml-auto`}></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Custom Price Toggle */}
              {formData.planId && (
                <div className="mb-4 p-3 bg-gradient-to-r from-orange-50 to-orange-50 rounded-lg border border-orange-200">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Edit className="w-4 h-4 text-[#f0813d]" />
                      <span className="text-sm font-medium text-gray-900">Custom Price</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => updateForm("useCustomPrice", !formData.useCustomPrice)}
                      className={`relative inline-flex h-5 w-10 items-center rounded-full ${
                        formData.useCustomPrice ? "bg-gradient-to-r from-[#f0813d] to-[#f0813d]" : "bg-gray-300"
                      }`}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition ${
                          formData.useCustomPrice ? "translate-x-5" : "translate-x-0.5"
                        }`}
                      />
                    </button>
                  </div>

                  {formData.useCustomPrice && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Custom Price (₹)
                      </label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input
                          type="text"
                          inputMode="decimal"
                          pattern="[0-9]*\.?[0-9]*"
                          className="w-full pl-10 pr-4 py-2 bg-white border border-[#f0813d] rounded-lg focus:ring-2 focus:ring-[#f0813d] focus:border-[#f0813d] outline-none text-sm font-medium transition-all"
                          placeholder="Enter custom price"
                          value={formData.customPrice}
                          onChange={(e) => {
                            const value = e.target.value;
                            if (value === '' || /^\d*\.?\d*$/.test(value)) {
                              updateForm("customPrice", value);
                            }
                          }}
                          onFocus={(e) => e.target.select()}
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Original price: ₹{selectedPlan?.price}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Start Date */}
              <div>
                <DateBandInput
                  label="Membership Start Date"
                  value={formData.startDate}
                  helper="Use the band arrows, quick presets, or exact date picker."
                  onChange={(value) => {
                    updateForm("startDate", value);
                    updateForm("joinDate", value);
                  }}
                  presets={[
                    { label: "Today", getValue: getTodayString },
                    {
                      label: "7 days",
                      getValue: () => {
                        const date = new Date();
                        date.setDate(date.getDate() - 7);
                        return date.toISOString().split("T")[0];
                      },
                    },
                    {
                      label: "1 month",
                      getValue: () => {
                        const date = new Date();
                        date.setMonth(date.getMonth() - 1);
                        return date.toISOString().split("T")[0];
                      },
                    },
                  ]}
                />

                {selectedPlan && (
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3">
                      <p className="text-[9px] font-black uppercase tracking-wide text-gray-400">Starts</p>
                      <p className="mt-1 text-xs font-black text-gray-900">{formatDateLabel(formData.startDate)}</p>
                    </div>
                    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3">
                      <p className="text-[9px] font-black uppercase tracking-wide text-gray-400">Ends</p>
                      <p className="mt-1 text-xs font-black text-gray-900">{formatDateLabel(calculatedMembershipEndDate)}</p>
                    </div>
                    <div className="rounded-2xl border border-orange-200 bg-orange-50 p-3">
                      <p className="text-[9px] font-black uppercase tracking-wide text-[#f0813d]">Left</p>
                      <p className="mt-1 text-xs font-black text-orange-800">{startDateRemainingDays ?? 0} days</p>
                    </div>
                  </div>
                )}
                
                {/* Past Date Info - Show remaining days */}
                {formData.startDate && formData.planId && isStartDateInPast(formData.startDate) && (
                  <div className="mt-2 p-2 bg-gradient-to-r from-orange-50 to-orange-50 border border-orange-200 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Info className="w-4 h-4 text-[#f0813d] flex-shrink-0" />
                      {calculateRemainingDays(formData.startDate, selectedPlan?.duration_days || 0) > 0 ? (
                        <p className="text-xs font-medium text-[#f0813d]">
                          Start date is in the past. Member will have <span className="font-bold">{calculateRemainingDays(formData.startDate, selectedPlan?.duration_days || 0)} days</span> remaining from today.
                        </p>
                      ) : (
                        <p className="text-xs font-medium text-[#f0813d]">
                          ⚠️ This membership is already expired. It will be saved as an expired record for history.
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
              </div>
            </div>

            {/* Navigation Buttons */}
            <div className="flex gap-3 px-1">
              <button
                onClick={() => setStep(1)}
                className="flex-1 py-3 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 active:scale-95 transition-all duration-200 flex items-center justify-center gap-2"
                style={{ minHeight: '44px' }}
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>
              <button
                onClick={() => {
                  if (!formData.planId) {
                    alert("Please select a membership plan");
                    return;
                  }
                  
                  if (formData.useCustomPrice) {
                    const customPrice = parseFloat(formData.customPrice);
                    if (!formData.customPrice || isNaN(customPrice) || customPrice <= 0) {
                      alert("Please enter a valid custom price");
                      return;
                    }
                  }
                  
                  const totalPrice = formData.useCustomPrice && formData.customPrice 
                    ? formData.customPrice 
                    : selectedPlan?.price;
                  if (!formData.paymentAmount) {
                    updateForm("paymentAmount", totalPrice.toString());
                  }
                  setStep(3);
                }}
                disabled={!formData.planId}
                className="flex-1 py-3 bg-gradient-to-r from-[#f0813d] to-[#f0813d] text-white font-medium rounded-lg hover:shadow-lg active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                style={{ minHeight: '44px' }}
              >
                Continue to Payment
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Payment */}
        {step === 3 && (
          <div className="space-y-4 pb-4">
            <div className="mx-1 overflow-hidden rounded-[1.5rem] border border-gray-200 bg-white shadow-[0_16px_40px_rgba(15,15,15,0.06)]">
              <div className="relative h-28 overflow-hidden bg-[#1a1c1c]">
                <img
                  src="/quick-actions/payment.png"
                  alt=""
                  className="absolute right-4 top-1/2 h-24 w-24 -translate-y-1/2 object-contain opacity-90"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-[#1a1c1c] via-[#1a1c1c]/95 to-[#1a1c1c]/30" />
                <div className="relative flex h-full items-center px-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#f0813d]">
                      Step 3 of 3
                    </p>
                    <h3 className="mt-1 text-xl font-black tracking-tight text-white">
                      Payment and access
                    </h3>
                    <p className="mt-1 text-xs font-medium text-white/60">
                      Capture amount, due date and app credentials.
                    </p>
                  </div>
                </div>
              </div>
              <div className="p-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-orange-100 to-orange-100 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Payment Details</h3>
                  <p className="text-xs text-gray-500">Complete the payment</p>
                </div>
              </div>

              {/* Plan Summary */}
              <div className="mb-4 rounded-2xl border border-orange-200 bg-gradient-to-r from-orange-50 to-white p-4">
                <div className="mb-3 grid grid-cols-3 gap-2">
                  <div className="rounded-xl bg-white p-3 text-center shadow-sm">
                    <p className="text-[9px] font-black uppercase tracking-wide text-gray-400">Total</p>
                    <p className="mt-1 text-sm font-black text-gray-900">Rs.{totalPlanAmount || 0}</p>
                  </div>
                  <div className="rounded-xl bg-white p-3 text-center shadow-sm">
                    <p className="text-[9px] font-black uppercase tracking-wide text-gray-400">Paid</p>
                    <p className="mt-1 text-sm font-black text-green-700">Rs.{paymentAmountNumber || 0}</p>
                  </div>
                  <div className="rounded-xl bg-white p-3 text-center shadow-sm">
                    <p className="text-[9px] font-black uppercase tracking-wide text-gray-400">Due</p>
                    <p className="mt-1 text-sm font-black text-[#f0813d]">Rs.{pendingPaymentAmount}</p>
                  </div>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-600">Plan</span>
                  <span className="font-medium text-gray-900">{selectedPlan?.name}</span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-600">Duration</span>
                  <span className="font-medium text-gray-900">{selectedPlan?.duration}</span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-600">Start Date</span>
                  <span className="font-medium text-gray-900">
                    {new Date(formData.startDate + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                </div>
                {/* Show membership status */}
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-600">Status</span>
                  <span className="font-medium px-2 py-0.5 rounded-full text-xs bg-orange-100 text-[#f0813d]">
                    Active
                  </span>
                </div>
                {/* Show remaining days if start date is in past */}
                {isStartDateInPast(formData.startDate) && selectedPlan && (
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-600">Remaining Days</span>
                    <span className="font-medium text-[#f0813d]">
                      {calculateRemainingDays(formData.startDate, selectedPlan.duration_days)} days
                    </span>
                  </div>
                )}
                {formData.useCustomPrice && (
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-600">Original Price</span>
                    <span className="font-medium line-through text-gray-400">
                      ₹{selectedPlan?.price}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-2 border-t border-orange-200">
                  <span className="font-medium text-gray-900">
                    Total Amount
                  </span>
                  <span className="text-lg font-bold text-gray-900">
                    ₹{formData.useCustomPrice && formData.customPrice
                      ? formData.customPrice
                      : selectedPlan?.price}
                  </span>
                </div>
              </div>

              {/* Payment Amount */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Amount (₹) <span className="text-[#f0813d]">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-semibold">
  ₹
</span>

                  <input
                    type="text"
                    inputMode="decimal"
                    pattern="[0-9]*\.?[0-9]*"
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#f0813d] focus:border-[#f0813d] outline-none font-medium transition-all text-sm"
                    placeholder="Enter amount"
                    value={formData.paymentAmount}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '' || /^\d*\.?\d*$/.test(value)) {
                        updateForm("paymentAmount", value);
                      }
                    }}
                  />
                </div>
              </div>

              {/* Payment Date */}
              <div className="mb-4">
                <DateBandInput
                  label="Payment Date"
                  value={formData.paymentDate}
                  helper="Used for paid_at. Membership start date is kept separate."
                  onChange={(value) => updateForm("paymentDate", value)}
                  presets={[
                    { label: "Today", getValue: getTodayString },
                    {
                      label: "Yesterday",
                      getValue: () => {
                        const date = new Date();
                        date.setDate(date.getDate() - 1);
                        return date.toISOString().split("T")[0];
                      },
                    },
                    {
                      label: "Start",
                      getValue: () => formData.startDate || getTodayString(),
                    },
                  ]}
                />
              </div>

              {/* Payment Status Alerts */}
              {formData.paymentAmount &&
                formData.paymentAmount < (formData.useCustomPrice && formData.customPrice
                  ? parseFloat(formData.customPrice)
                  : selectedPlan?.price) && (
                  <div className="mb-4 space-y-3">
                    <div className="p-3 bg-gradient-to-r from-orange-50 to-orange-100 border border-orange-200 rounded-lg">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-[#f0813d]" />
                        <p className="text-sm font-medium text-[#f0813d]">
                          Partial Payment: ₹{formData.paymentAmount}
                        </p>
                      </div>
                      <p className="text-xs text-[#f0813d] mt-1 ml-6">
                        Remaining due: ₹
                        {(formData.useCustomPrice && formData.customPrice
                          ? parseFloat(formData.customPrice)
                          : selectedPlan?.price) - parseFloat(formData.paymentAmount)}
                      </p>
                    </div>
                    
                    {/* Next Payment Date - Required for partial payments */}
                    <div>
                      <DateBandInput
                        label="Next Payment Date"
                        value={formData.nextPaymentDate}
                        helper="Required for partial payments."
                        onChange={(value) => updateForm("nextPaymentDate", value)}
                        presets={[
                          {
                            label: "7 days",
                            getValue: () => {
                              const date = new Date();
                              date.setDate(date.getDate() + 7);
                              return date.toISOString().split("T")[0];
                            },
                          },
                          {
                            label: "15 days",
                            getValue: () => {
                              const date = new Date();
                              date.setDate(date.getDate() + 15);
                              return date.toISOString().split("T")[0];
                            },
                          },
                          {
                            label: "1 month",
                            getValue: () => {
                              const date = new Date();
                              date.setMonth(date.getMonth() + 1);
                              return date.toISOString().split("T")[0];
                            },
                          },
                        ]}
                      />
                      {formData.nextPaymentDate && (
                        <div className="mt-2 p-2 bg-gradient-to-r from-orange-50 to-orange-50 border border-orange-200 rounded-lg">
                          <p className="text-xs text-[#f0813d]">
                            <span className="font-semibold">Reminder:</span> Remaining ₹
                            {(formData.useCustomPrice && formData.customPrice
                              ? parseFloat(formData.customPrice)
                              : selectedPlan?.price) - parseFloat(formData.paymentAmount)}{" "}
                            to be paid on{" "}
                            <span className="font-semibold">
                              {new Date(formData.nextPaymentDate + 'T00:00:00').toLocaleDateString('en-IN', { 
                                day: '2-digit', 
                                month: '2-digit', 
                                year: 'numeric' 
                              })}
                            </span>
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              {formData.paymentAmount && parseFloat(formData.paymentAmount) === (formData.useCustomPrice && formData.customPrice ? parseFloat(formData.customPrice) : selectedPlan?.price) && (
                <div className="mb-4 p-3 bg-gradient-to-r from-orange-50 to-orange-100 border border-orange-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-[#f0813d]" />
                    <p className="text-sm font-medium text-[#f0813d]">
                      Full payment received
                    </p>
                  </div>
                </div>
              )}

              {/* Payment Mode */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Payment Mode
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {["cash", "upi", "card"].map((mode) => (
                    <button
                      key={mode}
                      onClick={() => updateForm("paymentMode", mode)}
                      className={`py-2.5 text-xs font-medium capitalize rounded-lg transition-all active:scale-95 ${
                        formData.paymentMode === mode
                          ? "bg-gradient-to-r from-[#f0813d] to-[#f0813d] text-white shadow-sm"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes (Optional)
                </label>
                <textarea
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#f0813d] focus:border-[#f0813d] outline-none resize-none transition-all placeholder:text-gray-400 text-sm"
                  rows={2}
                  placeholder="Any additional notes..."
                  value={formData.notes}
                  onChange={(e) => updateForm("notes", e.target.value)}
                />
              </div>
              </div>
            </div>

            {/* Navigation Buttons */}
            <div className="space-y-3 px-1">
              <div className="flex gap-3">
                <button
                  onClick={() => handleSubmit(false)}
                  disabled={!formData.paymentAmount || loading}
                  className="flex-1 py-3 bg-gradient-to-r from-[#f0813d] to-[#f0813d] text-white font-medium rounded-lg hover:shadow-lg active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  style={{ minHeight: '44px' }}
                >
                  <Save className="w-4 h-4" />
                  {loading ? "Saving..." : "Save Member"}
                </button>
                <button
                  onClick={() => handleSubmit(true)}
                  disabled={!formData.paymentAmount || loading}
                  className="flex-1 py-3 bg-gradient-to-r from-[#f0813d] to-[#f0813d] text-white font-medium rounded-lg hover:shadow-lg active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  style={{ minHeight: '44px' }}
                >
                  <Plus className="w-4 h-4" />
                  {loading ? "Saving..." : "Save & Add Another"}
                </button>
              </div>
              <button
                onClick={() => setStep(2)}
                className="w-full py-3 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 active:scale-95 transition-all duration-200 flex items-center justify-center gap-2"
                style={{ minHeight: '44px' }}
              >
                <ChevronLeft className="w-4 h-4" />
                Back to Plan Selection
              </button>
            </div>

            {/* Login Info Preview */}
            <div className="bg-gradient-to-r from-[#f0813d] to-[#f0813d] rounded-xl p-4 mx-1 text-white">
              <div className="flex items-center gap-3 mb-3">
                <Key className="w-5 h-5 text-white/80" />
                <div>
                  <h4 className="font-medium text-white">App Login Details</h4>
                  <p className="text-white/80 text-xs">Will be shown after saving</p>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-white/80" />
                  <span className="font-medium">Phone:</span>
                  <span>{formData.phone || "Not set"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-white/80" />
                  <span className="font-medium">Password:</span>
                  <span>{formData.phone ? `${formData.phone.slice(-4)}123` : "Will be generated"}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
