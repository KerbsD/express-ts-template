import { z } from "zod";
import { validateBody, validateQuery } from "../lib/validate.ts";
import {
  booleanQueryField,
  imageUrlField,
  optionalText,
  paginationFields,
  sortOrderField,
} from "./shared.ts";

// ---------- Shared fields ----------

const titleField = z
  .string({ error: "Title is required." })
  .trim()
  .min(1, "Title is required.")
  .max(120, "Title is too long.");

const categoryField = z
  .string({ error: "Category is required." })
  .trim()
  .min(1, "Category is required.")
  .max(60, "Category is too long.");

// ---------- Schemas ----------

export const createDesignSchema = z.object({
  title: titleField,
  description: optionalText(2000, "Description"),
  // Displayed on the card as "Style: ..."
  style: optionalText(60, "Style"),
  // Displayed on the card as "Placement: ..."
  placement: optionalText(120, "Placement"),
  imageUrl: imageUrlField,
  // Filter chip ("Minimalist", "Black & Grey", "Illustrative")
  category: categoryField,
  sortOrder: sortOrderField.optional(),
  published: z.boolean().optional(),
});

// PATCH: every field optional, but at least one must be present
export const updateDesignSchema = z
  .object({
    title: titleField.optional(),
    description: z
      .string()
      .trim()
      .max(2000, "Description is too long.")
      .optional(),
    style: z.string().trim().max(60, "Style is too long.").optional(),
    placement: z.string().trim().max(120, "Placement is too long.").optional(),
    imageUrl: imageUrlField.optional(),
    category: categoryField.optional(),
    sortOrder: sortOrderField.optional(),
    published: z.boolean().optional(),
  })
  .refine(
    (patch) => Object.keys(patch).length > 0,
    "Provide at least one field to update.",
  );

// Admin list query:
// ?published=true&category=Minimalist&search=clear&limit=...&offset=...
export const listDesignQuerySchema = z.object({
  ...paginationFields,
  published: booleanQueryField("published").optional(),
  category: z.string().trim().max(60, "Category is too long.").optional(),
  search: z.string().trim().max(120, "Search is too long.").optional(),
  sort: z.enum(["sortOrder", "title", "createdAt"]).default("sortOrder"),
  order: z.enum(["asc", "desc"]).default("asc"),
});

// Public list query: ?limit=12&offset=0
export const publicDesignQuerySchema = z.object({
  ...paginationFields,
});

export type CreateDesignInput = z.infer<typeof createDesignSchema>;
export type UpdateDesignInput = z.infer<typeof updateDesignSchema>;
export type ListDesignQuery = z.infer<typeof listDesignQuerySchema>;
export type PublicDesignQuery = z.infer<typeof publicDesignQuerySchema>;

// ---------- Ready-to-use middlewares ----------

export const validateCreateDesign = validateBody(createDesignSchema);
export const validateUpdateDesign = validateBody(updateDesignSchema);
export const validateListDesignQuery = validateQuery(listDesignQuerySchema);
export const validatePublicDesignQuery = validateQuery(publicDesignQuerySchema);
