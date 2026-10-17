import express from "express";
import {
  handleLogin,
  forgotPassword,
  resetPassword,
} from "../../controllers/auth/login.ts";

import {
  loginIpLimiter,
  loginLimiter,
  forgotPasswordLimiter,
  resetPasswordLimiter,
} from "../../lib/authLimiter.ts";
import {
  validateEmail,
  validateLogin,
  validateResetPassword,
} from "../../validators/auth.ts";

const router = express.Router();

router.post("/", loginIpLimiter, loginLimiter, validateLogin, handleLogin);
router.post(
  "/forget-password",
  forgotPasswordLimiter,
  validateEmail,
  forgotPassword,
);
router.patch(
  "/reset-password",
  resetPasswordLimiter,
  validateResetPassword,
  resetPassword,
);

export default router;
