import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { requireOnboarded } from "@/server/auth";

export default async function DashboardLayout({
  children,
}: LayoutProps<"/dashboard">) {
  // Re-checks the session server-side; the proxy redirect is only a convenience.
  const viewer = await requireOnboarded("/dashboard");

  return (
    <div className="container grid gap-6 py-8 md:grid-cols-[220px_1fr] md:gap-10 md:py-12">
      <aside className="md:sticky md:top-6 md:self-start">
        <DashboardNav isAdmin={viewer.isAdmin} />
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
