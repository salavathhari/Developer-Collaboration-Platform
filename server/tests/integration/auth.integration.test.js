const request = require("supertest");
const app = require("../src/app");
const User = require("../src/models/User");
const AuthToken = require("../src/models/AuthToken");
const bcrypt = require("bcrypt");

describe("Authentication Flow Integration Tests", () => {
  describe("POST /api/auth/register", () => {
    it("should register a new user successfully", async () => {
      const userData = {
        name: "John Doe",
        email: "john@example.com",
        password: "Test@123",
      };

      const response = await request(app)
        .post("/api/auth/register")
        .send(userData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.user.email).toBe(userData.email);
      expect(response.body.user.name).toBe(userData.name);
      expect(response.body.user).not.toHaveProperty("password");

      // Verify user in database
      const user = await User.findOne({ email: userData.email });
      expect(user).toBeTruthy();
      expect(user.isVerified).toBe(false);

      // Verify token created
      const token = await AuthToken.findOne({ userId: user._id, type: "verify" });
      expect(token).toBeTruthy();
    });

    it("should reject registration with weak password", async () => {
      const response = await request(app)
        .post("/api/auth/register")
        .send({
          name: "Test User",
          email: "test@example.com",
          password: "weak",
        })
        .expect(400);

      expect(response.body.error).toContain("Password");
    });

    it("should reject duplicate email", async () => {
      const userData = {
        name: "Test User",
        email: "duplicate@example.com",
        password: "Test@123",
      };

      // First registration
      await request(app).post("/api/auth/register").send(userData).expect(201);

      // Second registration with same email
      const response = await request(app)
        .post("/api/auth/register")
        .send(userData)
        .expect(409);

      expect(response.body.error).toContain("already in use");
    });

    it("should validate email format", async () => {
      const response = await request(app)
        .post("/api/auth/register")
        .send({
          name: "Test User",
          email: "invalid-email",
          password: "Test@123",
        })
        .expect(400);

      expect(response.body.error).toContain("email");
    });
  });

  describe("POST /api/auth/login", () => {
    let testUser;

    beforeEach(async () => {
      testUser = await global.createTestUser(User, {
        email: "login@example.com",
        isVerified: true,
      });
    });

    it("should login successfully with valid credentials", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({
          email: "login@example.com",
          password: "Test@123",
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.accessToken).toBeTruthy();
      expect(response.body.user.email).toBe("login@example.com");

      // Verify refresh token cookie
      const cookies = response.headers["set-cookie"];
      expect(cookies).toBeTruthy();
      expect(cookies.some((cookie) => cookie.includes("refreshToken"))).toBe(true);

      // Verify refresh token in database
      const refreshToken = await AuthToken.findOne({
        userId: testUser._id,
        type: "refresh",
      });
      expect(refreshToken).toBeTruthy();
    });

    it("should reject invalid credentials", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({
          email: "login@example.com",
          password: "WrongPassword",
        })
        .expect(401);

      expect(response.body.error).toContain("Invalid");
    });

    it("should reject non-existent user", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({
          email: "nonexistent@example.com",
          password: "Test@123",
        })
        .expect(401);

      expect(response.body.error).toContain("Invalid");
    });

    it("should set rememberMe cookie correctly", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({
          email: "login@example.com",
          password: "Test@123",
          rememberMe: true,
        })
        .expect(200);

      const cookies = response.headers["set-cookie"];
      const refreshTokenCookie = cookies.find((c) => c.includes("refreshToken"));
      
      // Should have longer expiry for rememberMe
      expect(refreshTokenCookie).toBeTruthy();
    });
  });

  describe("POST /api/auth/request-password-reset", () => {
    let testUser;

    beforeEach(async () => {
      testUser = await global.createTestUser(User, {
        email: "reset@example.com",
      });
    });

    it("should create reset token for valid email", async () => {
      const response = await request(app)
        .post("/api/auth/request-password-reset")
        .send({
          email: "reset@example.com",
        })
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify reset token created
      const resetToken = await AuthToken.findOne({
        userId: testUser._id,
        type: "reset",
      });
      expect(resetToken).toBeTruthy();
      expect(resetToken.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it("should not reveal if email doesn't exist", async () => {
      const response = await request(app)
        .post("/api/auth/request-password-reset")
        .send({
          email: "nonexistent@example.com",
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      // Prevents email enumeration
    });
  });

  describe("POST /api/auth/reset-password", () => {
    let testUser;
    let resetToken;

    beforeEach(async () => {
      const crypto = require("crypto");
      testUser = await global.createTestUser(User, {
        email: "resetpw@example.com",
      });

      const token = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

      await AuthToken.create({
        userId: testUser._id,
        tokenHash,
        type: "reset",
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      });

      resetToken = token;
    });

    it("should reset password with valid token", async () => {
      const newPassword = "NewPassword@123";

      const response = await request(app)
        .post("/api/auth/reset-password")
        .send({
          token: resetToken,
          newPassword,
        })
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify password changed
      const updatedUser = await User.findById(testUser._id).select("+password");
      const isMatch = await bcrypt.compare(newPassword, updatedUser.password);
      expect(isMatch).toBe(true);

      // Verify reset token revoked
      const token = await AuthToken.findOne({
        userId: testUser._id,
        type: "reset",
      });
      expect(token.revokedAt).toBeTruthy();
    });

    it("should reject weak new password", async () => {
      const response = await request(app)
        .post("/api/auth/reset-password")
        .send({
          token: resetToken,
          newPassword: "weak",
        })
        .expect(400);

      expect(response.body.error).toContain("Password");
    });

    it("should reject invalid token", async () => {
      const response = await request(app)
        .post("/api/auth/reset-password")
        .send({
          token: "invalid-token",
          newPassword: "NewPassword@123",
        })
        .expect(400);

      expect(response.body.error).toContain("Invalid or expired");
    });
  });

  describe("POST /api/auth/refresh", () => {
    let testUser;
    let refreshToken;

    beforeEach(async () => {
      const crypto = require("crypto");
      testUser = await global.createTestUser(User);

      const token = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

      await AuthToken.create({
        userId: testUser._id,
        tokenHash,
        type: "refresh",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      refreshToken = token;
    });

    it("should issue new access token with valid refresh token", async () => {
      const response = await request(app)
        .post("/api/auth/refresh")
        .set("Cookie", [`refreshToken=${refreshToken}`])
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.accessToken).toBeTruthy();
    });

    it("should reject missing refresh token", async () => {
      const response = await request(app).post("/api/auth/refresh").expect(401);

      expect(response.body.error).toContain("Refresh token");
    });
  });

  describe("POST /api/auth/logout", () => {
    let testUser;
    let refreshToken;

    beforeEach(async () => {
      const crypto = require("crypto");
      testUser = await global.createTestUser(User);

      const token = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

      await AuthToken.create({
        userId: testUser._id,
        tokenHash,
        type: "refresh",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      refreshToken = token;
    });

    it("should logout and revoke refresh token", async () => {
      const response = await request(app)
        .post("/api/auth/logout")
        .set("Cookie", [`refreshToken=${refreshToken}`])
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify token revoked
      const token = await AuthToken.findOne({
        userId: testUser._id,
        type: "refresh",
      });
      expect(token.revokedAt).toBeTruthy();

      // Verify cookie cleared
      const cookies = response.headers["set-cookie"];
      expect(cookies.some((c) => c.includes("refreshToken=;"))).toBe(true);
    });
  });
});
