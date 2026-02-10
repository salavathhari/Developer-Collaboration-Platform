const nodemailer = require("nodemailer");

// Create transporter with SMTP config or use dev preview
const createTransporter = () => {
  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  // If SMTP credentials are not set, use preview mode for development
  if (!smtpHost || !smtpUser || !smtpPass) {
    console.log(
      "[EmailService] SMTP not configured. Emails will be logged to console."
    );
    return null;
  }

  return nodemailer.createTransport({
    host: smtpHost,
    port: process.env.SMTP_PORT || 587,
    secure: process.env.SMTP_PORT === "465",
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });
};

const transporter = createTransporter();

const verificationTemplate = (name, verificationUrl) => `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #e4e4e7; background-color: #18181b; margin: 0; padding: 0; }
      .container { max-width: 600px; margin: 40px auto; background: #27272a; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3); }
      .header { background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); padding: 40px 32px; text-align: center; }
      .header h1 { margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; }
      .content { padding: 40px 32px; }
      .content p { margin: 0 0 16px; color: #d4d4d8; }
      .button { display: inline-block; background: #8b5cf6; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; margin: 24px 0; transition: background 0.2s; }
      .button:hover { background: #7c3aed; }
      .footer { padding: 24px 32px; background: #18181b; text-align: center; font-size: 14px; color: #71717a; }
      .footer a { color: #8b5cf6; text-decoration: none; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>🎉 Welcome to DevCollab</h1>
      </div>
      <div class="content">
        <p>Hi ${name},</p>
        <p>Thanks for signing up! We're excited to have you on board.</p>
        <p>To get started, please verify your email address by clicking the button below:</p>
        <div style="text-align: center;">
          <a href="${verificationUrl}" class="button">Verify Email Address</a>
        </div>
        <p style="font-size: 14px; color: #a1a1aa;">This link will expire in 24 hours. If you didn't create an account, you can safely ignore this email.</p>
      </div>
      <div class="footer">
        <p>Need help? <a href="${process.env.CLIENT_ORIGIN}/support">Contact Support</a></p>
        <p>&copy; ${new Date().getFullYear()} DevCollab. All rights reserved.</p>
      </div>
    </div>
  </body>
  </html>
`;

const resetPasswordTemplate = (name, resetUrl) => `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #e4e4e7; background-color: #18181b; margin: 0; padding: 0; }
      .container { max-width: 600px; margin: 40px auto; background: #27272a; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3); }
      .header { background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); padding: 40px 32px; text-align: center; }
      .header h1 { margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; }
      .content { padding: 40px 32px; }
      .content p { margin: 0 0 16px; color: #d4d4d8; }
      .button { display: inline-block; background: #8b5cf6; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; margin: 24px 0; transition: background 0.2s; }
      .button:hover { background: #7c3aed; }
      .footer { padding: 24px 32px; background: #18181b; text-align: center; font-size: 14px; color: #71717a; }
      .footer a { color: #8b5cf6; text-decoration: none; }
      .alert { background: #422006; border-left: 4px solid #ea580c; padding: 12px 16px; margin: 16px 0; border-radius: 4px; color: #fed7aa; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>🔐 Reset Your Password</h1>
      </div>
      <div class="content">
        <p>Hi ${name},</p>
        <p>We received a request to reset your password for your DevCollab account.</p>
        <p>Click the button below to create a new password:</p>
        <div style="text-align: center;">
          <a href="${resetUrl}" class="button">Reset Password</a>
        </div>
        <div class="alert">
          <strong>⚠️ Security Notice:</strong> This link will expire in 1 hour. If you didn't request a password reset, please ignore this email or contact support if you have concerns.
        </div>
      </div>
      <div class="footer">
        <p>Need help? <a href="${process.env.CLIENT_ORIGIN}/support">Contact Support</a></p>
        <p>&copy; ${new Date().getFullYear()} DevCollab. All rights reserved.</p>
      </div>
    </div>
  </body>
  </html>
`;

const sendVerificationEmail = async (email, name, verificationToken) => {
  const verificationUrl = `${process.env.CLIENT_ORIGIN}/verify-email?token=${verificationToken}`;

  const mailOptions = {
    from: `"DevCollab" <${process.env.SMTP_USER || "noreply@devcollab.com"}>`,
    to: email,
    subject: "Verify your DevCollab account",
    html: verificationTemplate(name, verificationUrl),
  };

  if (!transporter) {
    console.log("\n" + "=".repeat(80));
    console.log("📧 VERIFICATION EMAIL (Dev Mode - SMTP not configured)");
    console.log("=".repeat(80));
    console.log(`To: ${email}`);
    console.log(`Subject: ${mailOptions.subject}`);
    console.log(`Verification URL: ${verificationUrl}`);
    console.log("=".repeat(80) + "\n");
    return { preview: verificationUrl };
  }

  const info = await transporter.sendMail(mailOptions);
  console.log(`✅ Verification email sent to ${email} (MessageId: ${info.messageId})`);
  return info;
};

const sendPasswordResetEmail = async (email, name, resetToken) => {
  const resetUrl = `${process.env.CLIENT_ORIGIN}/reset-password?token=${resetToken}`;

  const mailOptions = {
    from: `"DevCollab" <${process.env.SMTP_USER || "noreply@devcollab.com"}>`,
    to: email,
    subject: "Reset your DevCollab password",
    html: resetPasswordTemplate(name, resetUrl),
  };

  if (!transporter) {
    console.log("\n" + "=".repeat(80));
    console.log("📧 PASSWORD RESET EMAIL (Dev Mode - SMTP not configured)");
    console.log("=".repeat(80));
    console.log(`To: ${email}`);
    console.log(`Subject: ${mailOptions.subject}`);
    console.log(`Reset URL: ${resetUrl}`);
    console.log("=".repeat(80) + "\n");
    return { preview: resetUrl };
  }

  const info = await transporter.sendMail(mailOptions);
  console.log(`✅ Password reset email sent to ${email} (MessageId: ${info.messageId})`);
  return info;
};

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
};
