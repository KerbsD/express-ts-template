import { rateLimit, ipKeyGenerator } from "express-rate-limit";
import type { Options } from "express-rate-limit";
import type { Request } from "express";

const MINUTE = 60 * 1000;

const createLimiter = (
  limit: number,
  message: string,
  extra: Partial<Options> = {},
) =>
  rateLimit({
    windowMs: 15 * MINUTE,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message },
    ...extra,
  });

// Normalize the username so "Ana", "ana " and "ANA" share one counter.
// ipKeyGenerator groups IPv6 addresses by /64, so one user can't dodge
// the limit by rotating through addresses in their own range.
const loginKey = (req: Request): string => {
  const raw = typeof req.body?.user === "string" ? req.body.user : "";
  const username = raw.trim().toLowerCase().slice(0, 64);
  return `${ipKeyGenerator(req.ip ?? "")}|${username}`;
};

// Login: only failed attempts count (responses with status >= 400)
export const loginLimiter = createLimiter(
  5,
  "Too many login attempts. Please try again after 15 minutes.",
  { skipSuccessfulRequests: true, keyGenerator: loginKey },
);

export const loginIpLimiter = createLimiter(
  20,
  "Too many login attempts. Please try again after 15 minutes.",
  { skipSuccessfulRequests: true },
);

export const registerLimiter = createLimiter(
  10,
  "Too many sign-up attempts. Please try again later.",
  { windowMs: 60 * MINUTE },
);

export const forgotPasswordLimiter = createLimiter(
  5,
  "Too many reset requests. Please try again later.",
  { windowMs: 60 * MINUTE },
);

export const resetPasswordLimiter = createLimiter(
  10,
  "Too many attempts. Please try again later.",
);

export const resendVerificationLimiter = createLimiter(
  5,
  "Too many requests. Please try again later.",
);

export const verifyLimiter = createLimiter(
  10,
  "Too many verification attempts. Please try again later.",
);

// ---------- New: refresh & logout ----------

// Generous ceiling on all refresh calls. Access tokens live 1 minute in
// production, so a legitimate client refreshes often (and per tab).
export const refreshLimiter = createLimiter(
  300,
  "Too many refresh requests. Please try again later.",
);

// Strict limit on *failed* refreshes that carried a cookie: this is the
// junk-cookie spam pattern. Requests with no cookie at all are skipped here
// because they cost nothing (no DB query) and a logged-out SPA hits them on
// every page load. The ceiling above still covers them.
export const refreshFailLimiter = createLimiter(
  20,
  "Too many failed refresh attempts. Please try again later.",
  {
    skipSuccessfulRequests: true,
    skip: (req: Request) =>
      typeof req.cookies?.jwt !== "string" || !req.cookies.jwt,
  },
);

// Logout always answers 204, so count every request
export const logoutLimiter = createLimiter(
  30,
  "Too many logout requests. Please try again later.",
);
