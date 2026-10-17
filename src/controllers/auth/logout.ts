import type { Request, Response } from "express";

import { CLEAR_COOKIE_OPTIONS } from "../../configs/cookieOptions.ts";
import { revokeSessionFamily } from "../../lib/sessions.ts";
import { isWellFormedToken } from "../../lib/tokens.ts";

const handleLogout = async (req: Request, res: Response) => {
  const refreshToken = req.cookies?.jwt;

  // No cookie present, nothing to clear
  if (typeof refreshToken !== "string" || !refreshToken)
    return res.sendStatus(204);

  // Revokes only this device's session family. Other devices stay logged in.
  if (isWellFormedToken(refreshToken)) await revokeSessionFamily(refreshToken);

  res.clearCookie("jwt", CLEAR_COOKIE_OPTIONS);
  res.sendStatus(204);
};

export { handleLogout };
