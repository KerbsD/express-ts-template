import express from "express";
import { handleNewUser } from "../../controllers/auth/register.ts";
import {
  registerEmailLimiter,
  registerLimiter,
  registerUsernameLimiter,
} from "../../lib/authLimiter.ts";

import { validateNewUser } from "../../validators/auth.ts";

const router = express.Router();

// The per-email and per-username limiters must come AFTER validateNewUser so
// they see the cleaned values.
router.post(
  "/",
  registerLimiter,
  validateNewUser,
  registerEmailLimiter,
  registerUsernameLimiter,
  handleNewUser,
);

export default router;
