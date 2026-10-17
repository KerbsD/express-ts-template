import { randomUUID } from "node:crypto";
import { and, eq, inArray, isNull, lt, or } from "drizzle-orm";
import { db } from "../db/index.ts";
import { sessions, users } from "../db/schema.ts";
import {
  ABSOLUTE_SESSION_TTL_MS,
  REFRESH_GRACE_MS,
  REFRESH_TTL_MS,
  newToken,
  sha256,
} from "./tokens.ts";

const buildSession = (
  userId: number,
  familyId: string,
  absoluteExpiresAt: Date,
  now: Date,
) => {
  const token = newToken();
  // A token never outlives the session's absolute deadline
  const expiresAt = new Date(
    Math.min(now.getTime() + REFRESH_TTL_MS, absoluteExpiresAt.getTime()),
  );
  return {
    token,
    maxAge: expiresAt.getTime() - now.getTime(), // for the cookie
    row: {
      userId,
      familyId,
      tokenHash: sha256(token),
      expiresAt,
      absoluteExpiresAt,
    },
  };
};

/** Start a brand-new session family (called on login). */
export const createSession = async (userId: number) => {
  const now = new Date();
  const s = buildSession(
    userId,
    randomUUID(),
    new Date(now.getTime() + ABSOLUTE_SESSION_TTL_MS),
    now,
  );
  await db.insert(sessions).values(s.row);
  return { token: s.token, maxAge: s.maxAge };
};

export type RotateResult =
  | {
      ok: true;
      token: string;
      maxAge: number;
      userId: number;
      username: string;
    }
  | { ok: false; reason: "invalid" }
  | { ok: false; reason: "reuse"; userId: number };

/**
 * Exchange a refresh token for the next one, atomically.
 *
 * SELECT ... FOR UPDATE locks the session row, so two concurrent requests with
 * the same token are serialised: the first rotates, the second then sees
 * `usedAt` and is handled by the grace window or the reuse rule below.
 */
export const rotateSession = async (rawToken: string): Promise<RotateResult> =>
  db.transaction(async (tx): Promise<RotateResult> => {
    const now = new Date();

    const [session] = await tx
      .select()
      .from(sessions)
      .where(eq(sessions.tokenHash, sha256(rawToken)))
      .limit(1)
      .for("update");

    if (
      !session ||
      session.revokedAt ||
      session.expiresAt <= now ||
      session.absoluteExpiresAt <= now
    ) {
      return { ok: false, reason: "invalid" };
    }

    // Already rotated, and outside the grace window: someone is replaying an old
    // token (theft). Revoke the whole family so the attacker AND the victim's
    // copy both die; the real user simply logs in again.
    if (
      session.usedAt &&
      now.getTime() - session.usedAt.getTime() > REFRESH_GRACE_MS
    ) {
      await tx
        .update(sessions)
        .set({ revokedAt: now })
        .where(
          and(
            eq(sessions.familyId, session.familyId),
            isNull(sessions.revokedAt),
          ),
        );
      return { ok: false, reason: "reuse", userId: session.userId };
    }

    const [user] = await tx
      .select({ username: users.username })
      .from(users)
      .where(eq(users.id, session.userId))
      .limit(1);

    if (!user) return { ok: false, reason: "invalid" };

    // Inside the grace window (two tabs racing) we skip this and just issue
    // another token in the same family instead of treating it as theft.
    if (!session.usedAt) {
      await tx
        .update(sessions)
        .set({ usedAt: now })
        .where(eq(sessions.id, session.id));
    }

    const next = buildSession(
      session.userId,
      session.familyId,
      session.absoluteExpiresAt,
      now,
    );
    await tx.insert(sessions).values(next.row);

    return {
      ok: true,
      token: next.token,
      maxAge: next.maxAge,
      userId: session.userId,
      username: user.username,
    };
  });

/** Logout: revoke the whole family that this token belongs to. */
export const revokeSessionFamily = async (rawToken: string): Promise<void> => {
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(
      and(
        isNull(sessions.revokedAt),
        inArray(
          sessions.familyId,
          db
            .select({ familyId: sessions.familyId })
            .from(sessions)
            .where(eq(sessions.tokenHash, sha256(rawToken))),
        ),
      ),
    );
};

/** Housekeeping: expired rows can never be used again, so delete them. */
export const purgeExpiredSessions = async (): Promise<void> => {
  const now = new Date();
  await db
    .delete(sessions)
    .where(
      or(lt(sessions.expiresAt, now), lt(sessions.absoluteExpiresAt, now)),
    );
};
