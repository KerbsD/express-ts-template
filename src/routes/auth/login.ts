import express from "express";
import { handleLogin } from "../../controllers/auth/login.ts";
import {
  loginIpLimiter,
  loginLimiter,
  loginUserBackoff,
} from "../../lib/authLimiter.ts";
import { validateLogin } from "../../validators/auth.ts";

const router = express.Router();

// Limiters run BEFORE validation so junk requests are throttled too
router.post(
  "/",
  loginIpLimiter,
  loginLimiter,
  loginUserBackoff,
  validateLogin,
  handleLogin,
);

export default router;
