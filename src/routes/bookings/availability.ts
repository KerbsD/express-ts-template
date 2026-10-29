import express from "express";
import { handleGetBookingAvailability } from "../../controllers/bookings/getBookingAvailability.ts";

const router = express.Router();

// Public: the landing-page calendar needs to know which days are already held.
// This route is mounted before verifyJwt in server.ts.
router.get("/", handleGetBookingAvailability);

export default router;
