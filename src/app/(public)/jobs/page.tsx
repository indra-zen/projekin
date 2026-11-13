import { BriefcaseBusiness } from "lucide-react";

export default function JobsPage() {
  return (
    <div className="container py-16 md:py-24">
      <div className="max-w-2xl">
        <p className="text-primary text-sm font-bold tracking-widest uppercase">
          Opportunities
        </p>
        <h1 className="mt-3 text-4xl font-extrabold tracking-tight sm:text-5xl">
          Find projects worth doing.
        </h1>
        <p className="text-muted-foreground mt-5 text-lg">
          Discover meaningful work posted by clients and build your portfolio on
          your terms.
        </p>
      </div>
      <div className="bg-muted/40 mt-16 rounded-3xl border border-dashed py-20 text-center">
        <BriefcaseBusiness className="text-primary mx-auto size-10" />
        <h2 className="mt-5 text-2xl font-bold">Jobs are coming soon</h2>
        <p className="text-muted-foreground mx-auto mt-3 max-w-md">
          The first opportunities are on their way. Create an account to be
          ready when they arrive.
        </p>
      </div>
    </div>
  );
}
