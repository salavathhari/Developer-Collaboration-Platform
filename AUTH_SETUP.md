# DevCollab Authentication System

Complete production-ready authentication implementation with email verification, password reset, and JWT tokens.

## 🚀 Features

- ✅ User registration with email verification
- ✅ Login with JWT access tokens + HTTP-only refresh tokens
- ✅ Remember me functionality (7 days vs 30 days)
- ✅ Password reset flow
- ✅ Email verification with resend capability
- ✅ Rate limiting on auth endpoints
- ✅ Password strength validation (client + server)
- ✅ Responsive dark UI with Tailwind CSS
- ✅ Automatic token refresh on 401
- ✅ Secure HTTP-only cookies for refresh tokens
- ✅ Accessibility compliant (ARIA labels)

## 📋 Environment Variables

### Backend (.env)

```bash
# Database
MONGO_URI=mongodb://localhost:27017/devcollab

# JWT Secrets
JWT_ACCESS_SECRET=your_access_secret_key_here_min_32_chars
JWT_SECRET=your_fallback_secret_key_here_min_32_chars
ACCESS_TOKEN_EXPIRES=15m

# Server
PORT=5000
NODE_ENV=development
CLIENT_ORIGIN=http://localhost:5173

# Email (SMTP) - Optional for development
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=20
```

### Frontend (.env)

```bash
VITE_API_URL=http://localhost:5000
```

## 🔧 Installation & Setup

### 1. Install Dependencies

**Backend:**
```bash
cd server
npm install
```

**Frontend:**
```bash
cd client
npm install
```

### 2. Install Required Packages

If not already installed, add these to your backend:

```bash
cd server
npm install express-rate-limit nodemailer bcrypt jsonwebtoken cookie-parser
```

### 3. Setup Gmail SMTP (Optional - for email)

For development, emails are logged to console if SMTP is not configured.

To enable real emails:
1. Go to your Google Account settings
2. Enable 2-Factor Authentication
3. Generate an App Password: https://myaccount.google.com/apppasswords
4. Use that password in `SMTP_PASS`

### 4. Database Setup

Ensure MongoDB is running:
```bash
mongod
```

The auth system will automatically create indexes on first run.

### 5. Mount Auth Routes

In your `server/src/app.js`:

```javascript
const authRoutes = require("./routes/auth");

// Mount auth routes
app.use("/api/auth", authRoutes);
```

### 6. Frontend Routes

Add these routes to your React Router:

```tsx
import Register from "./pages/Register";
import VerifyEmail from "./pages/VerifyEmail";
import VerifyEmailPending from "./pages/VerifyEmailPending";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";

// In your router:
<Route path="/register" element={<Register />} />
<Route path="/verify-email" element={<VerifyEmail />} />
<Route path="/verify-email-pending" element={<VerifyEmailPending />} />
<Route path="/forgot-password" element={<ForgotPassword />} />
<Route path="/reset-password" element={<ResetPassword />} />
```

## 🧪 Testing Locally

### 1. Start Backend
```bash
cd server
npm run dev
```

### 2. Start Frontend
```bash
cd client
npm run dev
```

### 3. Test the Flow

**Registration:**
1. Navigate to http://localhost:5173/register
2. Fill in name, email, password
3. Click "Create Account"
4. Check console for verification link (or email inbox if SMTP configured)
5. Click verification link
6. Get redirected to login

**Login:**
1. Navigate to http://localhost:5173/login
2. Enter verified email and password
3. Check "Remember me" for 30-day session (optional)
4. Click "Sign In"
5. Get redirected to /dashboard

**Password Reset:**
1. Click "Forgot password?" on login page
2. Enter your email
3. Check console for reset link (or inbox)
4. Click reset link → set new password
5. Login with new password

## 📁 File Structure

```
server/src/
├── models/
│   ├── User.js (with isVerified field)
│   └── AuthToken.js (for refresh/verify/reset tokens)
├── controllers/
│   └── authController.js (8 endpoints)
├── middleware/
│   └── authMiddleware.js (verifyAccessToken, requireVerified)
├── routes/
│   └── auth.js (rate-limited routes)
└── utils/
    └── emailService.js (nodemailer + templates)

client/src/
├── pages/
│   ├── Register.tsx
│   ├── VerifyEmail.tsx
│   ├── VerifyEmailPending.tsx
│   ├── ForgotPassword.tsx
│   └── ResetPassword.tsx
├── components/
│   ├── AuthLayout.tsx (two-column layout)
│   ├── EmailInput.tsx (real-time validation)
│   └── PasswordInput.tsx (show/hide + strength meter)
├── context/
│   └── AuthContext.tsx (updated for new API)
├── services/
│   ├── api.ts (axios with 401 refresh interceptor)
│   └── authService.ts (login, register, refresh, etc.)
└── __tests__/
    ├── Register.test.tsx
    └── Login.test.tsx
```

## 🔒 Security Features

✅ **bcrypt** password hashing (cost 12)  
✅ **HTTP-only cookies** for refresh tokens (XSS protection)  
✅ **SameSite=Lax** cookies (CSRF protection)  
✅ **Secure cookies** in production (HTTPS only)  
✅ **Rate limiting** (20 requests/min on auth endpoints)  
✅ **Short-lived access tokens** (15 minutes)  
✅ **Long-lived refresh tokens** (7-30 days)  
✅ **Token rotation** on refresh  
✅ **Token revocation** on password reset and logout  
✅ **Password policy** (8+ chars, uppercase, number, symbol)  
✅ **Email enumeration prevention** (same response for existing/non-existing)

## 🎨 UI Features

✅ Two-column layout (form + hero illustration)  
✅ Responsive mobile-first design  
✅ Dark theme with purple accents  
✅ Password strength meter  
✅ Real-time email validation  
✅ Loading states on buttons  
✅ Success/error notifications  
✅ Accessible (ARIA labels, keyboard navigation)  
✅ Smooth animations and transitions  
✅ Logo integration

## 📝 API Endpoints

| Method | Endpoint | Description | Rate Limited |
|--------|----------|-------------|--------------|
| POST | `/api/auth/register` | Create new user | ✅ |
| GET | `/api/auth/verify?token=...` | Verify email | ❌ |
| POST | `/api/auth/login` | Login user | ✅ |
| POST | `/api/auth/refresh` | Get new access token | ❌ |
| POST | `/api/auth/logout` | Revoke refresh token | ❌ |
| POST | `/api/auth/request-password-reset` | Send reset email | ✅ |
| POST | `/api/auth/reset-password` | Reset password | ✅ |
| POST | `/api/auth/resend-verification` | Resend verification email | ✅ |

## 🧪 Running Tests

**Frontend:**
```bash
cd client
npm test
```

Tests cover:
- Form validation
- Password strength calculation
- Login/register flows
- Error handling
- Success states

## 🚀 Production Deployment

1. Set `NODE_ENV=production`
2. Use strong JWT secrets (32+ random characters)
3. Configure real SMTP credentials
4. Set `CLIENT_ORIGIN` to your production domain
5. Enable HTTPS (cookies require Secure flag)
6. Set up MongoDB replica set (for production)
7. Configure environment variables on your hosting platform

## 📖 Usage Examples

### Protected Routes

```tsx
// In your frontend router
import { useAuth } from "./hooks/useAuth";

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) return <div>Loading...</div>;
  if (!user) return <Navigate to="/login" />;

  return children;
}

// Use it:
<Route path="/dashboard" element={
  <ProtectedRoute>
    <Dashboard />
  </ProtectedRoute>
} />
```

### Backend Protected Endpoint

```javascript
const { verifyAccessToken, requireVerified } = require("./middleware/authMiddleware");

// Require valid access token
router.get("/api/projects", verifyAccessToken, getProjects);

// Require valid token + verified email
router.post("/api/projects", verifyAccessToken, requireVerified, createProject);
```

## 🐛 Troubleshooting

**Email not sending:**
- Check SMTP credentials
- For Gmail, use App Password (not regular password)
- Check console logs for preview URL in dev mode

**401 Unauthorized errors:**
- Check JWT_ACCESS_SECRET is set
- Ensure access token is in Authorization header: `Bearer <token>`
- Check token hasn't expired (15m)

**Refresh token not working:**
- Ensure `withCredentials: true` in axios
- Check cookie-parser is installed and used in Express
- Verify CORS allows credentials

**Database connection failed:**
- Ensure MongoDB is running: `mongod`
- Check MONGO_URI in .env

## 📚 Additional Resources

- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [Nodemailer Docs](https://nodemailer.com/)
- [bcrypt Docs](https://github.com/kelektiv/node.bcrypt.js)

---

Built with ❤️ for DevCollab
