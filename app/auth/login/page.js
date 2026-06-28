"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { saveSession, SESSION_KEYS } from "@/lib/sessionStorage";
import Link from "next/link";
import { 
  Dumbbell, 
  Lock, 
  Mail, 
  Eye, 
  EyeOff,
  Shield,
  Smartphone,
  ArrowRight,
  AlertCircle,
  User,
  Building,
  Sparkles,
  CheckCircle,
  Sun,
  Moon
} from "lucide-react";
import SSLogo from "@/components/shared/SSLogo";
import { useTheme } from "@/components/shared/ThemeProvider";

export default function LoginPage() {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const [emailOrPhone, setEmailOrPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [userType, setUserType] = useState("admin"); // "admin", "trainer", or "member"
  const [showContactModal, setShowContactModal] = useState(false);

  const roleContent = {
    admin: {
      title: "Manage your gym",
      detail: "Members, finance, attendance and operations.",
      icon: Building,
    },
    trainer: {
      title: "Lead every session",
      detail: "Members, plans, progress and coaching tools.",
      icon: Dumbbell,
    },
    member: {
      title: "Continue your progress",
      detail: "Workout, nutrition, attendance and health.",
      icon: User,
    },
  };
  const activeRole = roleContent[userType];
  const ActiveRoleIcon = activeRole.icon;

  useEffect(() => {
    router.prefetch("/admin/dashboard");
    router.prefetch("/trainer/dashboard");
    router.prefetch("/user/dashboard");
  }, [router]);

  // Helper function to detect if input is email or phone
  const isEmail = (input) => {
    return input.includes("@") && input.includes(".");
  };

  const completeLogin = (userData, destination, { member = false } = {}) => {
    const userValue = JSON.stringify(userData);
    const expiryValue = (Date.now() + (30 * 24 * 60 * 60 * 1000)).toString();

    // Make auth available synchronously so the next page can render at once.
    localStorage.setItem(SESSION_KEYS.USER, userValue);
    localStorage.setItem(SESSION_KEYS.EXPIRY, expiryValue);
    if (member) localStorage.setItem("member", userValue);
    else localStorage.removeItem("member");
    localStorage.removeItem("selectedGym");
    sessionStorage.removeItem("logoutInProgress");

    // Durable PWA persistence can finish without blocking navigation.
    void Promise.all([
      saveSession(SESSION_KEYS.USER, userValue),
      saveSession(SESSION_KEYS.EXPIRY, expiryValue),
    ]);

    router.replace(destination);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const normalizedPassword = password.trim();
      const rawLogin = emailOrPhone.trim();
      const isEmailLogin = isEmail(rawLogin);
      const normalizedLogin = isEmailLogin
        ? rawLogin.toLowerCase()
        : rawLogin.replace(/\D/g, "").slice(-10);

      if (!isEmailLogin && normalizedLogin.length !== 10) {
        setError("Enter a valid 10-digit phone number");
        setLoading(false);
        return;
      }
      
      if (userType === "admin") {
        // Admin/Owner login through profiles table
        const searchField = isEmailLogin ? "email" : "phone";
        
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq(searchField, normalizedLogin)
          .in("role", ["superadmin", "admin", "owner", "view_only"])
          .maybeSingle();

        if (profileError || !profile) {
          setError("Invalid email/phone or password");
          setLoading(false);
          return;
        }

        // Verify password
        if (String(profile.password || "").trim() !== normalizedPassword) {
          setError("Invalid email/phone or password");
          setLoading(false);
          return;
        }

        // Check if account is deactivated by superadmin
        if (profile.is_active === false) {
          setError("Your account has been deactivated. Contact your super admin.");
          setLoading(false);
          return;
        }

        // Store user info with permissions
        const userData = {
          id: profile.id,
          name: `${profile.first_name} ${profile.last_name}`,
          email: profile.email,
          phone: profile.phone,
          role: profile.role,
          gym_id: profile.gym_id,
          permissions: profile.permissions
        };
        
        completeLogin(userData, "/admin/dashboard");
        
      } else if (userType === "trainer") {
        // Trainer login - fetch profile data from profiles table
        const searchField = isEmailLogin ? "email" : "phone";
        
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq(searchField, normalizedLogin)
          .eq("role", "trainer")
          .maybeSingle();

        if (profileError || !profile) {
          setError("Invalid email/phone or password");
          setLoading(false);
          return;
        }

        // Verify password
        if (String(profile.password || "").trim() !== normalizedPassword) {
          setError("Invalid email/phone or password");
          setLoading(false);
          return;
        }

        // Store trainer info with gym_id
        const trainerData = {
          id: profile.id,
          name: `${profile.first_name} ${profile.last_name}`,
          email: profile.email,
          phone: profile.phone,
          role: "trainer",
          gym_id: profile.gym_id,
          userType: "trainer"
        };
        
        // Save trainer login timestamp (used to detect credential changes by admin)
        localStorage.setItem("trainer_login_at", Date.now().toString());
        completeLogin(trainerData, "/trainer/dashboard");
      } else {
        const response = await fetch("/api/auth/member-login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            login: normalizedLogin,
            password: normalizedPassword,
          }),
        });
        const result = await response.json();

        if (!response.ok || !result.member) {
          setError(result.error || "Invalid email/phone or password");
          setLoading(false);
          return;
        }

        const memberData = result.member;
        
        completeLogin(memberData, "/user/dashboard", { member: true });
      }
    } catch (err) {
      console.error("Login error:", err);
      setError("An error occurred during login");
    }
    
    setLoading(false);
  };

  return (
    <div className="relative min-h-screen bg-[#f7f3f0] overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-55"
          style={{ backgroundImage: "url('/bgimages/login-gym-bright.jpg')" }}
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.94)_0%,rgba(255,250,246,0.78)_48%,rgba(240,129,61,0.08)_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_20%,rgba(240,129,61,0.16),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.04),rgba(247,243,240,0.72)_94%)]" />
        
        {/* Grid Pattern */}
        <div className="absolute inset-0 opacity-[0.035]">
          <div className="absolute inset-0" style={{
            backgroundImage: `linear-gradient(to right, #1a1c1c 1px, transparent 1px),
                            linear-gradient(to bottom, #1a1c1c 1px, transparent 1px)`,
            backgroundSize: '50px 50px'
          }}></div>
        </div>
      </div>

      <button
        type="button"
        onClick={toggleTheme}
        aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        title={theme === "dark" ? "Light mode" : "Dark mode"}
        className="absolute right-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-[#ded6d0] bg-white/90 text-[#1a1c1c] shadow-sm backdrop-blur-md transition hover:-translate-y-0.5 hover:border-[#f0813d] hover:text-[#9c4400] sm:right-6 sm:top-6"
      >
        {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
      </button>

      <main className="relative z-10 min-h-screen flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-lg">
          {/* Logo and Header */}
          <div className="text-center mb-7 animate-fadeIn">
            <div className="mb-5 flex justify-center transition-transform duration-500 hover:scale-105">
              <SSLogo size="lg" showWordmark={false} />
            </div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#f0813d]/20 bg-white/90 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-[#9c4400] shadow-sm">
              <Sparkles className="h-3.5 w-3.5 text-[#f0813d]" />
              Your fitness workspace
            </div>
            <h1 className="text-4xl font-black tracking-tight text-[#1a1c1c] mb-2">Welcome Back</h1>
            <p className="text-base font-medium text-[#5f5e5e] mb-5">Choose your workspace and continue where you left off.</p>
            
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/90 backdrop-blur-sm border border-[#f0813d]/20 shadow-sm">
              <Shield className="w-4 h-4 text-[#f0813d]" />
              <span className="text-sm font-medium text-[#1a1c1c]">Secure Login</span>
            </div>
          </div>

          {/* Login Card */}
          <div className="relative overflow-hidden bg-white/95 backdrop-blur-xl rounded-[2rem] p-6 border border-[#e8ddd6] shadow-[0_28px_80px_rgba(26,28,28,0.16)] animate-slideUp">
            <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-[#f0813d] via-[#ffb37d] to-[#9c4400]" />
            <div className="absolute -right-20 -top-20 h-44 w-44 rounded-full bg-[#f0813d]/10 blur-3xl" />

            <div className="relative mb-5 flex items-center gap-3 rounded-2xl border border-[#f0813d]/15 bg-gradient-to-r from-[#fff7f1] to-white p-3.5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#1a1c1c] text-white shadow-lg transition-transform duration-300 hover:rotate-3 hover:scale-105">
                <ActiveRoleIcon className="h-5 w-5" />
              </span>
              <div className="min-w-0 text-left">
                <p className="text-sm font-black text-[#1a1c1c]">{activeRole.title}</p>
                <p className="mt-0.5 truncate text-xs font-medium text-[#897267]">{activeRole.detail}</p>
              </div>
              <CheckCircle className="ml-auto h-5 w-5 shrink-0 text-[#f0813d]" />
            </div>

            {/* User Type Selector */}
            <div className="grid grid-cols-3 gap-2 mb-6">
              <button
                onClick={() => setUserType("admin")}
                className={`group py-3 rounded-2xl border text-xs font-bold transition-all duration-300 flex flex-col items-center justify-center gap-1.5 active:scale-95 ${
                  userType === "admin"
                    ? "border-[#f0813d] bg-[#f0813d] text-black -translate-y-1 shadow-[0_12px_28px_rgba(240,129,61,0.28)]"
                    : "border-[#e8ddd6] bg-[#f7f3f0] text-[#5f5e5e] hover:-translate-y-0.5 hover:border-[#f0813d]/40 hover:bg-[#f0813d]/10"
                }`}
              >
                <Building className="w-4 h-4" />
                <span>Admin</span>
              </button>
              <button
                onClick={() => setUserType("trainer")}
                className={`group py-3 rounded-2xl border text-xs font-bold transition-all duration-300 flex flex-col items-center justify-center gap-1.5 active:scale-95 ${
                  userType === "trainer"
                    ? "border-[#f0813d] bg-[#f0813d] text-black -translate-y-1 shadow-[0_12px_28px_rgba(240,129,61,0.28)]"
                    : "border-[#e8ddd6] bg-[#f7f3f0] text-[#5f5e5e] hover:-translate-y-0.5 hover:border-[#f0813d]/40 hover:bg-[#f0813d]/10"
                }`}
              >
                <Dumbbell className="w-4 h-4" />
                <span>Trainer</span>
              </button>
              <button
                onClick={() => setUserType("member")}
                className={`group py-3 rounded-2xl border text-xs font-bold transition-all duration-300 flex flex-col items-center justify-center gap-1.5 active:scale-95 ${
                  userType === "member"
                    ? "border-[#f0813d] bg-[#f0813d] text-black -translate-y-1 shadow-[0_12px_28px_rgba(240,129,61,0.28)]"
                    : "border-[#e8ddd6] bg-[#f7f3f0] text-[#5f5e5e] hover:-translate-y-0.5 hover:border-[#f0813d]/40 hover:bg-[#f0813d]/10"
                }`}
              >
                <User className="w-4 h-4" />
                <span>Member</span>
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1">
                <label className="block text-sm font-medium text-[#1a1c1c] mb-1">
                  <div className="flex items-center gap-2">
                    {emailOrPhone.includes("@") ? (
                      <Mail className="w-4 h-4" />
                    ) : (
                      <Smartphone className="w-4 h-4" />
                    )}
                    Email Address or Phone Number
                  </div>
                </label>
                <div className="group relative rounded-xl transition-all duration-300 focus-within:-translate-y-0.5 focus-within:shadow-[0_10px_30px_rgba(240,129,61,0.12)]">
                  <input
                    type="text"
                    className="w-full pl-11 pr-4 py-3.5 bg-[#fffaf6] border border-[#ded6d0] rounded-xl text-[#1a1c1c] placeholder-[#9a8276] focus:ring-4 focus:ring-[#f0813d]/10 focus:border-[#f0813d] outline-none transition-all text-sm font-medium"
                    placeholder="Enter email or phone number"
                    value={emailOrPhone}
                    onChange={(e) => setEmailOrPhone(e.target.value)}
                    required
                  />
                  {emailOrPhone.includes("@") ? (
                    <Mail className="absolute left-3.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#897267] transition-colors group-focus-within:text-[#f0813d]" />
                  ) : (
                    <Smartphone className="absolute left-3.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#897267] transition-colors group-focus-within:text-[#f0813d]" />
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-sm font-medium text-[#1a1c1c] mb-1">
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4" />
                    Password
                  </div>
                </label>
                <div className="group relative rounded-xl transition-all duration-300 focus-within:-translate-y-0.5 focus-within:shadow-[0_10px_30px_rgba(240,129,61,0.12)]">
                  <input
                    type={showPassword ? "text" : "password"}
                    className="w-full pl-11 pr-12 py-3.5 bg-[#fffaf6] border border-[#ded6d0] rounded-xl text-[#1a1c1c] placeholder-[#9a8276] focus:ring-4 focus:ring-[#f0813d]/10 focus:border-[#f0813d] outline-none transition-all text-sm font-medium"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <Lock className="absolute left-3.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#897267] transition-colors group-focus-within:text-[#f0813d]" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 rounded-lg p-1 text-[#897267] hover:bg-[#f0813d]/10 hover:text-[#f0813d] transition-all"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Remember Me & Forgot Password */}
         

              {/* Error Message */}
              {error && (
                <div className="bg-[#f0813d]/20 backdrop-blur-sm rounded-lg p-3 border border-[#f0813d]/30 flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-[#f0813d] flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-[#9c4400]">{error}</p>
                </div>
              )}

              {/* Login Button */}
              <button
                type="submit"
                disabled={loading}
                className="group w-full py-4 mt-5 bg-[#f0813d] text-black font-black rounded-2xl hover:-translate-y-1 hover:bg-[#1a1c1c] hover:text-white hover:shadow-[0_16px_35px_rgba(26,28,28,0.25)] active:scale-[0.98] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Signing in...
                  </>
                ) : (
                  <>
                    <span>Sign In</span>
                    <ArrowRight className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" />
                  </>
                )}
              </button>

              {/* Demo Credentials */}
            
            </form>

            {/* Footer Links */}
            <div className="mt-6 pt-6 border-t border-[#e8ddd6]">
              <div className="text-center space-y-3">
                <p className="text-sm text-[#5f5e5e]">
                  Don&apos;t have an account?{" "}
                  <button
                    onClick={() => setShowContactModal(true)}
                    className="text-[#f0813d] hover:text-[#f0813d] font-medium transition-colors"
                  >
                    Contact Admin
                  </button>
                </p>
                <div className="flex items-center justify-center gap-4">
                  <Link
                    href="/"
                    className="text-xs text-[#897267] hover:text-[#1a1c1c] transition-colors"
                  >
                    ← Back to Home
                  </Link>
                  <span className="text-gray-500">•</span>
                  
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Notice */}
          <div className="mt-6 text-center">
            <p className="text-xs text-[#5f5e5e]">
              © {new Date().getFullYear()} SFit.ai • Created by Shabiya Solutions
            </p>
            <p className="text-xs text-[#5f5e5e] mt-1">
              Secure login with end-to-end encryption
            </p>
          </div>
        </div>
      </main>

      {/* Contact Admin Modal */}
      {showContactModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full border border-[#e8ddd6] shadow-2xl animate-scale-in">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#f0813d] to-[#f0813d] flex items-center justify-center">
                  <Building className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-[#1a1c1c]">Contact Admin</h3>
                  <p className="text-sm text-[#897267]">Get in touch with us</p>
                </div>
              </div>
              <button
                onClick={() => setShowContactModal(false)}
                className="p-2 hover:bg-[#f7f3f0] rounded-lg transition-colors"
              >
                <AlertCircle className="w-5 h-5 text-gray-400 rotate-45" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Email */}
              <div className="bg-[#fffaf6] backdrop-blur-sm rounded-xl p-4 border border-[#e8ddd6]">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-lg bg-[#f0813d]/20 flex items-center justify-center">
                    <Mail className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-[#897267] mb-1">Email Address</p>
                    <a 
                      href="mailto:shaibyasolutions@gmail.com"
                      className="text-[#1a1c1c] font-medium hover:text-[#f0813d] transition-colors"
                    >
                      shaibyasolutions@gmail.com
                    </a>
                  </div>
                </div>
              </div>

              {/* Phone */}
              <div className="bg-[#fffaf6] backdrop-blur-sm rounded-xl p-4 border border-[#e8ddd6]">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-lg bg-[#f0813d]/20 flex items-center justify-center">
                    <Smartphone className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-[#897267] mb-1">Phone Number</p>
                    <a 
                      href="tel:+917498341146"
                      className="text-[#1a1c1c] font-medium hover:text-[#f0813d] transition-colors"
                    >
                      +91 7498341146
                    </a>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-[#e8ddd6]">
              <p className="text-xs text-[#897267] text-center">
                Our team will get back to you within 24 hours
              </p>
            </div>

            <button
              onClick={() => setShowContactModal(false)}
              className="w-full mt-4 py-3 bg-gradient-to-r from-[#f0813d] to-[#f0813d] text-white font-semibold rounded-lg hover:shadow-xl hover:shadow-[#f0813d]/25 active:scale-95 transition-all"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
