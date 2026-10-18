import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";

import { env } from "./src/configs/env.ts";
import corsOptions from "./src/configs/corsOption.ts";
import { pool } from "./src/db/index.ts";
import { logger, serializeError } from "./src/lib/logger.ts";
import { globalLimiter } from "./src/lib/authLimiter.ts";
import { closeRedis } from "./src/lib/rateLimitStore.ts";
import { runMaintenance } from "./src/lib/maintenance.ts";

import { requestLogger } from "./src/middlewares/requestLogger.ts";
import errorHandler from "./src/middlewares/errorHandler.ts";
import notFound from "./src/middlewares/notFound.ts";
import { noStore } from "./src/middlewares/noStore.ts";
import { verifyJwt } from "./src/middlewares/verifyJwt.ts";

import registerRoute from "./src/routes/auth/register.ts";
import verifyEmailRoute from "./src/routes/auth/verifyEmail.ts";
import resendVerificationRoute from "./src/routes/auth/resendVerification.ts";
import loginRoute from "./src/routes/auth/login.ts";
import passwordRoute from "./src/routes/auth/password.ts";
import refreshTokenRoute from "./src/routes/auth/refresh.ts";
import logoutRoute from "./src/routes/auth/logout.ts";

const app = express();

// Only trust X-Forwarded-For if you really are behind that many proxies
if (env.TRUST_PROXY_HOPS > 0) app.set("trust proxy", env.TRUST_PROXY_HOPS);
app.disable("x-powered-by");

app.use(requestLogger);
app.use(helmet());

// This API returns tokens and private data on every route: keep all responses
// uncacheable (helmet does not set Cache-Control). Mounted before CORS so even
// preflight responses carry it.
app.use(noStore);
app.use(cors(corsOptions));
app.use(express.json({ limit: "10kb" }));
app.use(cookieParser());

// Public, and deliberately before the rate limiter so uptime checks never get blocked
app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

// Readiness: checks the database is reachable. Cached for a few seconds so
// frequent probes can't hammer the pool; answers 503 while the DB is down.
let dbReadiness = { ok: true, checkedAt: 0 };
const READINESS_CACHE_MS = 5_000;

app.get("/health/ready", async (_req, res) => {
  if (Date.now() - dbReadiness.checkedAt > READINESS_CACHE_MS) {
    try {
      await pool.query("select 1");
      dbReadiness = { ok: true, checkedAt: Date.now() };
    } catch {
      dbReadiness = { ok: false, checkedAt: Date.now() };
    }
  }
  res.status(dbReadiness.ok ? 200 : 503).json({ ok: dbReadiness.ok });
});

app.use(globalLimiter);

// Authentication (mounted under /auth so the refresh cookie can be scoped to path=/auth)
app.use("/auth/login", loginRoute);
app.use("/auth/register", registerRoute);
app.use("/auth/verify-email", verifyEmailRoute);
app.use("/auth/resend-verification", resendVerificationRoute);
app.use("/auth/password", passwordRoute);
app.use("/auth/refresh", refreshTokenRoute);
app.use("/auth/logout", logoutRoute);

// Default-deny: everything registered BELOW this line requires a valid access
// token, so a new route can't be left public by forgetting a middleware.
app.use(verifyJwt);

// e.g. app.use("/notes", notesRoute);

app.all("*splat", notFound);
app.use(errorHandler);

// ---------- Startup ----------

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, "server listening");
});

// Slow-client protection. keepAlive > headers is the documented setup behind
// load balancers (AWS ALB idles at 60s), otherwise you get sporadic 502s.
server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;
server.requestTimeout = 120_000;

// Delete expired sessions and stale unverified accounts on startup, then hourly
void runMaintenance();
const maintenanceTimer = setInterval(
  () => void runMaintenance(),
  60 * 60 * 1000,
);
maintenanceTimer.unref();

// ---------- Graceful shutdown ----------

let shuttingDown = false;

const shutdown = (reason: string, exitCode = 0) => {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ reason }, "shutting down");

  // Hard stop if something hangs
  setTimeout(() => {
    logger.error("shutdown timed out, forcing exit");
    process.exit(1);
  }, 10_000).unref();

  clearInterval(maintenanceTimer);

  // Stop accepting new connections, let in-flight requests finish
  server.close(async () => {
    try {
      await closeRedis();
      await pool.end();
    } catch (err) {
      logger.error({ err: serializeError(err) }, "error during shutdown");
      exitCode = 1;
    }
    process.exit(exitCode);
  });
  server.closeIdleConnections();
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

process.on("unhandledRejection", (reason) => {
  logger.fatal({ err: serializeError(reason) }, "unhandled promise rejection");
  shutdown("unhandledRejection", 1);
});

process.on("uncaughtException", (err) => {
  logger.fatal({ err: serializeError(err) }, "uncaught exception");
  shutdown("uncaughtException", 1);
});
