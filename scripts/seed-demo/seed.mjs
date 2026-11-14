#!/usr/bin/env node
// Replaces ALL data in a Projekin database with a realistic demo data set.
//
//   node scripts/seed-demo/seed.mjs --dry-run [--out <dir>]
//       Runs the whole seed against an in-memory Postgres (PGlite) with the
//       real migrations. Touches nothing outside this process. With --out,
//       also renders every image and PDF into <dir> for a visual check.
//
//   node scripts/seed-demo/seed.mjs --remote --wipe
//       DELETES every account, row and uploaded file in the Supabase project
//       from .env.local (reference data in migrations is kept), then seeds it.
//       Writes the demo logins to .demo-accounts (git-ignored).
//
// Data goes through the app's own database functions (onboarding, student
// verification, publishing, ordering, payment status, delivery, reviews,
// disputes, payouts), impersonating each user like PostgREST does, so every
// business rule and status transition is enforced. Only Midtrans is simulated:
// paid orders receive a `settlement` status through apply_payment_status.
// Timestamps are then moved into the past to form a two-month history.
import { execFileSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as D from "./data.mjs";
import {
  artworkHtml,
  avatarHtml,
  createRenderer,
  documentHtml,
  studentCardHtml,
} from "./images.mjs";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

const MODE = flag("--remote") ? "remote" : flag("--dry-run") ? "dry-run" : null;
if (!MODE) {
  console.error("Usage: seed.mjs --dry-run [--out <dir>] | --remote --wipe");
  process.exit(2);
}
if (MODE === "remote" && !flag("--wipe")) {
  console.error(
    "Refusing to run: --remote replaces ALL data. Add --wipe to confirm.",
  );
  process.exit(2);
}

const NOW = Date.now();
const when = (t) =>
  "hours" in t ? D.hoursAgo(t.hours, NOW) : D.ago(t.days, t.hhmm, NOW);
const q = (s) =>
  s === null || s === undefined ? "null" : `'${String(s).replace(/'/g, "''")}'`;
const arr = (xs) => `array[${xs.map(q).join(", ")}]::text[]`;
const byKey = (list) => Object.fromEntries(list.map((x) => [x.key, x]));
const USERS = byKey(D.users);
const SERVICES = byKey(D.services);
const JOBS = byKey(D.jobs);
const PROPOSALS = byKey(D.proposals);

/** Calendar date (Asia/Makassar) `days` after the ISO instant. */
function dateAfter(iso, days) {
  const t = new Date(new Date(iso).getTime() + 8 * 3600e3 + days * 86400e3);
  return t.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Files: every upload, with the storage path the app itself would use.
// ---------------------------------------------------------------------------

/** Builds the list of files for users/services/portfolio (paths need user ids). */
function baseFiles(uid) {
  const files = [];
  const add = (bucket, owner, kind, spec) => {
    const p = `${uid[owner]}/${randomUUID()}.${kind === "pdf" ? "pdf" : "png"}`;
    files.push({ bucket, path: p, kind, spec });
    return p;
  };
  const paths = { avatar: {}, card: {}, cover: {}, portfolio: [] };
  for (const u of D.users) {
    if (!["melati", "lina"].includes(u.key)) {
      paths.avatar[u.key] = add("avatars", u.key, "avatar", u);
    }
    if (u.uni) {
      const university =
        u.uni === "UBT"
          ? "Universitas Borneo Tarakan"
          : "STMIK PPKIA Tarakanita Rahmawati";
      paths.card[u.key] = add("student-documents", u.key, "card", {
        ...u,
        university,
      });
    }
  }
  for (const s of D.services) {
    if (s.cover) {
      paths.cover[s.key] = add("service-media", s.by, "art", {
        art: s.art,
        title: s.cover,
        label: null,
      });
    }
  }
  for (const item of D.portfolio) {
    paths.portfolio.push(
      add("portfolio", item.by, "art", {
        art: item.art,
        title: item.short,
        label: "Portofolio",
      }),
    );
  }
  return { files, paths };
}

/** Delivery attachments: `{orderId}/{freelancerId}/{uuid}-{safe-name}` (order-forms.tsx). */
function deliveryFiles(refs, uid) {
  const files = [];
  const byStep = new Map();
  for (const o of D.orders) {
    const freelancer = freelancerOf(o);
    o.steps.forEach((step, i) => {
      if (step[0] !== "deliver" || !step[3]) return;
      const list = step[3].map((f) => {
        const safe = f.name
          .toLowerCase()
          .replace(/[^a-z0-9._-]/g, "-")
          .slice(-80);
        const p = `${refs[`o:${o.key}`]}/${uid[freelancer]}/${randomUUID()}-${safe}`;
        const kind = safe.endsWith(".pdf") ? "pdf" : "art";
        files.push({
          bucket: "order-files",
          path: p,
          kind,
          spec: {
            art: f.art,
            title: f.title,
            subtitle:
              SERVICES[o.service]?.title ??
              JOBS[PROPOSALS[o.proposal]?.job]?.title ??
              "",
            label: "Hasil akhir",
          },
        });
        return p;
      });
      byStep.set(`${o.key}#${i}`, list);
    });
  }
  return { files, byStep };
}

const freelancerOf = (o) =>
  o.service ? SERVICES[o.service].by : PROPOSALS[o.proposal].by;

async function renderFiles(files, renderer) {
  for (const f of files) {
    if (f.kind === "avatar")
      f.body = await renderer.png(avatarHtml(f.spec), 320, 320);
    else if (f.kind === "card")
      f.body = await renderer.png(studentCardHtml(f.spec), 856, 540);
    else if (f.kind === "pdf")
      f.body = await renderer.pdf(
        documentHtml({ title: f.spec.title, subtitle: f.spec.subtitle }),
      );
    else f.body = await renderer.png(artworkHtml(f.spec), 960, 600);
    f.type = f.kind === "pdf" ? "application/pdf" : "image/png";
  }
}

// ---------------------------------------------------------------------------
// SQL. Each phase is one transaction: any failed rule rolls everything back.
// ---------------------------------------------------------------------------

const RELATIVE = [
  "updated_at",
  "payment_due_at",
  "due_at",
  "token_expires_at",
  "valid_until",
  "verified_until",
];

const PRELUDE = `
begin;
create temp table seed_ref (key text primary key, id uuid not null) on commit drop;
create temp table seed_clock (k int primary key, t timestamptz not null) on commit drop;
-- Every timestamptz column the app's functions set to now(), except the ones
-- computed from others (due dates, token expiry) and updated_at.
create temp table seed_cols on commit drop as
  select c.table_name::text as t, c.column_name::text as c
  from information_schema.columns c
  join information_schema.tables tb on tb.table_schema = c.table_schema and tb.table_name = c.table_name
  where c.table_schema = 'public' and tb.table_type = 'BASE TABLE'
    and c.data_type = 'timestamp with time zone'
    and c.column_name not in (${RELATIVE.map(q).join(", ")});
select set_config('seed.k', '0', true);

-- Simulated clock: rows written in step k get the marker now() + k µs, and the
-- markers are replaced by the real step times at the end. Checks inside the
-- functions (payment window, review window) therefore see "now".
create or replace function pg_temp.mark() returns timestamptz language sql stable as $$
  select now() + make_interval(secs => current_setting('seed.k')::int / 1000000.0)
$$;
create or replace function pg_temp.flush() returns void language plpgsql as $$
declare r record;
begin
  for r in select * from seed_cols loop
    execute format('update public.%I set %I = pg_temp.mark() where %I = now()', r.t, r.c, r.c);
  end loop;
end $$;
create or replace function pg_temp.at(p_t timestamptz) returns void language plpgsql as $$
declare v_k int;
begin
  perform pg_temp.flush();
  v_k := current_setting('seed.k')::int + 1;
  perform set_config('seed.k', v_k::text, true);
  insert into seed_clock values (v_k, p_t);
end $$;
create or replace function pg_temp.act(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
end $$;
create or replace function pg_temp.ref(p_key text) returns uuid language plpgsql stable as $$
declare v uuid;
begin
  select id into v from seed_ref where key = p_key;
  if v is null then raise exception 'seed: unknown ref %', p_key; end if;
  return v;
end $$;
create or replace function pg_temp.uni(p_short text) returns uuid language sql stable as $$
  select id from public.universities where short_name = p_short
$$;
create or replace function pg_temp.cat(p_slug text) returns uuid language sql stable as $$
  select id from public.categories where slug = p_slug
$$;
-- Client pays: payment attempt, Snap token, then Midtrans "settlement".
create or replace function pg_temp.pay(p_order text, p_type text) returns void language plpgsql as $$
declare v_order public.orders; v_pay public.payments; v_res text;
begin
  select * into v_order from public.orders where id = pg_temp.ref(p_order);
  perform pg_temp.act(v_order.client_id);
  v_pay := public.create_payment_attempt(v_order.id);
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  v_pay := public.attach_snap_token(
    v_pay.id, 'seed-' || replace(gen_random_uuid()::text, '-', ''),
    'https://app.sandbox.midtrans.com/snap/v4/redirection/seed', now() + interval '1 hour');
  v_res := public.apply_payment_status(
    v_pay.midtrans_order_id, 'settlement', 'accept', '200', v_pay.gross_amount, p_type, gen_random_uuid()::text);
  if v_res <> 'applied' then raise exception 'seed: payment for % returned %', p_order, v_res; end if;
  insert into seed_ref values ('pay:' || p_order, v_pay.id);
end $$;
-- Replace markers with real times, derive dependent columns, check the result.
create or replace function pg_temp.finish(p_final boolean) returns void language plpgsql as $$
declare r record; v_n bigint; v_bad boolean;
begin
  perform pg_temp.flush();
  for r in select * from seed_cols loop
    execute format(
      'update public.%I x set %I = m.t from seed_clock m where x.%I = now() + make_interval(secs => m.k / 1000000.0)',
      r.t, r.c, r.c);
  end loop;
  update public.orders set payment_due_at = created_at + private.payment_window();
  update public.orders set due_at = paid_at + make_interval(days => delivery_days) where paid_at is not null;
  update public.payments set token_expires_at = created_at + interval '1 hour' where token_expires_at is not null;
  for r in
    select c.table_name::text as t, string_agg(quote_ident(c.column_name), ', ') as cols
    from information_schema.columns c
    where c.table_schema = 'public' and c.data_type = 'timestamp with time zone'
      and c.column_name not in (${RELATIVE.map(q).join(", ")})
      and c.table_name in (select t from seed_cols)
      and c.table_name not in ('universities', 'categories') -- reference data keeps its own history
      and exists (select 1 from information_schema.columns u
                  where u.table_schema = 'public' and u.table_name = c.table_name and u.column_name = 'updated_at')
    group by c.table_name
  loop
    execute format('alter table public.%I disable trigger user', r.t);
    execute format('update public.%I set updated_at = greatest(%s)', r.t, r.cols);
    execute format('alter table public.%I enable trigger user', r.t);
  end loop;
  -- Nothing may be left in the future (or unmapped at the transaction time).
  for r in select * from seed_cols loop
    execute format('select count(*) from public.%I where %I >= now()', r.t, r.c) into v_n;
    if v_n > 0 then
      raise exception 'seed: %.% has % value(s) not in the past', r.t, r.c, v_n;
    end if;
  end loop;
  if exists (select 1 from public.orders where status = 'awaiting_payment' and payment_due_at < now() + interval '1 hour') then
    raise exception 'seed: an unpaid order would expire within the hour';
  end if;
  if not p_final then return; end if;
  if exists (select 1 from public.orders where status = 'delivered' and delivered_at < now() - interval '2 days 12 hours') then
    raise exception 'seed: a delivered order would be auto-completed right away';
  end if;
  if exists (select 1 from public.orders where status = 'in_progress' and due_at < now()) then
    raise exception 'seed: an in-progress order is already overdue';
  end if;
  -- Chronology: every story must happen in a possible order.
  for r in select * from (values
    ('order events out of order', 'select 1 from (select created_at, lag(created_at) over (partition by order_id order by id) prev from public.order_events) x where created_at < prev'),
    ('order numbers not in date order', 'select 1 from (select created_at, lag(created_at) over (order by order_number) prev from public.orders) x where created_at < prev'),
    ('order paid before it was placed', 'select 1 from public.orders where paid_at < created_at'),
    ('order delivered before payment', 'select 1 from public.orders where delivered_at < paid_at'),
    ('order completed before delivery', 'select 1 from public.orders where completed_at < coalesce(delivered_at, paid_at)'),
    ('order cancelled before it was placed', 'select 1 from public.orders where cancelled_at < created_at'),
    ('payout before completion', 'select 1 from public.orders where payout_marked_at < completed_at'),
    ('order placed before the client joined', 'select 1 from public.orders o join public.profiles p on p.id = o.client_id where o.created_at < p.created_at'),
    ('review before completion', 'select 1 from public.reviews v join public.orders o on o.id = v.order_id where v.created_at < o.completed_at'),
    ('message before the order', 'select 1 from public.order_messages m join public.orders o on o.id = m.order_id where m.created_at < o.created_at'),
    ('delivery before payment', 'select 1 from public.order_deliveries d join public.orders o on o.id = d.order_id where d.created_at < o.paid_at'),
    ('dispute before payment', 'select 1 from public.disputes d join public.orders o on o.id = d.order_id where d.created_at < o.paid_at or d.resolved_at < d.created_at'),
    ('refund marked before the dispute was resolved', 'select 1 from public.payments p join public.disputes d on d.order_id = p.order_id where p.refund_marked_at < d.resolved_at'),
    ('proposal before its job', 'select 1 from public.proposals p join public.jobs j on j.id = p.job_id where p.created_at < j.created_at or p.decided_at < p.created_at'),
    ('job order before its proposal', 'select 1 from public.orders o join public.proposals p on p.id = o.proposal_id where o.created_at < p.created_at'),
    ('job posted before the client joined', 'select 1 from public.jobs j join public.profiles p on p.id = j.client_id where j.created_at < p.created_at'),
    ('service before verification', 'select 1 from public.services s join public.freelancer_profiles f on f.user_id = s.freelancer_id where s.created_at < f.created_at or s.published_at < s.created_at'),
    ('portfolio before verification', 'select 1 from public.portfolio_items i join public.freelancer_profiles f on f.user_id = i.freelancer_id where i.created_at < f.created_at'),
    ('verification reviewed before submission', 'select 1 from public.student_verifications where reviewed_at < created_at'),
    ('verification before joining', 'select 1 from public.student_verifications v join public.profiles p on p.id = v.user_id where v.created_at < p.created_at'),
    ('updated_at before created_at', 'select 1 from public.orders where updated_at < created_at union all select 1 from public.services where updated_at < created_at union all select 1 from public.jobs where updated_at < created_at')
  ) as c(label, probe) loop
    execute format('select exists (%s)', r.probe) into v_bad;
    if v_bad then raise exception 'seed: %', r.label; end if;
  end loop;
end $$;
`;

/** Phase A: accounts, verification, catalog, jobs, orders up to payment. */
function phaseA(uid, paths) {
  const out = [PRELUDE];
  const at = (t) =>
    out.push(`select pg_temp.at(${q(typeof t === "string" ? t : when(t))});`);
  const act = (key) => out.push(`select pg_temp.act(${q(uid[key])});`);

  // Onboarding and profiles, oldest account first.
  for (const u of [...D.users].sort((a, b) => b.joined - a.joined)) {
    at({ days: u.joined, hhmm: "08:30" });
    act(u.key);
    out.push(
      `select 1 from public.complete_onboarding(${q(u.fullName)}, ${q(u.username)}, true);`,
    );
    out.push(
      `update public.profiles set created_at = now(), bio = ${q(u.bio)}, location = ${q(u.location)}, avatar_path = ${q(paths.avatar[u.key])} where id = ${q(uid[u.key])};`,
    );
    if (u.admin)
      out.push(
        `insert into public.admin_users (user_id) values (${q(uid[u.key])});`,
      );
  }

  // Student verification by document, reviewed by an admin.
  const verify = (key, submitted, review) => {
    const u = USERS[key];
    at(submitted);
    act(key);
    out.push(
      `insert into seed_ref select ${q(`v:${key}`)}, r.id from public.submit_student_verification(pg_temp.uni(${q(u.uni)}), 'document', ${q(u.nim)}, ${q(paths.card[key])}) r;`,
    );
    if (!review) return;
    at(review.at);
    act(review.admin);
    if (review.approve) {
      out.push(
        `select 1 from public.review_student_verification(pg_temp.ref(${q(`v:${key}`)}), 'approve', '2027-08-31 23:59:59+08', null);`,
      );
      out.push(
        `update public.freelancer_profiles set headline = ${q(u.headline)}, major = ${q(u.major)}, skills = ${arr(u.skills)} where user_id = ${q(uid[key])};`,
      );
    } else {
      out.push(
        `select 1 from public.review_student_verification(pg_temp.ref(${q(`v:${key}`)}), 'reject', null, ${q(review.reason)});`,
      );
    }
  };
  for (const key of D.verifiedFreelancers) {
    const v = D.verificationReview[key];
    verify(
      key,
      { days: v.submitted, hhmm: "20:00" },
      {
        at: {
          days: v.reviewed,
          hhmm: v.submitted === v.reviewed ? "21:30" : "09:00",
        },
        admin: v.admin,
        approve: true,
      },
    );
  }
  verify(
    "melati",
    { days: 8, hhmm: "19:00" },
    {
      at: { days: 7, hhmm: "10:00" },
      admin: "sari",
      approve: false,
      reason:
        "Foto kartu mahasiswa buram sehingga nama dan NIM tidak terbaca. Silakan unggah ulang foto yang lebih jelas.",
    },
  );
  verify("yoga", { days: 1, hhmm: "21:00" }, null);

  // Services: insert as the freelancer would, then publish (and pause one).
  for (const s of D.services) {
    at({ days: s.days, hhmm: "13:00" });
    act(s.by);
    out.push(
      `with x as (insert into public.services (freelancer_id, category_id, title, description, price, delivery_days, revisions_included, requirements_prompt, cover_image_path) values (${q(uid[s.by])}, pg_temp.cat(${q(s.cat)}), ${q(s.title)}, ${q(s.description)}, ${s.price}, ${s.delivery}, ${s.revisions}, ${q(s.requirements)}, ${q(paths.cover[s.key])}) returning id) insert into seed_ref select ${q(`s:${s.key}`)}, id from x;`,
    );
    if ((s.status ?? "published") !== "draft") {
      out.push(
        `select 1 from public.set_service_status(pg_temp.ref(${q(`s:${s.key}`)}), 'published');`,
      );
    }
    if (s.status === "paused") {
      at({ days: 8, hhmm: "18:00" });
      act(s.by);
      out.push(
        `select 1 from public.set_service_status(pg_temp.ref(${q(`s:${s.key}`)}), 'paused');`,
      );
    }
  }

  // Portfolio, a day after verification.
  D.portfolio.forEach((item, i) => {
    at({
      days: D.verificationReview[item.by].reviewed - 1,
      hhmm: `1${i % 10}:15`,
    });
    out.push(
      `insert into public.portfolio_items (freelancer_id, title, description, image_paths, sort_order) values (${q(uid[item.by])}, ${q(item.title)}, ${q(item.description)}, ${arr([paths.portfolio[i]])}, ${i % 2});`,
    );
  });

  // Jobs, proposals, decisions and closures.
  for (const j of D.jobs) {
    const created = when({ days: j.days, hhmm: "08:30" });
    at(created);
    out.push(
      `with x as (insert into public.jobs (client_id, category_id, title, description, requirements, budget_min, budget_max, deadline) values (${q(uid[j.by])}, pg_temp.cat(${q(j.cat)}), ${q(j.title)}, ${q(j.description)}, ${q(j.requirements)}, ${j.budget[0]}, ${j.budget[1]}, ${q(dateAfter(created, j.deadline))}) returning id) insert into seed_ref select ${q(`j:${j.key}`)}, id from x;`,
    );
  }
  for (const p of D.proposals) {
    at({ days: p.days, hhmm: "10:00" });
    act(p.by);
    out.push(
      `insert into seed_ref select ${q(`p:${p.key}`)}, r.id from public.submit_proposal(pg_temp.ref(${q(`j:${p.job}`)}), ${q(p.cover)}, ${p.price}, ${p.delivery}, ${p.revisions}) r;`,
    );
  }
  for (const p of D.proposals) {
    if (p.outcome === "withdrawn") {
      at({ days: p.days - 1, hhmm: "15:00" });
      act(p.by);
      out.push(
        `select 1 from public.withdraw_proposal(pg_temp.ref(${q(`p:${p.key}`)}));`,
      );
    }
    if (p.outcome === "rejected") {
      at({ days: p.days - 1, hhmm: "16:00" });
      act(JOBS[p.job].by);
      out.push(
        `select 1 from public.reject_proposal(pg_temp.ref(${q(`p:${p.key}`)}), ${q(p.reason)});`,
      );
    }
  }
  for (const c of D.closedJobs) {
    at({ days: c.days, hhmm: "17:00" });
    act(JOBS[c.job].by);
    out.push(
      `select 1 from public.close_job(pg_temp.ref(${q(`j:${c.job}`)}), ${q(c.reason)});`,
    );
  }

  // Orders up to payment (or cancellation before payment), oldest first so
  // order numbers (and Midtrans order ids) follow the calendar.
  const chronological = [...D.orders].sort((x, y) =>
    when(x.created).localeCompare(when(y.created)),
  );
  for (const o of chronological) {
    at(o.created);
    act(o.client);
    out.push(
      o.service
        ? `insert into seed_ref values (${q(`o:${o.key}`)}, public.create_service_order(pg_temp.ref(${q(`s:${o.service}`)}), ${q(o.requirements)}));`
        : `insert into seed_ref values (${q(`o:${o.key}`)}, public.accept_proposal(pg_temp.ref(${q(`p:${o.proposal}`)})));`,
    );
    for (const step of o.steps) {
      if (step[0] === "pay") {
        at(step[1]);
        out.push(`select pg_temp.pay(${q(`o:${o.key}`)}, ${q(step[2])});`);
      } else if (step[0] === "cancel") {
        at(step[2]);
        act(step[1]);
        out.push(
          `select 1 from public.cancel_order(pg_temp.ref(${q(`o:${o.key}`)}), ${q(step[3])});`,
        );
      }
    }
  }

  out.push("select pg_temp.finish(false);");
  out.push("select json_object_agg(key, id) as refs from seed_ref;");
  out.push("commit;");
  return out.join("\n");
}

/** Phase B: everything after payment (needs order ids for delivery files). */
function phaseB(uid, refs, deliveries) {
  const out = [PRELUDE];
  for (const [key, id] of Object.entries(refs))
    out.push(`insert into seed_ref values (${q(key)}, ${q(id)});`);
  const at = (t) => out.push(`select pg_temp.at(${q(when(t))});`);
  const act = (key) => out.push(`select pg_temp.act(${q(uid[key])});`);

  for (const o of D.orders) {
    const order = `pg_temp.ref(${q(`o:${o.key}`)})`;
    const freelancer = freelancerOf(o);
    o.steps.forEach((step, i) => {
      const [kind] = step;
      if (kind === "pay" || kind === "cancel") return;
      if (kind === "msg") {
        at(step[2]);
        act(step[1]);
        out.push(
          `select 1 from public.send_order_message(${order}, ${q(step[3])});`,
        );
      } else if (kind === "deliver") {
        at(step[1]);
        act(freelancer);
        out.push(
          `select 1 from public.deliver_order(${order}, ${q(step[2])}, ${arr(deliveries.get(`${o.key}#${i}`) ?? [])});`,
        );
      } else if (kind === "revision") {
        at(step[1]);
        act(o.client);
        out.push(
          `select 1 from public.request_order_revision(${order}, ${q(step[2])});`,
        );
      } else if (kind === "complete") {
        at(step[1]);
        act(o.client);
        out.push(`select 1 from public.complete_order(${order});`);
      } else if (kind === "review") {
        at(step[2]);
        act(step[1]);
        out.push(
          `select 1 from public.create_order_review(${order}, ${step[3]}::smallint, ${q(step[4])});`,
        );
      } else if (kind === "payout") {
        at(step[2]);
        act(step[1]);
        out.push(
          `select 1 from public.mark_payout_paid(${order}, ${q(step[3])});`,
        );
      } else if (kind === "dispute") {
        at(step[2]);
        act(step[1]);
        out.push(
          `insert into seed_ref select ${q(`d:${o.key}`)}, r.id from public.open_order_dispute(${order}, ${q(step[3])}) r;`,
        );
      } else if (kind === "resolve") {
        at(step[2]);
        act(step[1]);
        out.push(
          `select 1 from public.resolve_dispute(pg_temp.ref(${q(`d:${o.key}`)}), ${q(step[3])}::public.dispute_resolution, ${q(step[4])});`,
        );
      } else if (kind === "refund") {
        at(step[2]);
        act(step[1]);
        out.push(
          `select 1 from public.mark_refund_completed(pg_temp.ref(${q(`pay:o:${o.key}`)}), ${q(step[3])});`,
        );
      } else {
        throw new Error(`Unknown step ${kind} in ${o.key}`);
      }
    });
  }

  out.push("select pg_temp.finish(true);");
  out.push(SUMMARY);
  out.push("commit;");
  return out.join("\n");
}

const SUMMARY = `select json_build_object(
  'users', (select count(*) from public.profiles),
  'admins', (select count(*) from public.admin_users),
  'freelancers', (select count(*) from public.freelancer_profiles),
  'verifications', (select json_object_agg(status, n) from (select status, count(*) n from public.student_verifications group by status) x),
  'services', (select json_object_agg(status, n) from (select status, count(*) n from public.services group by status) x),
  'portfolio_items', (select count(*) from public.portfolio_items),
  'jobs', (select json_object_agg(status, n) from (select status, count(*) n from public.jobs group by status) x),
  'proposals', (select json_object_agg(status, n) from (select status, count(*) n from public.proposals group by status) x),
  'orders', (select json_object_agg(status, n) from (select status, count(*) n from public.orders group by status) x),
  'payments', (select json_object_agg(status, n) from (select status, count(*) n from public.payments group by status) x),
  'refunds', (select json_object_agg(refund_status, n) from (select refund_status, count(*) n from public.payments where refund_status <> 'none' group by refund_status) x),
  'payouts', (select json_object_agg(payout_status, n) from (select payout_status, count(*) n from public.orders where payout_status <> 'none' group by payout_status) x),
  'deliveries', (select count(*) from public.order_deliveries),
  'messages', (select count(*) from public.order_messages),
  'reviews', (select count(*) from public.reviews),
  'disputes', (select json_object_agg(status, n) from (select status, count(*) n from public.disputes group by status) x),
  'order_events', (select count(*) from public.order_events),
  'oldest', (select min(created_at) from public.orders),
  'newest', (select max(created_at) from public.orders)
) as summary;`;

const WIPE = `
begin;
truncate table public.profiles, public.payment_notifications restart identity cascade;
select json_build_object(
  'profiles', (select count(*) from public.profiles),
  'orders', (select count(*) from public.orders),
  'services', (select count(*) from public.services),
  'universities', (select count(*) from public.universities),
  'categories', (select count(*) from public.categories)
) as wipe;
commit;`;

// ---------------------------------------------------------------------------
// Targets
// ---------------------------------------------------------------------------

function loadEnv() {
  const env = {};
  for (const line of fs
    .readFileSync(path.join(ROOT, ".env.local"), "utf8")
    .split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

/** Runs SQL on the linked hosted project with the Supabase CLI; returns the last row. */
function remoteSql(sql, label) {
  const file = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), "seed-")),
    `${label}.sql`,
  );
  fs.writeFileSync(file, sql, { mode: 0o600 });
  let stdout;
  try {
    stdout = execFileSync(
      "npx",
      ["supabase", "db", "query", "--remote", "--yes", "-f", file],
      {
        cwd: ROOT,
        encoding: "utf8",
        maxBuffer: 64 * 1024 * 1024,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
  } catch (error) {
    throw new Error(
      `${label} failed:\n${error.stdout ?? ""}\n${error.stderr ?? ""}`,
    );
  } finally {
    fs.rmSync(path.dirname(file), { recursive: true, force: true });
  }
  const json = JSON.parse(stdout.slice(stdout.indexOf("{")));
  if (json.error)
    throw new Error(`${label} failed: ${JSON.stringify(json.error)}`);
  const row = json.rows?.at(-1);
  if (!row) throw new Error(`${label}: no result returned`);
  // JSON columns may arrive as text depending on the CLI version.
  return Object.fromEntries(
    Object.entries(row).map(([k, v]) => [
      k,
      typeof v === "string" && /^[[{]/.test(v) ? JSON.parse(v) : v,
    ]),
  );
}

async function dryRun() {
  const { PGlite } = await import("@electric-sql/pglite");
  const db = await PGlite.create();
  await db.exec(
    fs.readFileSync(path.join(ROOT, "tests/db/supabase-shim.sql"), "utf8"),
  );
  const dir = path.join(ROOT, "supabase/migrations");
  for (const f of fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    await db.exec(fs.readFileSync(path.join(dir, f), "utf8"));
  }
  const last = (results) =>
    results
      .filter((r) => r.rows?.length)
      .at(-1)
      ?.rows.at(-1);
  const run = async (sql, label) => {
    try {
      return last(await db.exec(sql));
    } catch (error) {
      throw new Error(`${label} failed: ${error.message}`);
    }
  };

  const uid = {};
  for (const u of D.users) {
    const r = await db.query(
      "insert into auth.users (email, email_confirmed_at, raw_user_meta_data) values ($1, now(), $2) returning id",
      [u.email, JSON.stringify({ full_name: u.fullName })],
    );
    uid[u.key] = r.rows[0].id;
  }
  const putObjects = async (files) => {
    for (const f of files)
      await db.query(
        "insert into storage.objects (bucket_id, name) values ($1, $2)",
        [f.bucket, f.path],
      );
  };

  const base = baseFiles(uid);
  await putObjects(base.files);
  const a = await run(phaseA(uid, base.paths), "phase A");
  const refs = a.refs;
  const del = deliveryFiles(refs, uid);
  await putObjects(del.files);
  const b = await run(phaseB(uid, refs, del.byStep), "phase B");
  console.log(JSON.stringify(b.summary, null, 2));

  const outDir = option("--out");
  if (outDir) {
    const renderer = await createRenderer();
    try {
      const all = [...base.files, ...del.files];
      await renderFiles(all, renderer);
      for (const f of all) {
        const p = path.join(outDir, f.bucket, f.path.replace(/\//g, "__"));
        fs.mkdirSync(path.dirname(p), { recursive: true });
        fs.writeFileSync(p, f.body);
      }
      console.log(`Rendered ${all.length} files into ${outDir}`);
    } finally {
      await renderer.close();
    }
  }
}

async function remote() {
  const env = loadEnv();
  const { createClient } = await import("@supabase/supabase-js");
  const admin = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SECRET_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
  const ref = fs
    .readFileSync(path.join(ROOT, "supabase/.temp/project-ref"), "utf8")
    .trim();
  if (!env.NEXT_PUBLIC_SUPABASE_URL.includes(ref)) {
    throw new Error(
      "The linked project and NEXT_PUBLIC_SUPABASE_URL differ; refusing to continue.",
    );
  }

  // Start the browser first, so a rendering problem stops before the wipe.
  const renderer = await createRenderer();
  try {
    console.log(`Target: ${env.NEXT_PUBLIC_SUPABASE_URL}`);

    // 1. Wipe rows, files and accounts.
    console.log("Wiping data…", JSON.stringify(remoteSql(WIPE, "wipe").wipe));
    const objects = remoteSql(
      "select coalesce(json_agg(json_build_object('b', bucket_id, 'n', name)), '[]') as o from storage.objects;",
      "list-objects",
    ).o;
    const byBucket = Object.groupBy(objects, (o) => o.b);
    for (const [bucket, list] of Object.entries(byBucket)) {
      for (let i = 0; i < list.length; i += 100) {
        const { error } = await admin.storage
          .from(bucket)
          .remove(list.slice(i, i + 100).map((o) => o.n));
        if (error) throw error;
      }
    }
    console.log(`Removed ${objects.length} stored files.`);
    const ids = remoteSql(
      "select coalesce(json_agg(id), '[]') as ids from auth.users;",
      "list-users",
    ).ids;
    for (const id of ids) {
      const { error } = await admin.auth.admin.deleteUser(id);
      if (error) throw error;
    }
    console.log(`Deleted ${ids.length} accounts.`);

    // 2. Accounts (confirmed, so they can sign in right away).
    const password =
      process.env.DEMO_PASSWORD ||
      `Demo-${randomBytes(9).toString("base64url")}`;
    const uid = {};
    for (const u of D.users) {
      const { data, error } = await admin.auth.admin.createUser({
        email: u.email,
        password,
        email_confirm: true,
        user_metadata: { full_name: u.fullName },
      });
      if (error) throw new Error(`createUser ${u.email}: ${error.message}`);
      uid[u.key] = data.user.id;
    }
    const accounts =
      D.users
        .map((u) => `${u.login} ${u.email} ${password} ${uid[u.key]}`)
        .join("\n") + "\n";
    fs.writeFileSync(path.join(ROOT, ".demo-accounts"), accounts, {
      mode: 0o600,
    });
    console.log(
      `Created ${D.users.length} accounts; logins written to .demo-accounts.`,
    );

    // 3. Uploads, then phase A.
    const upload = async (files) => {
      await renderFiles(files, renderer);
      for (const f of files) {
        const { error } = await admin.storage
          .from(f.bucket)
          .upload(f.path, f.body, { contentType: f.type, upsert: false });
        if (error)
          throw new Error(`upload ${f.bucket}/${f.path}: ${error.message}`);
      }
      console.log(`Uploaded ${files.length} files.`);
    };
    const base = baseFiles(uid);
    await upload(base.files);
    const refs = remoteSql(phaseA(uid, base.paths), "phase A").refs;
    console.log("Phase A done.");

    // 4. Delivery files, then phase B.
    const del = deliveryFiles(refs, uid);
    await upload(del.files);
    const summary = remoteSql(phaseB(uid, refs, del.byStep), "phase B").summary;
    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await renderer.close();
  }
}

await (MODE === "remote" ? remote() : dryRun());
