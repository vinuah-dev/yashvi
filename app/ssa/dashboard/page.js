"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Shield, LogOut, Search, Building2, Users, ChevronDown, ChevronUp,
  CheckCircle, XCircle, ToggleLeft, ToggleRight, Loader2,
  ShoppingBag, Activity, Trophy, Zap, Apple, BookOpen, Dumbbell,
  CalendarCheck, CreditCard, Bell, RefreshCw, AlertCircle, X, UserCog,
} from "lucide-react";

const MODULE_ICONS = {
  shop: ShoppingBag, health_tracker: Activity, leaderboard: Trophy,
  challenges: Zap, diet: Apple, knowledge: BookOpen, workout: Dumbbell,
  attendance: CalendarCheck, finance: CreditCard, notifications: Bell,
  referral: Users,
};

function Toast({ message, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, [onClose]);
  return (
    <div className={`fixed top-4 right-4 z-[100] flex items-center gap-2 px-4 py-3 rounded-xl shadow-xl text-sm font-medium ${type === "success" ? "bg-green-500 text-white" : "bg-red-500 text-white"}`}>
      {type === "success" ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
      {message}
      <button onClick={onClose}><X className="w-3 h-3 ml-1 opacity-70" /></button>
    </div>
  );
}

function FeatureToggle({ gymId, module, enabled, ssaToken, onChange }) {
  const [loading, setLoading] = useState(false);
  const Icon = MODULE_ICONS[module.id] || Shield;

  const handleToggle = async () => {
    setLoading(true);
    const res = await fetch("/api/ssa/gyms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "toggle_feature", token: ssaToken,
        gym_id: gymId, module_id: module.id, is_enabled: !enabled,
      }),
    });
    if (res.ok) onChange(module.id, !enabled);
    setLoading(false);
  };

  return (
    <div className={`flex items-center justify-between p-3 rounded-xl border transition-all ${enabled ? "bg-slate-700/50 border-slate-600" : "bg-slate-800/50 border-slate-700 opacity-60"}`}>
      <div className="flex items-center gap-2">
        <Icon className={`w-4 h-4 ${enabled ? "text-blue-400" : "text-slate-500"}`} />
        <span className={`text-sm font-medium ${enabled ? "text-slate-200" : "text-slate-500"}`}>{module.label}</span>
      </div>
      <button onClick={handleToggle} disabled={loading} className="shrink-0">
        {loading ? (
          <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
        ) : enabled ? (
          <ToggleRight className="w-8 h-8 text-green-400" />
        ) : (
          <ToggleLeft className="w-8 h-8 text-slate-500" />
        )}
      </button>
    </div>
  );
}

function GymCard({ gym, modules, ssaToken, showToast }) {
  const [expanded, setExpanded] = useState(false);
  const [access, setAccess] = useState(gym.feature_access || {});
  const [bulkLoading, setBulkLoading] = useState(false);

  const owner = gym.profiles;
  const enabledCount = modules.filter((m) => access[m.id] !== false).length;

  const handleChange = (moduleId, value) => {
    setAccess((prev) => ({ ...prev, [moduleId]: value }));
    showToast(`${value ? "Enabled" : "Disabled"} for ${gym.name}`, value ? "success" : "error");
  };

  const handleBulkToggle = async (enable) => {
    setBulkLoading(true);
    const moduleMap = {};
    modules.forEach((m) => { moduleMap[m.id] = enable; });
    const res = await fetch("/api/ssa/gyms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "bulk_set_features", token: ssaToken, gym_id: gym.id, modules: moduleMap }),
    });
    if (res.ok) {
      setAccess(moduleMap);
      showToast(`${enable ? "All enabled" : "All disabled"} for ${gym.name}`, enable ? "success" : "error");
    }
    setBulkLoading(false);
  };

  const memberModules = modules.filter((m) => m.category === "member");
  const adminModules = modules.filter((m) => m.category === "admin");

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-700/30 transition-colors" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl flex items-center justify-center shrink-0">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-white">{gym.name}</h3>
            <p className="text-xs text-slate-400">{owner ? `${owner.first_name} ${owner.last_name} · ${owner.email}` : "No owner"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs bg-slate-700 text-slate-300 px-2 py-1 rounded-lg flex items-center gap-1">
            <Users className="w-3 h-3" /> {gym.member_count}
          </span>
          <span className={`text-xs px-2 py-1 rounded-lg font-medium ${enabledCount === modules.length ? "bg-green-500/20 text-green-400" : enabledCount === 0 ? "bg-red-500/20 text-red-400" : "bg-yellow-500/20 text-yellow-400"}`}>
            {enabledCount}/{modules.length} on
          </span>
          {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-700 p-4">
          <div className="flex gap-2 mb-4">
            <button onClick={() => handleBulkToggle(true)} disabled={bulkLoading}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-green-600/20 text-green-400 border border-green-600/30 text-sm font-medium hover:bg-green-600/30 disabled:opacity-50">
              {bulkLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />} Enable All
            </button>
            <button onClick={() => handleBulkToggle(false)} disabled={bulkLoading}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-red-600/20 text-red-400 border border-red-600/30 text-sm font-medium hover:bg-red-600/30 disabled:opacity-50">
              {bulkLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />} Disable All
            </button>
          </div>

          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Member Features</p>
          <div className="space-y-2 mb-4">
            {memberModules.map((module) => (
              <FeatureToggle key={module.id} gymId={gym.id} module={module}
                enabled={access[module.id] !== false} ssaToken={ssaToken} onChange={handleChange} />
            ))}
          </div>

          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Admin Features</p>
          <div className="space-y-2">
            {adminModules.map((module) => (
              <FeatureToggle key={module.id} gymId={gym.id} module={module}
                enabled={access[module.id] !== false} ssaToken={ssaToken} onChange={handleChange} />
            ))}
          </div>

          {gym.address && <p className="text-xs text-slate-500 mt-3 pt-3 border-t border-slate-700">📍 {gym.address}</p>}
        </div>
      )}
    </div>
  );
}

export default function SSADashboard() {
  const router = useRouter();
  const [ssa, setSsa] = useState(null);
  const [ssaToken, setSsaToken] = useState(null);
  const [gyms, setGyms] = useState([]);
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState(null);

  const showToast = (message, type = "success") => setToast({ message, type });

  useEffect(() => {
    const token = localStorage.getItem("ssa_token");
    const user = localStorage.getItem("ssa_user");
    if (!token) { router.replace("/auth/login"); return; }
    setSsaToken(token);
    if (user) setSsa(JSON.parse(user));
  }, []);

  const fetchData = useCallback(async () => {
    if (!ssaToken) return;
    setLoading(true);
    try {
      const [gymsRes, modulesRes] = await Promise.all([
        fetch("/api/ssa/gyms", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "list_gyms", token: ssaToken }) }),
        fetch("/api/ssa/gyms", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "list_modules", token: ssaToken }) }),
      ]);
      const gymsData = await gymsRes.json();
      const modulesData = await modulesRes.json();
      if (gymsData.data) setGyms(gymsData.data);
      if (modulesData.data) setModules(modulesData.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [ssaToken]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleLogout = () => {
    localStorage.removeItem("ssa_token");
    localStorage.removeItem("ssa_user");
    router.replace("/auth/login");
  };

  const filteredGyms = gyms.filter((g) =>
    g.name.toLowerCase().includes(search.toLowerCase()) ||
    g.profiles?.email?.toLowerCase().includes(search.toLowerCase())
  );

  const totalMembers = gyms.reduce((s, g) => s + (g.member_count || 0), 0);

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="bg-slate-800 border-b border-slate-700 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-sm leading-none">Super Admin Control</h1>
              <p className="text-xs text-slate-400 leading-none mt-0.5">{ssa?.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => router.push("/ssa/admins")}
              className="flex items-center gap-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 px-3 py-2 rounded-lg transition-colors">
              <UserCog className="w-3.5 h-3.5" /> Manage Gyms
            </button>
            <button onClick={fetchData} className="p-2 hover:bg-slate-700 rounded-lg transition-colors">
              <RefreshCw className="w-4 h-4 text-slate-400" />
            </button>
            <button onClick={handleLogout} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-red-400 px-3 py-2 rounded-lg hover:bg-slate-700 transition-all">
              <LogOut className="w-3.5 h-3.5" /> Logout
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 pb-16">
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: "Total Gyms", value: gyms.length, icon: Building2, color: "text-blue-400" },
            { label: "Total Members", value: totalMembers, icon: Users, color: "text-green-400" },
            { label: "Modules", value: modules.length, icon: Shield, color: "text-purple-400" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-slate-800 border border-slate-700 rounded-2xl p-4 text-center">
              <Icon className={`w-5 h-5 mx-auto mb-1 ${color}`} />
              <p className="text-xl font-bold">{value}</p>
              <p className="text-xs text-slate-400">{label}</p>
            </div>
          ))}
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search gyms or owner email..."
            className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 placeholder-slate-500" />
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
        ) : filteredGyms.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>{search ? "No gyms match your search" : "No gyms found"}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredGyms.map((gym) => (
              <GymCard key={gym.id} gym={gym} modules={modules} ssaToken={ssaToken} showToast={showToast} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
