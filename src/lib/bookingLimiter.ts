import { rateLimit } from "express-rate-limit";
import { createStore } from "./rateLimitStore.ts";

// Public booking intake is unauthenticated, so it gets a tighter per-IP cap on
// top of the global limiter. Junk requests count too (the limiter runs first).
const store = createStore("booking-create");

export const bookingCreateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 5, // tune to your traffic
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message:
      "Too many booking requests from this address. Please try again later.",
  },
  // If Redis hiccups, let the request through instead of blocking bookings
  passOnStoreError: true,
  ...(store ? { store } : {}),
});
