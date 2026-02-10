const nodemailer = require("nodemailer");

// Create transporter with SMTP config or use dev preview
const createTransporter = () => {
  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  // If SMTP credentials are not set, use preview mode for development
  if (!smtpHost || !smtpUser || !smtpPass) {
    console.log(
      "\x1b[33m⚠️  [EmailService] SMTP not configured. Emails will be logged to console.\x1b[0m"
    );
    return null;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: process.env.SMTP_PORT || 587,
      secure: process.env.SMTP_PORT === "465",
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
      // Add timeout and connection settings
      connectionTimeout: 10000,
      greetingTimeout: 5000,
      socketTimeout: 10000,
    });

    // Verify transporter configuration
    transporter.verify((error, success) => {
      if (error) {
        console.error("\x1b[31m❌ [EmailService] SMTP connection failed:\x1b[0m", error.message);
      } else {
        console.log("\x1b[32m✅ [EmailService] SMTP connection successful - Ready to send emails\x1b[0m");
      }
    });

    return transporter;
  } catch (error) {
    console.error("\x1b[31m❌ [EmailService] Failed to create transporter:\x1b[0m", error.message);
    return null;
  }
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
    from: `"DevCollab Security" <${process.env.SMTP_USER || "noreply@devcollab.com"}>`,
    to: email,
    subject: "Reset your DevCollab password",
    html: resetPasswordTemplate(name, resetUrl),
  };

  if (!transporter) {
    console.log("\n" + "=".repeat(80));
    console.log("\x1b[36m📧 PASSWORD RESET EMAIL (Dev Mode - SMTP not configured)\x1b[0m");
    console.log("=".repeat(80));
    console.log(`To: ${email}`);
    console.log(`Subject: ${mailOptions.subject}`);
    console.log(`\x1b[32mReset URL: ${resetUrl}\x1b[0m`);
    console.log(`Token: ${resetToken.substring(0, 20)}...`);
    console.log(`Expires: 1 hour from now`);
    console.log("=".repeat(80) + "\n");
    return { preview: resetUrl };
  }

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`\x1b[32m✅ Password reset email sent to ${email}\x1b[0m`);
    console.log(`   MessageId: ${info.messageId}`);
    console.log(`   Response: ${info.response}`);
    return info;
  } catch (error) {
    console.error(`\x1b[31m❌ Failed to send password reset email to ${email}:\x1b[0m`, error.message);
    throw error; // Re-throw to let controller handle it
  }
};

const loginNotificationTemplate = (name, loginTime, ipAddress, userAgent) => {
  // Parse user agent to extract browser and OS info
  const browserInfo = userAgent || 'Unknown Browser';
  const device = /mobile/i.test(userAgent) ? '📱 Mobile Device' : '💻 Desktop/Laptop';
  
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #e4e4e7; background-color: #18181b; margin: 0; padding: 0; }
      .container { max-width: 600px; margin: 40px auto; background: #27272a; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3); }
      .header { background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); padding: 40px 32px; text-align: center; }
      .header h1 { margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; }
      .content { padding: 40px 32px; }
      .content p { margin: 0 0 16px; color: #d4d4d8; }
      .info-box { background: #18181b; border: 1px solid #3f3f46; border-radius: 8px; padding: 20px; margin: 24px 0; }
      .info-row { display: flex; justify-content: space-between; margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid #3f3f46; }
      .info-row:last-child { margin-bottom: 0; padding-bottom: 0; border-bottom: none; }
      .info-label { color: #a1a1aa; font-size: 14px; font-weight: 600; }
      .info-value { color: #e4e4e7; font-size: 14px; font-family: 'Courier New', monospace; }
      .alert { background: #7c2d12; border-left: 4px solid #ea580c; padding: 16px; margin: 24px 0; border-radius: 4px; color: #fed7aa; }
      .button { display: inline-block; background: #ef4444; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 600; margin: 16px 0; transition: background 0.2s; }
      .button:hover { background: #dc2626; }
      .footer { padding: 24px 32px; background: #18181b; text-align: center; font-size: 14px; color: #71717a; }
      .footer a { color: #22c55e; text-decoration: none; }
      .icon { font-size: 20px; margin-bottom: 8px; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <div class="icon">🔐</div>
        <h1>New Login Detected</h1>
      </div>
      <div class="content">
        <p>Hi ${name},</p>
        <p>We detected a new login to your DevCollab account. If this was you, you can safely ignore this email.</p>
        
        <div class="info-box">
          <div class="info-row">
            <span class="info-label">Login Time</span>
            <span class="info-value">${loginTime}</span>
          </div>
          <div class="info-row">
            <span class="info-label">IP Address</span>
            <span class="info-value">${ipAddress}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Device</span>
            <span class="info-value">${device}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Browser</span>
            <span class="info-value">${browserInfo.substring(0, 60)}${browserInfo.length > 60 ? '...' : ''}</span>
          </div>
        </div>

        <div class="alert">
          <strong>⚠️ Security Alert:</strong> If this wasn't you, your account may be compromised. Please reset your password immediately and review your account activity.
        </div>

        <div style="text-align: center;">
          <a href="${process.env.CLIENT_ORIGIN}/forgot-password" class="button">Reset Password Immediately</a>
        </div>

        <p style="font-size: 14px; color: #a1a1aa; margin-top: 24px;">
          For your security, we recommend using a strong, unique password and enabling two-factor authentication if available.
        </p>
      </div>
      <div class="footer">
        <p>Questions? <a href="${process.env.CLIENT_ORIGIN}/support">Contact Support</a></p>
        <p>&copy; ${new Date().getFullYear()} DevCollab. All rights reserved.</p>
      </div>
    </div>
  </body>
  </html>
`;
};

const sendLoginNotificationEmail = async (email, name, loginDetails) => {
  const { timestamp, ipAddress, userAgent } = loginDetails;
  
  const mailOptions = {
    from: `"DevCollab Security" <${process.env.SMTP_USER || "security@devcollab.com"}>`,
    to: email,
    subject: "New Login Detected — DevCollab",
    html: loginNotificationTemplate(name, timestamp, ipAddress, userAgent),
  };

  if (!transporter) {
    console.log("\n" + "=".repeat(80));
    console.log("\x1b[36m🔒 LOGIN NOTIFICATION EMAIL (Dev Mode - SMTP not configured)\x1b[0m");
    console.log("=".repeat(80));
    console.log(`To: ${email}`);
    console.log(`Subject: ${mailOptions.subject}`);
    console.log(`Login Time: ${timestamp}`);
    console.log(`IP Address: ${ipAddress}`);
    console.log(`User Agent: ${userAgent.substring(0, 60)}...`);
    console.log("=".repeat(80) + "\n");
    return { preview: true };
  }

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`\x1b[32m🔒 Login notification sent to ${email}\x1b[0m`);
    console.log(`   MessageId: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error(`\x1b[31m❌ Failed to send login notification to ${email}:\x1b[0m`, error.message);
    // Don't throw - we don't want to block login if email fails
    return null;
  }
};

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendLoginNotificationEmail,
};
