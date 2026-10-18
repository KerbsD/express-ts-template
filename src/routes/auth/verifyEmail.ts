import express from "express";
import { verifyEmail } from "../../controllers/auth/verifyEmail.ts";
import { verifyLimiter } from "../../lib/authLimiter.ts";
import { validateVerifyEmail } from "../../validators/auth.ts";

const router = express.Router();

router.post("/", verifyLimiter, validateVerifyEmail, verifyEmail);

export default router;
