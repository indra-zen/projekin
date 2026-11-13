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
};

/**
 * Minimal stand-in for the user-scoped Supabase client used by server code.
 * Supports the call chains used by src/server/auth.ts and the actions.
 */
export function fakeSupabase(options: FakeOptions) {
  const rpc = vi.fn(async (name: string, args: unknown) =>
    options.rpc ? options.rpc(name, args) : { data: null, error: null },
  );
  const updates: { table: string; values: unknown }[] = [];
  const storageRemove = vi.fn(async () => ({ data: null, error: null }));

  function from(table: string) {
    let pendingUpdate: unknown;
    const resolveRead = (): { data: unknown; error: null } => {
      if (table === "profiles")
        return { data: options.profile ?? null, error: null };
      if (table === "admin_users") {
        return {
          data: options.isAdmin ? { user_id: options.userId } : null,
          error: null,
        };
      }
      return { data: null, error: null };
    };
    const resolve = () => {
      if (pendingUpdate !== undefined) {
        updates.push({ table, values: pendingUpdate });
        return options.update
          ? options.update(table, pendingUpdate)
          : { data: { id: options.userId }, error: null };
      }
      return resolveRead();
    };
    const builder: Record<string, unknown> = {};
    for (const method of ["select", "eq", "neq", "not", "order", "limit"]) {
      builder[method] = () => builder;
    }
    builder.update = (values: unknown) => {
      pendingUpdate = values;
      return builder;
    };
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

  return { client, rpc, updates, storageRemove };
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
