import "dotenv/config";
import { z } from "zod";

// "https://app.example.com" is valid; "https://app.example.com/" (trailing slash),
// paths, and explicit default ports are not, because browsers send a bare origin.
const isPlainOrigin = (value: string): boolean => {
  try {
    const url = new URL(value);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      url.origin === value
    );
  } catch {
    return false;
  }
};

const originList = z
  .string()
  .min(1, "must list at least one origin")
  .transform((raw) =>
    raw
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean),
  )
  .refine((list) => list.length > 0, "must list at least one origin")
  .refine(
    (list) => list.every(isPlainOrigin),
    "each origin must look like https://app.example.com (scheme + host [+ port], no path, no trailing slash)",
  );

const envSchema = z
  .object({
    // No default on purpose: a missing NODE_ENV in production must fail loudly,
    // not silently fall back to insecure cookies and long-lived tokens.
    NODE_ENV: z.enum(["development", "production", "test"], {
      error: 'is required: set it to "development", "production" or "test"',
    }),

    PORT: z.coerce.number().int().positive().default(3000),
    DATABASE_URL: z
      .string()
      .min(1)
      .refine(
        (v) => /^postgres(ql)?:\/\//.test(v),
        "must start with postgres:// or postgresql://",
      ),

    ACCESS_TOKEN_SECRET: z
      .string()
      .min(
        32,
        "must be at least 32 characters (generate one: openssl rand -base64 48)",
      ),

    EMAIL_USER: z.string().min(1),
    EMAIL_PASS: z.string().min(1),
    CLIENT_URL: z.url(),

    // Comma-separated list, e.g. "https://app.example.com,https://admin.example.com"
    CORS_ORIGINS: originList,

    // "lax" is right when the frontend and API are same-site (e.g. app.x.com + api.x.com).
    COOKIE_SAMESITE: z.enum(["lax", "strict", "none"]).default("lax"),
  })
  .refine(
    (cfg) =>
      cfg.NODE_ENV !== "production" ||
      cfg.CORS_ORIGINS.every((o) => o.startsWith("https://")),
    {
      error: "must be https:// only when NODE_ENV=production",
      path: ["CORS_ORIGINS"],
    },
  )
  .refine(
    (cfg) =>
      cfg.NODE_ENV !== "production" || cfg.CLIENT_URL.startsWith("https://"),
    {
      error: "must be https:// when NODE_ENV=production",
      path: ["CLIENT_URL"],
    },
  );

// Print readable problems (names + reasons only, never values) and stop,
// instead of dumping a raw ZodError that might echo secrets.
const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:");
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join(".") || "(root)"}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = parsed.data;
