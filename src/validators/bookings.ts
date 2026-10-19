import { z } from "zod";
import { validateBody, validateQuery } from "../lib/validate.ts";

export const BOOKING_STATUSES = [
  "pending",
  "confirmed",
  "completed",
  "cancelled",
] as const;

// ---------- Shared fields ----------

const emailField = z
  .string({ error: "Email is required." })
  .trim()
  .min(1, "Email is required.")
  .max(254, "Email is too long.")
  .pipe(z.email("Must be a valid email address."));

const phoneField = z
  .string({ error: "Phone must be a string." })
  .trim()
  .max(32, "Phone is too long.")
  .refine(
    (value) => value === "" || /^[+\d][\d\s()+.-]{5,31}$/.test(value),
    "Phone number looks invalid.",
  )
  .default("");

// One preferred date. A timezone is required (Z or +hh:mm), so the server
// never has to guess what wall-clock time the client meant.
const scheduledAtItem = z.iso
  .datetime({
    offset: true,
    error:
      "Each scheduledAt date must be an ISO 8601 datetime with a timezone, e.g. 2026-11-05T14:30:00Z.",
  })
  .transform((value) => new Date(value))
  .refine(
    (date) => date.getTime() > Date.now(),
    "scheduledAt dates must be in the future.",
  )
  .refine(
    (date) => date.getTime() - Date.now() <= 366 * 24 * 60 * 60 * 1000,
    "scheduledAt dates must be within a year from now.",
  );

// Up to 3 preferred dates for one booking. A single ISO string is accepted as a
// 1-element list for convenience. Always normalised to a sorted (earliest
// first), de-duplicated array.
const scheduledAtField = z
  .preprocess(
    (value) => (typeof value === "string" ? [value] : value),
    z
      .array(scheduledAtItem, { error: "scheduledAt is required." })
      .min(1, "scheduledAt must include at least one date.")
      .max(3, "scheduledAt can include at most 3 dates."),
  )
  .transform((dates) =>
    [...new Set(dates.map((date) => date.getTime()))]
      .sort((a, b) => a - b)
      .map((time) => new Date(time)),
  );

const rangeDateField = (name: string) =>
  z.iso
    .datetime({
      offset: true,
      error: `${name} must be an ISO 8601 datetime with a timezone.`,
    })
    .transform((value) => new Date(value));

// ---------- Schemas ----------

export const createBookingSchema = z.object({
  name: z
    .string({ error: "Name is required." })
    .trim()
    .min(1, "Name is required.")
    .max(100, "Name is too long."),
  email: emailField,
  phone: phoneField,
  scheduledAt: scheduledAtField,
  message: z.string().trim().max(2000, "Message is too long.").default(""),
});

export const updateBookingSchema = z
  .object({
    status: z.enum(BOOKING_STATUSES).optional(),
    scheduledAt: scheduledAtField.optional(),
    adminNote: z
      .string()
      .trim()
      .max(2000, "Admin note is too long.")
      .optional(),
  })
  .refine(
    (patch) => Object.keys(patch).length > 0,
    "Provide at least one field to update (status, scheduledAt, adminNote).",
  );

// Admin list query: ?status=confirmed&from=...&to=...&search=...&limit=...&offset=...&sort=createdAt&order=desc
export const listBookingsQuerySchema = z.object({
  status: z.enum(BOOKING_STATUSES).optional(),
  from: rangeDateField("from").optional(),
  to: rangeDateField("to").optional(),
  search: z.string().trim().max(100, "Search is too long.").optional(),
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
  sort: z.enum(["createdAt", "scheduledAt"]).default("createdAt"),
  order: z.enum(["asc", "desc"]).default("desc"),
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type UpdateBookingInput = z.infer<typeof updateBookingSchema>;
export type ListBookingsQuery = z.infer<typeof listBookingsQuerySchema>;

// ---------- Ready-to-use middlewares ----------

export const validateCreateBooking = validateBody(createBookingSchema);
export const validateUpdateBooking = validateBody(updateBookingSchema);
export const validateListBookingsQuery = validateQuery(listBookingsQuerySchema);
