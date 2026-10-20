import { z } from "zod";
import { validateBody, validateQuery } from "../lib/validate.ts";
import { imageUrlField, optionalText, sortOrderField } from "./shared.ts";

// ---------- Shared fields ----------

// Calendar date, no time or timezone: YYYY-MM-DD
const dateField = z.iso
  .date({
    error: "date must be a calendar date in YYYY-MM-DD format.",
  })
  .nullable();

// ---------- Schemas ----------

export const createPortfolioSchema = z.object({
  title: z
    .string({ error: "Title is required." })
    .trim()
    .min(1, "Title is required.")
    .max(120, "Title is too long."),
  description: optionalText(2000, "Description"),
  imageUrl: imageUrlField,
  style: optionalText(60, "Style"),
  artist: optionalText(120, "Artist"),
  duration: optionalText(60, "Duration"),
  date: dateField.optional(),
  sortOrder: sortOrderField.optional(),
  published: z.boolean().optional(),
});

// PATCH: every field optional, but at least one must be present
export const updatePortfolioSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "Title is required.")
      .max(120, "Title is too long.")
      .optional(),
    description: z
      .string()
      .trim()
      .max(2000, "Description is too long.")
      .optional(),
    imageUrl: imageUrlField.optional(),
    style: z.string().trim().max(60, "Style is too long.").optional(),
    artist: z.string().trim().max(120, "Artist is too long.").optional(),
    duration: z.string().trim().max(60, "Duration is too long.").optional(),
    date: dateField.optional(),
    sortOrder: sortOrderField.optional(),
    published: z.boolean().optional(),
  })
  .refine(
    (patch) => Object.keys(patch).length > 0,
    "Provide at least one field to update.",
  );

// Admin list query: ?published=true&style=minimalist&search=seer&limit=...&offset=...
export const listPortfolioQuerySchema = z.object({
  published: z
    .enum(["true", "false"], { error: "published must be true or false." })
    .transform((value) => value === "true")
    .optional(),
  style: z.string().trim().max(60, "Style is too long.").optional(),
  search: z.string().trim().max(120, "Search is too long.").optional(),
  limit: z.coerce
    .number()
    .int("limit must be an integer.")
    .min(1, "limit must be at least 1.")
    .max(100, "limit must be at most 100.")
    .default(50),
  offset: z.coerce
    .number()
    .int("offset must be an integer.")
    .min(0, "offset must be at least 0.")
    .default(0),
  sort: z.enum(["sortOrder", "date", "createdAt", "title"]).default("sortOrder"),
  order: z.enum(["asc", "desc"]).default("asc"),
});

export type CreatePortfolioInput = z.infer<typeof createPortfolioSchema>;
export type UpdatePortfolioInput = z.infer<typeof updatePortfolioSchema>;
export type ListPortfolioQuery = z.infer<typeof listPortfolioQuerySchema>;

// ---------- Ready-to-use middlewares ----------

export const validateCreatePortfolio = validateBody(createPortfolioSchema);
export const validateUpdatePortfolio = validateBody(updatePortfolioSchema);
export const validateListPortfolioQuery = validateQuery(
  listPortfolioQuerySchema,
);
