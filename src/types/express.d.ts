import "express";
import type { AccessTokenUser } from "../lib/tokens.ts";

declare global {
  namespace Express {
    interface Request {
      /**
       * Set by verifyJwt. The user's ID comes from the token's sub claim.
       * Use it for ownership checks.
       */
      user?: AccessTokenUser;
    }
  }
}

export {};
