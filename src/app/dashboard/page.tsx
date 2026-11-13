import {
  ArrowUpRight,
  BriefcaseBusiness,
  FolderKanban,
  Plus,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function DashboardPage() {
  return (
    <div className="container py-12 md:py-18">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-primary text-sm font-bold tracking-widest uppercase">
            Your workspace
          </p>
          <h1 className="mt-2 text-4xl font-extrabold tracking-tight">
            Good morning, there.
          </h1>
          <p className="text-muted-foreground mt-3">
            Here&apos;s what&apos;s happening with your projects.
          </p>
        </div>
        <Button asChild>
          <Link href="/services">
            <Plus className="mr-2 size-4" /> Find a service
          </Link>
        </Button>
      </div>
      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        {[
          { label: "Active projects", value: "0", icon: FolderKanban },
          { label: "Saved services", value: "0", icon: BriefcaseBusiness },
          { label: "Profile views", value: "—", icon: ArrowUpRight },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="bg-card rounded-2xl border p-5">
            <Icon className="text-primary size-5" />
            <p className="mt-6 text-3xl font-bold">{value}</p>
            <p className="text-muted-foreground mt-1 text-sm">{label}</p>
          </div>
        ))}
      </div>
      <div className="bg-muted/40 mt-8 rounded-3xl border border-dashed py-20 text-center">
        <h2 className="text-2xl font-bold">Your workspace is ready</h2>
        <p className="text-muted-foreground mx-auto mt-3 max-w-md">
          Once you start exploring, your projects and saved services will appear
          here.
        </p>
        <Button variant="outline" className="mt-6" asChild>
          <Link href="/services">
            Explore services <ArrowUpRight className="ml-2 size-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
