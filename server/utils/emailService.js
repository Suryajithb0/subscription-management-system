const nodemailer = require('nodemailer');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

/**
 * Creates Nodemailer transporter if SMTP environment variables are configured
 */
const getTransporter = () => {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const port = Number(process.env.SMTP_PORT) || 587;

  // Check if SMTP is configured
  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass
    }
  });
};

/**
 * Send password reset email
 * Returns { delivered: boolean, error?: string, notice?: string }
 */
const sendPasswordResetEmail = async ({ to, resetToken, resetUrl }) => {
  const transporter = getTransporter();

  if (!transporter) {
    console.info(`[Email Service Notice] SMTP credentials are not configured in environment variables.`);
    console.info(`[Email Service Notice] To enable email delivery, set SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS in server/.env.`);
    console.info(`[Email Service Notice] Password reset token generated for ${to}: ${resetToken}`);
    return {
      delivered: false,
      reason: 'SMTP configuration unavailable. Email delivery was skipped.'
    };
  }

  const fromAddress = process.env.SMTP_FROM || '"SubFlow Platform" <no-reply@subflow.io>';
  const subject = 'SubFlow - Password Reset Request';
  const textContent = `You recently requested to reset your password for your SubFlow account.\n\nUse the following link to reset your password:\n${resetUrl}\n\nThis link is valid for 1 hour. If you did not request this, please ignore this email.\n`;
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
      <h2 style="color: #4f46e5; margin-bottom: 16px;">SubFlow Password Reset</h2>
      <p style="color: #334155; line-height: 1.6;">You recently requested to reset your password for your SubFlow account.</p>
      <p style="color: #334155; line-height: 1.6;">Click the button below to choose a new password. This link will expire in <strong>1 hour</strong>.</p>
      <div style="margin: 28px 0;">
        <a href="${resetUrl}" style="background-color: #6366f1; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
          Reset Password
        </a>
      </div>
      <p style="color: #64748b; font-size: 13px;">Or copy and paste this link into your browser:</p>
      <p style="color: #64748b; font-size: 12px; word-break: break-all;">${resetUrl}</p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
      <p style="color: #94a3b8; font-size: 12px;">If you did not request this password reset, please ignore this email or contact support if you have concerns.</p>
    </div>
  `;

  try {
    const info = await transporter.sendMail({
      from: fromAddress,
      to,
      subject,
      text: textContent,
      html: htmlContent
    });

    return {
      delivered: true,
      messageId: info.messageId
    };
  } catch (error) {
    console.error(`[Email Service Error] Failed to send email via SMTP to ${to}: ${error.message}`);
    return {
      delivered: false,
      error: error.message
    };
  }
};

module.exports = {
  sendPasswordResetEmail,
  getTransporter
};
