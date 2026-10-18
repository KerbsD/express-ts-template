import type { Request, Response } from "express";

import COOKIE_OPTIONS, {
  CLEAR_COOKIE_OPTIONS,
  clearRefreshCookies,
  getRefreshToken,
  LEGACY_REFRESH_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
} from "../../configs/cookieOptions.ts";
import { securityLog } from "../../lib/logger.ts";
import { rotateSession } from "../../lib/sessions.ts";
import { isWellFormedToken, signAccessToken } from "../../lib/tokens.ts";

const handleRefreshToken = async (req: Request, res: Response) => {
  const refreshToken = getRefreshToken(req);

  if (!refreshToken) return res.sendStatus(401);

  // Junk cookies are rejected before any database work
  if (!isWellFormedToken(refreshToken)) {
    clearRefreshCookies(res);
    return res.sendStatus(403);
  }

  const result = await rotateSession(refreshToken, {
    ip: req.ip,
    userAgent: req.get("user-agent"),
  });

  if (!result.ok) {
    if (result.reason === "reuse") {
      securityLog(
        "refresh_token_reuse",
        { userId: result.userId, ip: req.ip, cause: result.cause },
        "warn",
      );
    }
    clearRefreshCookies(res);
    return res.sendStatus(403);
  }

  res.cookie(REFRESH_COOKIE_NAME, result.token, {
    ...COOKIE_OPTIONS,
    maxAge: result.maxAge,
  });
  // Hygiene: clear a pre-rename cookie so only one credential is live
  if (req.cookies?.[LEGACY_REFRESH_COOKIE_NAME] !== undefined)
    res.clearCookie(LEGACY_REFRESH_COOKIE_NAME, CLEAR_COOKIE_OPTIONS);
  res.json({ accessToken: signAccessToken(result.userId, result.username) });
};

export { handleRefreshToken };
