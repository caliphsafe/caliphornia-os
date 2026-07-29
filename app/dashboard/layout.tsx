import { requireAdminUser } from "@/lib/admin-auth";
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await requireAdminUser();
  return <>{children}</>;
}
