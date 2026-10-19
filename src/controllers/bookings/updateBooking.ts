import { eq } from "drizzle-orm";
import type { Request, Response } from "express";

import { db } from "../../db/index.ts";
import { bookings } from "../../db/schema.ts";
import type { Booking } from "../../db/schema.ts";
import {
  ACTIVE_STATUSES,
  findTakenSlots,
  lockSlots,
} from "../../lib/bookingSlots.ts";
import { parseId } from "../../lib/helpers.ts";
import type { UpdateBookingInput } from "../../validators/bookings.ts";

const ACTIVE = new Set<string>(ACTIVE_STATUSES);

type UpdateOutcome =
  | { notFound: true }
  | { taken: Date[] }
  | { updated: Booking };

const notFound = (res: Response) =>
  res.status(404).json({ success: false, message: "Booking not found." });

const handleUpdateBooking = async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (!id) return notFound(res);

  const { status, scheduledAt, adminNote } = req.body as UpdateBookingInput;

  const outcome = await db.transaction(async (tx): Promise<UpdateOutcome> => {
    const [existing] = await tx
      .select()
      .from(bookings)
      .where(eq(bookings.id, id))
      .limit(1);

    if (!existing) return { notFound: true };

    // Check exclusivity whenever the change can claim slots: new dates, or
    // bringing a cancelled/completed booking back to an active status.
    const nextStatus = status ?? existing.status;
    const nextIsActive = ACTIVE.has(nextStatus);
    const needsSlotCheck =
      nextIsActive && (scheduledAt !== undefined || !ACTIVE.has(existing.status));

    if (needsSlotCheck) {
      const nextDates = scheduledAt ?? existing.scheduledAt;
      await lockSlots(tx, nextDates);
      const taken = await findTakenSlots(tx, nextDates, id);
      if (taken.length > 0) return { taken };
    }

    // Only touch the fields that were actually sent (updatedAt is bumped by the
    // column's $onUpdate)
    const patch: Partial<typeof bookings.$inferInsert> = {};
    if (status !== undefined) patch.status = status;
    if (scheduledAt !== undefined) patch.scheduledAt = scheduledAt;
    if (adminNote !== undefined) patch.adminNote = adminNote;

    const [updated] = await tx
      .update(bookings)
      .set(patch)
      .where(eq(bookings.id, id))
      .returning();

    return { updated };
  });

  if ("notFound" in outcome) return notFound(res);

  if ("taken" in outcome)
    return res.status(409).json({
      success: false,
      message: "One or more requested dates are already taken.",
      takenDates: outcome.taken.map((date) => date.toISOString()),
    });

  res.json({ success: true, data: outcome.updated });
};

export { handleUpdateBooking };
