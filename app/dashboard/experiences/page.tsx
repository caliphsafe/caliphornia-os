import AdminControlCenter from "@/components/admin/AdminControlCenter";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function AdminExperiencesPage() {
  return <AdminControlCenter initialView="experiences" />;
}
