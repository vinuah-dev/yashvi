"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/layout/Header";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/contexts/ToastContext";

export default function NotificationsSettingsPage() {
  const router = useRouter();
  const { showSuccess, showError } = useToast();
  const [fetching, setFetching] = useState(true);
  const [saving, setSaving] = useState(false);
  const [gymId, setGymId] = useState(null);
  const [settings, setSettings] = useState({
    // Attendance Alerts
    attendanceReminder: true,
    attendanceReminderTime: "06:00",
    noShowAlert: true,
    noShowDays: 3,

    // Payment Reminders
    paymentReminder: true,
    paymentReminderDays: 3,
    overdueAlert: true,

    // Member Notifications
    welcomeMessage: true,
    birthdayWishes: true,
    expiryReminder: true,
    expiryReminderDays: 7,

    // Channels
    whatsappEnabled: true,
    smsEnabled: false,
    pushEnabled: true,
  });

  useEffect(() => {
    fetchNotificationSettings();
  }, []);

  const fetchNotificationSettings = async () => {
    try {
      setFetching(true);
      
      // Get gym ID from localStorage
      const storedGym = localStorage.getItem("selectedGym");
      if (!storedGym) {
        console.error("No gym selected");
        router.push("/admin/dashboard");
        return;
      }

      const gym = JSON.parse(storedGym);
      setGymId(gym.id);

      // Fetch notification settings from database
      const { data: notificationData, error } = await supabase
        .from("notification_settings")
        .select("*")
        .eq("gym_id", gym.id)
        .single();

      if (error && error.code !== "PGRST116") {
        // PGRST116 is "not found" error - we'll create default settings
        throw error;
      }

      if (notificationData) {
        // Map database column names (snake_case) to component state (camelCase)
        setSettings({
          attendanceReminder: notificationData.attendance_reminder ?? true,
          attendanceReminderTime: notificationData.attendance_reminder_time || "06:00",
          noShowAlert: notificationData.no_show_alert ?? true,
          noShowDays: notificationData.no_show_days ?? 3,
          paymentReminder: notificationData.payment_reminder ?? true,
          paymentReminderDays: notificationData.payment_reminder_days ?? 3,
          overdueAlert: notificationData.overdue_alert ?? true,
          welcomeMessage: notificationData.welcome_message ?? true,
          birthdayWishes: notificationData.birthday_wishes ?? true,
          expiryReminder: notificationData.expiry_reminder ?? true,
          expiryReminderDays: notificationData.expiry_reminder_days ?? 7,
          whatsappEnabled: notificationData.whatsapp_enabled ?? true,
          smsEnabled: notificationData.sms_enabled ?? false,
          pushEnabled: notificationData.push_enabled ?? true,
        });
      }
    } catch (error) {
      console.error("Error fetching notification settings:", error);
      // Continue with default settings if fetch fails
    } finally {
      setFetching(false);
    }
  };

  const updateSetting = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (!gymId) return;

    setSaving(true);
    try {
      // Get current user for updated_by
      const storedUser = localStorage.getItem("gymUser");
      const user = storedUser ? JSON.parse(storedUser) : null;

      // Map component state (camelCase) to database column names (snake_case)
      const settingsData = {
        gym_id: gymId,
        attendance_reminder: settings.attendanceReminder,
        attendance_reminder_time: settings.attendanceReminderTime,
        no_show_alert: settings.noShowAlert,
        no_show_days: settings.noShowDays,
        payment_reminder: settings.paymentReminder,
        payment_reminder_days: settings.paymentReminderDays,
        overdue_alert: settings.overdueAlert,
        welcome_message: settings.welcomeMessage,
        birthday_wishes: settings.birthdayWishes,
        expiry_reminder: settings.expiryReminder,
        expiry_reminder_days: settings.expiryReminderDays,
        whatsapp_enabled: settings.whatsappEnabled,
        sms_enabled: settings.smsEnabled,
        push_enabled: settings.pushEnabled,
        updated_by: user?.id || null,
      };

      // Use upsert to insert or update
      const { error } = await supabase
        .from("notification_settings")
        .upsert(settingsData, { onConflict: "gym_id" });

      if (error) throw error;

      showSuccess("Settings saved successfully!");
    } catch (error) {
      console.error("Error saving notification settings:", error);
      showError("Failed to save settings. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (fetching) {
    return (
      <div className="min-h-screen bg-gray-50 pb-24">
        <Header title="Notifications" />
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#f0813d]"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Header title="Notifications" />

      <main className="px-4 py-4 space-y-4">
        {/* Notification Channels */}
        <div className="bg-white rounded-xl p-4 shadow-sm space-y-4">
          <h3 className="font-semibold text-gray-900">Notification Channels</h3>

          <ToggleItem
            icon="💬"
            title="WhatsApp"
            description="Send notifications via WhatsApp"
            enabled={settings.whatsappEnabled}
            onToggle={() =>
              updateSetting("whatsappEnabled", !settings.whatsappEnabled)
            }
          />

          <ToggleItem
            icon="📱"
            title="SMS"
            description="Send notifications via SMS"
            enabled={settings.smsEnabled}
            onToggle={() => updateSetting("smsEnabled", !settings.smsEnabled)}
            badge="Extra charges apply"
          />

          <ToggleItem
            icon="🔔"
            title="Push Notifications"
            description="In-app push notifications"
            enabled={settings.pushEnabled}
            onToggle={() => updateSetting("pushEnabled", !settings.pushEnabled)}
          />
        </div>

        {/* Attendance Alerts */}
        <div className="bg-white rounded-xl p-4 shadow-sm space-y-4">
          <h3 className="font-semibold text-gray-900">Attendance Alerts</h3>

          <ToggleItem
            icon="⏰"
            title="Daily Reminder"
            description="Remind members to visit gym"
            enabled={settings.attendanceReminder}
            onToggle={() =>
              updateSetting("attendanceReminder", !settings.attendanceReminder)
            }
          />

          {settings.attendanceReminder && (
            <div className="ml-12">
              <label className="text-sm text-gray-600">Reminder Time</label>
              <input
                type="time"
                className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none mt-1"
                value={settings.attendanceReminderTime}
                onChange={(e) =>
                  updateSetting("attendanceReminderTime", e.target.value)
                }
              />
            </div>
          )}

          <ToggleItem
            icon="⚠️"
            title="No-Show Alert"
            description="Alert when member misses gym"
            enabled={settings.noShowAlert}
            onToggle={() => updateSetting("noShowAlert", !settings.noShowAlert)}
          />

          {settings.noShowAlert && (
            <div className="ml-12">
              <label className="text-sm text-gray-600">Alert after days</label>
              <select
                className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none mt-1"
                value={settings.noShowDays}
                onChange={(e) =>
                  updateSetting("noShowDays", parseInt(e.target.value))
                }
              >
                <option value={2}>2 days</option>
                <option value={3}>3 days</option>
                <option value={5}>5 days</option>
                <option value={7}>7 days</option>
              </select>
            </div>
          )}
        </div>

        {/* Payment Reminders */}
        <div className="bg-white rounded-xl p-4 shadow-sm space-y-4">
          <h3 className="font-semibold text-gray-900">Payment Reminders</h3>

          <ToggleItem
            icon="💳"
            title="Payment Reminder"
            description="Remind before plan expires"
            enabled={settings.paymentReminder}
            onToggle={() =>
              updateSetting("paymentReminder", !settings.paymentReminder)
            }
          />

          {settings.paymentReminder && (
            <div className="ml-12">
              <label className="text-sm text-gray-600">
                Days before expiry
              </label>
              <select
                className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none mt-1"
                value={settings.paymentReminderDays}
                onChange={(e) =>
                  updateSetting("paymentReminderDays", parseInt(e.target.value))
                }
              >
                <option value={1}>1 day</option>
                <option value={3}>3 days</option>
                <option value={5}>5 days</option>
                <option value={7}>7 days</option>
              </select>
            </div>
          )}

          <ToggleItem
            icon="🔴"
            title="Overdue Alert"
            description="Alert for overdue payments"
            enabled={settings.overdueAlert}
            onToggle={() =>
              updateSetting("overdueAlert", !settings.overdueAlert)
            }
          />
        </div>

        {/* Member Notifications */}
        <div className="bg-white rounded-xl p-4 shadow-sm space-y-4">
          <h3 className="font-semibold text-gray-900">Member Notifications</h3>

          <ToggleItem
            icon="👋"
            title="Welcome Message"
            description="Send welcome on registration"
            enabled={settings.welcomeMessage}
            onToggle={() =>
              updateSetting("welcomeMessage", !settings.welcomeMessage)
            }
          />

          <ToggleItem
            icon="🎂"
            title="Birthday Wishes"
            description="Send birthday greetings"
            enabled={settings.birthdayWishes}
            onToggle={() =>
              updateSetting("birthdayWishes", !settings.birthdayWishes)
            }
          />

          <ToggleItem
            icon="📅"
            title="Expiry Reminder"
            description="Remind about plan expiry"
            enabled={settings.expiryReminder}
            onToggle={() =>
              updateSetting("expiryReminder", !settings.expiryReminder)
            }
          />

          {settings.expiryReminder && (
            <div className="ml-12">
              <label className="text-sm text-gray-600">
                Days before expiry
              </label>
              <select
                className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none mt-1"
                value={settings.expiryReminderDays}
                onChange={(e) =>
                  updateSetting("expiryReminderDays", parseInt(e.target.value))
                }
              >
                <option value={3}>3 days</option>
                <option value={5}>5 days</option>
                <option value={7}>7 days</option>
                <option value={14}>14 days</option>
              </select>
            </div>
          )}
        </div>

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-3 bg-black text-white rounded-xl font-medium disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </main>
    </div>
  );
}

// Toggle Item Component
function ToggleItem({ icon, title, description, enabled, onToggle, badge }) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-3">
        <span className="text-xl">{icon}</span>
        <div>
          <div className="flex items-center gap-2">
            <p className="font-medium text-gray-900">{title}</p>
            {badge && (
              <span className="text-xs bg-[#f0813d]/15 text-[#9c4400] px-2 py-0.5 rounded-full">
                {badge}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500">{description}</p>
        </div>
      </div>
      <button
        onClick={onToggle}
        className={`w-12 h-6 rounded-full transition ${
          enabled ? "bg-[#f0813d]" : "bg-gray-300"
        }`}
      >
        <div
          className={`w-5 h-5 bg-white rounded-full shadow transition transform ${
            enabled ? "translate-x-6" : "translate-x-1"
          }`}
        ></div>
      </button>
    </div>
  );
}
