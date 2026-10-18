import type { Request, Response } from "express";

import COOKIE_OPTIONS, {
  CLEAR_COOKIE_OPTIONS,
} from "../../configs/cookieOptions.ts";
import { securityLog } from "../../lib/logger.ts";
import { rotateSession } from "../../lib/sessions.ts";
import { isWellFormedToken, signAccessToken } from "../../lib/tokens.ts";

const handleRefreshToken = async (req: Request, res: Response) => {
  const refreshToken = req.cookies?.jwt;

  if (typeof refreshToken !== "string" || !refreshToken)
    return res.sendStatus(401);

  // Junk cookies are rejected before any database work
  if (!isWellFormedToken(refreshToken)) {
    res.clearCookie("jwt", CLEAR_COOKIE_OPTIONS);
    return res.sendStatus(403);
  }

  const result = await rotateSession(refreshToken);

  if (!result.ok) {
    if (result.reason === "reuse") {
      // Hook this into real alerting later
      securityLog(
        "refresh_token_reuse",
        { userId: result.userId, ip: req.ip },
        "warn",
      );
    }
    res.clearCookie("jwt", CLEAR_COOKIE_OPTIONS);
    return res.sendStatus(403);
  }

  res.cookie("jwt", result.token, { ...COOKIE_OPTIONS, maxAge: result.maxAge });
  res.json({ accessToken: signAccessToken(result.userId, result.username) });
};

export { handleRefreshToken };
