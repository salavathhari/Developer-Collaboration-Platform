const ApiError = require("../utils/ApiError");
const logger = require("../utils/logger");

const errorHandler = (err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  if (err && err.code === 11000) {
    return res.status(409).json({ message: "Email already in use" });
  }

  if (err && err.name === "MulterError") {
    return res.status(400).json({ message: err.message });
  }

  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal server error";
  const errors = err.errors || undefined;

  logger.error({
    message,
    statusCode,
    stack: err.stack,
  });

  return res.status(statusCode).json({ message, errors });
};

const notFoundHandler = (req, res) => {
  return res.status(404).json({ message: "Route not found" });
};

const toApiError = (message, statusCode, errors) => {
  return new ApiError(statusCode || 500, message, errors);
};

module.exports = {
  errorHandler,
  notFoundHandler,
  toApiError,
};
