import express from "express";
import { verifyEmail } from "../../controllers/auth/verifyEmail.ts";
import { verifyLimiter } from "../../lib/authLimiter.ts";
import { validateVerifyEmailQuery } from "../../validators/auth.ts";

const router = express.Router();

router.get("/", verifyLimiter, validateVerifyEmailQuery, verifyEmail);

export default router;
