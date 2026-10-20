import { z } from "zod";
import { slugify } from "../lib/slug.ts";
import { validateBody, validateQuery } from "../lib/validate.ts";
import {
  imageUrlField,
  paginationFields,
  sortOrderField,
} from "./shared.ts";

// ---------- Shared fields ----------

const nameField = z
  .string({ error: "Name is required." })
  .trim()
  .min(1, "Name is required.")
  .max(120, "Name is too long.");

// Whole pesos: the frontend's Intl formatter turns 1000 into ₱1,000.00.
// Strict number (no coercion) so `price: null` can't silently become 0.
const priceField = z
  .number({ error: "Price is required." })
  .int("Price must be a whole number of pesos.")
  .min(0, "Price must be at least 0.")
  .max(10_000_000, "Price is too large.");

const categoryField = z
  .string({ error: "Category is required." })
  .trim()
  .min(1, "Category is required.")
  .max(60, "Category is too long.");

// Accepts any text and normalizes it to a slug; the result must not be empty
const slugField = z
  .string({ error: "Slug must be a string." })
  .trim()
  .max(160, "Slug is too long.")
  .transform((value) => slugify(value))
  .refine(
    (value) => value.length > 0,
    "Slug must contain at least one letter or number.",
  );

// Query-string booleans: ?published=true / ?preorder=false
const booleanQuery = (label: string) =>
  z
    .enum(["true", "false"], { error: `${label} must be true or false.` })
    .transform((value) => value === "true");

// ---------- Schemas ----------

export const createMerchSchema = z.object({
  name: nameField,
  price: priceField,
  imageUrl: imageUrlField,
  slug: slugField.optional(),
  category: categoryField,
  preorder: z.boolean().optional(),
  sortOrder: sortOrderField.optional(),
  published: z.boolean().optional(),
});

// PATCH: every field optional, but at least one must be present
export const updateMerchSchema = z
  .object({
    name: nameField.optional(),
    price: priceField.optional(),
    imageUrl: imageUrlField.optional(),
    slug: slugField.optional(),
    category: categoryField.optional(),
    preorder: z.boolean().optional(),
    sortOrder: sortOrderField.optional(),
    published: z.boolean().optional(),
  })
  .refine(
    (patch) => Object.keys(patch).length > 0,
    "Provide at least one field to update.",
  );

// Admin list query:
// ?published=true&preorder=false&category=Hoodies&search=hoodie&limit=...&offset=...
export const listMerchQuerySchema = z.object({
  ...paginationFields,
  published: booleanQuery("published").optional(),
  preorder: booleanQuery("preorder").optional(),
  category: z.string().trim().max(60, "Category is too long.").optional(),
  search: z.string().trim().max(120, "Search is too long.").optional(),
  sort: z.enum(["sortOrder", "name", "price", "createdAt"]).default("sortOrder"),
  order: z.enum(["asc", "desc"]).default("asc"),
});

// Public list query: ?limit=50&offset=0
export const publicMerchQuerySchema = z.object({
  ...paginationFields,
});

export type CreateMerchInput = z.infer<typeof createMerchSchema>;
export type UpdateMerchInput = z.infer<typeof updateMerchSchema>;
export type ListMerchQuery = z.infer<typeof listMerchQuerySchema>;
export type PublicMerchQuery = z.infer<typeof publicMerchQuerySchema>;

// ---------- Ready-to-use middlewares ----------

export const validateCreateMerch = validateBody(createMerchSchema);
export const validateUpdateMerch = validateBody(updateMerchSchema);
export const validateListMerchQuery = validateQuery(listMerchQuerySchema);
export const validatePublicMerchQuery = validateQuery(publicMerchQuerySchema);
