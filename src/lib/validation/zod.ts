import { z } from "zod";

// Default Zod messages in Bahasa Indonesia (PRD NFR-11). Schemas add specific
// messages where the default wording is not user-friendly enough.
// `jitless`: skip Zod's `new Function` probe and fast path so the
// Content-Security-Policy needs no 'unsafe-eval' (ARCHITECTURE §12.1).
// Parsing results are identical. It must run before any schema is built.
z.config({ ...z.locales.id(), jitless: true });

export { z };
