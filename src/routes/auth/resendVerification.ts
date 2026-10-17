import express from "express";
import { resendVerification } from "../../controllers/auth/resendVerification.ts";
import { resendVerificationLimiter } from "../../lib/authLimiter.ts";
import { validateEmail } from "../../validators/auth.ts";

const router = express.Router();

router.post("/", resendVerificationLimiter, validateEmail, resendVerification);

export default router;
