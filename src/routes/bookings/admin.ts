import express from "express";
import { handleDeleteBooking } from "../../controllers/bookings/deleteBooking.ts";
import { handleGetBooking } from "../../controllers/bookings/getBooking.ts";
import { handleListBookings } from "../../controllers/bookings/listBookings.ts";
import { handleUpdateBooking } from "../../controllers/bookings/updateBooking.ts";
import {
  validateListBookingsQuery,
  validateUpdateBooking,
} from "../../validators/bookings.ts";

const router = express.Router();

// Mounted below verifyJwt in server.ts: every handler here needs a valid access
// token. (Add a role check here when you introduce admin roles.)
router.get("/", validateListBookingsQuery, handleListBookings);
router.get("/:id", handleGetBooking);
router.patch("/:id", validateUpdateBooking, handleUpdateBooking);
router.delete("/:id", handleDeleteBooking);

export default router;
