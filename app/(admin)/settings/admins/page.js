"use client";

import { useState, useEffect, useCallback } from "react";
import Header from "@/components/layout/Header";
import { useAuthContext } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import {
  Shield, ShieldCheck, ShieldOff, Plus, X, Trash2, Eye,
  EyeOff, UserPlus, Users, ChevronDown, ChevronUp, Key,
  Settings, AlertTriangle, CheckCircle, Lock, Unlock, Edit3,
  Crown, ShieldAlert,
} from "lucide-react";

const ROLE_CONFIG = {
  superadmin: { label: "Super Admin", color: "bg-[#f0813d]/15 text-[#9c4400]", icon: <Crown className="w-3.5 h-3.5" /> },
  owner: { label: "Owner", color: "bg-[#f0813d]/15 text-[#9c4400]", icon: <ShieldCheck className="w-3.5 h-3.5" /> },
  admin: { label: "Admin", color: "bg-[#f0813d]/15 text-[#9c4400]", icon: <Shield className="w-3.5 h-3.5" /> },
  view_only: { label: "View Only", color: "bg-gray-100 text-gray-600", icon: <Eye className="w-3.5 h-3.5" /> },
};

const ALL_PERMISSIONS = [
  { key: "dashboard", label: "Dashboard" },
  { key: "members", label: "Members" },
  { key: "attendance", label: "Attendance" },
  { key: "announcements", label: "Announcements" },
  { key: "finance", label: "Finance" },
  { key: "analytics", label: "Analytics" },
  { key: "monitoring", label: "Monitoring" },
  { key: "settings", label: "Settings" },
  { key: "inquiries", label: "Inquiries" },
];

// ─── Add Admin Modal ─────────────────────────────────────────
function AddAdminModal({ open, onClose, onAdd }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("admin");
  const [permissions, setPermissions] = useState({
    dashboard: true, members: true, attendance: true, announcements: true,
    finance: false, analytics: true, monitoring: true, settings: true, inquiries: true,
  });
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const togglePerm = (key) => setPermissions(p => ({ ...p, [key]: !p[key] }));

  const handleAdd = async () => {
    if (!firstName.trim() || !phone.trim() || !password.trim()) return;
    setSaving(true);
    await onAdd({
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      email: email.trim() || null,
      phone: phone.trim(),
      password: password.trim(),
      role,
      permissions: role === "admin" ? permissions : undefined,
    });
    setSaving(false);
    setFirstName(""); setLastName(""); setEmail(""); setPhone(""); setPassword(""); setRole("admin");
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-[#f0813d]" /> Add Admin
          </h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"><X className="w-4 h-4" /></button>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">First Name *</label>
              <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="First name"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#f0813d]/20 focus:border-[#f0813d]/40" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Last Name</label>
              <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Last name"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#f0813d]/20 focus:border-[#f0813d]/40" />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Phone *</label>
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone number"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#f0813d]/20 focus:border-[#f0813d]/40" />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email (optional)"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#f0813d]/20 focus:border-[#f0813d]/40" />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Password *</label>
            <input type="text" value={password} onChange={e => setPassword(e.target.value)} placeholder="Set password"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#f0813d]/20 focus:border-[#f0813d]/40" />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 mb-2 block">Role</label>
            <div className="flex gap-2">
              {[{ key: "admin", label: "Admin" }, { key: "view_only", label: "View Only" }].map(r => (
                <button key={r.key} onClick={() => setRole(r.key)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                    role === r.key ? "border-[#f0813d]/40 bg-[#f0813d]/10 text-[#9c4400]" : "border-gray-200 text-gray-500"
                  }`}>{r.label}</button>
              ))}
            </div>
          </div>

          {role === "admin" && (
            <div>
              <label className="text-xs font-medium text-gray-500 mb-2 block">Permissions</label>
              <div className="grid grid-cols-2 gap-2">
                {ALL_PERMISSIONS.map(p => (
                  <button key={p.key} onClick={() => togglePerm(p.key)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium transition-all ${
                      permissions[p.key] ? "border-[#f0813d]/30 bg-[#f0813d]/10 text-[#9c4400]" : "border-gray-200 text-gray-400"
                    }`}>
                    {permissions[p.key] ? <CheckCircle className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button onClick={handleAdd} disabled={!firstName.trim() || !phone.trim() || !password.trim() || saving}
            className="w-full py-3 bg-[#f0813d] text-white rounded-xl font-semibold text-sm active:scale-95 transition-transform disabled:opacity-50">
            {saving ? "Adding..." : "Add Admin"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────
export default function AdminManagementPage() {
  const { user, selectedGym, isReady } = useAuthContext();
  const { showToast } = useToast();

  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [editingPerms, setEditingPerms] = useState(null);
  const [localPerms, setLocalPerms] = useState({});

  const gymId = selectedGym?.id;
  const isSuperAdmin = user?.role === "superadmin";

  const apiCall = useCallback(async (body) => {
    const res = await fetch("/api/superadmin", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-user-id": user?.id || "" },
      body: JSON.stringify(body),
    });
    return res.json();
  }, [user?.id]);

  const fetchAdmins = useCallback(async () => {
    if (!gymId) return;
    const json = await apiCall({ action: "list" });
    setAdmins(json.data || []);
    setLoading(false);
  }, [gymId, apiCall]);

  useEffect(() => {
    if (gymId && isReady) fetchAdmins();
    else if (isReady) setLoading(false);
  }, [gymId, isReady, fetchAdmins]);

  const handleToggleAccess = async (adminId, name, newState) => {
    setProcessing(true);
    const json = await apiCall({ action: "toggle_access", admin_id: adminId, is_active: newState });
    if (json.data?.success) {
      showToast(`${name} ${newState ? "activated" : "deactivated"}`, "success");
      fetchAdmins();
    } else {
      showToast(json.error || "Failed", "error");
    }
    setProcessing(false);
    setConfirmAction(null);
  };

  const handleAddAdmin = async (data) => {
    const json = await apiCall({ action: "add_admin", ...data });
    if (json.data) {
      showToast("Admin added successfully", "success");
      fetchAdmins();
    } else {
      showToast(json.error || "Failed to add", "error");
    }
  };

  const handleRemoveAdmin = async (adminId) => {
    setProcessing(true);
    const json = await apiCall({ action: "remove_admin", admin_id: adminId });
    if (json.success) {
      showToast("Admin removed", "success");
      fetchAdmins();
    } else {
      showToast(json.error || "Failed", "error");
    }
    setProcessing(false);
    setConfirmAction(null);
  };

  const handleChangeRole = async (adminId, newRole) => {
    const json = await apiCall({ action: "change_role", admin_id: adminId, new_role: newRole });
    if (json.success) {
      showToast("Role updated", "success");
      fetchAdmins();
    } else {
      showToast(json.error || "Failed", "error");
    }
  };

  const handleUpdatePermissions = async (adminId, permissions) => {
    const json = await apiCall({ action: "update_permissions", admin_id: adminId, permissions });
    if (json.data?.success) {
      showToast("Permissions updated", "success");
      fetchAdmins();
      setEditingPerms(null);
    } else {
      showToast(json.error || "Failed", "error");
    }
  };

  if (!isSuperAdmin && isReady) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
        <Header title="Admin Management" />
        <div className="flex flex-col items-center justify-center py-20 px-4">
          <ShieldOff className="w-16 h-16 text-gray-300 mb-4" />
          <h3 className="text-gray-800 font-bold text-lg mb-1">Access Denied</h3>
          <p className="text-gray-500 text-sm text-center">Only super admins can manage other admins.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
        <Header title="Admin Management" />
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-12 h-12 border-4 border-[#f0813d] border-t-transparent rounded-full animate-spin mb-4"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 mb-17 safe-area-inset-bottom">
      <Header title="Admin Management" />
      <main className="px-3 py-3 space-y-3">

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 text-center">
            <p className="text-2xl font-black text-gray-800">{admins.length}</p>
            <p className="text-[10px] text-gray-400">Total Admins</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 text-center">
            <p className="text-2xl font-black text-[#f0813d]">{admins.filter(a => a.is_active !== false).length}</p>
            <p className="text-[10px] text-gray-400">Active</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 text-center">
            <p className="text-2xl font-black text-[#f0813d]">{admins.filter(a => a.is_active === false).length}</p>
            <p className="text-[10px] text-gray-400">Inactive</p>
          </div>
        </div>

        {/* Add Admin Button */}
        <button onClick={() => setShowAddModal(true)}
          className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-[#f0813d] to-[#9c4400] text-white rounded-xl font-semibold text-sm active:scale-95 transition-transform shadow-md">
          <UserPlus className="w-4 h-4" /> Add New Admin
        </button>

        {/* Admin List */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden divide-y divide-gray-50">
          {admins.map(admin => {
            const cfg = ROLE_CONFIG[admin.role] || ROLE_CONFIG.admin;
            const isMe = admin.id === user?.id;
            const isProtected = admin.role === "superadmin" || admin.role === "owner";
            const isExpanded = expandedId === admin.id;
            const isActive = admin.is_active !== false;
            const isEditingPermsForThis = editingPerms === admin.id;

            return (
              <div key={admin.id}>
                <div className={`flex items-center gap-3 px-4 py-3 cursor-pointer active:bg-gray-50 ${!isActive ? "opacity-50" : ""}`}
                  onClick={() => { setExpandedId(isExpanded ? null : admin.id); setEditingPerms(null); }}>
                  {/* Avatar */}
                  <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${
                    admin.role === "superadmin" ? "from-[#f0813d] to-[#9c4400]" :
                    admin.role === "owner" ? "from-[#f0813d] to-[#9c4400]" :
                    "from-[#f0813d] to-[#9c4400]"
                  } flex items-center justify-center text-white font-bold text-sm`}>
                    {(admin.first_name || "?")[0]}{(admin.last_name || "")[0] || ""}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm text-gray-800 truncate">
                        {admin.first_name} {admin.last_name} {isMe && <span className="text-[#f0813d] text-xs">(You)</span>}
                      </p>
                    </div>
                    <p className="text-xs text-gray-400 truncate">{admin.phone || admin.email}</p>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.color}`}>
                      {cfg.icon} {cfg.label}
                    </span>
                    {!isActive && <span className="text-xs bg-[#f0813d]/15 text-[#f0813d] px-2 py-0.5 rounded-full font-semibold">Inactive</span>}
                  </div>

                  {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                </div>

                {/* Expanded Actions */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-1 bg-gray-50/50 space-y-3">
                    {/* Info */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {admin.email && <div><span className="text-gray-400">Email:</span> <span className="text-gray-700">{admin.email}</span></div>}
                      {admin.phone && <div><span className="text-gray-400">Phone:</span> <span className="text-gray-700">{admin.phone}</span></div>}
                      <div><span className="text-gray-400">Joined:</span> <span className="text-gray-700">{new Date(admin.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span></div>
                    </div>

                    {/* Actions (only for non-protected roles) */}
                    {!isProtected && !isMe && (
                      <div className="flex flex-wrap gap-2">
                        {/* Toggle Active */}
                        <button
                          onClick={() => setConfirmAction({
                            type: isActive ? "deactivate" : "activate",
                            adminId: admin.id,
                            name: `${admin.first_name} ${admin.last_name}`,
                          })}
                          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border active:scale-95 transition-transform ${
                            isActive ? "bg-[#f0813d]/10 border-[#f0813d]/20 text-[#9c4400]" : "bg-[#f0813d]/10 border-[#f0813d]/20 text-[#9c4400]"
                          }`}>
                          {isActive ? <><Lock className="w-3.5 h-3.5" /> Deactivate</> : <><Unlock className="w-3.5 h-3.5" /> Activate</>}
                        </button>

                        {/* Change Role */}
                        <button
                          onClick={() => handleChangeRole(admin.id, admin.role === "admin" ? "view_only" : "admin")}
                          className="flex items-center gap-1.5 px-3 py-2 bg-[#f0813d]/10 border border-[#f0813d]/20 rounded-lg text-xs font-medium text-[#9c4400] active:scale-95 transition-transform">
                          <Edit3 className="w-3.5 h-3.5" />
                          {admin.role === "admin" ? "Set View Only" : "Set Admin"}
                        </button>

                        {/* Edit Permissions (admin only) */}
                        {admin.role === "admin" && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setEditingPerms(isEditingPermsForThis ? null : admin.id); setLocalPerms(admin.permissions || {}); }}
                            className="flex items-center gap-1.5 px-3 py-2 bg-[#f0813d]/10 border border-[#f0813d]/20 rounded-lg text-xs font-medium text-[#9c4400] active:scale-95 transition-transform">
                            <Settings className="w-3.5 h-3.5" /> Permissions
                          </button>
                        )}

                        {/* Remove */}
                        <button
                          onClick={() => setConfirmAction({ type: "remove", adminId: admin.id, name: `${admin.first_name} ${admin.last_name}` })}
                          className="flex items-center gap-1.5 px-3 py-2 bg-[#f0813d]/10 border border-[#f0813d]/20 rounded-lg text-xs font-medium text-[#f0813d] active:scale-95 transition-transform">
                          <Trash2 className="w-3.5 h-3.5" /> Remove
                        </button>
                      </div>
                    )}

                    {isProtected && !isMe && (
                      <p className="text-xs text-gray-400 italic">This role cannot be modified.</p>
                    )}

                    {isMe && (
                      <p className="text-xs text-[#f0813d] italic">You cannot modify your own account.</p>
                    )}

                    {/* Permissions Editor */}
                    {isEditingPermsForThis && admin.role === "admin" && (
                      <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-2">
                        <p className="text-xs font-semibold text-gray-700">Edit Permissions</p>
                        <div className="grid grid-cols-2 gap-2">
                          {ALL_PERMISSIONS.map(p => (
                            <button key={p.key} onClick={() => setLocalPerms(prev => ({ ...prev, [p.key]: !prev[p.key] }))}
                              className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
                                localPerms[p.key] ? "border-[#f0813d]/30 bg-[#f0813d]/10 text-[#9c4400]" : "border-gray-200 text-gray-400"
                              }`}>
                              {localPerms[p.key] ? <CheckCircle className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                              {p.label}
                            </button>
                          ))}
                        </div>
                        <button onClick={() => handleUpdatePermissions(admin.id, localPerms)}
                          className="w-full py-2.5 bg-[#f0813d] text-white rounded-xl text-xs font-semibold active:scale-95">
                          Save Permissions
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="h-4"></div>
      </main>

      <AddAdminModal open={showAddModal} onClose={() => setShowAddModal(false)} onAdd={handleAddAdmin} />

      {/* Confirm Dialog */}
      {confirmAction && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full shadow-xl">
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${confirmAction.type ==="remove" ?"bg-[#f0813d]/15" :"bg-[#f0813d]/15"}`}>
                <AlertTriangle className={`w-5 h-5 ${confirmAction.type === "remove" ? "text-white" : "text-white"}`} />
              </div>
              <h3 className="font-bold text-gray-900">
                {confirmAction.type === "remove" ? "Remove Admin" : confirmAction.type === "deactivate" ? "Deactivate Admin" : "Activate Admin"}
              </h3>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              {confirmAction.type === "remove"
                ? `Remove ${confirmAction.name}? This cannot be undone.`
                : `${confirmAction.type === "deactivate" ? "Deactivate" : "Activate"} ${confirmAction.name}? They ${confirmAction.type === "deactivate" ? "won't" : "will"} be able to login.`}
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmAction(null)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium">Cancel</button>
              <button onClick={() => {
                if (confirmAction.type === "remove") handleRemoveAdmin(confirmAction.adminId);
                else handleToggleAccess(confirmAction.adminId, confirmAction.name, confirmAction.type === "activate");
              }} className={`flex-1 py-2.5 rounded-xl text-sm font-medium text-white ${confirmAction.type === "remove" ? "bg-[#f0813d]" : "bg-[#f0813d]"}`}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
