const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const sendValidationError = (res, errors) => {
  return res.status(400).json({ message: "Validation failed", errors });
};

const validateRegister = (req, res, next) => {
  const { name, email, password } = req.body;
  const errors = [];

  if (!name || String(name).trim().length < 2) {
    errors.push({ field: "name", message: "Name is required" });
  }

  if (!email || !isValidEmail(String(email).trim())) {
    errors.push({ field: "email", message: "Valid email is required" });
  }

  if (!password || String(password).length < 8) {
    errors.push({
      field: "password",
      message: "Password must be at least 8 characters",
    });
  }

  if (errors.length > 0) {
    return sendValidationError(res, errors);
  }

  return next();
};

const validateLogin = (req, res, next) => {
  const { email, password } = req.body;
  const errors = [];

  if (!email || !isValidEmail(String(email).trim())) {
    errors.push({ field: "email", message: "Valid email is required" });
  }

  if (!password) {
    errors.push({ field: "password", message: "Password is required" });
  }

  if (errors.length > 0) {
    return sendValidationError(res, errors);
  }

  return next();
};

module.exports = {
  validateRegister,
  validateLogin,
};
