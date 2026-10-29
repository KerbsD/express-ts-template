import { sql } from "drizzle-orm";

import { db } from "../db/index.ts";

// Transaction handle passed to db.transaction(...) callbacks
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Statuses that hold their dates. Cancelled and completed bookings release
// their slots again. (Subset of BOOKING_STATUSES in validators/bookings.ts.)
export const ACTIVE_STATUSES = ["pending", "confirmed"] as const;

// The studio's local calendar day. Public availability is grouped by this zone
// so a slot near midnight does not land on a different day for the visitor.
export const STUDIO_TIME_ZONE = "Asia/Manila";

const ACTIVE_STATUS_PARAMS = sql.join(
  ACTIVE_STATUSES.map((status) => sql`${status}::booking_status`),
  sql`, `,
);

/**
 * Serialise writers per slot: concurrent creates/updates touching the same date
 * queue up here, so the check-then-write in the controllers cannot race.
 * Locks are taken in ascending order (deadlock-free for multi-date requests)
 * and released automatically when the transaction ends.
 */
export const lockSlots = async (tx: Tx, dates: Date[]) => {
  const ordered = [...dates].sort((a, b) => a.getTime() - b.getTime());
  for (const date of ordered) {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtextextended(${date.toISOString()}, 0))`,
    );
  }
};

/**
 * Subset of `dates` that another active booking already holds.
 * Call lockSlots() first, inside the same transaction.
 */
export const findTakenSlots = async (
  tx: Tx,
  dates: Date[],
  excludeBookingId?: number,
): Promise<Date[]> => {
  if (dates.length === 0) return [];

  const dateParams = sql.join(
    dates.map((date) => sql`${date.toISOString()}::timestamptz`),
    sql`, `,
  );
  const exclude =
    excludeBookingId !== undefined
      ? sql`AND b.id <> ${excludeBookingId}`
      : sql``;

  const result = await tx.execute<{ slot: Date }>(sql`
    SELECT DISTINCT slot
    FROM bookings b
    CROSS JOIN LATERAL unnest(b.scheduled_at) AS slot
    WHERE b.status IN (${ACTIVE_STATUS_PARAMS})
      ${exclude}
      AND slot IN (${dateParams})
    ORDER BY slot
  `);

  return result.rows.map((row) => new Date(row.slot));
};
