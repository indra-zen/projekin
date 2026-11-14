import {
  CalendarDays,
  ExternalLink,
  GraduationCap,
  Images,
  MapPin,
  Star,
  Store,
} from "lucide-react";
import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { UserAvatar } from "@/components/profile/user-avatar";
import { RatingSummary, ReviewList } from "@/components/reviews/review-display";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { VerifiedStudentBadge } from "@/components/verification/verification-badge";
import { isVerifiedStudent } from "@/lib/capabilities";
import { formatDate, formatIdr } from "@/lib/format";
import { ledgeAt } from "@/lib/ledge";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { USERNAME_PATTERN } from "@/lib/validation/common";

const loadProfile = cache(async (username: string) => {
  if (!USERNAME_PATTERN.test(username)) return null;
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "id, username, full_name, avatar_path, bio, location, created_at, onboarded_at",
    )
    .eq("username", username)
    .not("onboarded_at", "is", null)
    .maybeSingle();
  if (!profile) return null;
  const { data: freelancer } = await supabase
    .from("freelancer_profiles")
    .select(
      "headline, major, skills, status, verified_until, university:universities(name, short_name)",
    )
    .eq("user_id", profile.id)
    .maybeSingle();
  // FR-PROF-02: reviews received as freelancer and as client, each with its
  // own average and count (from the rating views, not the latest page only).
  const latestReviews = (reviewerRole: "client" | "freelancer") =>
    supabase
      .from("reviews")
      .select(
        "id, rating, comment, created_at, reviewer:profiles!reviews_reviewer_id_fkey(username, full_name)",
      )
      .eq("reviewee_id", profile.id)
      .eq("reviewer_role", reviewerRole)
      .order("created_at", { ascending: false })
      .limit(10);
  const [
    { data: services },
    { data: portfolio },
    { data: asFreelancer },
    { data: asClient },
    { data: freelancerStats },
    { data: clientStats },
  ] = await Promise.all([
    supabase
      .from("service_listings")
      .select("id, title, price, delivery_days, rating_avg, rating_count")
      .eq("freelancer_id", profile.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("portfolio_items")
      .select("id, title, description, external_url")
      .eq("freelancer_id", profile.id)
      .order("sort_order"),
    latestReviews("client"),
    latestReviews("freelancer"),
    supabase
      .from("freelancer_rating_stats")
      .select("rating_avg, rating_count")
      .eq("user_id", profile.id)
      .maybeSingle(),
    supabase
      .from("client_rating_stats")
      .select("rating_avg, rating_count")
      .eq("user_id", profile.id)
      .maybeSingle(),
  ]);
  return {
    profile,
    freelancer,
    services: services ?? [],
    portfolio: portfolio ?? [],
    reviewGroups: [
      {
        key: "freelancer",
        title: "Ulasan sebagai freelancer",
        reviews: asFreelancer ?? [],
        avg: freelancerStats?.rating_avg ?? 0,
        count: freelancerStats?.rating_count ?? 0,
      },
      {
        key: "client",
        title: "Ulasan sebagai klien",
        reviews: asClient ?? [],
        avg: clientStats?.rating_avg ?? 0,
        count: clientStats?.rating_count ?? 0,
      },
    ].filter((group) => group.count > 0 && group.reviews.length > 0),
  };
});

export async function generateMetadata({
  params,
}: PageProps<"/u/[username]">): Promise<Metadata> {
  const { username } = await params;
  const data = await loadProfile(username);
  return {
    title: data
      ? (data.profile.full_name ?? data.profile.username)
      : "Profil tidak ditemukan",
  };
}

function SectionTitle({
  id,
  icon: Icon,
  children,
}: {
  id?: string;
  icon: typeof Store;
  children: React.ReactNode;
}) {
  return (
    <h2
      id={id}
      className="flex scroll-mt-6 items-center gap-3 text-2xl font-extrabold tracking-tight"
    >
      <span className="bg-highlight border-border shadow-hard-sm flex size-10 items-center justify-center rounded-xl border-2">
        <Icon className="size-5" aria-hidden />
      </span>
      {children}
    </h2>
  );
}

export default async function PublicProfilePage({
  params,
}: PageProps<"/u/[username]">) {
  const { username } = await params;
  const data = await loadProfile(username);
  if (!data) notFound();
  const { profile, freelancer, services, portfolio, reviewGroups } = data;
  const verified = isVerifiedStudent(freelancer);
  const asFreelancer = reviewGroups.find((g) => g.key === "freelancer");
  const showServices = verified && services.length > 0;
  const showPortfolio = verified && portfolio.length > 0;

  const stats = [
    asFreelancer
      ? {
          label: "Rating",
          value: asFreelancer.avg.toLocaleString("id-ID", {
            maximumFractionDigits: 1,
          }),
          note: `${asFreelancer.count} ulasan`,
        }
      : null,
    verified ? { label: "Layanan", value: String(services.length) } : null,
    verified ? { label: "Karya", value: String(portfolio.length) } : null,
  ].filter((item) => item !== null);

  return (
    <div className="container max-w-5xl space-y-10 py-8 md:py-12">
      {/* Hero */}
      <div className="bg-card border-border shadow-ledge rounded-2xl border-2 [--ledge:var(--lilac)]">
        <div className="bg-lilac border-border relative h-28 overflow-hidden rounded-t-[14px] border-b-2 sm:h-36">
          <div
            aria-hidden
            className="bg-secondary border-border absolute -top-10 right-10 size-32 rounded-full border-2"
          />
          <div
            aria-hidden
            className="bg-accent border-border absolute top-8 right-36 size-12 rounded-full border-2"
          />
          <div
            aria-hidden
            className="absolute bottom-3 left-[38%] hidden size-20 [background-image:radial-gradient(white_1.5px,transparent_1.5px)] [background-size:12px_12px] opacity-70 sm:block"
          />
        </div>
        <div className="px-5 pb-6 sm:px-9 sm:pb-8">
          <div className="-mt-14 flex flex-col gap-5 sm:-mt-16 sm:flex-row sm:items-end sm:justify-between">
            <UserAvatar
              path={profile.avatar_path}
              name={profile.full_name}
              username={profile.username}
              className="shadow-hard size-28 border-4 sm:size-32"
              fallbackClassName="text-3xl"
            />
            {verified && (showServices || showPortfolio) ? (
              <div className="flex flex-wrap gap-3">
                {showServices ? (
                  <a href="#layanan" className={buttonVariants()}>
                    <Store className="mr-2 size-4" aria-hidden /> Lihat layanan
                  </a>
                ) : null}
                {showPortfolio ? (
                  <a
                    href="#portofolio"
                    className={buttonVariants({ variant: "outline" })}
                  >
                    <Images className="mr-2 size-4" aria-hidden /> Portofolio
                  </a>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="mt-5 min-w-0 space-y-3">
            <div>
              <h1 className="text-3xl leading-tight font-extrabold tracking-tight break-words md:text-4xl">
                {profile.full_name}
              </h1>
              <p className="text-muted-foreground font-semibold">
                @{profile.username}
              </p>
            </div>
            {verified && freelancer?.headline ? (
              <p className="text-lg font-semibold text-balance">
                {freelancer.headline}
              </p>
            ) : null}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              {verified ? (
                <VerifiedStudentBadge
                  university={
                    freelancer?.university?.short_name ??
                    freelancer?.university?.name
                  }
                />
              ) : null}
              {profile.location ? (
                <span className="text-muted-foreground flex items-center gap-1 text-sm font-medium">
                  <MapPin className="size-4" aria-hidden /> {profile.location}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {stats.length > 0 ? (
        <dl
          className={cn(
            "grid gap-4",
            stats.length === 1
              ? "sm:max-w-xs"
              : stats.length === 2
                ? "grid-cols-2"
                : "grid-cols-3",
          )}
        >
          {stats.map((item, i) => (
            <div
              key={item.label}
              className={cn(
                "border-border shadow-hard rounded-2xl border-2 px-4 py-3",
                ["bg-highlight", "bg-success", "bg-secondary"][i],
              )}
            >
              <dt className="text-xs font-bold tracking-wide uppercase">
                {item.label}
              </dt>
              <dd className="font-display text-3xl font-extrabold tabular-nums">
                {item.value}
                {"note" in item && item.note ? (
                  <span className="block font-sans text-xs font-semibold">
                    {item.note}
                  </span>
                ) : null}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}

      <div className="grid gap-10 lg:grid-cols-[1fr_300px] lg:items-start lg:gap-8">
        {/* Facts first in the DOM so they read before the long lists on mobile;
            placed in the right column on desktop. */}
        <aside className="space-y-6 lg:sticky lg:top-6 lg:col-start-2 lg:row-start-1">
          {verified && freelancer ? (
            <Card className="[--ledge:var(--secondary)]">
              <CardContent className="space-y-5">
                <div>
                  <p className="flex items-center gap-2 text-sm font-extrabold tracking-wide uppercase">
                    <GraduationCap className="size-4" aria-hidden /> Kampus
                  </p>
                  <p className="mt-2 font-semibold">
                    {freelancer.university?.name}
                  </p>
                  {freelancer.major ? (
                    <p className="text-muted-foreground text-sm">
                      {freelancer.major}
                    </p>
                  ) : null}
                </div>
                {freelancer.skills.length > 0 ? (
                  <div>
                    <p className="text-sm font-extrabold tracking-wide uppercase">
                      Keahlian
                    </p>
                    <ul className="mt-2 flex flex-wrap gap-2">
                      {freelancer.skills.map((skill) => (
                        <li key={skill}>
                          <Badge variant="secondary">{skill}</Badge>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ) : null}
          <p className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
            <CalendarDays className="size-4" aria-hidden /> Bergabung sejak{" "}
            {formatDate(profile.created_at)}
          </p>
        </aside>

        <div className="space-y-12 lg:col-start-1 lg:row-start-1">
          {profile.bio ? (
            <section className="space-y-3">
              <h2 className="text-2xl font-extrabold tracking-tight">
                Tentang
              </h2>
              {/* Plain text only (BR-26). */}
              <p className="leading-7 whitespace-pre-wrap">{profile.bio}</p>
            </section>
          ) : null}

          {showServices ? (
            <section className="space-y-5" aria-labelledby="layanan">
              <SectionTitle id="layanan" icon={Store}>
                Layanan
              </SectionTitle>
              <div className="grid gap-x-5 gap-y-8 sm:grid-cols-2">
                {services.map((service, index) => (
                  <Link
                    key={service.id}
                    href={`/services/${service.id}` as Route}
                    className={cn(
                      "group bg-card border-border shadow-ledge flex flex-col gap-3 rounded-2xl border-2 p-5 transition-transform motion-safe:hover:-translate-y-1 motion-safe:focus-visible:-translate-y-1",
                      ledgeAt(index),
                    )}
                  >
                    <p className="line-clamp-2 leading-snug font-bold decoration-2 underline-offset-4 group-hover:underline">
                      {service.title}
                    </p>
                    <RatingSummary
                      avg={service.rating_avg}
                      count={service.rating_count}
                    />
                    <div className="border-hairline mt-auto flex items-end justify-between gap-2 border-t pt-3">
                      <strong className="font-display text-xl font-extrabold">
                        {formatIdr(service.price ?? 0)}
                      </strong>
                      <span className="sticker bg-muted">
                        {service.delivery_days} hari
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {showPortfolio ? (
            <section className="space-y-5" aria-labelledby="portofolio">
              <SectionTitle id="portofolio" icon={Images}>
                Portofolio
              </SectionTitle>
              <div className="grid gap-x-5 gap-y-8 sm:grid-cols-2">
                {portfolio.map((item, index) => (
                  <div
                    key={item.id}
                    className={cn(
                      "bg-card border-border shadow-ledge flex flex-col rounded-2xl border-2 p-5",
                      ledgeAt(index + 2),
                    )}
                  >
                    <p className="leading-snug font-bold">{item.title}</p>
                    {item.description ? (
                      <p className="text-muted-foreground mt-2 text-sm leading-6">
                        {item.description}
                      </p>
                    ) : null}
                    {item.external_url ? (
                      <a
                        href={item.external_url}
                        target="_blank"
                        rel="noopener noreferrer nofollow ugc"
                        className={cn(
                          buttonVariants({ variant: "outline", size: "sm" }),
                          "mt-4 w-fit",
                        )}
                      >
                        Lihat karya{" "}
                        <ExternalLink className="ml-2 size-3.5" aria-hidden />
                      </a>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {reviewGroups.map((group) => (
            <section key={group.key} className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <SectionTitle icon={Star}>{group.title}</SectionTitle>
                <RatingSummary avg={group.avg} count={group.count} />
              </div>
              <ReviewList reviews={group.reviews} />
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
