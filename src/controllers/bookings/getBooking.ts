import { eq } from "drizzle-orm";
import type { Request, Response } from "express";

import { db } from "../../db/index.ts";
import { bookings } from "../../db/schema.ts";
import { parseId } from "../../lib/helpers.ts";

const handleGetBooking = async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (!id)
    return res
      .status(404)
      .json({ success: false, message: "Booking not found." });

  const [booking] = await db
    .select()
    .from(bookings)
    .where(eq(bookings.id, id))
    .limit(1);

  if (!booking)
    return res
      .status(404)
      .json({ success: false, message: "Booking not found." });

  res.json({ success: true, data: booking });
};

export { handleGetBooking };
