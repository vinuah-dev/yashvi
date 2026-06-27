"use client";

import { useState } from "react";
import { Activity, Clock, Dumbbell } from "lucide-react";
import ListModal from "./ListModal";

function ActivityRow({ activity }) {
  const isMemberActivity = activity.type === "member";

  return (
    <div className="flex items-center justify-between p-3 rounded-2xl border border-[#ececec] bg-[#fafafa] hover:bg-white transition-all duration-300">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center bg-orange-50 border border-orange-100 shadow-sm">
          {isMemberActivity ? (
            <Dumbbell className="w-5 h-5 text-[#1a1c1c]" />
          ) : (
            <span className="text-base">{activity.icon}</span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-[#1a1c1c] truncate">
            {activity.text}
          </p>

          <div className="flex items-center gap-1.5 mt-1">
            <Clock className="w-3.5 h-3.5 text-[#897267]" />
            <p className="text-xs text-[#897267] font-medium">
              {activity.time}
            </p>
          </div>
        </div>
      </div>

      <span className="text-[10px] font-bold text-[#5f5e5e] flex-shrink-0 pl-2">
        {activity.time === "Today" ? "Just now" : activity.time}
      </span>
    </div>
  );
}

export default function RecentActivitySection({ topActivity, allActivity }) {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <div className="bg-white border border-[#ececec] rounded-3xl p-5 shadow-[0_10px_40px_rgba(0,0,0,0.05)]">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-[#f0813d] to-[#9c4400] text-white border border-[#f0813d]/30 rounded-2xl flex items-center justify-center shadow-[0_10px_24px_rgba(240,129,61,0.24)]">
              <Activity className="w-5 h-5 text-white" />
            </div>

            <div>
              <h3 className="text-sm font-black text-[#1a1c1c] tracking-tight">
                Recent Activity
              </h3>
              <p className="text-[11px] font-semibold text-[#897267] uppercase tracking-wide">
                Real-time updates
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowModal(true)}
            className="px-3 py-2 bg-[#fafafa] hover:bg-white border border-[#ececec] text-[#1a1c1c] rounded-xl text-[11px] font-bold active-scale transition-all"
          >
            View All
          </button>
        </div>

        <div className="space-y-2.5">
          {topActivity.length > 0 ? (
            topActivity.map((a) => <ActivityRow key={a.id} activity={a} />)
          ) : (
            <div className="text-center py-8 bg-[#fafafa] border border-dashed border-[#e5e5e5] rounded-2xl">
              <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-sm">
                <Activity className="w-6 h-6 text-[#897267]" />
              </div>
              <p className="text-[#1a1c1c] text-sm font-black">
                No recent activity
              </p>
              <p className="text-xs text-[#897267] mt-1">
                Activity will appear here as events happen
              </p>
            </div>
          )}
        </div>
      </div>

      <ListModal
        open={showModal}
        onClose={() => setShowModal(false)}
        title="Recent Activity"
        subtitle={`${allActivity.length} activities`}
        icon={<Activity className="w-5 h-5" />}
        iconBg="bg-orange-50"
        iconColor="text-[#f0813d]"
        footer={
          <button
            onClick={() => setShowModal(false)}
            className="w-full py-3 bg-[#1a1c1c] text-white rounded-2xl font-bold text-sm active-scale transition-all"
          >
            Close
          </button>
        }
      >
        {allActivity.length > 0 ? (
          allActivity.map((a) => (
            <ActivityRow key={a.id} activity={a} />
          ))
        ) : (
          <div className="text-center py-8 bg-[#fafafa] border border-dashed border-[#e5e5e5] rounded-2xl">
            <Activity className="w-10 h-10 text-[#897267] mx-auto mb-3" />
            <p className="text-[#1a1c1c] font-black">
              No recent activity
            </p>
            <p className="text-xs text-[#897267] mt-1">
              Activity will appear here as events happen
            </p>
          </div>
        )}
      </ListModal>
    </>
  );
}
