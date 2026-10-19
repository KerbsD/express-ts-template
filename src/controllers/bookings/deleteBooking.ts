import { eq } from "drizzle-orm";
import type { Request, Response } from "express";

import { db } from "../../db/index.ts";
import { bookings } from "../../db/schema.ts";
import { parseId } from "../../lib/helpers.ts";

const handleDeleteBooking = async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  
  if (!id)
    return res
      .status(404)
      .json({ success: false, message: "Booking not found." });

  const [deleted] = await db
    .delete(bookings)
    .where(eq(bookings.id, id))
    .returning({ id: bookings.id });

  if (!deleted)
    return res
      .status(404)
      .json({ success: false, message: "Booking not found." });

  res.json({ success: true, message: "Booking deleted." });
};

export { handleDeleteBooking };
