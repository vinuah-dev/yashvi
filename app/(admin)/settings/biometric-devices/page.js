"use client";

import { useState, useEffect, useCallback } from "react";
import Header from "@/components/layout/Header";
import { useAuthContext } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import {
  Fingerprint,
  Plus,
  Trash2,
  Edit2,
  MapPin,
  Wifi,
  WifiOff,
  X,
  Loader2,
  Info,
} from "lucide-react";

function timeAgo(ts) {
  if (!ts) return "Never connected";
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days > 1 ? "s" : ""} ago`;
}

function isOnline(ts) {
  if (!ts) return false;
  // Considered "online" if seen within the last 10 minutes.
  return Date.now() - new Date(ts).getTime() < 10 * 60 * 1000;
}

export default function BiometricDevicesPage() {
  const { selectedGym, user: authUser } = useAuthContext();
  const { showSuccess, showError } = useToast();

  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ device_sn: "", device_name: "", location: "" });
  const [access, setAccess] = useState({ graceDays: 7, blockMode: "disable" });
  const [accessDraft, setAccessDraft] = useState({ graceDays: "7", blockMode: "disable" });
  const [accessSaving, setAccessSaving] = useState(false);

  const call = useCallback(
    async (payload) => {
      const res = await fetch("/api/settings/biometric-devices", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": String(authUser?.id || ""),
        },
        body: JSON.stringify({ ...payload, p_gym_id: selectedGym?.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Request failed");
      return json;
    },
    [authUser?.id, selectedGym?.id],
  );

  const fetchDevices = useCallback(async () => {
    if (!selectedGym?.id) return;
    setLoading(true);
    try {
      const json = await call({ action: "list" });
      setDevices(json.data || []);
    } catch (e) {
      showError(e.message);
    } finally {
      setLoading(false);
    }
  }, [call, selectedGym?.id, showError]);

  const fetchAccess = useCallback(async () => {
    if (!selectedGym?.id) return;
    try {
      const res = await fetch("/api/biometric/access", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": String(authUser?.id || ""),
        },
        body: JSON.stringify({ action: "settings", p_gym_id: selectedGym.id }),
      });
      const json = await res.json();
      if (json?.data) {
        setAccess(json.data);
        setAccessDraft({
          graceDays: String(json.data.graceDays),
          blockMode: json.data.blockMode,
        });
      }
    } catch {
      // keep defaults
    }
  }, [authUser?.id, selectedGym?.id]);

  const saveAccess = async () => {
    const days = Number(accessDraft.graceDays);
    if (!Number.isFinite(days) || days < 0 || days > 90) {
      showError("Buffer days must be between 0 and 90.");
      return;
    }
    setAccessSaving(true);
    try {
      const res = await fetch("/api/settings/biometric-access", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": String(authUser?.id || ""),
        },
        body: JSON.stringify({
          p_gym_id: selectedGym?.id,
          biometric_grace_days: days,
          biometric_block_mode: accessDraft.blockMode,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to save");
      setAccess({ graceDays: days, blockMode: accessDraft.blockMode });
      showSuccess("Access rules saved");
    } catch (e) {
      showError(e.message);
    } finally {
      setAccessSaving(false);
    }
  };

  useEffect(() => {
    fetchDevices();
    fetchAccess();
  }, [fetchDevices, fetchAccess]);

  const openAdd = () => {
    setEditing(null);
    setForm({ device_sn: "", device_name: "", location: "" });
    setShowModal(true);
  };

  const openEdit = (device) => {
    setEditing(device);
    setForm({
      device_sn: device.device_sn,
      device_name: device.device_name || "",
      location: device.location || "",
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!editing && !form.device_sn.trim()) {
      showError("Serial Number is required");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await call({
          action: "update",
          id: editing.id,
          device_name: form.device_name,
          location: form.location,
        });
        showSuccess("Device updated");
      } else {
        await call({
          action: "add",
          device_sn: form.device_sn,
          device_name: form.device_name,
          location: form.location,
        });
        showSuccess("Device registered");
      }
      setShowModal(false);
      fetchDevices();
    } catch (e) {
      showError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (device) => {
    if (!window.confirm(`Remove device "${device.device_name || device.device_sn}"? Attendance from it will stop being recorded.`)) return;
    try {
      await call({ action: "delete", id: device.id });
      showSuccess("Device removed");
      fetchDevices();
    } catch (e) {
      showError(e.message);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 safe-area-inset-bottom">
      <Header title="Biometric Devices" />

      <main className="px-3 py-4 space-y-4 mb-20">
        {/* Info banner */}
        <div className="mx-1 rounded-2xl border border-[#f0813d]/20 bg-[#f0813d]/5 p-4">
          <div className="flex gap-3">
            <Info className="h-5 w-5 shrink-0 text-[#f0813d]" />
            <div className="text-sm text-gray-700">
              <p className="font-semibold text-gray-900 mb-1">How it works</p>
              <p className="text-xs leading-relaxed text-gray-600">
                Each scanner is identified by its <span className="font-semibold">Serial Number</span> (printed on the device / in its menu — not the IP address). Register it here once and every fingerprint punch from it is automatically recorded for this gym. The SN never changes, even if the device's IP or network does.
              </p>
            </div>
          </div>
        </div>

        {/* Access rules */}
        <div className="mx-1 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="font-semibold text-gray-900 mb-1">Expired Member Access</p>
          <p className="text-xs text-gray-500 mb-4 leading-relaxed">
            The scanner opens the gate on its own, so an expired member keeps getting in until their access is withdrawn on the device.
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-1.5">
                Buffer period after expiry
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="90"
                  value={accessDraft.graceDays}
                  onChange={(e) => setAccessDraft((d) => ({ ...d, graceDays: e.target.value }))}
                  className="w-24 rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-[#f0813d] focus:ring-2 focus:ring-[#f0813d]/20"
                />
                <span className="text-sm text-gray-600">days</span>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Members can still enter for this many days after expiry, so they get a chance to renew. Set 0 to block immediately.
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-1.5">
                How to block
              </label>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setAccessDraft((d) => ({ ...d, blockMode: "disable" }))}
                  className={`w-full text-left rounded-xl border p-3 transition-all ${
                    accessDraft.blockMode === "disable"
                      ? "border-[#f0813d] bg-[#f0813d]/5"
                      : "border-gray-200 bg-white"
                  }`}
                >
                  <p className="text-sm font-semibold text-gray-900">Revoke access (recommended)</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Fingerprint stays on the device. Renewing turns access straight back on — nothing to re-enroll.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setAccessDraft((d) => ({ ...d, blockMode: "delete" }))}
                  className={`w-full text-left rounded-xl border p-3 transition-all ${
                    accessDraft.blockMode === "delete"
                      ? "border-[#f0813d] bg-[#f0813d]/5"
                      : "border-gray-200 bg-white"
                  }`}
                >
                  <p className="text-sm font-semibold text-gray-900">Remove from device</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Works on every device, but the fingerprint is erased and has to be enrolled again on renewal. Use this only if the option above doesn&apos;t work on your scanner.
                  </p>
                </button>
              </div>
            </div>

            <button
              onClick={saveAccess}
              disabled={
                accessSaving ||
                (String(access.graceDays) === accessDraft.graceDays &&
                  access.blockMode === accessDraft.blockMode)
              }
              className="w-full rounded-xl bg-gradient-to-r from-[#f0813d] to-[#9c4400] py-2.5 text-sm font-bold text-white disabled:opacity-50 active:scale-95 transition-all"
            >
              {accessSaving ? "Saving..." : "Save Access Rules"}
            </button>
          </div>
        </div>

        {/* Add button */}
        <button
          onClick={openAdd}
          className="mx-1 flex w-[calc(100%-0.5rem)] items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#f0813d] to-[#9c4400] py-3.5 text-sm font-bold text-white shadow-lg active:scale-95 transition-all"
        >
          <Plus className="h-5 w-5" />
          Register a Scanner
        </button>

        {/* Devices list */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-[#f0813d]" />
          </div>
        ) : devices.length === 0 ? (
          <div className="mx-1 rounded-2xl border border-gray-200 bg-white p-8 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100">
              <Fingerprint className="h-7 w-7 text-gray-400" />
            </div>
            <p className="font-semibold text-gray-900">No scanners registered yet</p>
            <p className="mt-1 text-sm text-gray-500">Add your gym's fingerprint device to start recording attendance automatically.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {devices.map((d) => {
              const online = isOnline(d.last_seen_at);
              return (
                <div key={d.id} className="mx-1 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#f0813d]/10">
                      <Fingerprint className="h-5 w-5 text-[#f0813d]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-bold text-gray-900">{d.device_name || "Unnamed Scanner"}</p>
                        <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${online ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                          {online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                          {online ? "Online" : "Offline"}
                        </span>
                      </div>
                      <p className="mt-0.5 font-mono text-xs text-gray-500">SN: {d.device_sn}</p>
                      {d.location && (
                        <p className="mt-1 flex items-center gap-1 text-xs text-gray-500">
                          <MapPin className="h-3 w-3" /> {d.location}
                        </p>
                      )}
                      <p className="mt-1 text-[11px] text-gray-400">Last seen: {timeAgo(d.last_seen_at)}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex justify-end gap-2 border-t border-gray-100 pt-3">
                    <button
                      onClick={() => openEdit(d)}
                      className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f0813d]/10 text-[#9c4400] active:scale-95"
                      title="Edit label / location"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(d)}
                      className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 text-red-500 active:scale-95"
                      title="Remove device"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Add / Edit modal */}
      {showModal && (
        <div className="fixed inset-0 z-[110] flex items-end justify-center bg-black/60 p-3 backdrop-blur-sm sm:items-center">
          <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 p-4">
              <h3 className="text-lg font-bold text-gray-900">
                {editing ? "Edit Scanner" : "Register a Scanner"}
              </h3>
              <button onClick={() => setShowModal(false)} className="rounded-full p-2 hover:bg-gray-100">
                <X className="h-5 w-5 text-gray-400" />
              </button>
            </div>

            <div className="space-y-4 p-4">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-gray-800">
                  Serial Number *
                </label>
                <input
                  type="text"
                  disabled={!!editing}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#f0813d] focus:ring-2 focus:ring-[#f0813d]/20 disabled:bg-gray-50 disabled:text-gray-400"
                  placeholder="e.g. CJTM201960483"
                  value={form.device_sn}
                  onChange={(e) => setForm((f) => ({ ...f, device_sn: e.target.value.trim() }))}
                />
                <p className="mt-1 text-xs text-gray-500">
                  {editing ? "Serial Number can't be changed. Delete and re-add if the device changed." : "Find it on the device sticker or in its Menu → System Info. Not the IP address."}
                </p>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-gray-800">
                  Device Name
                </label>
                <input
                  type="text"
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#f0813d] focus:ring-2 focus:ring-[#f0813d]/20"
                  placeholder="e.g. Main Entrance F22"
                  value={form.device_name}
                  onChange={(e) => setForm((f) => ({ ...f, device_name: e.target.value }))}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-gray-800">
                  Location
                </label>
                <input
                  type="text"
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#f0813d] focus:ring-2 focus:ring-[#f0813d]/20"
                  placeholder="e.g. Front Desk"
                  value={form.location}
                  onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex gap-2 border-t border-gray-100 p-4">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 rounded-xl bg-gray-100 py-3 text-sm font-semibold text-gray-700 active:scale-95"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 rounded-xl bg-gradient-to-r from-[#f0813d] to-[#9c4400] py-3 text-sm font-bold text-white disabled:opacity-50 active:scale-95"
              >
                {saving ? "Saving..." : editing ? "Save Changes" : "Register"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
