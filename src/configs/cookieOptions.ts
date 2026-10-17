import type { CookieOptions } from "express";
import { env } from "./env.ts";

const COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  sameSite: env.COOKIE_SAMESITE,
  // Browsers reject SameSite=None without Secure
  secure: env.NODE_ENV === "production" || env.COOKIE_SAMESITE === "none",
  // The refresh cookie is only sent to /auth/*, not to every endpoint.
  // If you don't want to mount routes under /auth, change this to "/".
  path: "/auth",
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
};

// clearCookie must use the same attributes (path, sameSite, secure) but not maxAge
const { maxAge: _maxAge, ...CLEAR_COOKIE_OPTIONS } = COOKIE_OPTIONS;

export { CLEAR_COOKIE_OPTIONS };
export default COOKIE_OPTIONS;
