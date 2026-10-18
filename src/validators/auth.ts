import { z } from "zod";
import { validateBody } from "../lib/validate.ts";

// ---------- Field rules ----------

const emailField = z
  .string({ error: "Email is required." })
  .trim()
  .min(1, "Email is required.")
  .max(254, "Email is too long.")
  .pipe(z.email("Must be a valid email address."));

// Length beats composition rules ("must contain a symbol"). Breached passwords
// are rejected separately by lib/pwned.ts. bcrypt silently truncates at 72
// bytes, so anything longer is rejected rather than quietly weakened.
const passwordField = (label: string) =>
  z
    .string({ error: `${label} is required.` })
    .min(12, "Password must be at least 12 characters.")
    .max(128, "Password must be at most 128 characters.")
    .refine(
      (p) => Buffer.byteLength(p, "utf8") <= 72,
      "Password must be at most 72 bytes.",
    );

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

// Used by /auth/password/forgot and /auth/resend-verification
export const emailSchema = z.object({ email: emailField });

const tokenField = (label: string) =>
  z
    .string({ error: `${label} is required.` })
    .min(1, `${label} is required.`)
    .max(2048, `Invalid ${label.toLowerCase()}.`);

export const resetPasswordSchema = z.object({
  token: tokenField("Reset token"),
  newPwd: passwordField("New password"),
});

export const verifyEmailSchema = z.object({
  token: tokenField("Verification token"),
});

// ---------- Ready-to-use middlewares ----------

export const validateNewUser = validateBody(registerSchema);
export const validateLogin = validateBody(loginSchema);
export const validateEmail = validateBody(emailSchema);
export const validateResetPassword = validateBody(resetPasswordSchema);
export const validateVerifyEmail = validateBody(verifyEmailSchema);
