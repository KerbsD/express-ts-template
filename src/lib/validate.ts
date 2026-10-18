import type { NextFunction, Request, Response } from "express";
import type { ZodError, ZodType } from "zod";

const sendValidationError = (res: Response, error: ZodError) =>
  res.status(400).json({
    success: false,
    message: "Validation failed.",
    errors: error.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
    })),
  });

export const validateBody =
  (schema: ZodType) => (req: Request, res: Response, next: NextFunction) => {
    // Express 5 leaves req.body undefined when there is no JSON body
    const result = schema.safeParse(req.body ?? {});
    if (!result.success) return sendValidationError(res, result.error);

    req.body = result.data; // cleaned data; unknown fields are stripped
    next();
  };