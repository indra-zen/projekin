import { vi } from "vitest";

type Row = Record<string, unknown> | null;

export type FakeOptions = {
  userId?: string | null;
  email?: string;
  profile?: Row;
  isAdmin?: boolean;
  rpc?: (name: string, args: unknown) => { data: unknown; error: unknown };
  update?: (
    table: string,
    values: unknown,
  ) => { data: unknown; error: unknown };
  /** Read results for other tables (single/maybeSingle/awaited queries). */
  reads?: Record<string, { data?: unknown; count?: number }>;
  insert?: (
    table: string,
    values: unknown,
  ) => { data: unknown; error: unknown };
  /** Result of `.delete()...select()` (defaults to no deleted rows). */
  delete?: (table: string) => { data: unknown; error: unknown };
};

/**
 * Minimal stand-in for the user-scoped Supabase client used by server code.
 * Supports the call chains used by src/server/auth.ts and the actions.
 */
export function fakeSupabase(options: FakeOptions) {
  // Returns a promise that also supports `.single()`, like the real builder.
  const rpc = vi.fn((name: string, args: unknown) => {
    const result = Promise.resolve(
      options.rpc ? options.rpc(name, args) : { data: null, error: null },
    );
    return Object.assign(result, { single: () => result });
  });
  const updates: { table: string; values: unknown }[] = [];
  const inserts: { table: string; values: unknown }[] = [];
  const storageRemove = vi.fn(async () => ({ data: null, error: null }));

  function from(table: string) {
    let pendingUpdate: unknown;
    let pendingInsert: unknown;
    let pendingDelete = false;
    const resolveRead = (): { data: unknown; error: null } => {
      if (table === "profiles")
        return { data: options.profile ?? null, error: null };
      if (table === "admin_users") {
        return {
          data: options.isAdmin ? { user_id: options.userId } : null,
          error: null,
        };
      }
      const read = options.reads?.[table];
      return { data: read?.data ?? null, error: null };
    };
    const resolve = () => {
      if (pendingDelete) {
        return options.delete
          ? options.delete(table)
          : { data: [], error: null };
      }
      if (pendingUpdate !== undefined) {
        updates.push({ table, values: pendingUpdate });
        return options.update
          ? options.update(table, pendingUpdate)
          : { data: { id: options.userId }, error: null };
      }
      if (pendingInsert !== undefined) {
        inserts.push({ table, values: pendingInsert });
        return options.insert
          ? options.insert(table, pendingInsert)
          : { data: { id: "new-id" }, error: null };
      }
      return resolveRead();
    };
    const builder: Record<string, unknown> = {};
    for (const method of [
      "select",
      "eq",
      "neq",
      "not",
      "in",
      "gte",
      "lte",
      "order",
      "limit",
      "range",
    ]) {
      builder[method] = () => builder;
    }
    builder.update = (values: unknown) => {
      pendingUpdate = values;
      return builder;
    };
    builder.insert = (values: unknown) => {
      pendingInsert = values;
      return builder;
    };
    builder.delete = () => {
      pendingDelete = true;
      return builder;
    };
    // Awaiting the builder directly (e.g. count queries).
    builder.then = (onFulfilled: (value: unknown) => unknown) =>
      Promise.resolve({
        ...resolve(),
        count: options.reads?.[table]?.count ?? 0,
      }).then(onFulfilled);
    builder.single = async () => resolve();
    builder.maybeSingle = async () => resolve();
    return builder;
  }

  const client = {
    auth: {
      getClaims: vi.fn(async () =>
        options.userId
          ? {
              data: {
                claims: {
                  sub: options.userId,
                  email: options.email ?? "user@example.test",
                },
              },
              error: null,
            }
          : { data: null, error: null },
      ),
    },
    from: vi.fn(from),
    rpc,
    storage: { from: () => ({ remove: storageRemove }) },
  };

  return { client, rpc, updates, inserts, storageRemove };
}

export function profileRow(
  id: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    id,
    username: "rina_a",
    full_name: "Rina",
    avatar_path: null,
    bio: null,
    location: null,
    terms_accepted_at: "2026-11-13T00:00:00Z",
    onboarded_at: "2026-11-13T00:00:00Z",
    created_at: "2026-11-13T00:00:00Z",
    updated_at: "2026-11-13T00:00:00Z",
    ...overrides,
  };
}

export function formData(values: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(values)) fd.set(key, value);
  return fd;
}
