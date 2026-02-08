const nodemailer = require("nodemailer");
const logger = require("./logger");

const createTransporter = () => {
  // If credentials are present, use them
  if (process.env.EMAIL_SMTP_HOST && process.env.EMAIL_SMTP_USER) {
    console.log("Creating email transporter with:", process.env.EMAIL_SMTP_HOST, process.env.EMAIL_SMTP_USER);
    return nodemailer.createTransport({
      host: process.env.EMAIL_SMTP_HOST,
      port: process.env.EMAIL_SMTP_PORT || 587,
      secure: process.env.EMAIL_SMTP_SECURE === "true",
      auth: {
        user: process.env.EMAIL_SMTP_USER,
        pass: process.env.EMAIL_SMTP_PASS,
      },
    });
  }
  
  console.log("Email credentials missing. Falling back to simulation.");
  // Minimal fallback or no-op logger if no creds
  // In a real dev environment, we might use ethereal.email, but for now we'll just log
  return null;
};

const sendEmail = async ({ to, subject, html }) => {
  const transporter = createTransporter();
  
  if (!transporter) {
    logger.info({ to, subject }, "Email simulation (SMTP not configured):");
    console.log(`[EMAIL to ${to}]: ${subject}\n${html}`);
    return;
  }

  try {
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || '"DevCollab" <noreply@devcollab.com>',
      to,
      subject,
      html,
    });
    logger.info({ messageId: info.messageId }, "Email sent");
    console.log(`Email successfully sent to ${to}. Message ID: ${info.messageId}`);
    return info;
  } catch (error) {
    logger.error({ err: error.message }, "Failed to send email");
    console.error("FAILED TO SEND EMAIL. Error details:", error);
    // Don't throw if email fails, just log it so the flow continues? 
    // Or throw if "realtime" usage implies reliability. 
    // Let's log but treat as soft fail unless critical.
    throw error; 
  }
};

module.exports = { sendEmail };
