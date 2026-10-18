import express from "express";
import { resendVerification } from "../../controllers/auth/resendVerification.ts";
import {
  resendVerificationEmailLimiter,
  resendVerificationLimiter,
} from "../../lib/authLimiter.ts";
import { validateEmail } from "../../validators/auth.ts";

const router = express.Router();

router.post(
  "/",
  resendVerificationLimiter,
  validateEmail,
  resendVerificationEmailLimiter,
  resendVerification,
);

export default router;
