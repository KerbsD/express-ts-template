import express from "express";
import { handleCreateBooking } from "../../controllers/bookings/createBooking.ts";
import { bookingCreateLimiter } from "../../lib/bookingLimiter.ts";
import { validateCreateBooking } from "../../validators/bookings.ts";

const router = express.Router();

// Public: visitors book without an account. The limiter runs before validation
// so junk floods are throttled too.
router.post(
  "/",
  bookingCreateLimiter,
  validateCreateBooking,
  handleCreateBooking,
);

export default router;
