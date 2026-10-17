import { z } from "zod";
import { validateBody, validateQuery } from "../lib/validate.ts";

// ---------- Field rules ----------

const emailField = z
  .string({ error: "Email is required." })
  .trim()
  .min(1, "Email is required.")
  .max(254, "Email is too long.")
  .pipe(z.email("Must be a valid email address."));

// bcrypt silently truncates at 72 bytes, so reject anything longer
const passwordField = (label: string) =>
  z
    .string({ error: `${label} is required.` })
    .min(8, "Password must be at least 8 characters.")
    .max(128, "Password must be at most 128 characters.")
    .refine(
      (p) => Buffer.byteLength(p, "utf8") <= 72,
      "Password must be at most 72 bytes.",
    )
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter.")
    .regex(/[0-9]/, "Password must contain at least one number.")
    .regex(/[!@#$%^&*]/, "Password must contain at least one special character.");

// ---------- Schemas ----------

export const registerSchema = z.object({
  user: z
    .string({ error: "Username is required." })
    .trim()
    .min(3, "Username must be between 3 and 24 characters.")
    .max(24, "Username must be between 3 and 24 characters.")
    .regex(/^[A-Za-z0-9]+$/, "Username must only contain letters and numbers."),
  email: emailField,
  pwd: passwordField("Password"),
});

// Login only checks shape and size. Don't apply the strength rules here,
// so users with older passwords can still sign in.
export const loginSchema = z.object({
  user: z
    .string({ error: "Username is required." })
    .trim()
    .min(1, "Username is required.")
    .max(64, "Username is too long."),
  pwd: z
    .string({ error: "Password is required." })
    .min(1, "Password is required.")
    .max(128, "Password is too long."),
});

// Used by /forget-password and /resend-verification
export const emailSchema = z.object({ email: emailField });

export const resetPasswordSchema = z.object({
  token: z
    .string({ error: "Reset token is required." })
    .min(1, "Reset token is required.")
    .max(2048, "Invalid reset token."),
  newPwd: passwordField("New password"),
});

export const verifyEmailQuerySchema = z.object({
  token: z
    .string({ error: "Verification token is required." })
    .min(1, "Verification token is required.")
    .max(2048, "Invalid verification token."),
});

// ---------- Ready-to-use middlewares ----------

export const validateNewUser = validateBody(registerSchema);
export const validateLogin = validateBody(loginSchema);
export const validateEmail = validateBody(emailSchema);
export const validateResetPassword = validateBody(resetPasswordSchema);
export const validateVerifyEmailQuery = validateQuery(verifyEmailQuerySchema);