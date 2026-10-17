// src/types/express.d.ts
declare global {
  namespace Express {
    interface Request {
      // Set by verifyJwt. `id` comes from the token's `sub` claim and is the
      // only thing you should use for ownership checks (WHERE user_id = $1).
      user?: { id: number; username: string };
    }
  }
}

export {};
