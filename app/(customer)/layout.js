import RoleShell from "@/components/layout/RoleShell";

export default function CustomerLayout({ children }) {
  return <RoleShell role="customer">{children}</RoleShell>;
}
