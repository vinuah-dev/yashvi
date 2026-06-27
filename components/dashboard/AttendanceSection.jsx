"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar, Clock, XCircle } from "lucide-react";
import ListModal from "./ListModal";

function AttendanceRow({ member, size = "sm" }) {
  const isActive = member.status === "active";
  const isExpired = member.membershipStatus === "EXPIRED";
  const avatarSize = size === "lg" ? "w-11 h-11" : "w-10 h-10";

  return (
    <div className="flex items-center justify-between p-3 rounded-2xl border border-[#ececec] bg-[#fafafa] hover:bg-white transition-all duration-300">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className={`${avatarSize} rounded-2xl flex items-center justify-center bg-gradient-to-br from-[#f0813d] to-[#9c4400] text-white font-black text-sm shadow-md`}>
          {member.name.charAt(0)}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold text-[#1a1c1c] truncate">
              {member.name}
            </p>

            {isExpired && (
              <span className="px-2 py-0.5 text-[8px] font-black bg-orange-50 text-[#f0813d] border border-orange-100 rounded-full uppercase">
                Expired
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 mt-1">
            <Clock className="w-3.5 h-3.5 text-[#897267]" />
            <p className="text-xs text-[#897267] font-medium">{member.checkIn}</p>
          </div>

          {isExpired && (
            <div className="flex items-center gap-1 mt-1">
              <XCircle className="w-3.5 h-3.5 text-[#f0813d]" />
              <p className="text-[10px] text-[#f0813d] font-bold uppercase">
                Membership expired
              </p>
            </div>
          )}
        </div>
      </div>

      <span
        className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase ${
          isActive
            ? "bg-[#f0813d]/30 text-[#4d7c0f]"
            : "bg-orange-50 text-[#f0813d]"
        }`}
      >
        {isActive ? "Active" : "Left"}
      </span>
    </div>
  );
}

export default function AttendanceSection({ todayList, allAttendance, totalCount }) {
  const [showModal, setShowModal] = useState(false);
  const router = useRouter();

  return (
    <>
      <div className="bg-white border border-[#ececec] rounded-3xl p-5 shadow-[0_10px_40px_rgba(0,0,0,0.05)]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-gradient-to-br from-[#f0813d] to-[#9c4400] text-white border border-[#f0813d]/30 rounded-2xl flex items-center justify-center shadow-[0_10px_24px_rgba(240,129,61,0.24)]">
              <Calendar className="w-5 h-5 text-white" />
            </div>

            <div>
              <h3 className="text-sm font-black text-[#1a1c1c] tracking-tight">
                Today's Check-ins
              </h3>
              <p className="text-[11px] font-semibold text-[#897267] uppercase tracking-wide">
                {totalCount} members
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
          {todayList.length > 0 ? (
            todayList.map((m) => <AttendanceRow key={m.id} member={m} />)
          ) : (
            <div className="text-center py-7 bg-[#fafafa] border border-dashed border-[#e5e5e5] rounded-2xl">
              <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center mx-auto mb-2 shadow-sm">
                <Calendar className="w-5 h-5 text-[#897267]" />
              </div>

              <p className="text-[#5f5e5e] text-sm font-semibold">
                No check-ins today
              </p>

              <button
                onClick={() => router.push("/attendance/manual")}
                className="mt-2 text-xs font-black text-[#f0813d] active-scale"
              >
                Take manual attendance
              </button>
            </div>
          )}
        </div>
      </div>

      <ListModal
        open={showModal}
        onClose={() => setShowModal(false)}
        title="Today's Check-ins"
        subtitle={`${allAttendance.length} members checked in`}
        icon={<Calendar className="w-5 h-5" />}
        iconBg="bg-orange-50"
        iconColor="text-[#f0813d]"
        footer={
          <button
            onClick={() => {
              setShowModal(false);
              router.push("/attendance");
            }}
            className="w-full py-3 bg-[#1a1c1c] text-white rounded-2xl font-bold text-sm active-scale transition-all"
          >
            Go to Attendance Page
          </button>
        }
      >
        {allAttendance.length > 0 ? (
          allAttendance.map((m) => (
            <AttendanceRow key={m.id} member={m} size="lg" />
          ))
        ) : (
          <div className="text-center py-8 bg-[#fafafa] border border-dashed border-[#e5e5e5] rounded-2xl">
            <Calendar className="w-8 h-8 text-[#897267] mx-auto mb-3" />
            <p className="text-[#1a1c1c] font-bold">No check-ins today</p>
            <p className="text-xs text-[#897267] mt-1">
              Members will appear here when they check in
            </p>
          </div>
        )}
      </ListModal>
    </>
  );
}
