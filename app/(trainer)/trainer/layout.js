"use client";

import RouteProtection from "@/components/shared/RouteProtection";
import RoleShell from "@/components/layout/RoleShell";

export default function TrainerLayout({ children }) {
  return (
    <RouteProtection>
      <RoleShell role="trainer">{children}</RoleShell>
    </RouteProtection>
  );
}
