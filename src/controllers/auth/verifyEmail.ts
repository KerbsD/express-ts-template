import { and, eq, gt } from "drizzle-orm";
import type { Request, Response } from "express";

import { db } from "../../db/index.ts";
import { users } from "../../db/schema.ts";
import { isWellFormedToken, sha256 } from "../../lib/tokens.ts";

const verifyEmail = async (req: Request, res: Response) => {
  const { token } = req.query;

  if (!isWellFormedToken(token))
    return res.status(400).json({
      success: false,
      message: "Invalid verification link.",
    });

  const tokenHash = sha256(token);

  // Consume the token atomically: verify + clear in one statement, so two
  // parallel requests can't both succeed.
  const [verified] = await db
    .update(users)
    .set({
      isVerified: true,
      verificationTokenHash: null,
      verificationExpiresAt: null,
    })
    .where(
      and(
        eq(users.verificationTokenHash, tokenHash),
        gt(users.verificationExpiresAt, new Date()),
      ),
    )
    .returning({ id: users.id });

  if (verified)
    return res.status(200).json({
      success: true,
      message: "Email verified successfully! You can now log in.",
    });

  // Distinguish "expired" from "used/unknown". Only someone holding a real
  // token can learn this, so it doesn't leak which emails exist.
  const [expired] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.verificationTokenHash, tokenHash))
    .limit(1);

  // If this error is sent, redirect the user in the frontend to the re-verify page.
  return res.status(400).json({
    success: false,
    message: expired
      ? "Verification link has expired. Please request a new one."
      : "Invalid or already used verification link.",
  });
};

export { verifyEmail };
