import { z } from "zod";

// Default Zod messages in Bahasa Indonesia (PRD NFR-11). Schemas add specific
// messages where the default wording is not user-friendly enough.
z.config(z.locales.id());

export { z };
