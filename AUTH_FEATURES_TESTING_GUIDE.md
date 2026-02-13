# 🔐 Authentication Features - Testing & Verification Guide

## ✅ What's Implemented

### Feature 1: Password Reset System
- ✅ `/api/auth/forgot-password` endpoint (alias)
- ✅ `/api/auth/request-password-reset` endpoint (original)
- ✅ `/api/auth/reset-password` endpoint
- ✅ Secure token generation (crypto.randomBytes)
- ✅ SHA-256 token hashing
- ✅ 1-hour token expiry
- ✅ Email enumeration protection
- ✅ Rate limiting (20 req/min)
- ✅ Professional HTML email templates
- ✅ Frontend pages: `/forgot-password`, `/reset-password`

### Feature 2: Login Notification Email
- ✅ Automatic email on every login
- ✅ IP address tracking
- ✅ Browser/device detection
- ✅ UTC timestamp logging
- ✅ Async non-blocking implementation
- ✅ HTML email template with security warning

---

## 🚀 Quick Start - How to Test

### Step 1: Start Both Servers

**Terminal 1 - Backend:**
```bash
cd server
npm start
```

**Terminal 2 - Frontend:**
```bash
cd client
npm run dev
```

Wait for the startup messages:
- Backend: Look for `✅ [EmailService] SMTP connection successful`
- Frontend: Usually on `http://localhost:5173`

---

### Step 2: Verify SMTP Connection

When the server starts, check for:

**✅ SUCCESS (Green text):**
```
✅ [EmailService] SMTP connection successful - Ready to send emails
```

**❌ ERROR (Red text):**
```
❌ [EmailService] SMTP connection failed: Invalid login credentials
```
→ If you see this, check your `.env` file for correct SMTP credentials

**⚠️ DEV MODE (Yellow text):**
```
⚠️ [EmailService] SMTP not configured. Emails will be logged to console.
```
→ Emails will be printed to console instead of sent

---

## 🧪 Test Scenarios

### Test 1: Password Reset Flow (Happy Path)

**Prerequisites:**
- User must exist in database
- User email: Check your registered accounts

**Steps:**

1. **Go to Forgot Password page:**
   ```
   http://localhost:5173/forgot-password
   ```

2. **Enter registered email:**
   - Example: `salavathhari286@gmail.com`
   - Click "Send Reset Link"

3. **Check Server Console:**
   
   You should see:
   ```
   [Auth] Password reset requested for: salavathhari286@gmail.com
   [Auth] User found: John Doe (507f1f77bcf86cd799439011)
   [Auth] Reset token created, expires in 1 hour
   ✅ Password reset email sent to salavathhari286@gmail.com
      MessageId: <...@gmail.com>
      Response: 250 2.0.0 OK ...
   [Auth] Password reset email sent successfully
   ```

4. **Check Email Inbox:**
   - Open Gmail: `salavathhari286@gmail.com`
   - Look for email from "DevCollab Security"
   - Subject: "Reset your DevCollab password"
   - **Check spam folder** if not in inbox

5. **Click Reset Link:**
   - Link format: `http://localhost:5173/reset-password?token=abc123...`
   - Or click the "Reset Password" button in email

6. **Enter New Password:**
   - Must be 8+ characters
   - Must contain: uppercase, number, special character
   - Example: `NewPassword123!`
   - Confirm password

7. **Submit & Verify:**
   
   Server console shows:
   ```
   [Auth] Password reset attempt with token
   [Auth] Valid token found for user: John Doe (john@example.com)
   [Auth] Password updated successfully
   [Auth] All refresh tokens revoked for user security
   ```

8. **Login with New Password:**
   - Go to: `http://localhost:5173/login`
   - Use new password
   - Should work! ✅

---

### Test 2: Expired Token

1. Request password reset
2. **Wait 1 hour** (or manually update token expiry in DB)
3. Try to use the link
4. Should see: "Reset token has expired"

---

### Test 3: Email Not Found

1. Go to forgot password page
2. Enter email that doesn't exist: `nonexistent@example.com`
3. Still shows success message (security feature)
4. Server console shows:
   ```
   [Auth] Password reset - User not found: nonexistent@example.com
   ```
5. No email is sent ✅

---

### Test 4: Login Notification Email

**Steps:**

1. **Login to DevCollab:**
   ```
   http://localhost:5173/login
   ```
   - Use existing credentials
   - Click "Sign In"

2. **Check Server Console:**
   
   Look for:
   ```
   [Auth] Login successful for: john@example.com
      IP: ::1
      Device: Mozilla/5.0 (Windows NT 10.0; Win64; x64)...
   🔒 Login notification sent to john@example.com
      MessageId: <...@gmail.com>
   ```

3. **Check Email:**
   - Should receive "New Login Detected — DevCollab"
   - Shows:
     - Login time (UTC)
     - IP address
     - Browser/device
     - Security warning
     - "Reset Password" button

4. **Verify Login Still Works:**
   - Login should complete normally
   - Email sending happens in background
   - No delay or blocking ✅

---

### Test 5: Dev Mode (No SMTP)

If SMTP is not configured, emails are logged to console:

**Password Reset Example:**
```
================================================================================
📧 PASSWORD RESET EMAIL (Dev Mode - SMTP not configured)
================================================================================
To: john@example.com
Subject: Reset your DevCollab password
Reset URL: http://localhost:5173/reset-password?token=abc123...
Token: abc123def456ghi789jk...
Expires: 1 hour from now
================================================================================
```

**Login Notification Example:**
```
================================================================================
🔒 LOGIN NOTIFICATION EMAIL (Dev Mode - SMTP not configured)
================================================================================
To: john@example.com
Subject: New Login Detected — DevCollab
Login Time: Saturday, February 10, 2026 at 3:45:30 PM UTC
IP Address: ::1
User Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64)...
================================================================================
```

**Copy the reset URL** from console and paste in browser to test!

---

## 🐛 Troubleshooting

### Problem: "404 Not Found" Error

**Cause:** Vite proxy not forwarding requests

**Solution:**
1. Check `client/vite.config.ts` has proxy config:
   ```typescript
   server: {
     proxy: {
       '/api': {
         target: 'http://localhost:5000',
         changeOrigin: true,
       }
     }
   }
   ```
2. Restart Vite dev server

---

### Problem: No Email Received

**Check 1: Server Console**
```
✅ Password reset email sent to user@example.com
```
→ Email was sent successfully

**Check 2: Gmail Spam Folder**
→ Gmail might filter automated emails

**Check 3: SMTP Credentials**
```bash
# In server/.env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=yourapppassword  # NO SPACES!
```

**Check 4: Gmail App Password**
- Must use App Password, not regular Gmail password
- Enable 2FA first
- Generate at: https://myaccount.google.com/apppasswords

**Check 5: CLIENT_ORIGIN**
```bash
# In server/.env
CLIENT_ORIGIN=http://localhost:5173
```
→ Must match frontend URL for reset links

---

### Problem: "Invalid login credentials"

**Cause:** Wrong Gmail app password

**Solution:**
1. Go to Google Account → Security
2. Enable 2-Factor Authentication
3. Go to App Passwords
4. Generate new password for "Mail"
5. Copy 16-character password (remove spaces!)
6. Update `.env`:
   ```bash
   SMTP_PASS=abcdefghijklmnop  # No spaces!
   ```
7. Restart server

---

### Problem: "Failed to execute 'json' on 'Response'"

**Cause:** Server returned non-JSON response (404, 500)

**Already Fixed:** Frontend now has error handling:
```typescript
let data;
try {
  data = await response.json();
} catch (jsonError) {
  throw new Error("Server returned invalid response");
}
```

---

### Problem: Token Always Expired

**Check:** System clock synchronization
```bash
# Windows
w32tm /query /status
```

**Fix:** Ensure server and client clocks are synchronized

---

## 📊 Monitoring & Logs

### Successful Password Reset Flow:
```
[Auth] Password reset requested for: user@example.com
[Auth] User found: John Doe (507f1f77bcf86cd799439011)
[Auth] Reset token created, expires in 1 hour
✅ Password reset email sent to user@example.com
   MessageId: <xxxxx@gmail.com>
   Response: 250 2.0.0 OK
[Auth] Password reset email sent successfully
```

Later...

```
[Auth] Password reset attempt with token
[Auth] Valid token found for user: John Doe (user@example.com)
[Auth] Password updated successfully
[Auth] All refresh tokens revoked for user security
```

### Successful Login with Notification:
```
[Auth] Login successful for: user@example.com
   IP: 192.168.1.100
   Device: Mozilla/5.0 (Windows NT 10.0; Win64; x64)...
🔒 Login notification sent to user@example.com
   MessageId: <xxxxx@gmail.com>
```

---

## 🔒 Security Features Verified

| Feature | Status | Test Method |
|---------|--------|-------------|
| Rate limiting | ✅ | Try 21+ requests in 1 minute |
| Email enumeration protection | ✅ | Enter non-existent email |
| Token expiry (1 hour) | ✅ | Wait 1 hour, try token |
| Token single-use | ✅ | Use token twice |
| Password strength validation | ✅ | Try weak password |
| Bcrypt hashing (cost 12) | ✅ | Check DB password field |
| Token SHA-256 hashing | ✅ | Check AuthToken collection |
| Session revocation on reset | ✅ | Stay logged in, reset password |
| Async email (non-blocking) | ✅ | Login should be instant |
| HTTP-only cookies | ✅ | Check browser dev tools |

---

## 📧 Email Templates Preview

### Password Reset Email:
- Header: Purple gradient with "🔐 Reset Your Password"
- Content: User greeting, reset button, expiry warning
- Security notice: Orange alert box
- Footer: Support link, copyright

### Login Notification Email:
- Header: Green gradient with "🔐 New Login Detected"
- Content: Login details table (time, IP, device, browser)
- Security warning: Red alert with "Reset Password" button
- Footer: Support link, copyright

---

## 🎯 Success Criteria

✅ **Password Reset Works When:**
1. User receives email within seconds
2. Reset link opens correct page
3. Token is valid for 1 hour
4. New password is saved
5. Old password no longer works
6. User is logged out from all devices

✅ **Login Notification Works When:**
1. Email sent after every login
2. Contains accurate login details
3. Doesn't block login response
4. Email failure doesn't break login

---

## 🔧 Configuration Checklist

### Backend (`server/.env`):
```bash
✅ SMTP_HOST=smtp.gmail.com
✅ SMTP_PORT=587
✅ SMTP_USER=your-email@gmail.com
✅ SMTP_PASS=yourapppassword (no spaces!)
✅ CLIENT_ORIGIN=http://localhost:5173
✅ JWT_SECRET=your-secret-key
✅ MONGO_URI=mongodb://localhost:27017/devcollab
```

### Frontend (`client/vite.config.ts`):
```typescript
✅ Proxy configured for /api routes
✅ Dev server on port 5173
```

### Routes (`server/src/routes/auth.js`):
```javascript
✅ POST /api/auth/forgot-password
✅ POST /api/auth/request-password-reset  
✅ POST /api/auth/reset-password
✅ Rate limiter applied (20 req/min)
```

---

## 🎓 Developer Notes

### Token Security:
- Plain token sent in email (64 hex chars)
- SHA-256 hash stored in DB
- Even if DB leaked, tokens can't be reversed
- 1-hour expiry minimizes attack window

### Email Enumeration Protection:
- Always return same success message
- Never reveal if email exists
- Attackers can't discover valid accounts
- Server logs truth, client sees generic message

### Async Email Sending:
```javascript
sendLoginNotificationEmail(...)
  .catch(err => console.error(...));
// No await! Doesn't block response
```
- Login returns immediately
- Email happens in background
- Failure doesn't break authentication

---

## 📞 Support

**Still having issues?**

1. Check server console for colored log messages
2. Verify SMTP connection on startup
3. Test in dev mode (console emails) first
4. Check Gmail spam folder
5. Verify user exists in database
6. Ensure both servers are running

**Common Issues:**
- ❌ Spaces in SMTP_PASS → Remove all spaces
- ❌ Regular Gmail password → Use app password
- ❌ Wrong CLIENT_ORIGIN → Must match frontend URL
- ❌ Server not restarted → .env changes need restart

---

**Last Updated:** February 10, 2026  
**Status:** ✅ Production Ready  
**Version:** 2.0.0 (Optimized)
