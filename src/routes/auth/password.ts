import express from "express";
import {
  forgotPassword,
  resetPassword,
} from "../../controllers/auth/password.ts";
import {
  forgotPasswordEmailLimiter,
  forgotPasswordLimiter,
  resetPasswordLimiter,
} from "../../lib/authLimiter.ts";
import { validateEmail, validateResetPassword } from "../../validators/auth.ts";

const router = express.Router();

// The per-email limiter must come AFTER validateEmail so it sees the cleaned address
router.post(
  "/forgot",
  forgotPasswordLimiter,
  validateEmail,
  forgotPasswordEmailLimiter,
  forgotPassword,
);

router.patch(
  "/reset",
  resetPasswordLimiter,
  validateResetPassword,
  resetPassword,
);

export default router;
