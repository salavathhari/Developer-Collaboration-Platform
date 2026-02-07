const crypto = require("crypto");

const hashWithSecret = (value) => {
  const secret = process.env.JWT_REFRESH_SECRET || "";
  if (secret) {
    return crypto.createHmac("sha256", secret).update(value).digest("hex");
  }
  return crypto.createHash("sha256").update(value).digest("hex");
};

const createRefreshToken = (ttlMs) => {
  const token = crypto.randomBytes(48).toString("hex");
  const tokenHash = hashWithSecret(token);
  const expiresAt = new Date(Date.now() + ttlMs);

  return { token, tokenHash, expiresAt };
};

const hashRefreshToken = (token) => hashWithSecret(String(token));

const isExpired = (expiresAt) => expiresAt && expiresAt <= new Date();

module.exports = {
  createRefreshToken,
  hashRefreshToken,
  isExpired,
};
