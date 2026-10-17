import bcrypt from "bcrypt";
import { eq, sql } from "drizzle-orm";
import type { Request, Response } from "express";

import { db } from "../../db/index.ts";
import { users } from "../../db/schema.ts";
import { sendVerificationEmail } from "../../services/email.ts";
import { VERIFY_TTL_MS, newToken, sha256 } from "../../lib/tokens.ts";

const SALT_ROUNDS = 12;

const handleNewUser = async (req: Request, res: Response) => {
  const { user, pwd, email } = req.body;

  // Case-insensitive username check
  const [duplicateUsername] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(sql`lower(${users.username})`, user.toLowerCase()))
    .limit(1);

  if (duplicateUsername)
    return res.status(409).json({
      success: false,
      message: "Username already exists.",
    });

  // Case-insensitive email check
  const [duplicateEmail] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(sql`lower(${users.email})`, email.toLowerCase()))
    .limit(1);

  if (duplicateEmail)
    return res.status(409).json({
      success: false,
      message: "Email already in use.",
    });

  const hashedPwd = await bcrypt.hash(pwd, SALT_ROUNDS);

  // Opaque token: the raw value goes in the email, only its hash is stored
  const verificationToken = newToken();

  try {
    await db.insert(users).values({
      username: user,
      password: hashedPwd,
      email,
      isVerified: false,
      verificationTokenHash: sha256(verificationToken),
      verificationExpiresAt: new Date(Date.now() + VERIFY_TTL_MS),
      lastVerificationSentAt: new Date(),
    });
  } catch (err: any) {
    // Postgres unique violation (race condition between check and insert).
    // Newer Drizzle versions wrap the driver error in `cause`.
    const code = err.code ?? err.cause?.code;
    if (code === "23505") {
      return res.status(409).json({
        success: false,
        message: "Username or email already in use.",
      });
    }
    throw err;
  }

  await sendVerificationEmail(email, verificationToken);

  res.status(201).json({
    success: true,
    message: `New user ${user} created successfully. Please check your email to verify your account.`,
  });
};

export { handleNewUser };
