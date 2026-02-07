const validator = require("validator");
const sanitizeHtml = require("sanitize-html");

const sanitizeString = (value) => validator.escape(String(value || "").trim());

const sanitizeRichText = (value) => {
  return sanitizeHtml(String(value || "").trim(), {
    allowedTags: ["b", "i", "em", "strong", "a", "code", "pre"],
    allowedAttributes: {
      a: ["href", "target", "rel"],
    },
    allowedSchemes: ["http", "https", "mailto"],
  });
};

const normalizeEmail = (email) => {
  const normalized = validator.normalizeEmail(String(email || "").trim(), {
    all_lowercase: true,
  });
  return normalized || String(email || "").trim().toLowerCase();
};

const isValidEmail = (email) => validator.isEmail(String(email || "").trim());

module.exports = {
  sanitizeString,
  sanitizeRichText,
  normalizeEmail,
  isValidEmail,
};
