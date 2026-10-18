import bcrypt from "bcrypt";
import { and, eq, ne, sql } from "drizzle-orm";
import type { Request, Response } from "express";

import { db } from "../../db/index.ts";
import { users } from "../../db/schema.ts";
import { pgCode, pgConstraint } from "../../lib/helpers.ts";
import { logger } from "../../lib/logger.ts";
import { isPwnedPassword, pwnedPasswordResponse } from "../../lib/pwned.ts";
import {
  queueEmail,
  sendAccountExistsEmail,
  sendVerificationEmail,
} from "../../services/email.ts";
import {
  BCRYPT_ROUNDS,
  EMAIL_COOLDOWN_MS,
  VERIFY_TTL_MS,
  newToken,
  sha256,
} from "../../lib/tokens.ts";

type Outcome =
  | "created"
  | "taken_over"
  | "exists"
  | "cooldown"
  | "username_taken";

const handleNewUser = async (req: Request, res: Response) => {
  const { user, pwd, email } = req.body as {
    user: string;
    pwd: string;
    email: string;
  };

  if (await isPwnedPassword(pwd))
    return res.status(400).json(pwnedPasswordResponse("pwd"));

  // Always hash, even if we end up not creating anything, so response time
  // doesn't reveal whether the email was already registered.
  const hashedPwd = await bcrypt.hash(pwd, BCRYPT_ROUNDS);

  const token = newToken();
  const now = new Date();
  const verification = {
    verificationTokenHash: sha256(token),
    verificationExpiresAt: new Date(now.getTime() + VERIFY_TTL_MS),
    lastVerificationSentAt: now,
  };

  let outcome: Outcome;
  try {
    outcome = await db.transaction(async (tx): Promise<Outcome> => {
      // Username held by a DIFFERENT account? The 409 status alone still
      // reveals existence, but probing is rate-limited (accepted trade-off).
      const [nameClash] = await tx
        .select({ id: users.id })
        .from(users)
        .where(
          and(
            eq(sql`lower(${users.username})`, user.toLowerCase()),
            ne(sql`lower(${users.email})`, email.toLowerCase()),
          ),
        )
        .limit(1);

      if (nameClash) return "username_taken";

      const [existing] = await tx
        .select({
          id: users.id,
          isVerified: users.isVerified,
          lastSentAt: users.lastVerificationSentAt,
        })
        .from(users)
        .where(eq(sql`lower(${users.email})`, email.toLowerCase()))
        .limit(1)
        .for("update");

      if (existing) {
        // Real, verified account: don't touch it, just warn the owner by email
        if (existing.isVerified) return "exists";

        // Email-bombing guard
        if (
          existing.lastSentAt &&
          existing.lastSentAt > new Date(now.getTime() - EMAIL_COOLDOWN_MS)
        )
          return "cooldown";

        // Unverified squatter (or the owner retrying): the NEW registration wins.
        // The old password and verification link are overwritten, so an attacker
        // who pre-registered someone's email can't keep control of the account.
        await tx
          .update(users)
          .set({ username: user, password: hashedPwd, ...verification })
          .where(eq(users.id, existing.id));
        return "taken_over";
      }

      await tx.insert(users).values({
        username: user,
        password: hashedPwd,
        email,
        isVerified: false,
        ...verification,
      });
      return "created";
    });
  } catch (err) {
    // Race: a concurrent request won between our check and our write
    if (pgCode(err) !== "23505") throw err;
    outcome =
      pgConstraint(err) === "users_username_lower_idx"
        ? "username_taken"
        : "cooldown";
  }

  if (outcome === "username_taken")
    return res.status(409).json({
      success: false,
      message: "Username unavailable.",
    });

  if (outcome === "created" || outcome === "taken_over")
    queueEmail("verification", () => sendVerificationEmail(email, token));
  else if (outcome === "exists")
    queueEmail("account-exists", () => sendAccountExistsEmail(email));

  logger.info({ event: "register", outcome }, "registration processed");

  // Same response whether the email was new, taken over, or already registered
  res.status(201).json({
    success: true,
    message:
      "Registration received. If the email can be used, a verification link has been sent. Please check your inbox.",
  });
};

export { handleNewUser };
