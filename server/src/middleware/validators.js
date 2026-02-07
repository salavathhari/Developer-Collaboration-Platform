const { sanitizeString, normalizeEmail, isValidEmail } = require("../utils/sanitize");

const sendValidationError = (res, errors) => {
  return res.status(400).json({ message: "Validation failed", errors });
};

const validateRegister = (req, res, next) => {
  const errors = [];
  const name = sanitizeString(req.body.name);
  const email = normalizeEmail(req.body.email);
  const password = String(req.body.password || "");

  if (!name || name.length < 2) {
    errors.push({ field: "name", message: "Name is required" });
  }

  if (!email || !isValidEmail(email)) {
    errors.push({ field: "email", message: "Valid email is required" });
  }

  if (!password || password.length < 8) {
    errors.push({ field: "password", message: "Password must be at least 8 characters" });
  }

  if (errors.length > 0) {
    return sendValidationError(res, errors);
  }

  req.body = { name, email, password };
  return next();
};

const validateLogin = (req, res, next) => {
  const errors = [];
  const email = normalizeEmail(req.body.email);
  const password = String(req.body.password || "");

  if (!email || !isValidEmail(email)) {
    errors.push({ field: "email", message: "Valid email is required" });
  }

  if (!password) {
    errors.push({ field: "password", message: "Password is required" });
  }

  if (errors.length > 0) {
    return sendValidationError(res, errors);
  }

  req.body = { email, password };
  return next();
};

const validateProfileUpdate = (req, res, next) => {
  const errors = [];
  const name = req.body.name ? sanitizeString(req.body.name) : undefined;
  const email = req.body.email ? normalizeEmail(req.body.email) : undefined;
  const bio = req.body.bio ? sanitizeString(req.body.bio) : undefined;

  if (name && name.length < 2) {
    errors.push({ field: "name", message: "Name must be at least 2 characters" });
  }

  if (email && !isValidEmail(email)) {
    errors.push({ field: "email", message: "Valid email is required" });
  }

  if (bio && bio.length > 280) {
    errors.push({ field: "bio", message: "Bio must be under 280 characters" });
  }

  if (errors.length > 0) {
    return sendValidationError(res, errors);
  }

  req.body = {
    ...(name !== undefined ? { name } : {}),
    ...(email !== undefined ? { email } : {}),
    ...(bio !== undefined ? { bio } : {}),
  };

  return next();
};

const validateProjectCreate = (req, res, next) => {
  const errors = [];
  const name = sanitizeString(req.body.name);
  const description = req.body.description
    ? sanitizeString(req.body.description)
    : "";

  if (!name || name.length < 3) {
    errors.push({ field: "name", message: "Project name is required" });
  }

  if (description && description.length > 500) {
    errors.push({ field: "description", message: "Description is too long" });
  }

  if (errors.length > 0) {
    return sendValidationError(res, errors);
  }

  req.body = { name, description };
  return next();
};

const validateInvite = (req, res, next) => {
  const errors = [];
  const email = req.body.email ? normalizeEmail(req.body.email) : undefined;

  if (!email) {
    errors.push({ field: "email", message: "Email is required" });
  } else if (!isValidEmail(email)) {
    errors.push({ field: "email", message: "Valid email is required" });
  }

  if (errors.length > 0) {
    return sendValidationError(res, errors);
  }

  req.body = { ...(email ? { email } : {}) };
  return next();
};

const validateInviteAccept = (req, res, next) => {
  const token = String(req.body.token || "").trim();

  if (!token || token.length < 10) {
    return sendValidationError(res, [
      { field: "token", message: "Invite token is required" },
    ]);
  }

  req.body = { token };
  return next();
};

const validateMemberRole = (req, res, next) => {
  const role = String(req.body.role || "");
  const allowed = ["owner", "member"];

  if (!allowed.includes(role)) {
    return sendValidationError(res, [
      { field: "role", message: "Role must be owner or member" },
    ]);
  }

  req.body = { role };
  return next();
};

module.exports = {
  validateRegister,
  validateLogin,
  validateProfileUpdate,
  validateProjectCreate,
  validateInvite,
  validateInviteAccept,
  validateMemberRole,
};
