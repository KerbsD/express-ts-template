import {
  pgTable,
  pgEnum,
  serial,
  text,
  timestamp,
  boolean,
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

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
export type NewBooking = typeof bookings.$inferInsert;
