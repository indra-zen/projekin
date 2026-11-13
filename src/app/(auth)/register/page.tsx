import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";

export default function RegisterPage() {
  return (
    <div className="container flex min-h-[calc(100vh-9rem)] items-center justify-center py-16">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Brand />
        </div>
        <div className="bg-card rounded-3xl border p-7 shadow-sm sm:p-9">
          <h1 className="text-2xl font-bold">Create your account</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Join a community of people making things happen.
          </p>
          <div className="mt-8 space-y-4">
            <label className="block text-sm font-semibold">
              Full name
              <input
                type="text"
                placeholder="Your name"
                className="bg-background focus:border-primary focus:ring-primary/15 mt-2 h-12 w-full rounded-xl border px-4 outline-none focus:ring-2"
              />
            </label>
            <label className="block text-sm font-semibold">
              Email
              <input
                type="email"
                placeholder="you@example.com"
                className="bg-background focus:border-primary focus:ring-primary/15 mt-2 h-12 w-full rounded-xl border px-4 outline-none focus:ring-2"
              />
            </label>
            <label className="block text-sm font-semibold">
              Password
              <input
                type="password"
                placeholder="At least 8 characters"
                className="bg-background focus:border-primary focus:ring-primary/15 mt-2 h-12 w-full rounded-xl border px-4 outline-none focus:ring-2"
              />
            </label>
            <Button className="w-full" size="lg">
              Get started <ArrowRight className="ml-2 size-4" />
            </Button>
          </div>
          <p className="text-muted-foreground mt-7 text-center text-sm">
            Already have an account?{" "}
            <Link
              href="/login"
              className="text-primary font-bold hover:underline"
            >
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
