const crypto = require("crypto");

const createInviteToken = (ttlMs) => {
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + ttlMs);

  return { token, tokenHash, expiresAt };
};

const hashToken = (token) => {
  return crypto.createHash("sha256").update(token).digest("hex");
};

module.exports = {
  createInviteToken,
  hashToken,
};
