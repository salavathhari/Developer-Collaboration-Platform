# 🚀 Quick Reference - Auth Features

## ⚡ Quick Commands

### Start Servers
```bash
# Terminal 1 - Backend
cd server && npm start

# Terminal 2 - Frontend  
cd client && npm run dev
```

### Check SMTP Status
Look for on server startup:
- ✅ Green: `SMTP connection successful - Ready to send emails`
- ❌ Red: `SMTP connection failed` → Check credentials
- ⚠️ Yellow: `SMTP not configured` → Dev mode (console emails)

---

## 🔗 Quick Links

| Feature | URL |
|---------|-----|
| Login | http://localhost:5173/login |
| Forgot Password | http://localhost:5173/forgot-password |
| Reset Password | http://localhost:5173/reset-password?token=XXX |
| Signup | http://localhost:5173/signup |

---

## 📋 API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/auth/forgot-password` | Request reset (alias) |
| POST | `/api/auth/request-password-reset` | Request reset (original) |
| POST | `/api/auth/reset-password` | Reset with token |
| POST | `/api/auth/login` | Login (sends notification) |

---

## ✅ Quick Test

### Test Password Reset (2 minutes)
1. Go to http://localhost:5173/forgot-password
2. Enter: `salavathhari286@gmail.com`
3. Click "Send Reset Link"
4. Check server console for green `✅` messages
5. Check email inbox (+ spam folder)
6. Click reset link
7. Enter new password: `NewPassword123!`
8. Login with new password

### Test Login Notification (30 seconds)
1. Go to http://localhost:5173/login
2. Login with any account
3. Check server console for `🔒` message
4. Check email for "New Login Detected"

---

## 🐛 Quick Fixes

### No Email Received?
```bash
# 1. Check .env (no spaces!)
SMTP_PASS=abcdefghijklmnop

# 2. Restart server
cd server
# Ctrl+C then:
npm start

# 3. Check spam folder
```

### 404 Error?
```bash
# Restart Vite
cd client
# Ctrl+C then:
npm run dev
```

### Invalid Credentials?
```bash
# Get new Gmail App Password:
# 1. https://myaccount.google.com/apppasswords
# 2. Generate new password for "Mail"
# 3. Copy (remove spaces!)
# 4. Update server/.env
# 5. Restart server
```

---

## 📊 Console Colors Guide

| Color | Meaning | Action |
|-------|---------|--------|
| 🟢 Green | Success | All good! |
| 🔵 Blue/Cyan | Info | Normal operation |
| 🟡 Yellow | Warning | Check but not critical |
| 🔴 Red | Error | Fix required |

---

## 🔒 Security Quick Check

- ✅ Rate limiting: 20 requests/minute
- ✅ Token expiry: 1 hour
- ✅ Password strength: 8+ chars, uppercase, number, symbol
- ✅ Email enumeration: Protected (same response always)
- ✅ Token hashing: SHA-256
- ✅ Password hashing: bcrypt cost 12
- ✅ Session invalidation: All devices logged out on reset

---

## 📧 Email Checklist

### If email not received:
- [ ] Check spam/junk folder
- [ ] Verify user exists in database
- [ ] Check server console for `✅` message
- [ ] Verify SMTP credentials (no spaces)
- [ ] Check CLIENT_ORIGIN matches frontend URL
- [ ] Restart server after .env changes

---

## 🎯 Expected Console Output

### Password Reset:
```
[Auth] Password reset requested for: user@example.com
[Auth] User found: John Doe (507f...)
[Auth] Reset token created, expires in 1 hour
✅ Password reset email sent to user@example.com
```

### Login:
```
[Auth] Login successful for: user@example.com
   IP: ::1
   Device: Mozilla/5.0...
🔒 Login notification sent to user@example.com
```

---

## ⚙️ Environment Variables

### Required in `server/.env`:
```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=salavathhari286@gmail.com
SMTP_PASS=yourapppassword
CLIENT_ORIGIN=http://localhost:5173
```

---

## 🎓 Pro Tips

1. **Dev Mode**: If SMTP not configured, URLs printed to console
2. **Copy Token**: Can copy reset URL from console and use directly
3. **Check Spam**: Gmail often filters automated emails
4. **No Spaces**: SMTP_PASS must have NO spaces
5. **Restart**: Always restart server after .env changes
6. **App Password**: Must use Gmail App Password, not regular password

---

**Need detailed guide?** → See `AUTH_FEATURES_TESTING_GUIDE.md`

**Need setup help?** → See `AUTH_SECURITY_FEATURES.md`
