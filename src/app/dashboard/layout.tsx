import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { requireOnboarded } from "@/server/auth";

export default async function DashboardLayout({
  children,
}: LayoutProps<"/dashboard">) {
  // Re-checks the session server-side; the proxy redirect is only a convenience.
  const viewer = await requireOnboarded("/dashboard");

  return (
    <div className="container grid grid-cols-1 gap-6 py-8 lg:grid-cols-[232px_1fr] lg:gap-10 lg:py-12">
      <aside className="min-w-0 lg:sticky lg:top-6 lg:self-start">
        <DashboardNav isAdmin={viewer.isAdmin} />
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
