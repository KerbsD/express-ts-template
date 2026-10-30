// src/middleware/verifyJwt.ts
import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../lib/tokens.ts";
import type { AccessTokenUser } from "../lib/tokens.ts";

// RFC 7235 auth schemes are case-insensitive ("Bearer", "bearer", ...)
const BEARER_PREFIX = "bearer ";

export const verifyJwt = (req: any, res: Response, next: NextFunction) => {
  // Node lowercases header names, so only "authorization" exists
  const authHeader = req.headers.authorization ?? "";

  if (
    authHeader.slice(0, BEARER_PREFIX.length).toLowerCase() !== BEARER_PREFIX
  ) {
    res.set("WWW-Authenticate", "Bearer");
    return res.sendStatus(401);
  }

  const token = authHeader.slice(BEARER_PREFIX.length).trim();

  // Validate token format before verifying
  if (token.split(".").length !== 3) {
    res.set("WWW-Authenticate", 'Bearer error="invalid_token"');
    return res.sendStatus(401);
  }

  let user: AccessTokenUser;
  try {
    user = verifyAccessToken(token);
  } catch {
    // Expired, tampered, wrong issuer/audience/type: all 401, so the client
    // handles every case the same way (call /auth/refresh, else log in again).
    res.set("WWW-Authenticate", 'Bearer error="invalid_token"');
    return res.sendStatus(401);
  }

  req.user = user;
  next();
};
