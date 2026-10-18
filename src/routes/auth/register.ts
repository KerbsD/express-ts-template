import express from "express";
import { handleNewUser } from "../../controllers/auth/register.ts";
import {
  registerEmailLimiter,
  registerLimiter,
} from "../../lib/authLimiter.ts";

import { validateNewUser } from "../../validators/auth.ts";

const router = express.Router();

// The per-email limiter must come AFTER validateNewUser so it sees the cleaned address
router.post(
  "/",
  registerLimiter,
  validateNewUser,
  registerEmailLimiter,
  handleNewUser,
);

export default router;
