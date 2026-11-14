import { MapPin } from "lucide-react";
import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { UserAvatar } from "@/components/profile/user-avatar";
import { RatingSummary, ReviewList } from "@/components/reviews/review-display";
import { Badge } from "@/components/ui/badge";
import { VerifiedStudentBadge } from "@/components/verification/verification-badge";
import { isVerifiedStudent } from "@/lib/capabilities";
import { formatDate, formatIdr } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
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

export default async function PublicProfilePage({
  params,
}: PageProps<"/u/[username]">) {
  const { username } = await params;
  const data = await loadProfile(username);
  if (!data) notFound();
  const { profile, freelancer, services, portfolio, reviewGroups } = data;
  const verified = isVerifiedStudent(freelancer);

  return (
    <div className="container max-w-4xl py-10 md:py-16">
      <div className="bg-card rounded-3xl border p-6 sm:p-9">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
          <UserAvatar
            path={profile.avatar_path}
            name={profile.full_name}
            username={profile.username}
            className="size-24 text-2xl"
          />
          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight break-words">
                {profile.full_name}
              </h1>
              <p className="text-muted-foreground">@{profile.username}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {verified ? (
                <VerifiedStudentBadge
                  university={
                    freelancer?.university?.short_name ??
                    freelancer?.university?.name
                  }
                />
              ) : null}
              {profile.location ? (
                <span className="text-muted-foreground flex items-center gap-1 text-sm">
                  <MapPin className="size-4" /> {profile.location}
                </span>
              ) : null}
            </div>
            {verified && freelancer?.headline ? (
              <p className="text-lg font-semibold">{freelancer.headline}</p>
            ) : null}
          </div>
        </div>

        {profile.bio ? (
          <section className="mt-8">
            <h2 className="text-sm font-bold tracking-widest uppercase">
              Tentang
            </h2>
            {/* Plain text only (BR-26). */}
            <p className="text-muted-foreground mt-3 leading-7 whitespace-pre-wrap">
              {profile.bio}
            </p>
          </section>
        ) : null}

        {verified && freelancer ? (
          <section className="mt-8 space-y-3">
            <h2 className="text-sm font-bold tracking-widest uppercase">
              Freelancer
            </h2>
            <p className="text-muted-foreground text-sm">
              {freelancer.university?.name}
              {freelancer.major ? ` · ${freelancer.major}` : ""}
            </p>
            {freelancer.skills.length > 0 ? (
              <ul className="flex flex-wrap gap-2">
                {freelancer.skills.map((skill) => (
                  <li key={skill}>
                    <Badge variant="secondary" className="rounded-full">
                      {skill}
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : null}

            {verified && services.length > 0 ? (
              <section className="mt-8 space-y-3">
                <h2 className="text-sm font-bold tracking-widest uppercase">
                  Layanan
                </h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {services.map((service) => (
                    <Link
                      key={service.id}
                      href={`/services/${service.id}` as Route}
                      className="rounded-xl border p-4 transition-shadow hover:shadow-sm"
                    >
                      <p className="font-semibold">{service.title}</p>
                      <p className="text-primary mt-2 text-sm font-bold">
                        {formatIdr(service.price ?? 0)} ·{" "}
                        {service.delivery_days} hari
                      </p>
                      <RatingSummary
                        avg={service.rating_avg}
                        count={service.rating_count}
                        className="mt-1"
                      />
                    </Link>
                  ))}
                </div>
              </section>
            ) : null}

            {verified && portfolio.length > 0 ? (
              <section className="mt-8 space-y-3">
                <h2 className="text-sm font-bold tracking-widest uppercase">
                  Portofolio
                </h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {portfolio.map((item) => (
                    <div key={item.id} className="bg-muted rounded-xl p-4">
                      <p className="font-semibold">{item.title}</p>
                      {item.description ? (
                        <p className="text-muted-foreground mt-1 text-sm">
                          {item.description}
                        </p>
                      ) : null}
                      {item.external_url ? (
                        <a
                          href={item.external_url}
                          target="_blank"
                          rel="noopener noreferrer nofollow ugc"
                          className="text-primary mt-2 inline-block text-sm font-semibold"
                        >
                          Lihat karya
                        </a>
                      ) : null}
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </section>
        ) : null}

        {reviewGroups.map((group) => (
          <section key={group.key} className="mt-8 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-bold tracking-widest uppercase">
                {group.title}
              </h2>
              <RatingSummary avg={group.avg} count={group.count} />
            </div>
            <ReviewList reviews={group.reviews} />
          </section>
        ))}

        <p className="text-muted-foreground mt-8 text-xs">
          Bergabung sejak {formatDate(profile.created_at)}
        </p>
      </div>
    </div>
  );
}
