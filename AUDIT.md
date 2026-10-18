# Security & Engineering Audit — `express-ts-template` (auth API)

> **Audit date:** 2026-10-17
> **Auditor:** lead backend review (DeepSeek agent session)
> **Status:** H1 fixed (2026-10-17), M1 + M2 + M5 fixed (2026-10-18). H2 accepted as intended behavior. M3/M4 deferred by decision. L1–L10 open.
> **Engine:** Express 5 + TypeScript (native type-stripping, Node ≥ 22.18/23.6), Drizzle ORM + Postgres (Neon), Redis-optional rate limiting, JWT access tokens + opaque rotating refresh tokens.

---

## How to use this document in a new session

1. Read this file top to bottom first.
2. Work findings in the **suggested fix order** at the bottom (or user-preferred order).
3. Each finding has: **evidence** (file:line), **impact**, **fix direction**. Verify line numbers against the working tree — they refer to the uncommitted state audited on 2026-10-17.
4. Update the `Status:` checkbox per finding as it is fixed: `[ ]` → `[x]`.
5. Do **not** treat "Verified clean" items as work items; they are regression guards — don't break them.

**Scope audited:** `server.ts`, `src/**` (40 TS files), `src/db/schema.ts`, `drizzle/**` migrations, `.env` (for config review only), `.github/**`, `package.json`.
**Checks run:** `npx tsc --noEmit` ✅ clean · `npm audit --omit=dev` ✅ 0 vulnerabilities · `npm audit` ⚠️ 4 moderate (dev-only, see L9) · git history search for secret values ✅ none ever committed.

**Known context for the fixer:**
- `.env` was reviewed and is git-ignored; its values are in **no** git object. H1 (2026-10-17): runtime role + JWT secret rotated — owner/Gmail rotations still pending, see H1 Resolution. Do not print secrets into chat/logs.
- `npm run dev` = `node --watch server.ts` (requires Node with TS type-stripping support). Typecheck passes on the audited tree.
- There are currently **no tests** and **no lint config** in the repo.
- The repo has uncommitted changes on top of `cf90b17` ("Initial Commit"); audit reflects the working tree.

---

## Severity summary

| ID | Severity | Title | Status |
|----|----------|-------|--------|
| H1 | **HIGH** | Live credentials in plaintext `.env` + DB over-privilege | [x] *(manual rotations pending — see H1)* |
| H2 | **HIGH** | Brute-force protection silently disappears (fail-open + per-process fallback) | [~] *accepted — intended behavior (2026-10-18)* |
| M1 | MEDIUM | Email-bombing gap on `/auth/register` (no per-recipient cap) | [x] |
| M2 | MEDIUM | Account lockout DoS + username enumeration + renewable username squatting | [x] |
| M3 | MEDIUM | `TRUST_PROXY_HOPS` is a foot-gun coupled to deployment topology | [ ] |
| M4 | MEDIUM | No engineering safety net for security-critical code | [ ] |
| M5 | MEDIUM | Refresh grace window lets a replayed (stolen) token win | [x] |
| L1 | LOW | HIBP check fails open | [ ] |
| L2 | LOW | `CLIENT_URL` has no scheme restriction | [ ] |
| L3 | LOW | Login isn't origin-checked; refresh cookie path `/auth` is broad | [ ] |
| L4 | LOW | `no-store` scoped to `/auth` only | [ ] |
| L5 | LOW | `verifyJwt` nits (Bearer case-sensitivity, missing `WWW-Authenticate`) | [ ] |
| L6 | LOW | CORS `methods` lacks PUT/DELETE | [ ] |
| L7 | LOW | Redis adds latency before fail-open | [ ] |
| L8 | LOW | Code nits (unused `validateQuery`, `any`, config message, cookie name) | [ ] |
| L9 | LOW | 4 moderate dev-only npm advisories (drizzle-kit → esbuild) | [ ] |
| L10 | LOW | Ops/repo hygiene (uncommitted migration/lockfile, no migration CI, health, in-process jobs) | [ ] |

---

## HIGH

### H1. Live credentials in plaintext `.env` + DB over-privilege
**Status:** [x] — code/infra complete 2026-10-17; external rotations pending (see Resolution)

**Resolution (2026-10-17):**
- [x] Created DML-only role `app_runtime` on Neon: `CONNECT` + `USAGE` on `public`, `SELECT/INSERT/UPDATE/DELETE` on all tables, `USAGE, SELECT` on all sequences, plus default privileges for future owner-created objects; `CREATE` revoked. Smoke-tested live: reads ok, write-then-rollback ok, DDL denied.
- [x] `DATABASE_URL` now uses `app_runtime` (pooled host); owner credentials moved to `MIGRATION_DATABASE_URL` (direct host) used only by drizzle-kit; `drizzle.config.ts` prefers it.
- [x] `ACCESS_TOKEN_SECRET` rotated (48 random bytes). Outstanding access tokens are invalidated; refresh sessions unaffected.
- [x] Added `.env.example` (placeholder keys + secret-manager guidance); `.gitignore` hardened (`.env.*` ignored, `.env.example` tracked).
- [x] Verified through the app's own stack (env loading + pg pool + Drizzle against the live DB) and `tsc --noEmit` — both clean.
- [ ] **Manual:** rotate the `neondb_owner` password in the Neon Console, then update `MIGRATION_DATABASE_URL` in `.env` (and anything else that uses it).
- [ ] **Manual:** rotate the Gmail app password (Google Account → Security → App passwords), then update `EMAIL_PASS` in `.env`.
- [ ] **Manual (deploy time):** inject secrets from the platform secret manager; never ship `.env`.

**Evidence (as audited; remediated 2026-10-17 — see Resolution above):**
- `.env:1` — Neon connection string incl. password, role **`neondb_owner`** (DDL rights) used by the runtime app (`src/db/index.ts`).
- `.env:3` — JWT signing secret.
- `.env:11-13` — real Gmail address + app password for outbound mail (`src/services/email.ts`).
- `.env:19` — config state generally mirrored from a real environment.

**Verified not leaked to git:** `.gitignore` ignores `.env`; `git grep` over all rev-list objects for the DB password / JWT value / mail password returned nothing. Risk is local/exfiltration (zips, backups, screen share, malicious postinstall scripts), not a repo leak.

**Impact:** anyone obtaining the file gets full DB ownership, token-forging capability, and mail-sending credentials for the domain.

**Fix direction:**
- Rotate all three secrets (Neon password/role, JWT secret, Gmail app password) in their consoles — assume compromise once addressed.
- Runtime DB role: create least-privileged role (DML only; no `neondb_owner`). Keep the owner/pooler connection for `drizzle-kit migrate` only (e.g., `MIGRATION_DATABASE_URL`).
- Deploys: inject env from platform secret manager; never ship `.env`.
- Add `.env.example` with placeholder keys so onboarding doesn't copy live values.
- Note: rotating `ACCESS_TOKEN_SECRET` invalidates all outstanding access tokens (max 10 min dev / 1 min prod) — users refresh; no session loss.

---

## MEDIUM

### M1. Email-bombing gap on `/auth/register`
**Status:** [x] — fixed 2026-10-18 (see Resolution)

**Resolution (2026-10-18):**
- [x] Added `registerEmailLimiter` (`src/lib/authLimiter.ts`): 5 requests / 24h per normalized recipient address (`emailKey`, same as forgot/resend); `standardHeaders: false`; silent handler returns the normal 201 success body (no 429 leak).
- [x] Mounted on `/auth/register` AFTER `validateNewUser` (`src/routes/auth/register.ts`) so it sees the cleaned address; tripped requests never reach the controller, so no email is queued.
- [x] Verified with a stub-app test: first 5 requests pass (controller hit 5×), the 6th is answered silently without invoking the controller, case/whitespace variants share one bucket, a different address still passes. `tsc --noEmit` clean.
- Trade-off (same as forgot/resend): an attacker can exhaust the quota for a specific address (victim waits out the 24h window for that address); aggregate abuse across many addresses remains bounded by `registerLimiter` (10/h/IP) + `globalLimiter`.

**Evidence:**
- `src/controllers/auth/register.ts:80-82` — verified existing email → outcome `"exists"` → `sendAccountExistsEmail` on **every** attempt; 2-min cooldown only applies to unverified accounts (`:84-89`).
- Per-recipient daily caps exist for forgot (`src/lib/authLimiter.ts:113-125`) and resend (`:139-151`) but **not for register** — only per-IP `registerLimiter` (10/hour, `:97-102`).

**Impact:** attacker with a handful of IPs repeatedly mails any verified address from your domain ("You already have an account") → harassment + domain reputation damage; also acts as a relay to arbitrary addresses.

**Fix direction:** add an `emailKey`-based per-recipient daily limiter on `/auth/register` after validation, using the same `silentOk` handler pattern as the other two. Consider updating `lastVerificationSentAt`-style state for the "exists" branch too.

### M2. Account lockout DoS + username enumeration + renewable username squatting
**Status:** [x] — fixed 2026-10-18 (see Resolution)

**Resolution (2026-10-18):**
- [x] Replaced `loginUserLimiter` (hard 20/15min lock across IPs — a DoS gift) with `loginUserBackoff` (`src/lib/authLimiter.ts`): failures build a progressive delay (250ms → 500ms → 1s → 2s → 5s cap, 15-min sliding window, reset on successful login). The correct password is never blocked, only delayed; Redis-backed when configured, per-process otherwise.
- [x] Username conflict now uses generic text ("Username unavailable.", `src/controllers/auth/register.ts`); the 409 status itself still signals existence, but probing is rate-limited (accepted trade-off).
- [x] Added `registerUsernameLimiter` (5 / 24h per username across IPs, mounted after `validateNewUser`) to bound probing/churn against one username.
- [x] Squatting deadline is no longer renewable: `purgeStaleUnverifiedUsers` (`src/lib/maintenance.ts`) purges on `createdAt` (fixed 7-day window from creation) instead of `coalesce(lastVerificationSentAt, createdAt)`.
- [x] Verified: stub-app test (delays 264/504/1010ms as expected, correct password passed at 2006ms after 8 failures, counter reset to ~0ms on success; username cap 5×201 then 429, case/whitespace variants share one bucket) + live DB test (old → purged, old-but-refreshed → purged, fresh → kept) + `tsc --noEmit` clean.
- Residual: a determined squatter can still re-register every 7 days (fully closing that needs verification-first or CAPTCHA); distributed brute force is slowed, not hard-capped, by design.

**Evidence:**
- `src/lib/authLimiter.ts:88-93` — 20 failures / 15 min **per username across all IPs** → attacker can lock a victim out (comment acknowledges trade-off).
- `src/controllers/auth/register.ts:119-123` — `409 Username already exists` reveals username existence.
- `src/lib/maintenance.ts:11-22` purges unverified accounts after 7 days, but `register.ts:84-98` refreshes `lastVerificationSentAt` on re-registration after the 2-min cooldown → attacker can hold a username indefinitely.

**Impact:** availability (victim lockout), enumeration oracle, username hoarding.

**Fix direction:**
- Replace hard per-username lockout with progressive delay/backoff that doesn't fully block the correct password, or separate "throttle" from "lock".
- Return generic conflict text ("Username unavailable") — still 409 acceptable.
- Add a per-username registration cap (e.g., N distinct emails attempted per username per day).

### M3. `TRUST_PROXY_HOPS` is a foot-gun coupled to deployment topology
**Status:** [ ]

**Evidence:**
- `server.ts:31` — `app.set("trust proxy", env.TRUST_PROXY_HOPS)`; `.env:19` = `1`; validation `src/configs/env.ts:55-57` (0–10, default 0).
- All rate-limit keys and audit logs derive from `req.ip` (`src/lib/authLimiter.ts:34`, `src/middlewares/requestLogger.ts:36`, `securityLog` calls).

**Impact:** directly exposed instance with `TRUST_PROXY_HOPS=1` → clients spoof `X-Forwarded-For` → rate-limit bypass + poisoned audit IPs. Behind 2+ proxies (Cloudflare + LB) → all users share one bucket.

**Fix direction:** document expected topology in deploy README; prefer trusting explicit proxy CIDRs over hop counts; add a startup sanity check/log of the resolved `req.ip` behavior.

### M4. No engineering safety net for security-critical code
**Status:** [ ]

**Evidence:**
- `package.json:6-13` — no `test`, `lint`, `build`, or `start` scripts; no test files anywhere; no ESLint/Prettier config.
- `.github/workflows/ci.yml:18-20` — CI = `npm ci`, `npx tsc --noEmit`, `npm audit --omit=dev`.
- `ci.yml:16` pins Node 22; dev script (`node --watch server.ts`) needs Node ≥ 22.18/23.6 for unflagged TS type-stripping; no `engines`/`.nvmrc`; local Node 24.
- No migration step in CI.

**Impact:** the riskiest logic (refresh rotation/reuse detection, rate-limit keying, re-registration takeover) has zero regression coverage; environment drift between CI/locals/production.

**Fix direction:**
- Add Vitest + supertest covering: register→verify→login→refresh rotation→reuse revoke; rate-limit keys; re-registration of unverified emails; validation error shapes.
- Add lint to CI; declare `engines.node` and an `.nvmrc`; add `start` script for production; run `drizzle-kit migrate` (against a test DB) in CI.

### M5. Refresh grace window lets a replayed (stolen) token win
**Status:** [x] — fixed 2026-10-18 (see Resolution)

**Resolution (2026-10-18):**
- [x] Session rows now store a client fingerprint (`ip`, `user_agent`) at login and on every rotation — migration `0004_perfect_nico_minoru.sql` applied (`src/db/schema.ts`, `src/lib/sessions.ts`).
- [x] The grace window now only forgives a **same-fingerprint** replay (a genuine multi-tab race). A replay inside the window from a different IP/user-agent is treated as token theft: the family is revoked immediately (`cause: "grace"`), so a stolen token no longer wins a replacement. **Note:** this goes one step beyond the audit's telemetry-only direction.
- [x] Normal rotations from a new IP/UA (VPN, mobile, new device) still succeed, but emit a `refresh_fingerprint_mismatch` warning with both fingerprints.
- [x] Telemetry: dependency-free in-process counters `refresh_token_reuse` (incremented at both detection sites) and `refresh_fingerprint_mismatch` (`src/lib/metrics.ts`); the reuse security log now includes `cause`. The hourly maintenance job snapshots counters to the log until a real metrics backend consumes `snapshotCounters()`.
- [x] Verified live against Neon: create/rotation store fingerprints; same-client grace race still works; cross-client grace replay → revoked family (`cause: "grace"`); post-window replay → revoked (`cause: "window"`); cross-fingerprint normal rotation allowed + flagged; counters `{refresh_token_reuse: 2, refresh_fingerprint_mismatch: 1}`; `tsc --noEmit` clean.
- Residual: fingerprints are heuristic — UA is client-controlled and IP trust depends on correct `TRUST_PROXY_HOPS` (see M3); same-device theft remains indistinguishable from the real client (inherent to bearer tokens).

**Evidence:**
- `src/lib/tokens.ts:30` — `REFRESH_GRACE_MS = 10s`.
- `src/lib/sessions.ts:91-122` — replay within the grace window of a legitimate rotation issues a **new valid token** in the same family; theft only detectable after the window.
- `src/controllers/auth/refreshToken.ts:26-31` — reuse handling has a "Hook this into real alerting later" comment; no metric emitted.

**Impact:** narrow but real: an attacker holding a stolen refresh token has a 10s window to obtain a valid replacement; there is no telemetry to notice it happening.

**Fix direction:** keep the window (multi-tab race), but:
- store `ip`/`userAgent` on session rows at rotation and alert when a family rotates from a different IP/UA;
- emit a counter/metric on `refresh_token_reuse` instead of only a log line.

---

## LOW / HARDENING

### L1. HIBP check fails open
**Status:** [ ]

- `src/lib/pwned.ts:30-36` — outage/timeout → password allowed. Reasonable availability choice; document it and alert on the warn log. Ensure `PWNED_PASSWORD_CHECK` is never `off` in production.

### L2. `CLIENT_URL` has no scheme restriction
**Status:** [ ]

- `src/configs/env.ts:95` — `z.url()` accepts `javascript:`/`data:` URLs, which flow into email `href`s (`src/services/email.ts:61-62,82,105`).
- Production is https-guarded (`:115-122`), but staging/dev are not.
- Fix: apply the same `isPlainOrigin`-style refine used for `CORS_ORIGINS`.

### L3. Login isn't origin-checked; refresh cookie path is broad
**Status:** [ ]

- `src/routes/auth/login.ts` — no `requireTrustedOrigin`. Currently **not exploitable** (JSON-only body parsing + CORS preflight block cross-site forms), but it's the one cookie-setting endpoint without the defense-in-depth middleware. Consider adding it for consistency once non-browser clients are accounted for.
- `src/configs/cookieOptions.ts:11` — refresh cookie `path=/auth` is attached to login/register/verify/reset too. Acceptable; narrower scoping (`/auth/refresh` + `/auth/logout`) is tighter if frontend allows.

### L4. `no-store` scoped to `/auth` only
**Status:** [ ]

- `server.ts:48`. Protected routes added below `verifyJwt` will not get `Cache-Control: no-store`; helmet doesn't add it. Add a global default or document the convention so sensitive GETs stay uncacheable.

### L5. `verifyJwt` nits
**Status:** [ ]

- `src/middlewares/verifyJwt.ts:6,12` — `"Bearer "` prefix is case-sensitive (RFC 7235 schemes are case-insensitive); 401 on missing header lacks `WWW-Authenticate: Bearer` (tampered tokens do get it at `:25`).

### L6. CORS `methods` lacks PUT/DELETE
**Status:** [ ]

- `src/configs/corsOption.ts:13`. First future `PUT`/`DELETE` route will fail preflight mysteriously. Add `PUT`, `DELETE` (and `PATCH` already present).

### L7. Redis adds latency before fail-open
**Status:** [ ]

- `src/lib/rateLimitStore.ts:14` (`commandTimeout: 250`) × up to 3 Redis calls on login (`loginIpLimiter`, `loginLimiter`, the username-backoff read) ≈ 750ms added per request during a Redis brownout before passing through. Consider a circuit breaker or shared timeout budget.

### L8. Code nits
**Status:** [ ]

- `src/lib/validate.ts:25-31` — `validateQuery` unused (dead code or wire it where needed).
- `src/lib/helpers.ts:12-16` — `any` types; prefer `unknown` + narrowing.
- `drizzle.config.ts:4-5` — error message says `DATABASE_URL_UNPOOLED` but checks `DATABASE_URL`.
- `src/controllers/auth/login.ts:58` / `src/configs/cookieOptions.ts` — cookie named `jwt` holds an opaque token, not a JWT (naming confusion; renaming needs a migration/coexistence plan).

### L9. 4 moderate dev-only npm advisories
**Status:** [ ]

- `npm audit` → `drizzle-kit → @esbuild-kit/esm-loader → esbuild ≤0.24.2` (GHSA-67mh-4wv8-2f99, dev-server request snooping). Prod deps (`npm audit --omit=dev`) are clean. Track a drizzle-kit update; don't `npm audit fix --force` (downgrades drizzle-kit to 0.18).

### L10. Ops / repo hygiene
**Status:** [ ]

- Uncommitted in working tree: `drizzle/0003_*.sql`, `drizzle/meta/_journal.json`, `package-lock.json` (+ many modified src files). Deploying "the repo" as-is risks schema drift. Commit deliberately; add migration step to CI/deploy.
- `/health` (`server.ts:41-43`) is unthrottled and liveness-only; fine for now — add DB readiness (`SELECT 1`) if used by orchestrators.
- Email sends (`src/services/email.ts:50-57`) and maintenance (`server.ts:79-84`) run in-process per instance — idempotent/acceptable single-instance; move to a queue (BullMQ/pg-boss) before scaling horizontally.

---

## Verified clean — do not regress

These were checked and found sound:

- **No secrets in git history**; `.env` ignored; only env var *names* exist in committed files.
- **SQL safety:** all user input parameterized via Drizzle; `sql` template usages reference columns, not interpolated user values (`login.ts:31`, `register.ts:61-76`, `maintenance.ts:19`, etc.).
- **Token handling:** refresh tokens are 256-bit random, stored as SHA-256 hash only (`schema.ts:63`, `tokens.ts:8-18`); rotation + family revoke on reuse (`sessions.ts:68-158`); refresh cookie `httpOnly`, `secure` in prod, `sameSite` configurable, scoped path (`cookieOptions.ts:4-13`).
- **JWT:** HS256 pinned, issuer/audience/`typ`/`sub` validated, short expiry (1 min prod) (`tokens.ts:44-72`, `verifyJwt.ts:19-30`).
- **Timing defenses:** dummy bcrypt hash for unknown users (`login.ts:13-16,35`), uniform forgot/resend responses (`password.ts:27-31`, `resendVerification.ts:50-55`).
- **Atomic flows:** verify email consume, resend rotation, forgot-password claim, reset-password transaction all single-statement/`FOR UPDATE` (`verifyEmail.ts:24-37`, `resendVerification.ts:23-43`, `password.ts:38-57,89-128`).
- **Response hygiene:** 5xx messages genericized, Drizzle params stripped from logs (`errorHandler.ts:20-26`, `logger.ts:36-59`), redaction list (`logger.ts:70-89`), query strings never logged (`requestLogger.ts:6-9,33`).
- **Transport/parsing:** helmet defaults, `x-powered-by` off, `express.json({ limit: "10kb" })`, CORS allowlist with credentials, `no-store` on `/auth`, origin check on `/auth/refresh` + `/auth/logout` (`server.ts:32-48`, `corsOption.ts`, `requireTrustOrigin.ts`).
- **Register takeover semantics:** unverified email rows are overwritten by the true owner (`register.ts:91-98`) — deliberate anti-squat design.
- **Infra:** pool error handler prevents crash (`db/index.ts:20-22`), statement timeout set, graceful shutdown with hard deadline + unhandled rejection/exception handlers (`server.ts:90-128`), Redis closes before pool.
- **`tsc --noEmit` clean; prod dependencies free of known advisories.**

---

## Suggested fix order

1. ~~**H1**~~ — code/infra done 2026-10-17; external rotations still pending (see H1 Resolution).
2. ~~**H2**~~ — accepted as intended behavior 2026-10-18; revisit before multi-instance deploys without Redis.
3. ~~**M1**~~ — fixed 2026-10-18 (per-recipient limiter on register).
4. **M4 (first slice)** *(deferred by decision 2026-10-18)* — test harness (Vitest + supertest) around the auth state machine, then lint + engines + CI migration.
5. ~~**M2**~~ / ~~**M5**~~ — fixed 2026-10-18 (username backoff, generic 409, per-username register cap, non-renewable purge; refresh fingerprinting, grace-window theft revoke, reuse/mismatch counters). **M3** *(deferred by decision 2026-10-18)* — proxy trust docs/validation.
6. **L1–L10** — hardening sweep; batch small nits into one PR.

After each fix: run `npx tsc --noEmit`, `npm audit --omit=dev`, and the new test suite; update this file's checkboxes.
