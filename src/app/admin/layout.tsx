import { AdminNav } from "@/components/admin/admin-nav";
import { requireAdmin } from "@/server/auth";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  // Non-admins get 404. Every admin action is also re-checked inside its RPC.
  await requireAdmin();
  return (
    <div className="container space-y-8 py-8 md:py-12">
      <AdminNav />
      {children}
    </div>
  );
}
