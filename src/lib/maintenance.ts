import { and, eq, sql } from "drizzle-orm";
import { db } from "../db/index.ts";
import { users } from "../db/schema.ts";
import { logger, serializeError } from "./logger.ts";
import { snapshotCounters } from "./metrics.ts";
import { purgeExpiredSessions } from "./sessions.ts";

const UNVERIFIED_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// Frees usernames/emails held by accounts that never verified (squatting).
// Purges on creation time, not last activity: refreshing the verification
// email used to push the deadline forward forever, so a squatter could hold a
// username indefinitely by re-registering every few days.
export const purgeStaleUnverifiedUsers = async (): Promise<void> => {
  const cutoff = new Date(Date.now() - UNVERIFIED_TTL_MS).toISOString();

  await db
    .delete(users)
    .where(
      and(
        eq(users.isVerified, false),
        sql`${users.createdAt} < ${cutoff}::timestamptz`,
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

  // Security counters (token reuse, fingerprint mismatches, ...) live in the
  // process; emit them here so the numbers are observable somewhere.
  const counters = snapshotCounters();
  if (Object.keys(counters).length > 0)
    logger.info({ counters }, "security counters");
};
