# Authentication Security Features - DevCollab

This document explains the two critical authentication security features implemented in DevCollab:

## Table of Contents
1. [Feature 1: Forgot Password System](#feature-1-forgot-password-system)
2. [Feature 2: Login Notification Email](#feature-2-login-notification-email)
3. [Setup Instructions](#setup-instructions)
4. [Security Best Practices](#security-best-practices)

---

## Feature 1: Forgot Password System

### Overview
Allows users to securely reset their password via email verification with time-limited tokens.

### Backend Implementation

#### Endpoints

**1. Request Password Reset**
```
POST /api/auth/request-password-reset
```

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "message": "If an account exists with that email, a password reset link has been sent."
}
```

**Security Features:**
- ✅ **Email Enumeration Protection**: Always returns success, never reveals if email exists
- ✅ **Rate Limited**: 20 requests per minute per IP
- ✅ **Token Expiry**: Reset tokens expire after 1 hour
- ✅ **Token Revocation**: Old tokens are revoked when new one is requested
- ✅ **Secure Token Generation**: `crypto.randomBytes(32)` with SHA-256 hashing

**Process:**
1. User submits email
2. System checks if user exists (silently)
3. Generates secure 64-character hex token
4. Hashes token with SHA-256 before storing in `AuthToken` collection
5. Sends email with reset link containing plain token
6. Returns same success message regardless of user existence

---

**2. Reset Password**
```
POST /api/auth/reset-password
```

**Request Body:**
```json
{
  "token": "4a8f3c2e1d9b7c6a5e4f3d2c1b0a9e8d7c6b5a4f3e2d1c0b9a8e7d6c5b4a3f",
  "newPassword": "NewSecure123!"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Password has been reset successfully. Please log in with your new password."
}
```

**Password Requirements:**
- ✅ Minimum 8 characters
- ✅ At least one uppercase letter
- ✅ At least one number
- ✅ At least one special character (!@#$%^&*(),.?":{}|<>)

**Security Features:**
- ✅ **Token Validation**: Checks token hash matches stored hash
- ✅ **Expiry Check**: Verifies token hasn't expired (1 hour limit)
- ✅ **Password Strength Validation**: Enforces strong password policy
- ✅ **Bcrypt Hashing**: New password hashed with cost factor 12
- ✅ **Session Invalidation**: All refresh tokens revoked after password reset
- ✅ **Token Single-Use**: Reset token marked as revoked after use

**Process:**
1. User clicks email link with token parameter
2. Frontend sends token + new password
3. Backend hashes token and finds matching record
4. Validates token hasn't expired
5. Validates new password strength
6. Hashes new password with bcrypt (cost: 12)
7. Updates user password
8. Revokes reset token
9. Revokes all user's refresh tokens (forces re-login everywhere)

---

#### Email Service Implementation

**File:** `server/src/utils/emailService.js`

**Password Reset Email Template Features:**
- 🎨 Professional HTML design with dark theme
- 🔒 Security warning about link expiry (1 hour)
- 🔗 One-click reset button
- 🚨 Alert if request wasn't made by user
- 📱 Responsive design for mobile

**Email Configuration:**
```javascript
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,        // e.g., smtp.gmail.com
  port: process.env.SMTP_PORT || 587, // 587 for TLS, 465 for SSL
  secure: process.env.SMTP_PORT === "465",
  auth: {
    user: process.env.SMTP_USER,      // your-email@gmail.com
    pass: process.env.SMTP_PASS,      // app-specific password
  },
});
```

**Development Mode:**
If SMTP is not configured, emails are logged to console with reset URLs for testing.

---

### Frontend Implementation

#### Pages

**1. Forgot Password Page**
- **Route:** `/forgot-password`
- **File:** `client/src/pages/ForgotPassword.tsx`

**Features:**
- ✅ Email validation
- ✅ Loading state with spinner
- ✅ Success confirmation screen
- ✅ Error handling
- ✅ Link back to login

**User Flow:**
1. User enters email
2. Clicks "Send Reset Link"
3. Sees loading spinner
4. Receives confirmation message
5. Checks email for reset link

---

**2. Reset Password Page**
- **Route:** `/reset-password?token=...`
- **File:** `client/src/pages/ResetPassword.tsx`

**Features:**
- ✅ Password strength indicator
- ✅ Confirm password validation
- ✅ Show/hide password toggle
- ✅ Token validation
- ✅ Auto-redirect to login after success
- ✅ Expiry handling

**User Flow:**
1. User clicks link from email
2. Enters new password
3. Confirms password
4. Submits form
5. Sees success message
6. Auto-redirected to login (3 seconds)

---

## Feature 2: Login Notification Email

### Overview
Automatically sends security notification email every time a user successfully logs in.

### Backend Implementation

#### Email Sending Logic

**File:** `server/src/controllers/authController.js`

**Location:** Inside `login()` function, after successful authentication

```javascript
// Send login notification email (async, non-blocking)
const loginDetails = {
  timestamp: new Date().toLocaleString('en-US', { 
    timeZone: 'UTC',
    dateStyle: 'full',
    timeStyle: 'long'
  }),
  ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'Unknown',
  userAgent: req.headers['user-agent'] || 'Unknown Browser',
};

// Send email asynchronously - don't block the response
sendLoginNotificationEmail(user.email, user.name, loginDetails)
  .catch(err => console.error('Login notification email failed:', err));
```

**Key Features:**
- ⚡ **Non-Blocking**: Email sent asynchronously, doesn't delay login response
- 🔍 **IP Tracking**: Captures user's IP address
- 🖥️ **Device Detection**: Logs browser and device information
- ⏰ **Timestamp**: Records exact login time in UTC
- 🛡️ **Error Resilience**: Email failure doesn't break login flow

---

#### Email Template

**File:** `server/src/utils/emailService.js`

**Function:** `loginNotificationTemplate(name, loginTime, ipAddress, userAgent)`

**Email Content:**
```
Subject: New Login Detected — DevCollab

Hi [Name],

We detected a new login to your DevCollab account.

Login Details:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Login Time:    [Full timestamp]
IP Address:    [xxx.xxx.xxx.xxx]
Device:        💻 Desktop/Laptop or 📱 Mobile
Browser:       [User agent string]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ Security Alert:
If this wasn't you, your account may be compromised.
Please reset your password immediately.

[Reset Password Button]
```

**Design Features:**
- 🎨 Modern dark theme with green success gradient
- 🔐 Security-focused branding
- 📊 Formatted info box with login details
- 🚨 Prominent security warning
- 🔴 Red "Reset Password" button for urgency
- 📱 Mobile-responsive design

---

#### Device Detection

```javascript
const device = /mobile/i.test(userAgent) ? '📱 Mobile Device' : '💻 Desktop/Laptop';
```

Automatically detects and displays appropriate icon based on device type.

---

### Frontend Impact

**No UI Changes Required** ✅

Login notification happens silently in the background. Users only see:
1. Successful login to dashboard
2. Email in their inbox moments later

---

## Setup Instructions

### 1. Environment Variables

Add to `server/.env`:

```bash
# Email Configuration (Gmail Example)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-specific-password

# Client URL for email links
CLIENT_ORIGIN=http://localhost:3000

# JWT Secrets (if not already set)
JWT_ACCESS_SECRET=your-secret-key-here
JWT_REFRESH_SECRET=your-refresh-secret-key-here

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000  # 1 minute
RATE_LIMIT_MAX=20           # 20 requests per window
```

---

### 2. Gmail Setup (If Using Gmail)

1. **Enable 2-Factor Authentication** on your Google account
2. **Generate App Password:**
   - Go to Google Account → Security → 2-Step Verification
   - Scroll to "App passwords"
   - Select "Mail" and your device
   - Copy the 16-character password
3. **Use App Password** as `SMTP_PASS` in `.env`

---

### 3. Testing Without SMTP (Development)

If SMTP is not configured:
- ✅ Emails are logged to console
- ✅ Reset URLs printed for manual testing
- ✅ Login notifications shown in terminal

**Example Console Output:**
```
================================================================================
🔒 LOGIN NOTIFICATION EMAIL (Dev Mode - SMTP not configured)
================================================================================
To: user@example.com
Subject: New Login Detected — DevCollab
Login Time: Saturday, February 10, 2026 at 3:45:30 PM UTC
IP Address: ::1
User Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64)...
================================================================================
```

---

### 4. Install Dependencies

Ensure these packages are installed:

```bash
cd server
npm install nodemailer bcrypt jsonwebtoken express-rate-limit crypto
```

---

### 5. Database Setup

The system uses the `AuthToken` model which should already exist:

```javascript
// server/src/models/AuthToken.js
{
  userId: ObjectId,
  tokenHash: String,        // SHA-256 hashed token
  type: String,             // "refresh" | "verify" | "reset"
  expiresAt: Date,
  revokedAt: Date,
}
```

**Indexes:**
- Compound index: `{ userId: 1, type: 1 }`
- TTL index: `{ expiresAt: 1 }` (auto-delete expired tokens)

---

## Security Best Practices

### ✅ Implemented Security Measures

1. **Rate Limiting**
   - 20 requests per minute per IP on all auth endpoints
   - Prevents brute force attacks
   - Uses `express-rate-limit` middleware

2. **Token Security**
   - Cryptographically secure random generation (`crypto.randomBytes(32)`)
   - Tokens hashed before storage (SHA-256)
   - Short expiry times (1 hour for reset, 24h for verify)
   - Single-use tokens (marked as revoked after use)

3. **Password Security**
   - Bcrypt hashing with cost factor 12
   - Strong password requirements enforced
   - Never stored in plain text
   - Never logged or exposed in responses

4. **Email Enumeration Protection**
   - Same response whether email exists or not
   - Prevents attackers from discovering valid accounts

5. **Session Management**
   - All refresh tokens revoked on password reset
   - Forces re-authentication on all devices
   - HTTP-only cookies for refresh tokens

6. **Input Validation**
   - Email format validation
   - Password strength requirements
   - Token format verification

7. **Error Handling**
   - Generic error messages to users
   - Detailed logs on server (not exposed)
   - Email failures don't break auth flow

---

### 🚀 Additional Recommendations

1. **HTTPS in Production**
   - Always use HTTPS for password reset links
   - Set `secure: true` on cookies in production

2. **IP Monitoring**
   - Log suspicious patterns (many failed resets)
   - Consider blocking IPs with excessive requests

3. **Email Security**
   - Use dedicated email domain for sending
   - Configure SPF, DKIM, DMARC records
   - Monitor bounce rates

4. **Token Rotation**
   - Consider rotating refresh tokens on each use
   - Implement token family tracking

5. **Account Lockout**
   - Lock account after N failed login attempts
   - Require email verification to unlock

6. **Two-Factor Authentication**
   - Consider adding TOTP 2FA
   - Use authenticator apps

---

## Testing Checklist

### Forgot Password Flow

- [ ] User can request password reset
- [ ] Email is received with valid link
- [ ] Token works within 1 hour
- [ ] Token expires after 1 hour
- [ ] Token only works once
- [ ] New token revokes old tokens
- [ ] Password requirements are enforced
- [ ] User can login with new password
- [ ] Old password no longer works
- [ ] All sessions are logged out after reset

### Login Notification Flow

- [ ] Email sent after successful login
- [ ] Email contains correct timestamp
- [ ] IP address is captured
- [ ] Browser/device info is shown
- [ ] Email doesn't block login response
- [ ] Email failure doesn't break login
- [ ] Reset password link works in notification

---

## Troubleshooting

### Email Not Sending

1. **Check SMTP credentials** in `.env`
2. **Verify Gmail App Password** (not regular password)
3. **Check console** for error messages
4. **Test with mailtrap.io** for development

```bash
# Example mailtrap.io config
SMTP_HOST=smtp.mailtrap.io
SMTP_PORT=2525
SMTP_USER=your-mailtrap-username
SMTP_PASS=your-mailtrap-password
```

### Reset Link Not Working

1. **Check token in URL** is complete
2. **Verify not expired** (1 hour limit)
3. **Check token not already used**
4. **Confirm CLIENT_ORIGIN** matches frontend URL

### Login Notification Not Received

1. **Check spam folder**
2. **Verify SMTP_USER** email is correct
3. **Check server logs** for email errors
4. **Non-critical**: Login still works even if email fails

---

## API Reference

### POST /api/auth/request-password-reset

**Body:**
```json
{ "email": "user@example.com" }
```

**Success:** `200 OK`
```json
{
  "success": true,
  "message": "If an account exists with that email, a password reset link has been sent."
}
```

**Errors:**
- `400`: Invalid request (missing email)
- `500`: Server error

---

### POST /api/auth/reset-password

**Body:**
```json
{
  "token": "4a8f3c2e...",
  "newPassword": "NewSecure123!"
}
```

**Success:** `200 OK`
```json
{
  "success": true,
  "message": "Password has been reset successfully. Please log in with your new password."
}
```

**Errors:**
- `400`: Invalid token, expired token, or weak password
- `404`: User not found
- `500`: Server error

---

## File Structure

```
server/
├── src/
│   ├── controllers/
│   │   └── authController.js       # Login + password reset logic
│   ├── models/
│   │   ├── User.js                 # User model
│   │   └── AuthToken.js            # Token storage
│   ├── routes/
│   │   └── auth.js                 # Auth endpoints with rate limiting
│   ├── utils/
│   │   └── emailService.js         # Email templates + sending
│   └── middleware/
│       └── authMiddleware.js       # JWT verification

client/
├── src/
│   ├── pages/
│   │   ├── ForgotPassword.tsx      # Reset request page
│   │   └── ResetPassword.tsx       # New password page
│   ├── components/
│   │   ├── EmailInput.tsx          # Email input with validation
│   │   ├── PasswordInput.tsx       # Password input with strength meter
│   │   └── AuthLayout.tsx          # Shared auth page layout
│   ├── services/
│   │   ├── authService.ts          # Auth API calls
│   │   └── api.ts                  # Axios instance with interceptors
│   └── App.tsx                     # Route configuration
```

---

## Production Deployment Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Use production SMTP service (SendGrid, AWS SES, Mailgun)
- [ ] Enable HTTPS/SSL
- [ ] Set secure cookie flags
- [ ] Configure rate limiting for production scale
- [ ] Set up email monitoring/alerting
- [ ] Configure proper CORS origins
- [ ] Use environment-specific CLIENT_ORIGIN
- [ ] Enable Helmet middleware for security headers
- [ ] Set up logging/monitoring (Sentry, LogRocket)
- [ ] Test email deliverability
- [ ] Monitor email bounce rates
- [ ] Set up IP whitelisting if needed

---

## Support

For issues or questions:
- Check server logs (`console.log` output)
- Verify environment variables are loaded
- Test with development email service (mailtrap.io)
- Review rate limit settings if requests are blocked

---

**Last Updated:** February 10, 2026  
**Version:** 1.0.0  
**Status:** ✅ Production Ready
