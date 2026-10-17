import {
  pgTable,
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
    email: text("email").notNull().unique(),
    password: text("password").notNull(),

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
  },
  (table) => [
    index("sessions_user_id_idx").on(table.userId),
    index("sessions_family_id_idx").on(table.familyId),
  ],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
