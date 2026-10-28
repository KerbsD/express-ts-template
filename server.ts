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
import createBookingRoute from "./src/routes/bookings/create.ts";
import adminBookingsRoute from "./src/routes/bookings/admin.ts";
import publicPortfolioRoute from "./src/routes/portfolio/public.ts";
import adminPortfolioRoute from "./src/routes/portfolio/admin.ts";
import publicMerchRoute from "./src/routes/merch/public.ts";
import adminMerchRoute from "./src/routes/merch/admin.ts";
import publicDesignRoute from "./src/routes/design/public.ts";
import adminDesignRoute from "./src/routes/design/admin.ts";
import adminUploadsRoute from "./src/routes/uploads/admin.ts";

const app = express();
if (env.TRUST_PROXY_HOPS > 0) app.set("trust proxy", env.TRUST_PROXY_HOPS);
app.disable("x-powered-by");

app.use(requestLogger);
app.use(helmet());
app.use(noStore);
app.use(cors(corsOptions));
app.use(express.json({ limit: "10kb" }));
app.use(cookieParser());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

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

app.use("/auth/login", loginRoute);
app.use("/auth/register", registerRoute);
app.use("/auth/verify-email", verifyEmailRoute);
app.use("/auth/resend-verification", resendVerificationRoute);
app.use("/auth/password", passwordRoute);
app.use("/auth/refresh", refreshTokenRoute);
app.use("/auth/logout", logoutRoute);

app.use("/bookings", createBookingRoute);
app.use("/portfolio", publicPortfolioRoute);
app.use("/merch", publicMerchRoute);
app.use("/design", publicDesignRoute);

app.use(verifyJwt);

app.use("/admin/bookings", adminBookingsRoute);
app.use("/admin/portfolio", adminPortfolioRoute);
app.use("/admin/merch", adminMerchRoute);
app.use("/admin/design", adminDesignRoute);
app.use("/admin/uploads", adminUploadsRoute);

app.all("*splat", notFound);
app.use(errorHandler);

// ---------- Startup ----------

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, "server listening");
});

server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;
server.requestTimeout = 120_000;

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

  setTimeout(() => {
    logger.error("shutdown timed out, forcing exit");
    process.exit(1);
  }, 10_000).unref();

  clearInterval(maintenanceTimer);

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
