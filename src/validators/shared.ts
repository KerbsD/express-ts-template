import { z } from "zod";

// Site-relative path ("/portfolio/TP7.jpg") or an absolute http(s) URL.
// Rejects javascript:, data: and other schemes, as well as protocol-relative
// "//host" URLs (they silently point at a different origin), because the
// frontend renders this value in <img src>.
export const imageUrlField = z
  .string({ error: "Image URL is required." })
  .trim()
  .min(1, "Image URL is required.")
  .max(2048, "Image URL is too long.")
  .refine(
    (value) => /^\/(?!\/)/.test(value) || /^https?:\/\/[^\s]+$/i.test(value),
    "Image URL must be a site-relative path or an http(s) URL.",
  );

// Optional display fields: "" is a valid value, so treat it as absent
export const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} is too long.`)
    .default("");

// Shared by body (create/update) and query schemas
export const sortOrderField = z.coerce
  .number({ error: "sortOrder must be a number." })
  .int("sortOrder must be an integer.")
  .min(0, "sortOrder must be at least 0.");

// Shared limit/offset pagination for list endpoints: ?limit=50&offset=0
export const paginationFields = {
  limit: z.coerce
    .number()
    .int("limit must be an integer.")
    .min(1, "limit must be at least 1.")
    .max(100, "limit must be at most 100.")
    .default(12),
  offset: z.coerce
    .number()
    .int("offset must be an integer.")
    .min(0, "offset must be at least 0.")
    .default(0),
};
