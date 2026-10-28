import { eq } from "drizzle-orm";
import type { Request, Response } from "express";

import { db } from "../../db/index.ts";
import { bookings } from "../../db/schema.ts";
import { parseId } from "../../lib/helpers.ts";
import { logger, serializeError } from "../../lib/logger.ts";
import {
  sendBookingCancelledEmail,
  sendBookingConfirmedEmail,
} from "../../services/email.ts";
import type { SendBookingStatusEmailInput } from "../../validators/bookings.ts";

const notFound = (res: Response) =>
  res.status(404).json({ success: false, message: "Booking not found." });

/**
 * Sends the customer-facing email for the booking's current status. Only
 * confirmed and cancelled bookings have a customer email; pending and completed
 * are internal states. Sending is explicit (admin action), never automatic.
 */
const handleSendBookingStatusEmail = async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (!id) return notFound(res);

  const { note } = req.body as SendBookingStatusEmailInput;

  const [booking] = await db
    .select({
      id: bookings.id,
      name: bookings.name,
      email: bookings.email,
      scheduledAt: bookings.scheduledAt,
      status: bookings.status,
    })
    .from(bookings)
    .where(eq(bookings.id, id))
    .limit(1);

  if (!booking) return notFound(res);

  if (booking.status === "pending" || booking.status === "completed")
    return res.status(400).json({
      success: false,
      message: `There is no customer email for ${booking.status} bookings. Set the status to confirmed or cancelled first.`,
    });

  const isConfirmation = booking.status === "confirmed";
  const send = isConfirmation
    ? sendBookingConfirmedEmail
    : sendBookingCancelledEmail;

  try {
    // Awaited on purpose: the admin needs to know whether the customer actually
    // got the email, unlike the fire-and-forget auth emails.
    await send({
      id: booking.id,
      name: booking.name,
      email: booking.email,
      scheduledAt: booking.scheduledAt,
      note,
    });
  } catch (err) {
    logger.error(
      {
        event: "booking_status_email_failed",
        bookingId: booking.id,
        status: booking.status,
        err: serializeError(err),
      },
      "booking status email failed",
    );

    return res.status(502).json({
      success: false,
      message: "The email could not be sent. Please try again.",
    });
  }

  // Mark the email only after it was actually delivered to the SMTP server, so
  // a failed send never shows up as "already emailed" in the admin UI.
  const sentAt = new Date();
  try {
    await db
      .update(bookings)
      .set(
        isConfirmation
          ? { confirmationEmailSentAt: sentAt }
          : { cancellationEmailSentAt: sentAt },
      )
      .where(eq(bookings.id, booking.id));
  } catch (err) {
    // The customer already has the email, so this is not a failed request; it
    // only means the marker could not be persisted.
    logger.error(
      {
        event: "booking_status_email_marker_failed",
        bookingId: booking.id,
        status: booking.status,
        err: serializeError(err),
      },
      "booking status email sent but the marker could not be saved",
    );
  }

  logger.info(
    {
      event: "booking_status_email_sent",
      bookingId: booking.id,
      status: booking.status,
    },
    "booking status email sent",
  );

  res.json({
    success: true,
    message: `Booking ${booking.status} email sent to ${booking.email}.`,
    data: {
      status: booking.status,
      sentAt: sentAt.toISOString(),
    },
  });
};

export { handleSendBookingStatusEmail };
