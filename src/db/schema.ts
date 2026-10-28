import {
  pgTable,
  pgEnum,
  serial,
  text,
  timestamp,
  boolean,
  date,
  uniqueIndex,
  index,
  uuid,
  integer,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    username: text("username").notNull(),
    // Uniqueness is enforced by the case-insensitive index below. A plain
    // .unique() here would be a redundant, looser second constraint.
    email: text("email").notNull(),
    password: text("password").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),

    isVerified: boolean("is_verified").notNull().default(false),

    // Only SHA-256 hashes are stored. The raw token exists only in the email link.
    // .unique() also gives us the index for the atomic lookup.
    verificationTokenHash: text("verification_token_hash").unique(),
    verificationExpiresAt: timestamp("verification_expires_at", {
      withTimezone: true,
    }),
    lastVerificationSentAt: timestamp("last_verification_sent_at", {
      withTimezone: true,
    }),

    resetPasswordTokenHash: text("reset_password_token_hash").unique(),
    resetPasswordExpiresAt: timestamp("reset_password_expires_at", {
      withTimezone: true,
    }),
    resetPasswordSentAt: timestamp("reset_password_sent_at", {
      withTimezone: true,
    }),
  },
  (table) => [
    uniqueIndex("users_username_lower_idx").on(sql`lower(${table.username})`),
    uniqueIndex("users_email_lower_idx").on(sql`lower(${table.email})`),
  ],
);

// One row per issued refresh token. All tokens descended from one login share a
// familyId, so a replayed (already-rotated) token can revoke the whole chain.
export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    familyId: uuid("family_id").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    absoluteExpiresAt: timestamp("absolute_expires_at", {
      withTimezone: true,
    }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }), // set when rotated
    revokedAt: timestamp("revoked_at", { withTimezone: true }),

    // Fingerprint of the client this token was issued to. Lets the grace
    // window tell a multi-tab race apart from a replayed (stolen) token.
    ip: text("ip"),
    userAgent: text("user_agent"),
  },
  (table) => [
    index("sessions_user_id_idx").on(table.userId),
    index("sessions_family_id_idx").on(table.familyId),
  ],
);

// ---------- Bookings ----------

// Statuses live in a real Postgres enum; add values with a migration if needed.
export const bookingStatus = pgEnum("booking_status", [
  "pending",
  "confirmed",
  "completed",
  "cancelled",
]);

// A booking requested from the public site by a visitor (no account needed).
// Admins list and manage these through /admin/bookings.
export const bookings = pgTable(
  "bookings",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone").notNull().default(""),
    // Up to 3 preferred dates; stored sorted (earliest first), deduplicated.
    // Exclusivity is enforced by the API (src/lib/bookingSlots.ts) rather than
    // a constraint, so writes outside the API can still double-book.
    scheduledAt: timestamp("scheduled_at", { withTimezone: true })
      .array()
      .notNull(),
    message: text("message").notNull().default(""),
    status: bookingStatus("status").notNull().default("pending"),
    adminNote: text("admin_note").notNull().default(""),
    // Set when the admin manually sends the matching customer email. Two
    // separate markers keep the history across status changes (e.g. a
    // confirmation followed later by a cancellation).
    confirmationEmailSentAt: timestamp("confirmation_email_sent_at", {
      withTimezone: true,
    }),
    cancellationEmailSentAt: timestamp("cancellation_email_sent_at", {
      withTimezone: true,
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("bookings_scheduled_at_idx").on(table.scheduledAt),
    index("bookings_status_idx").on(table.status),
    index("bookings_created_at_idx").on(table.createdAt),
  ],
);

// ---------- Portfolio ----------

// Gallery items shown on the public /portfolio page and managed by the admin.
// Images are hosted elsewhere (Cloudinary, Vercel Blob, the Next.js site); only
// the URL/path is stored here.
export const portfolioItems = pgTable(
  "portfolio_items",
  {
    id: serial("id").primaryKey(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    // Site-relative path ("/portfolio/TP7.jpg") or an absolute http(s) URL
    imageUrl: text("image_url").notNull(),
    // Free text, so new styles don't need a migration. The frontend can build
    // its filter list from the distinct values.
    style: text("style").notNull().default(""),
    artist: text("artist").notNull().default(""),
    duration: text("duration").notNull().default(""), // display text, e.g. "3.5 hours"
    // Calendar date only (no time or timezone), stored as YYYY-MM-DD
    date: date("date"),
    // Carousel order; lower comes first. New items are appended by the API.
    sortOrder: integer("sort_order").notNull().default(0),
    // Draft/hidden items never appear on the public route
    published: boolean("published").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("portfolio_items_published_sort_idx").on(
      table.published,
      table.sortOrder,
    ),
  ],
);

// ---------- Merch ----------

// Products shown on the public /merch page and managed by the admin. Prices
// are whole Philippine pesos (the frontend formats them with Intl en-PH).
// There is no stock/inventory tracking yet: `preorder` only drives the badge.
export const merchProducts = pgTable(
  "merch_products",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    // Stable, URL-safe identifier (generated from the name when omitted)
    slug: text("slug").notNull(),
    price: integer("price").notNull(),
    // Site-relative path ("/merch/HOODIE.png") or an absolute http(s) URL
    imageUrl: text("image_url").notNull(),
    // Free text, so new categories don't need a migration. The frontend builds
    // its filter chips from the distinct values.
    category: text("category").notNull(),
    preorder: boolean("preorder").notNull().default(false),
    // Display order; lower comes first. New products are appended by the API.
    sortOrder: integer("sort_order").notNull().default(0),
    // Draft/hidden products never appear on the public route
    published: boolean("published").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("merch_products_slug_unique").on(table.slug),
    index("merch_products_published_sort_idx").on(
      table.published,
      table.sortOrder,
    ),
  ],
);

// ---------- Designs ----------

// Original tattoo designs offered on the public /design page and managed by
// the admin. The site adds designs to the cart without a price (they're
// price-on-request), so there is no price column.
export const designItems = pgTable(
  "design_items",
  {
    id: serial("id").primaryKey(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    // Displayed on the card ("Style: Minimalist")
    style: text("style").notNull().default(""),
    // Displayed on the card ("Placement: Forearm / Chest")
    placement: text("placement").notNull().default(""),
    // Site-relative path ("/design/dfs-1.png") or an absolute http(s) URL
    imageUrl: text("image_url").notNull(),
    // Filter chip ("Minimalist", "Black & Grey", "Illustrative"). Free text,
    // so new categories don't need a migration: the frontend derives its chips
    // from the distinct values.
    category: text("category").notNull(),
    // Display order; lower comes first. New designs are appended by the API.
    sortOrder: integer("sort_order").notNull().default(0),
    // Draft/hidden designs never appear on the public route
    published: boolean("published").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("design_items_published_sort_idx").on(
      table.published,
      table.sortOrder,
    ),
  ],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
export type NewBooking = typeof bookings.$inferInsert;
export type PortfolioItem = typeof portfolioItems.$inferSelect;
export type NewPortfolioItem = typeof portfolioItems.$inferInsert;
export type MerchProduct = typeof merchProducts.$inferSelect;
export type NewMerchProduct = typeof merchProducts.$inferInsert;
export type DesignItem = typeof designItems.$inferSelect;
export type NewDesignItem = typeof designItems.$inferInsert;
