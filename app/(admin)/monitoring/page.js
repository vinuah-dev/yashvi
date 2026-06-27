"use client";

import { useState } from "react";
import Header from "@/components/layout/Header";

// Mock data for monitoring
const mockCurrentMembers = [
  {
    id: 1,
    name: "John Doe",
    checkIn: "06:30 AM",
    duration: "1h 15m",
    status: "active",
  },
  {
    id: 2,
    name: "Jane Smith",
    checkIn: "07:15 AM",
    duration: "45m",
    status: "active",
  },
  {
    id: 3,
    name: "Mike Johnson",
    checkIn: "06:45 AM",
    duration: "1h 30m",
    status: "active",
  },
];

const mockRecentActivity = [
  {
    id: 1,
    type: "check-in",
    name: "Sarah Wilson",
    time: "2 min ago",
    icon: "🟢",
  },
  {
    id: 2,
    type: "check-out",
    name: "Tom Brown",
    time: "5 min ago",
    icon: "🔴",
  },
  {
    id: 3,
    type: "check-in",
    name: "Emily Davis",
    time: "10 min ago",
    icon: "🟢",
  },
];

export default function MonitoringPage() {
  const [currentMembers] = useState(mockCurrentMembers);
  const [recentActivity] = useState(mockRecentActivity);

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Header title="Live Monitoring" showBack={false} />

      <main className="px-4 py-4 space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-xl p-4 shadow-sm text-center">
            <p className="text-3xl font-bold text-gray-900">
              {currentMembers.length}
            </p>
            <p className="text-sm text-gray-500">Currently In Gym</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm text-center">
            <p className="text-3xl font-bold text-[#f0813d]">
              {recentActivity.filter((a) => a.type === "check-in").length}
            </p>
            <p className="text-sm text-gray-500">Today's Check-ins</p>
          </div>
        </div>

        {/* Current Members */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Currently In Gym</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {currentMembers.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <p>No members currently in gym</p>
              </div>
            ) : (
              currentMembers.map((member) => (
                <div key={member.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-gray-800 to-gray-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                        {member.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{member.name}</p>
                        <p className="text-sm text-gray-500">
                          In since {member.checkIn}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900">
                        {member.duration}
                      </p>
                      <span className="inline-block w-2 h-2 bg-[#f0813d] rounded-full mt-1"></span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Recent Activity</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {recentActivity.map((activity) => (
              <div key={activity.id} className="p-4">
                <div className="flex items-center gap-3">
                  <span className="text-xl">{activity.icon}</span>
                  <div className="flex-1">
                    <p className="text-sm text-gray-900">
                      <span className="font-medium">{activity.name}</span>{" "}
                      {activity.type === "check-in" ? "checked in" : "checked out"}
                    </p>
                    <p className="text-xs text-gray-500">{activity.time}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

