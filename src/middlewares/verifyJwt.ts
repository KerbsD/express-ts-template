// src/middleware/verifyJwt.ts
import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../lib/tokens.ts";
import type { AccessTokenUser } from "../lib/tokens.ts";

const BEARER = "Bearer ";

export const verifyJwt = (req: Request, res: Response, next: NextFunction) => {
  // Node lowercases header names, so only "authorization" exists
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith(BEARER)) return res.sendStatus(401);

  const token = authHeader.slice(BEARER.length).trim();

  // Validate token format before verifying
  if (token.split(".").length !== 3) return res.sendStatus(401);

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
