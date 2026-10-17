import { and, eq, isNull, lt, or, sql } from "drizzle-orm";
import type { Request, Response } from "express";

import { db } from "../../db/index.ts";
import { users } from "../../db/schema.ts";
import { sendVerificationEmail } from "../../services/email.ts";
import {
  EMAIL_COOLDOWN_MS,
  VERIFY_TTL_MS,
  newToken,
  sha256,
} from "../../lib/tokens.ts";

const resendVerification = async (req: Request, res: Response) => {
  const { email } = req.body as { email: string };

  const token = newToken();
  const now = new Date();

  // Eligibility (exists, unverified, cooldown elapsed) and token rotation happen
  // in ONE atomic statement. The new hash replaces the old one, so the previous
  // link stops working.
  const [claimed] = await db
    .update(users)
    .set({
      verificationTokenHash: sha256(token),
      verificationExpiresAt: new Date(now.getTime() + VERIFY_TTL_MS),
      lastVerificationSentAt: now,
    })
    .where(
      and(
        eq(sql`lower(${users.email})`, email.toLowerCase()),
        eq(users.isVerified, false),
        or(
          isNull(users.lastVerificationSentAt),
          lt(
            users.lastVerificationSentAt,
            new Date(now.getTime() - EMAIL_COOLDOWN_MS),
          ),
        ),
      ),
    )
    .returning({ email: users.email });

  if (claimed) {
    void sendVerificationEmail(claimed.email, token).catch((err) =>
      console.error(
        "Verification email failed:",
        err instanceof Error ? err.message : err,
      ),
    );
  }

  // Same response whether the email is unknown, already verified, cooling down, or sent
  res.status(200).json({
    success: true,
    message:
      "If that email exists and is unverified, a new link has been sent.",
  });
};

export { resendVerification };
