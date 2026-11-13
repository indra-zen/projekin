import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ServicesPage() {
  return (
    <div className="container py-16 md:py-24">
      <div className="max-w-2xl">
        <p className="text-primary text-sm font-bold tracking-widest uppercase">
          Marketplace
        </p>
        <h1 className="mt-3 text-4xl font-extrabold tracking-tight sm:text-5xl">
          Find the right talent for your next project.
        </h1>
        <p className="text-muted-foreground mt-5 text-lg">
          Browse services from motivated university students who are ready to
          make an impact.
        </p>
      </div>
      <div className="bg-card mt-10 flex max-w-xl items-center gap-3 rounded-2xl border p-2 shadow-sm">
        <Search className="text-muted-foreground ml-3 size-5" />
        <input
          className="placeholder:text-muted-foreground h-11 flex-1 bg-transparent px-2 outline-none"
          placeholder="What do you need help with?"
        />
        <Button>Search</Button>
      </div>
      <div className="bg-muted/40 mt-16 rounded-3xl border border-dashed py-20 text-center">
        <h2 className="text-2xl font-bold">Services are coming soon</h2>
        <p className="text-muted-foreground mx-auto mt-3 max-w-md">
          We&apos;re preparing a focused marketplace for student talent. Check
          back soon to discover what&apos;s possible.
        </p>
      </div>
    </div>
  );
}
