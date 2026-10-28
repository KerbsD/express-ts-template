import nodemailer from "nodemailer";
import { env } from "../configs/env.ts";
import { logger, serializeError } from "../lib/logger.ts";

const transporter = nodemailer.createTransport({
  host: env.EMAIL_HOST,
  port: env.EMAIL_PORT,
  secure: env.EMAIL_SECURE,
  auth: {
    user: env.EMAIL_USER,
    pass: env.EMAIL_PASS, // Use an App Password / API key, not your real password
  },
  pool: true,
  maxConnections: 3,
  // Never let a stalled SMTP server hang a request or a background job forever
  connectionTimeout: 10_000,
  greetingTimeout: 10_000,
  socketTimeout: 20_000,
});

const FROM = env.EMAIL_FROM ?? `"${env.APP_NAME}" <${env.EMAIL_USER}>`;
const BASE_URL = env.CLIENT_URL.replace(/\/+$/, "");

type MailOptions = Parameters<typeof transporter.sendMail>[0];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Simple in-process retry with backoff (1s, 2s). For guaranteed delivery across
// restarts you'd move this behind a real queue (BullMQ, pg-boss, SQS).
const sendWithRetry = async (
  options: MailOptions,
  attempts = 3,
): Promise<void> => {
  for (let attempt = 1; ; attempt++) {
    try {
      await transporter.sendMail(options);
      return;
    } catch (err) {
      if (attempt >= attempts) throw err;
      await sleep(1000 * 2 ** (attempt - 1));
    }
  }
};

/**
 * Fire-and-forget. Sending in the background keeps response time identical
 * whether or not an account exists (no timing oracle) and a failed send can't
 * turn a successful request into a 500.
 */
export const queueEmail = (label: string, send: () => Promise<void>): void => {
  void send().catch((err) =>
    logger.error(
      { email: label, err: serializeError(err) },
      "email delivery failed",
    ),
  );
};

// Tokens go in the URL fragment (#), which browsers never send to servers or
// in Referer headers. The frontend reads location.hash and POSTs the token.
const verifyUrl = (token: string) => `${BASE_URL}/verify-email#token=${token}`;
const resetUrl = (token: string) => `${BASE_URL}/reset-password#token=${token}`;

const button = (href: string, label: string, color: string) =>
  `<a href="${href}" style="display:inline-block;padding:12px 24px;background:${color};color:#fff;border-radius:6px;text-decoration:none;font-weight:bold;">${label}</a>`;

// Booking emails include values the visitor typed (name, note), so they must be
// escaped before going into the HTML body.
const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char] ?? char);

// The API has no idea which timezone the visitor is in, so booking times are
// always shown in UTC and labelled as such instead of the server's locale.
const bookingDateFormatter = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

const formatBookingDate = (date: Date): string =>
  `${bookingDateFormatter.format(date)} UTC`;

export type BookingEmailDetails = {
  id: number;
  name: string;
  email: string;
  scheduledAt: Date[];
  /** Optional message from the admin, shown to the customer. */
  note?: string;
};

const bookingDatesHtml = (dates: Date[]): string => `
  <ul style="margin:12px 0 0;padding-left:20px;color:#333;">
    ${dates
      .map((date) => `<li style="margin-bottom:4px;">${formatBookingDate(date)}</li>`)
      .join("")}
  </ul>
`;

const bookingDatesText = (dates: Date[]): string =>
  dates.map((date) => `- ${formatBookingDate(date)}`).join("\n");

const noteHtml = (note?: string): string =>
  note
    ? `<p style="margin-top:16px;padding:12px;background:#f5f5f5;border-radius:6px;white-space:pre-line;">${escapeHtml(note)}</p>`
    : "";

const noteText = (note?: string): string => (note ? `\n\n${note}\n` : "");

export const sendBookingConfirmedEmail = async (
  booking: BookingEmailDetails,
): Promise<void> => {
  const name = escapeHtml(booking.name);

  await sendWithRetry({
    from: FROM,
    to: booking.email,
    subject: `Your ${env.APP_NAME} booking is confirmed (#${booking.id})`,
    text: `Hi ${booking.name},\n\nGood news — your ${env.APP_NAME} booking is confirmed.\n\nWhen:\n${bookingDatesText(booking.scheduledAt)}${noteText(booking.note)}\n\nIf you have any questions, just reply to this email.\n\n— ${env.APP_NAME}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;">
        <h2>Your booking is confirmed</h2>
        <p>Hi ${name},</p>
        <p>Good news — your ${env.APP_NAME} booking has been confirmed.</p>
        <p style="margin-bottom:0;"><strong>When:</strong></p>
        ${bookingDatesHtml(booking.scheduledAt)}
        ${noteHtml(booking.note)}
        <p style="margin-top:24px;">If you have any questions, just reply to this email.</p>
        <p style="margin-top:24px;color:#999;font-size:13px;">Booking reference: #${booking.id}</p>
      </div>
    `,
  });
};

export const sendBookingCancelledEmail = async (
  booking: BookingEmailDetails,
): Promise<void> => {
  const name = escapeHtml(booking.name);

  await sendWithRetry({
    from: FROM,
    to: booking.email,
    subject: `Your ${env.APP_NAME} booking has been cancelled (#${booking.id})`,
    text: `Hi ${booking.name},\n\nWe're sorry to let you know that your ${env.APP_NAME} booking has been cancelled.\n\nRequested date(s):\n${bookingDatesText(booking.scheduledAt)}${noteText(booking.note)}\n\nIf you have any questions or would like to book another date, just reply to this email.\n\n— ${env.APP_NAME}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;">
        <h2>Your booking has been cancelled</h2>
        <p>Hi ${name},</p>
        <p>We're sorry to let you know that your ${env.APP_NAME} booking has been cancelled.</p>
        <p style="margin-bottom:0;"><strong>Requested date(s):</strong></p>
        ${bookingDatesHtml(booking.scheduledAt)}
        ${noteHtml(booking.note)}
        <p style="margin-top:24px;">If you have any questions or would like to book another date, just reply to this email.</p>
        <p style="margin-top:24px;color:#999;font-size:13px;">Booking reference: #${booking.id}</p>
      </div>
    `,
  });
};

export const sendVerificationEmail = async (
  email: string,
  token: string,
): Promise<void> => {
  const url = verifyUrl(token);

  await sendWithRetry({
    from: FROM,
    to: email,
    subject: "Verify your email address",
    text: `Welcome to ${env.APP_NAME}! Verify your email (link expires in 24 hours): ${url}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;">
        <h2>Welcome to ${env.APP_NAME}!</h2>
        <p>Click the button below to verify your email. This link expires in <strong>24 hours</strong>.</p>
        ${button(url, "Verify Email", "#4F46E5")}
        <p style="margin-top:16px;color:#555;">Or copy this link:<br/>${url}</p>
        <p style="margin-top:24px;color:#999;font-size:13px;">If you didn't create an account, you can ignore this email.</p>
      </div>
    `,
  });
};

export const sendPasswordResetEmail = async (
  email: string,
  token: string,
): Promise<void> => {
  const url = resetUrl(token);

  await sendWithRetry({
    from: FROM,
    to: email,
    subject: "Reset your password",
    text: `Reset your ${env.APP_NAME} password (link expires in 15 minutes): ${url}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;">
        <h2>Password Reset Request</h2>
        <p>We received a request to reset your password. This link expires in <strong>15 minutes</strong>.</p>
        ${button(url, "Reset Password", "#DC2626")}
        <p style="margin-top:16px;color:#555;">Or paste this link in your browser:<br/>${url}</p>
        <p style="margin-top:24px;color:#999;font-size:13px;">
          If you didn't request this, you can safely ignore this email. Your password will not be changed.
        </p>
      </div>
    `,
  });
};

// Sent when someone registers with an address that already has an account.
// Tells the real owner what happened without the website revealing it.
export const sendAccountExistsEmail = async (email: string): Promise<void> => {
  await sendWithRetry({
    from: FROM,
    to: email,
    subject: `You already have a ${env.APP_NAME} account`,
    text: `Someone tried to create a ${env.APP_NAME} account with this email, but you already have one. Visit ${BASE_URL} to log in or reset your password. If this wasn't you, you can ignore this email.`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;">
        <h2>You already have an account</h2>
        <p>Someone tried to create a ${env.APP_NAME} account with this email address, but you already have one.</p>
        <p>You can <a href="${BASE_URL}">log in or reset your password</a>.</p>
        <p style="margin-top:24px;color:#999;font-size:13px;">If this wasn't you, you can ignore this email.</p>
      </div>
    `,
  });
};

export const sendPasswordChangedEmail = async (
  email: string,
): Promise<void> => {
  await sendWithRetry({
    from: FROM,
    to: email,
    subject: "Your password was changed",
    text: `The password for your ${env.APP_NAME} account was just changed and all devices were logged out. If this wasn't you, reset your password immediately at ${BASE_URL}.`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;">
        <h2>Your password was changed</h2>
        <p>The password for your ${env.APP_NAME} account was just changed, and all devices were logged out.</p>
        <p><strong>If this wasn't you</strong>, <a href="${BASE_URL}">reset your password immediately</a>.</p>
      </div>
    `,
  });
};
