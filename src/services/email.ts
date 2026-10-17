import nodemailer from "nodemailer";
import { env } from "../configs/env.ts";

const transporter = nodemailer.createTransport({
  service: "Gmail",
  auth: {
    user: env.EMAIL_USER,
    pass: env.EMAIL_PASS, // Use an App Password, not your real password
  },
});

const sendVerificationEmail = async (
  email: string,
  token: string,
): Promise<void> => {
  const verifyUrl = `${env.CLIENT_URL}/verify-email?token=${encodeURIComponent(token)}`;

  await transporter.sendMail({
    from: `"PERN Email Test" <${env.EMAIL_USER}>`,
    to: email,
    subject: "Verify your email address",
    html: `
        <h2>Welcome!</h2>
        <p>Click the button below to verify your email. This link expires in <strong>24 hours</strong>.</p>
        <a href="${verifyUrl}" style="padding:10px 20px;background:#4F46E5;color:#fff;border-radius:5px;text-decoration:none;">
          Verify Email
        </a>
        <p>Or copy this link: ${verifyUrl}</p>
      `,
  });
};

const sendPasswordResetEmail = async (
  email: string,
  token: string,
): Promise<void> => {
  const resetUrl = `${env.CLIENT_URL}/reset-password?token=${encodeURIComponent(token)}`;

  await transporter.sendMail({
    from: `"MyApp" <${env.EMAIL_USER}>`,
    to: email,
    subject: "Reset your password",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;">
        <h2>Password Reset Request 🔐</h2>
        <p>We received a request to reset your password. Click below to proceed.
           This link expires in <strong>15 minutes</strong>.</p>
        <a href="${resetUrl}"
           style="display:inline-block;padding:12px 24px;background:#DC2626;
                  color:#fff;border-radius:6px;text-decoration:none;font-weight:bold;">
          Reset Password
        </a>
        <p style="margin-top:16px;color:#555;">
          Or paste this link in your browser:<br/>
          <a href="${resetUrl}">${resetUrl}</a>
        </p>
        <p style="margin-top:24px;color:#999;font-size:13px;">
          If you didn't request this, you can safely ignore this email.
          Your password will not be changed.
        </p>
      </div>
    `,
  });
};

export { sendVerificationEmail, sendPasswordResetEmail };
