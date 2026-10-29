import { sql } from "drizzle-orm";
import type { Request, Response } from "express";

import { db } from "../../db/index.ts";
import {
  ACTIVE_STATUSES,
  STUDIO_TIME_ZONE,
} from "../../lib/bookingSlots.ts";

const ACTIVE_STATUS_PARAMS = sql.join(
  ACTIVE_STATUSES.map((status) => sql`${status}::booking_status`),
  sql`, `,
);

/**
 * Public read-only availability for the landing-page calendar.
 *
 * Returns only calendar days (YYYY-MM-DD in the studio's time zone) that an
 * active booking already holds. No customer data is exposed.
 */
const handleGetBookingAvailability = async (_req: Request, res: Response) => {
  const result = await db.execute<{ date: string }>(sql`
    SELECT DISTINCT
      to_char(slot AT TIME ZONE ${STUDIO_TIME_ZONE}, 'YYYY-MM-DD') AS date
    FROM bookings b
    CROSS JOIN LATERAL unnest(b.scheduled_at) AS slot
    WHERE b.status IN (${ACTIVE_STATUS_PARAMS})
      AND slot > now()
      AND slot <= now() + interval '1 year'
    ORDER BY date
  `);

  res.json({
    success: true,
    data: {
      takenDates: result.rows.map((row) => row.date),
    },
  });
};

export { handleGetBookingAvailability };
