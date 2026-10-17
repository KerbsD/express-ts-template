import { format } from "date-fns";
import { v4 as uuid } from "uuid";
import type { Request, Response, NextFunction } from "express";

import fs from "fs";
import fsPromises from "fs/promises";
import path from "path";

export const clean = (value: unknown, max = 200): string =>
  String(value ?? "-")
    .replace(/[\t\r\n]+/g, " ")
    .slice(0, max);

export const logEvents = async (
  message: string,
  logName: string,
): Promise<void> => {
  const dateTime = format(new Date(), "yyyyMMdd\tHH:mm:ss");
  const logItem = `${dateTime}\t${uuid()}\t${message.replace(/[\r\n]+/g, " ")}\n`;

  try {
    const logsDir = path.join(process.cwd(), "logs");

    if (!fs.existsSync(logsDir)) {
      await fsPromises.mkdir(logsDir, { recursive: true });
    }

    await fsPromises.appendFile(path.join(logsDir, logName), logItem);
  } catch (err) {
    console.log(err);
  }
};

export const logger = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  logEvents(
    `${req.method}\t${clean(req.headers.origin)}\t${clean(req.path)}`,
    "reqLog.txt",
  );
  console.log(`${req.method} ${req.path}`);
  next();
};
