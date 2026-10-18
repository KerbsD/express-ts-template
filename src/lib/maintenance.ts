import { and, eq, sql } from "drizzle-orm";
import { db } from "../db/index.ts";
import { users } from "../db/schema.ts";
import { logger, serializeError } from "./logger.ts";
import { purgeExpiredSessions } from "./sessions.ts";

const UNVERIFIED_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// Frees usernames/emails held by accounts that never verified (squatting).
// "Last activity" = last verification email, falling back to creation time.
export const purgeStaleUnverifiedUsers = async (): Promise<void> => {
  const cutoff = new Date(Date.now() - UNVERIFIED_TTL_MS).toISOString();

  await db
    .delete(users)
    .where(
      and(
        eq(users.isVerified, false),
        sql`coalesce(${users.lastVerificationSentAt}, ${users.createdAt}) < ${cutoff}::timestamptz`,
      ),
    );
};

export const runMaintenance = async (): Promise<void> => {
  try {
    await purgeExpiredSessions();
    await purgeStaleUnverifiedUsers();
  } catch (err) {
    logger.error({ err: serializeError(err) }, "maintenance job failed");
  }
};
