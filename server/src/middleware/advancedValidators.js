/**
 * Production-ready Request Validation Middleware
 * Provides comprehensive validation with detailed error messages
 */

const { body, param, query, validationResult } = require("express-validator");

/**
 * Handle validation errors
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: "Validation failed",
      details: errors.array().map((err) => ({
        field: err.path,
        message: err.msg,
        value: err.value,
      })),
    });
  }
  next();
};

/**
 * Task validation rules
 */
const validateTaskCreate = [
  body("title")
    .trim()
    .notEmpty()
    .withMessage("Task title is required")
    .isLength({ max: 200 })
    .withMessage("Title cannot exceed 200 characters"),
  body("description")
    .optional()
    .trim()
    .isLength({ max: 5000 })
    .withMessage("Description cannot exceed 5000 characters"),
  body("status")
    .optional()
    .isIn(["todo", "in_progress", "review", "blocked", "done"])
    .withMessage("Invalid status"),
  body("priority")
    .optional()
    .isIn(["low", "medium", "high", "critical"])
    .withMessage("Invalid priority"),
  body("assignees")
    .optional()
    .isArray()
    .withMessage("Assignees must be an array"),
  body("assignees.*")
    .optional()
    .isMongoId()
    .withMessage("Invalid assignee ID"),
  body("labels")
    .optional()
    .isArray()
    .withMessage("Labels must be an array"),
  handleValidationErrors,
];

const validateTaskUpdate = [
  param("taskId").isMongoId().withMessage("Invalid task ID"),
  body("title")
    .optional()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage("Title must be 1-200 characters"),
  body("description")
    .optional()
    .trim()
    .isLength({ max: 5000 })
    .withMessage("Description cannot exceed 5000 characters"),
  body("status")
    .optional()
    .isIn(["todo", "in_progress", "review", "blocked", "done"])
    .withMessage("Invalid status"),
  body("priority")
    .optional()
    .isIn(["low", "medium", "high", "critical"])
    .withMessage("Invalid priority"),
  body("assignees")
    .optional()
    .isArray()
    .withMessage("Assignees must be an array"),
  body("assignees.*")
    .optional()
    .isMongoId()
    .withMessage("Invalid assignee ID"),
  handleValidationErrors,
];

/**
 * PR validation rules
 */
const validatePRCreate = [
  body("projectId").isMongoId().withMessage("Invalid project ID"),
  body("title")
    .trim()
    .notEmpty()
    .withMessage("PR title is required")
    .isLength({ max: 200 })
    .withMessage("Title cannot exceed 200 characters"),
  body("description")
    .optional()
    .trim()
    .isLength({ max: 5000 })
    .withMessage("Description cannot exceed 5000 characters"),
  body("baseBranch")
    .trim()
    .notEmpty()
    .withMessage("Base branch is required")
    .matches(/^[a-zA-Z0-9_\-\/]+$/)
    .withMessage("Invalid branch name format"),
  body("headBranch")
    .trim()
    .notEmpty()
    .withMessage("Head branch is required")
    .matches(/^[a-zA-Z0-9_\-\/]+$/)
    .withMessage("Invalid branch name format"),
  body("reviewers")
    .optional()
    .isArray()
    .withMessage("Reviewers must be an array"),
  body("reviewers.*")
    .optional()
    .isMongoId()
    .withMessage("Invalid reviewer ID"),
  handleValidationErrors,
];

/**
 * Comment validation rules
 */
const validateComment = [
  body("text")
    .trim()
    .notEmpty()
    .withMessage("Comment text is required")
    .isLength({ max: 2000 })
    .withMessage("Comment cannot exceed 2000 characters"),
  handleValidationErrors,
];

/**
 * Project validation rules
 */
const validateProjectCreate = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Project name is required")
    .isLength({ min: 3, max: 120 })
    .withMessage("Project name must be 3-120 characters"),
  body("description")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Description cannot exceed 500 characters"),
  handleValidationErrors,
];

const validateInvite = [
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Invalid email format")
    .normalizeEmail(),
  handleValidationErrors,
];

/**
 * File upload validation
 */
const validateFileUpload = [
  body("name")
    .optional()
    .trim()
    .isLength({ max: 255 })
    .withMessage("File name cannot exceed 255 characters"),
  handleValidationErrors,
];

/**
 * MongoDB ID validation
 */
const validateMongoId = (paramName) => [
  param(paramName).isMongoId().withMessage(`Invalid ${paramName}`),
  handleValidationErrors,
];

/**
 * Pagination validation
 */
const validatePagination = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer")
    .toInt(),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100")
    .toInt(),
  handleValidationErrors,
];

/**
 * Search/filter validation
 */
const validateTaskFilters = [
  query("status")
    .optional()
    .isIn(["todo", "in_progress", "review", "blocked", "done"])
    .withMessage("Invalid status filter"),
  query("priority")
    .optional()
    .isIn(["low", "medium", "high", "critical"])
    .withMessage("Invalid priority filter"),
  query("assignee")
    .optional()
    .isMongoId()
    .withMessage("Invalid assignee ID"),
  query("search")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Search query too long"),
  handleValidationErrors,
];

module.exports = {
  handleValidationErrors,
  validateTaskCreate,
  validateTaskUpdate,
  validatePRCreate,
  validateComment,
  validateProjectCreate,
  validateInvite,
  validateFileUpload,
  validateMongoId,
  validatePagination,
  validateTaskFilters,
};
