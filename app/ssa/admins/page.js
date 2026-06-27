"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Shield, ArrowLeft, Plus, Pencil, Trash2, Search, Building2, Users,
  Mail, Phone, Lock, X, Loader2, CheckCircle, AlertCircle, Eye, EyeOff,
  User, ToggleLeft, ToggleRight, MapPin,
} from "lucide-react";

function Toast({ message, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, [onClose]);
  return (
    <div className={`fixed top-4 right-4 z-[100] flex items-center gap-2 px-4 py-3 rounded-xl shadow-xl text-sm font-medium ${type === "success" ? "bg-green-500 text-white" : "bg-red-500 text-white"}`}>
      {type === "success" ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
      {message}
      <button onClick={onClose}><X className="w-3 h-3 ml-2 opacity-70" /></button>
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-slate-700 sticky top-0 bg-slate-800 rounded-t-2xl">
          <h3 className="font-semibold text-white">{title}</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-700 rounded-lg"><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function GymForm({ initial, onSubmit, loading }) {
  const [form, setForm] = useState({
    gym_name: initial?.name || "",
    gym_address: initial?.address || "",
    first_name: initial?.owner?.first_name || "",
    last_name: initial?.owner?.last_name || "",
    email: initial?.owner?.email || "",
    phone: initial?.owner?.phone || "",
    password: "",
  });
  const [showPass, setShowPass] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div className="space-y-4">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Gym Details</p>
      {[
        { key: "gym_name", label: "Gym Name", icon: Building2, placeholder: "FitZone Gym", required: true },
        { key: "gym_address", label: "Address", icon: MapPin, placeholder: "123 Main St, Mumbai" },
      ].map(({ key, label, icon: Icon, placeholder, required }) => (
        <div key={key}>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">{label}{required && <span className="text-red-400 ml-1">*</span>}</label>
          <div className="relative">
            <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input type="text" value={form[key]} onChange={e => set(key, e.target.value)} placeholder={placeholder}
              className="w-full bg-slate-700 border border-slate-600 text-white rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 placeholder-slate-500" />
          </div>
        </div>
      ))}

      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider pt-2">Owner / Super Admin</p>
      {[
        { key: "first_name", label: "First Name", icon: User, placeholder: "John", required: !initial },
        { key: "last_name", label: "Last Name", icon: User, placeholder: "Doe" },
        { key: "email", label: "Email", icon: Mail, placeholder: "owner@gym.com", type: "email", required: !initial },
        { key: "phone", label: "Phone", icon: Phone, placeholder: "+91 98765 43210" },
      ].map(({ key, label, icon: Icon, placeholder, type, required }) => (
        <div key={key}>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">{label}{required && <span className="text-red-400 ml-1">*</span>}</label>
          <div className="relative">
            <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input type={type || "text"} value={form[key]} onChange={e => set(key, e.target.value)} placeholder={placeholder}
              className="w-full bg-slate-700 border border-slate-600 text-white rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 placeholder-slate-500" />
          </div>
        </div>
      ))}

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">
          Password{!initial && <span className="text-red-400 ml-1">*</span>}
          {initial && <span className="text-slate-500 text-xs ml-2">(leave blank to keep)</span>}
        </label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input type={showPass ? "text" : "password"} value={form.password} onChange={e => set("password", e.target.value)} placeholder="••••••••"
            className="w-full bg-slate-700 border border-slate-600 text-white rounded-xl pl-10 pr-10 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 placeholder-slate-500" />
          <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
            {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <button onClick={() => onSubmit(form)} disabled={loading}
        className="w-full bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60 mt-2">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
        {initial ? "Save Changes" : "Create Gym & Owner"}
      </button>
    </div>
  );
}

function DeleteConfirm({ gym, onConfirm, onCancel, loading }) {
  return (
    <Modal title="Delete Gym" onClose={onCancel}>
      <div className="text-center">
        <div className="w-14 h-14 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <Trash2 className="w-6 h-6 text-red-400" />
        </div>
        <p className="text-white font-medium mb-1">{gym.name}</p>
        <p className="text-slate-400 text-sm mb-1">{gym.owner?.email}</p>
        <p className="text-red-400 text-sm mb-6">This will permanently delete the gym, owner account, and all member data.</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 bg-slate-700 text-slate-300 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-600">Cancel</button>
          <button onClick={onConfirm} disabled={loading}
            className="flex-1 bg-red-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-red-700 disabled:opacity-60 flex items-center justify-center gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Delete
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default function SSAGymsPage() {
  const router = useRouter();
  const [token, setToken] = useState(null);
  const [gyms, setGyms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editingGym, setEditingGym] = useState(null);
  const [deletingGym, setDeletingGym] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [togglingId, setTogglingId] = useState(null);

  const showToast = (message, type = "success") => setToast({ message, type });

  useEffect(() => {
    const t = localStorage.getItem("ssa_token");
    if (!t) { router.replace("/ssa/login"); return; }
    setToken(t);
  }, []);

  const fetchGyms = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch("/api/ssa/admins", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list_gyms", token }),
      });
      const data = await res.json();
      if (data.data) setGyms(data.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { fetchGyms(); }, [fetchGyms]);

  const handleAdd = async (form) => {
    setSubmitting(true);
    const res = await fetch("/api/ssa/admins", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add_gym", token, ...form }),
    });
    const data = await res.json();
    if (data.error) showToast(data.error, "error");
    else { showToast("Gym created!"); setShowAdd(false); fetchGyms(); }
    setSubmitting(false);
  };

  const handleEdit = async (form) => {
    setSubmitting(true);
    const res = await fetch("/api/ssa/admins", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "edit_gym", token, gym_id: editingGym.id, owner_id: editingGym.owner?.id, ...form, password: form.password || undefined }),
    });
    const data = await res.json();
    if (data.error) showToast(data.error, "error");
    else { showToast("Updated!"); setEditingGym(null); fetchGyms(); }
    setSubmitting(false);
  };

  const handleToggle = async (gym) => {
    setTogglingId(gym.id);
    const res = await fetch("/api/ssa/admins", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "toggle_gym", token, gym_id: gym.id, is_active: !gym.is_active }),
    });
    const data = await res.json();
    if (data.error) showToast(data.error, "error");
    else { showToast(gym.is_active ? "Gym disabled" : "Gym enabled", gym.is_active ? "error" : "success"); fetchGyms(); }
    setTogglingId(null);
  };

  const handleDelete = async () => {
    setSubmitting(true);
    const res = await fetch("/api/ssa/admins", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete_gym", token, gym_id: deletingGym.id, owner_id: deletingGym.owner?.id }),
    });
    const data = await res.json();
    if (data.error) showToast(data.error, "error");
    else { showToast("Deleted!"); setDeletingGym(null); fetchGyms(); }
    setSubmitting(false);
  };

  const filtered = gyms.filter(g =>
    `${g.name} ${g.owner?.email} ${g.owner?.first_name} ${g.owner?.last_name}`.toLowerCase().includes(search.toLowerCase())
  );

  const activeCount = gyms.filter(g => g.is_active !== false).length;

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="bg-slate-800 border-b border-slate-700 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push("/ssa/dashboard")} className="p-2 hover:bg-slate-700 rounded-lg">
              <ArrowLeft className="w-4 h-4 text-slate-400" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center"><Shield className="w-4 h-4 text-white" /></div>
              <div>
                <h1 className="font-bold text-sm leading-none">Manage Gyms</h1>
                <p className="text-xs text-slate-400 leading-none mt-0.5">Add, edit, disable or delete gyms</p>
              </div>
            </div>
          </div>
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-xl text-sm font-medium">
            <Plus className="w-4 h-4" /> Add Gym
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 pb-16">
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { label: "Total Gyms", value: gyms.length, color: "text-blue-400" },
            { label: "Active", value: activeCount, color: "text-green-400" },
            { label: "Disabled", value: gyms.length - activeCount, color: "text-red-400" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-slate-800 border border-slate-700 rounded-2xl p-4 text-center">
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-slate-400 mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search gym name, owner email..."
            className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 placeholder-slate-500" />
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>{search ? "No results" : "No gyms yet"}</p>
            {!search && <button onClick={() => setShowAdd(true)} className="mt-4 bg-red-600 text-white px-4 py-2 rounded-xl text-sm font-medium">Add First Gym</button>}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(gym => (
              <div key={gym.id} className={`bg-slate-800 border rounded-2xl p-4 transition-all ${gym.is_active === false ? "border-slate-700 opacity-60" : "border-slate-700"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${gym.is_active === false ? "bg-slate-700" : "bg-gradient-to-br from-blue-600 to-indigo-700"}`}>
                      <Building2 className="w-5 h-5 text-white" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-white truncate">{gym.name}</p>
                        {gym.is_active === false && <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full shrink-0">Disabled</span>}
                      </div>
                      {gym.address && <p className="text-xs text-slate-500 flex items-center gap-1 truncate"><MapPin className="w-3 h-3" />{gym.address}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => handleToggle(gym)} disabled={togglingId === gym.id} className="p-2 hover:bg-slate-700 rounded-lg" title={gym.is_active === false ? "Enable" : "Disable"}>
                      {togglingId === gym.id ? <Loader2 className="w-4 h-4 animate-spin text-slate-400" /> :
                        gym.is_active === false ? <ToggleLeft className="w-5 h-5 text-slate-500" /> : <ToggleRight className="w-5 h-5 text-green-400" />}
                    </button>
                    <button onClick={() => setEditingGym(gym)} className="p-2 hover:bg-blue-500/20 rounded-lg"><Pencil className="w-4 h-4 text-blue-400" /></button>
                    <button onClick={() => setDeletingGym(gym)} className="p-2 hover:bg-red-500/20 rounded-lg"><Trash2 className="w-4 h-4 text-red-400" /></button>
                  </div>
                </div>

                {gym.owner && (
                  <div className="mt-3 pt-3 border-t border-slate-700 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 bg-slate-700 rounded-lg flex items-center justify-center text-xs font-bold text-slate-300">
                        {gym.owner.first_name?.[0]}{gym.owner.last_name?.[0]}
                      </div>
                      <div>
                        <p className="text-sm text-slate-300">{gym.owner.first_name} {gym.owner.last_name}</p>
                        <p className="text-xs text-slate-500 flex items-center gap-1"><Mail className="w-3 h-3" />{gym.owner.email}</p>
                      </div>
                    </div>
                    <span className="text-xs bg-slate-700 text-slate-300 px-2 py-1 rounded-lg flex items-center gap-1">
                      <Users className="w-3 h-3" /> {gym.member_count} members
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showAdd && <Modal title="Add New Gym" onClose={() => setShowAdd(false)}><GymForm onSubmit={handleAdd} loading={submitting} /></Modal>}
      {editingGym && <Modal title="Edit Gym" onClose={() => setEditingGym(null)}><GymForm initial={editingGym} onSubmit={handleEdit} loading={submitting} /></Modal>}
      {deletingGym && <DeleteConfirm gym={deletingGym} onConfirm={handleDelete} onCancel={() => setDeletingGym(null)} loading={submitting} />}
    </div>
  );
}
