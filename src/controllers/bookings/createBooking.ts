import type { Request, Response } from "express";

import { db } from "../../db/index.ts";
import { bookings } from "../../db/schema.ts";
import type { Booking } from "../../db/schema.ts";
import { findTakenSlots, lockSlots } from "../../lib/bookingSlots.ts";
import { logger } from "../../lib/logger.ts";
import type { CreateBookingInput } from "../../validators/bookings.ts";

type CreateOutcome =
  | { taken: Date[] }
  | { booking: Pick<Booking, "id" | "status" | "scheduledAt"> };

// req.body is already validated and trimmed by validateCreateBooking
const handleCreateBooking = async (req: Request, res: Response) => {
  const { name, email, phone, scheduledAt, message } =
    req.body as CreateBookingInput;

  // Dates are exclusive: pending/confirmed bookings hold their slots. Slots are
  // locked before the check so two concurrent requests for the same date can't
  // both pass and double-book.
  const outcome = await db.transaction(async (tx): Promise<CreateOutcome> => {
    await lockSlots(tx, scheduledAt);
    const taken = await findTakenSlots(tx, scheduledAt);
    if (taken.length > 0) return { taken };

    const [booking] = await tx
      .insert(bookings)
      .values({ name, email, phone, scheduledAt, message })
      .returning({
        id: bookings.id,
        status: bookings.status,
        scheduledAt: bookings.scheduledAt,
      });

    return { booking };
  });

  if ("taken" in outcome)
    return res.status(409).json({
      success: false,
      message: "One or more requested dates are already taken.",
      takenDates: outcome.taken.map((date) => date.toISOString()),
    });

  const { booking } = outcome;

  // No PII in the log line; the database is the record of truth
  logger.info(
    { event: "booking_created", bookingId: booking.id },
    "booking created",
  );

  res.status(201).json({
    success: true,
    message: "Booking received. We will review it and get back to you.",
    data: booking,
  });
};

export { handleCreateBooking };
