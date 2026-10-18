import bcrypt from "bcrypt";
import { randomBytes } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import type { Request, Response } from "express";

import COOKIE_OPTIONS from "../../configs/cookieOptions.ts";
import { db } from "../../db/index.ts";
import { users } from "../../db/schema.ts";
import { securityLog } from "../../lib/logger.ts";
import { createSession } from "../../lib/sessions.ts";
import { BCRYPT_ROUNDS, signAccessToken } from "../../lib/tokens.ts";

const DUMMY_HASH = await bcrypt.hash(
  randomBytes(16).toString("hex"),
  BCRYPT_ROUNDS,
);

// req.body is already validated and trimmed by validateLogin
const handleLogin = async (req: Request, res: Response) => {
  const { user, pwd } = req.body as { user: string; pwd: string };

  // Case-insensitive, matching the unique index on lower(username)
  const [foundUser] = await db
    .select({
      id: users.id,
      username: users.username,
      password: users.password,
      isVerified: users.isVerified,
    })
    .from(users)
    .where(eq(sql`lower(${users.username})`, user.toLowerCase()))
    .limit(1);

  // Always run bcrypt.compare to prevent timing attacks
  const match = await bcrypt.compare(pwd, foundUser?.password ?? DUMMY_HASH);

  if (!foundUser || !match) {
    // Never log the attempted username: people paste passwords into that field
    securityLog(
      "login_failed",
      { userId: foundUser?.id ?? null, ip: req.ip },
      "warn",
    );
    return res.sendStatus(401);
  }

  if (!foundUser.isVerified)
    return res.status(403).json({
      success: false,
      message: "Please verify your email before logging in.",
    });

  // Each login starts its own session family (one per device)
  const session = await createSession(foundUser.id, {
    ip: req.ip,
    userAgent: req.get("user-agent"),
  });

  securityLog("login_success", { userId: foundUser.id, ip: req.ip });

  res.cookie("jwt", session.token, {
    ...COOKIE_OPTIONS,
    maxAge: session.maxAge,
  });
  res.json({ accessToken: signAccessToken(foundUser.id, foundUser.username) });
};

export { handleLogin };
