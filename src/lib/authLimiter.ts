import { rateLimit, ipKeyGenerator } from "express-rate-limit";
import type { Options } from "express-rate-limit";
import type { Request, Response } from "express";
import { createStore } from "./rateLimitStore.ts";

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

const createLimiter = (
  name: string,
  limit: number,
  message: string,
  extra: Partial<Options> = {},
) => {
  const store = createStore(name);

  return rateLimit({
    windowMs: 15 * MINUTE,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message },
    // If Redis hiccups, let the request through instead of taking auth down
    passOnStoreError: true,
    ...(store ? { store } : {}),
    ...extra,
  });
};

// ---------- Key helpers ----------

// ipKeyGenerator groups IPv6 addresses by /64, so one user can't dodge a limit
// by rotating through addresses in their own range.
const clientKey = (req: Request): string => ipKeyGenerator(req.ip ?? "");

const bodyString = (req: Request, field: string): string => {
  const value = req.body?.[field];
  return typeof value === "string"
    ? value.trim().toLowerCase().slice(0, 254)
    : "";
};

// "Ana", "ana " and "ANA" share one counter
const loginKey = (req: Request): string =>
  `${clientKey(req)}|${bodyString(req, "user").slice(0, 64)}`;

const usernameKey = (req: Request): string =>
  bodyString(req, "user").slice(0, 64) || `ip:${clientKey(req)}`;

const emailKey = (req: Request): string =>
  bodyString(req, "email") || `ip:${clientKey(req)}`;

// Per-email limits answer with the SAME 200 body as a normal request, so an
// attacker can't tell from the response whether the address exists or was capped.
const silentOk =
  (message: string, status = 200) =>
  (_req: Request, res: Response) => {
    res.status(status).json({ success: true, message });
  };

// ---------- Global baseline ----------

export const globalLimiter = createLimiter(
  "global",
  600,
  "Too many requests. Please slow down.",
);

// ---------- Login ----------

// Per IP + username. Only failed attempts count (responses with status >= 400)
export const loginLimiter = createLimiter(
  "login",
  5,
  "Too many login attempts. Please try again after 15 minutes.",
  { skipSuccessfulRequests: true, keyGenerator: loginKey },
);

// Per IP, across all usernames
export const loginIpLimiter = createLimiter(
  "loginIp",
  20,
  "Too many login attempts. Please try again after 15 minutes.",
  { skipSuccessfulRequests: true },
);

// Per username across ALL IPs, so a botnet can't hammer one account.
// Trade-off: someone can also lock a victim out for the window by failing on
// purpose, so the limit is deliberately higher than the per-IP one.
export const loginUserLimiter = createLimiter(
  "loginUser",
  20,
  "Too many login attempts for this account. Please try again later.",
  { skipSuccessfulRequests: true, keyGenerator: usernameKey },
);

// ---------- Registration / verification / reset ----------

export const registerLimiter = createLimiter(
  "register",
  10,
  "Too many sign-up attempts. Please try again later.",
  { windowMs: HOUR },
);

// Daily cap per recipient address. The per-IP limit alone still lets a botnet
// mail one victim repeatedly: for verified addresses the "account exists"
// email fires on every attempt. Mount AFTER validateNewUser.
export const registerEmailLimiter = createLimiter(
  "registerEmail",
  5,
  "Registration received. If the email can be used, a verification link has been sent. Please check your inbox.",
  {
    windowMs: 24 * HOUR,
    keyGenerator: emailKey,
    standardHeaders: false,
    handler: silentOk(
      "Registration received. If the email can be used, a verification link has been sent. Please check your inbox.",
      201,
    ),
  },
);

export const forgotPasswordLimiter = createLimiter(
  "forgot",
  5,
  "Too many reset requests. Please try again later.",
  { windowMs: HOUR },
);

// Daily cap per target address (the 2-minute cooldown alone still lets a third
// party mail a victim every 2 minutes forever). Mount AFTER validateEmail.
export const forgotPasswordEmailLimiter = createLimiter(
  "forgotEmail",
  5,
  "If that email is registered, a reset link has been sent.",
  {
    windowMs: 24 * HOUR,
    keyGenerator: emailKey,
    standardHeaders: false,
    handler: silentOk(
      "If that email is registered, a reset link has been sent.",
    ),
  },
);

export const resetPasswordLimiter = createLimiter(
  "reset",
  10,
  "Too many attempts. Please try again later.",
);

export const resendVerificationLimiter = createLimiter(
  "resend",
  5,
  "Too many requests. Please try again later.",
);

export const resendVerificationEmailLimiter = createLimiter(
  "resendEmail",
  5,
  "If that email exists and is unverified, a new link has been sent.",
  {
    windowMs: 24 * HOUR,
    keyGenerator: emailKey,
    standardHeaders: false,
    handler: silentOk(
      "If that email exists and is unverified, a new link has been sent.",
    ),
  },
);

export const verifyLimiter = createLimiter(
  "verify",
  10,
  "Too many verification attempts. Please try again later.",
);

// ---------- Refresh & logout ----------

// Generous ceiling on all refresh calls. Access tokens live 1 minute in
// production, so a legitimate client refreshes often (and per tab).
export const refreshLimiter = createLimiter(
  "refresh",
  300,
  "Too many refresh requests. Please try again later.",
);

// Strict limit on *failed* refreshes that carried a cookie: the junk-cookie
// spam pattern. Requests with no cookie at all are skipped here because they
// cost nothing and a logged-out SPA hits them on every page load.
export const refreshFailLimiter = createLimiter(
  "refreshFail",
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
  "logout",
  30,
  "Too many logout requests. Please try again later.",
);
