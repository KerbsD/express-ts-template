import bcrypt from "bcrypt";
import { randomBytes } from "node:crypto";
import { and, eq, isNull, lt, or, sql } from "drizzle-orm";
import type { Request, Response } from "express";

import COOKIE_OPTIONS from "../../configs/cookieOptions.ts";
import { db } from "../../db/index.ts";
import { sessions, users } from "../../db/schema.ts";
import { sendPasswordResetEmail } from "../../services/email.ts";
import { createSession } from "../../lib/sessions.ts";
import {
  EMAIL_COOLDOWN_MS,
  RESET_TTL_MS,
  isWellFormedToken,
  newToken,
  sha256,
  signAccessToken,
} from "../../lib/tokens.ts";

const SALT_ROUNDS = 12;
const DUMMY_HASH = await bcrypt.hash(
  randomBytes(16).toString("hex"),
  SALT_ROUNDS,
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

  if (!foundUser || !match) return res.sendStatus(401);

  if (!foundUser.isVerified)
    return res.status(403).json({
      success: false,
      message: "Please verify your email before logging in.",
    });

  // Each login starts its own session family (one per device)
  const session = await createSession(foundUser.id);

  res.cookie("jwt", session.token, {
    ...COOKIE_OPTIONS,
    maxAge: session.maxAge,
  });
  res.json({ accessToken: signAccessToken(foundUser.id, foundUser.username) });
};

const forgotPassword = async (req: Request, res: Response) => {
  const { email } = req.body as { email: string };

  // Identical response in EVERY branch (unknown email, cooldown, success)
  const sendSafeResponse = () =>
    res.status(200).json({
      success: true,
      message: "If that email is registered, a reset link has been sent.",
    });

  const token = newToken();
  const now = new Date();

  // Check-the-cooldown and claim-the-slot in ONE statement. Concurrent requests
  // can't all pass: only the first UPDATE matches the WHERE clause.
  const [claimed] = await db
    .update(users)
    .set({
      resetPasswordTokenHash: sha256(token),
      resetPasswordExpiresAt: new Date(now.getTime() + RESET_TTL_MS),
      resetPasswordSentAt: now,
    })
    .where(
      and(
        eq(sql`lower(${users.email})`, email.toLowerCase()),
        or(
          isNull(users.resetPasswordSentAt),
          lt(
            users.resetPasswordSentAt,
            new Date(now.getTime() - EMAIL_COOLDOWN_MS),
          ),
        ),
      ),
    )
    .returning({ email: users.email });

  // Send in the background so response time doesn't reveal whether the account exists
  if (claimed) {
    void sendPasswordResetEmail(claimed.email, token).catch((err) =>
      console.error(
        "Reset email failed:",
        err instanceof Error ? err.message : err,
      ),
    );
  }

  return sendSafeResponse();
};

const resetPassword = async (req: Request, res: Response) => {
  const { token, newPwd } = req.body as { token: string; newPwd: string };

  if (!isWellFormedToken(token))
    return res
      .status(400)
      .json({ success: false, message: "Invalid reset link." });

  const tokenHash = sha256(token);

  // One transaction. FOR UPDATE locks the user row, so a second parallel request
  // with the same token waits, then finds the token already cleared.
  const outcome = await db.transaction(
    async (tx): Promise<"ok" | "invalid" | "expired" | "same"> => {
      const [user] = await tx
        .select({
          id: users.id,
          password: users.password,
          expiresAt: users.resetPasswordExpiresAt,
        })
        .from(users)
        .where(eq(users.resetPasswordTokenHash, tokenHash))
        .limit(1)
        .for("update");

      if (!user) return "invalid";
      if (!user.expiresAt || user.expiresAt <= new Date()) return "expired";

      // Prevent reusing the same password (doesn't consume the token)
      if (await bcrypt.compare(newPwd, user.password)) return "same";

      const hashedPwd = await bcrypt.hash(newPwd, SALT_ROUNDS);

      await tx
        .update(users)
        .set({
          password: hashedPwd,
          resetPasswordTokenHash: null,
          resetPasswordExpiresAt: null,
          resetPasswordSentAt: null,
        })
        .where(eq(users.id, user.id));

      // Kick out every device
      await tx
        .update(sessions)
        .set({ revokedAt: new Date() })
        .where(and(eq(sessions.userId, user.id), isNull(sessions.revokedAt)));

      return "ok";
    },
  );

  if (outcome === "ok")
    return res.status(200).json({
      success: true,
      message:
        "Password reset successfully. Please log in with your new password.",
    });

  const messages = {
    invalid: "Invalid or already used reset link.",
    expired: "Reset link has expired. Please request a new one.",
    same: "New password must be different from your current password.",
  } as const;

  return res.status(400).json({ success: false, message: messages[outcome] });
};

export { handleLogin, forgotPassword, resetPassword };
