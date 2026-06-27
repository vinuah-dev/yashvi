"use client";

import Header from "@/components/layout/Header";

export default function StaffSettingsPage() {
  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Header title="Staff & Access" />

      <main className="px-4 py-4">
        {/* Coming Soon */}
        <div className="bg-white rounded-xl p-8 shadow-sm text-center">
          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-4xl">🔐</span>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Coming Soon</h2>
          <p className="text-gray-500 mb-6">
            Staff management and role-based access control will be available in
            a future update.
          </p>

          {/* Preview Features */}
          <div className="bg-gray-50 rounded-xl p-4 text-left">
            <h3 className="font-semibold text-gray-900 mb-3">
              Planned Features
            </h3>
            <ul className="space-y-3">
              {[
                {
                  icon: "👥",
                  title: "Sub-Admin Roles",
                  desc: "Create trainer, manager roles",
                },
                {
                  icon: "🔑",
                  title: "Permissions",
                  desc: "Granular access control",
                },
                {
                  icon: "📊",
                  title: "Activity Logs",
                  desc: "Track staff actions",
                },
                {
                  icon: "⏰",
                  title: "Shift Management",
                  desc: "Manage staff schedules",
                },
              ].map((feature, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="text-xl">{feature.icon}</span>
                  <div>
                    <p className="font-medium text-gray-900">{feature.title}</p>
                    <p className="text-sm text-gray-500">{feature.desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <button
            className="mt-6 px-6 py-2 bg-gray-100 text-gray-500 rounded-xl font-medium"
            disabled
          >
            Notify Me When Available
          </button>
        </div>
      </main>
    </div>
  );
}
