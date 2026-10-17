import type { ErrorRequestHandler } from "express";
import { clean, logEvents } from "./logEvents.ts";

const isHttpError = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  value >= 400 &&
  value < 600;

const firstLine = (value: unknown): string =>
  typeof value === "string" ? (value.split("\n")[0] ?? "") : "";

const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  // Headers already sent: let Express close the connection
  if (res.headersSent) return next(err);

  const status = isHttpError(err?.status)
    ? err.status
    : isHttpError(err?.statusCode)
      ? err.statusCode
      : 500;

  // Server errors always get a generic message. Client errors (4xx) may show
  // their message, except body-parser errors, whose text can echo your input.
  let message = "Internal Server Error";
  if (err?.type === "entity.parse.failed") message = "Invalid JSON body";
  else if (err?.type === "entity.too.large") message = "Request body too large";
  else if (status < 500 && typeof err?.message === "string")
    message = err.message;

  // Log file: names and the first line only. For Drizzle errors that line is
  // the SQL with $1, $2 placeholders; the values are on the next line.
  logEvents(
    [
      req.method,
      clean(req.path),
      status,
      clean(err?.name),
      clean(firstLine(err?.message)),
    ].join("\t"),
    "errLog.txt",
  );

  // Full detail (stack, cause, params) goes to the console only
  console.error(err);

  res.status(status).json({ success: false, message });
};

export default errorHandler;
