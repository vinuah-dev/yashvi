"use client";

import { useRouter } from "next/navigation";
import {
  UserPlus,
  CheckCircle,
  MessageCircle,
  UserCheck,
  CreditCard,
  Users,
  ClipboardList,
  BookOpen,
} from "lucide-react";
import { hasPermission, PERMISSIONS } from "@/lib/constants/permissions";

const ACTIONS = [
  {
    label: "Add Member",
    icon: <UserPlus className="w-4 h-4" />,
    href: "/members/add",
    permission: PERMISSIONS.MEMBERS,
    photo: "/quick-actions/add-member.png",
  },
  {
    label: "Attendance",
    icon: <CheckCircle className="w-4 h-4" />,
    href: "/attendance",
    permission: PERMISSIONS.ATTENDANCE,
    photo: "/quick-actions/attendance.png",
  },
  {
    label: "Messaging",
    icon: <MessageCircle className="w-4 h-4" />,
    href: "/messaging",
    permission: PERMISSIONS.MEMBERS,
    photo: "/quick-actions/messaging.png",
  },
  {
    label: "Trainer Att.",
    icon: <UserCheck className="w-4 h-4" />,
    href: "/settings/trainers/attendance",
    permission: PERMISSIONS.SETTINGS,
    adminOnly: true,
    photo: "/quick-actions/trainer-attendance.png",
  },
  {
    label: "Payment",
    icon: <CreditCard className="w-4 h-4" />,
    href: "/finance",
    permission: PERMISSIONS.FINANCE,
    photo: "/quick-actions/payment.png",
  },
  {
    label: "Members",
    icon: <Users className="w-4 h-4" />,
    href: "/members",
    permission: PERMISSIONS.MEMBERS,
    photo: "/quick-actions/members.png",
  },
  {
    label: "Inquiries",
    icon: <ClipboardList className="w-4 h-4" />,
    href: "/inquiries",
    permission: PERMISSIONS.INQUIRIES,
    photo: "/quick-actions/inquiries.png",
  },
  {
    label: "Knowledge",
    icon: <BookOpen className="w-4 h-4" />,
    href: "/admin/knowledge",
    adminOnly: true,
    photo: "/quick-actions/knowledge.png",
  },
];

export default function QuickActions({ permissions, canCreateTrainer }) {
  const router = useRouter();

  const visibleActions = ACTIONS.filter((action) => {
    if (action.permission && !hasPermission(permissions, action.permission)) return false;
    if (action.adminOnly && !canCreateTrainer) return false;
    return true;
  });

  if (visibleActions.length === 0) return null;

  return (
    <div className="bg-white border border-[#ececec] rounded-3xl p-3 shadow-[0_10px_40px_rgba(0,0,0,0.05)] overflow-hidden">
      <div className="mb-3 rounded-2xl bg-gradient-to-r from-[#f0813d] to-[#9c4400] px-4 py-3 shadow-[0_12px_28px_rgba(240,129,61,0.22)]">
        <h3 className="text-sm font-black text-white tracking-tight font-heading">
          Quick Actions
        </h3>
        <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-white/75">
          Fast controls
        </p>
      </div>
      <div className="flex space-x-3 overflow-x-auto pb-1 px-1 no-scrollbar">
        {visibleActions.map((action) => {
          return (
            <button
              key={action.label}
              onClick={() => router.push(action.href)}
              className="flex-shrink-0 w-[100px] overflow-hidden rounded-2xl bg-[#fafafa] hover:bg-white border border-[#ececec] hover:border-[#f0813d]/35 active-scale transition-all duration-300 group shadow-sm hover:shadow-[0_14px_32px_rgba(240,129,61,0.16)]"
              style={{ minHeight: "124px" }}
            >
              <div className="relative h-[68px] w-full overflow-hidden bg-[#1a1c1c]">
                <img
                  src={action.photo}
                  alt=""
                  className="h-full w-full object-contain transition-transform duration-500 group-hover:scale-105"
                />
              </div>
              <div className="p-2 text-left">
                <div className="mb-1 flex h-6 w-6 items-center justify-center rounded-lg bg-[#f0813d]/12 text-[#f0813d]">
                  {action.icon}
                </div>
                <span className="block text-[10px] font-black text-[#1a1c1c] leading-tight tracking-tight transition-colors truncate w-full">
                  {action.label}
                </span>
                <span className="mt-1 block h-1 w-6 rounded-full bg-[#f0813d]" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
