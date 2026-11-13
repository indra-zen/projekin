import Link from "next/link";
import {
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  GraduationCap,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const categories = [
  "Design & creative",
  "Development & tech",
  "Writing & translation",
  "Marketing & growth",
];

export default function HomePage() {
  return (
    <div>
      <section className="border-border/70 relative overflow-hidden border-b">
        <div className="container grid gap-12 py-18 md:grid-cols-[1.05fr_.95fr] md:items-center md:py-28">
          <div className="max-w-2xl">
            <div className="bg-secondary text-secondary-foreground mb-6 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold tracking-wider uppercase">
              <Sparkles className="size-3.5" /> Built around student talent
            </div>
            <h1 className="text-5xl leading-[1.08] font-extrabold tracking-[-0.04em] sm:text-6xl">
              Great work starts with{" "}
              <span className="text-primary">the right people.</span>
            </h1>
            <p className="text-muted-foreground mt-6 max-w-xl text-lg leading-8">
              Projekin connects ambitious clients with skilled university
              students ready to bring fresh ideas and real momentum to every
              project.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button size="lg" asChild>
                <Link href="/services">
                  Explore services <ArrowRight className="ml-2 size-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/register">Start freelancing</Link>
              </Button>
            </div>
            <div className="text-muted-foreground mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="text-primary size-4" /> Verified
                student talent
              </span>
              <span className="flex items-center gap-2">
                <CheckCircle2 className="text-primary size-4" /> Secure payments
              </span>
            </div>
          </div>
          <div className="relative mx-auto w-full max-w-md">
            <div className="bg-secondary/70 absolute -inset-8 rounded-full blur-3xl" />
            <div className="border-border bg-card shadow-primary/10 relative rounded-3xl border p-5 shadow-2xl">
              <div className="border-border flex items-center justify-between border-b pb-5">
                <div>
                  <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                    Today&apos;s opportunities
                  </p>
                  <p className="mt-1 text-lg font-bold">Find your next move</p>
                </div>
                <div className="bg-secondary text-primary rounded-xl p-3">
                  <BriefcaseBusiness className="size-5" />
                </div>
              </div>
              <div className="space-y-3 py-5">
                {[
                  "Brand identity for a new campus app",
                  "Landing page for a climate startup",
                  "Social content strategy",
                ].map((item, index) => (
                  <div
                    key={item}
                    className="border-border/80 flex items-center gap-3 rounded-2xl border p-3"
                  >
                    <div className="bg-muted text-primary flex size-10 shrink-0 items-center justify-center rounded-xl font-bold">
                      0{index + 1}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{item}</p>
                      <p className="text-muted-foreground mt-1 text-xs">
                        {["Design", "Development", "Marketing"][index]} · New
                        today
                      </p>
                    </div>
                    <ArrowRight className="text-muted-foreground ml-auto size-4 shrink-0" />
                  </div>
                ))}
              </div>
              <div className="bg-primary text-primary-foreground flex items-center gap-3 rounded-2xl p-4">
                <GraduationCap className="size-6" />
                <div>
                  <p className="text-sm font-bold">
                    Your next project is closer.
                  </p>
                  <p className="text-primary-foreground/75 mt-0.5 text-xs">
                    Join a community moving forward.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="container py-16 md:py-20">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-primary text-sm font-bold tracking-widest uppercase">
              Start exploring
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight">
              What can we help you build?
            </h2>
          </div>
          <Link
            href="/services"
            className="text-primary text-sm font-bold hover:underline"
          >
            View all services <ArrowRight className="ml-1 inline size-4" />
          </Link>
        </div>
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {categories.map((category, index) => (
            <Link
              key={category}
              href="/services"
              className="group border-border bg-card hover:border-primary/40 hover:shadow-primary/5 rounded-2xl border p-5 transition-all hover:-translate-y-1 hover:shadow-lg"
            >
              <div className="bg-secondary text-primary mb-10 flex size-10 items-center justify-center rounded-xl text-sm font-bold">
                0{index + 1}
              </div>
              <p className="font-bold">{category}</p>
              <p className="text-muted-foreground mt-1 text-sm">
                Explore student experts{" "}
                <ArrowRight className="ml-1 inline size-3.5 transition-transform group-hover:translate-x-1" />
              </p>
            </Link>
          ))}
        </div>
      </section>
      <section className="bg-foreground text-background py-16">
        <div className="container flex flex-col items-start justify-between gap-8 md:flex-row md:items-center">
          <div>
            <p className="text-primary-foreground/60 text-sm font-bold tracking-widest uppercase">
              Ready when you are
            </p>
            <h2 className="mt-3 max-w-xl text-3xl font-bold tracking-tight sm:text-4xl">
              Turn an idea into something real.
            </h2>
          </div>
          <Button size="lg" variant="secondary" asChild>
            <Link href="/register">
              Join Projekin <ArrowRight className="ml-2 size-4" />
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
