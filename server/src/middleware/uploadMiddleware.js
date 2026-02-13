const multer = require("multer");
const path = require("path");
const crypto = require("crypto");
const os = require("os");
const fs = require("fs/promises");
const { execFile } = require("child_process");
const { promisify } = require("util");
const logger = require("../utils/logger");

const execFileAsync = promisify(execFile);

// Configuration
const FILE_MAX_BYTES = parseInt(process.env.FILE_MAX_BYTES) || 10 * 1024 * 1024; // 10MB default
const FILE_ALLOWED_TYPES = process.env.FILE_ALLOWED_TYPES
  ? process.env.FILE_ALLOWED_TYPES.split(",")
  : [
      // Images
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "image/svg+xml",
      // Documents
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      // Text/Code
      "text/plain",
      "text/csv",
      "text/html",
      "text/css",
      "text/javascript",
      "application/json",
      "application/xml",
      // Archives
      "application/zip",
      "application/x-zip-compressed",
      "application/x-rar-compressed",
      "application/x-tar",
      "application/gzip",
      // Media
      "video/mp4",
      "video/mpeg",
      "video/quicktime",
      "audio/mpeg",
      "audio/wav",
    ];

// Dangerous extensions to block
const BLOCKED_EXTENSIONS = [
  ".exe",
  ".bat",
  ".cmd",
  ".com",
  ".pif",
  ".scr",
  ".vbs",
  ".js",
  ".jar",
  ".sh",
  ".app",
  ".deb",
  ".rpm",
];

// Antivirus scanning configuration (ClamAV CLI)
const CLAMAV_ENABLED = process.env.CLAMAV_ENABLED === "true";
const CLAMAV_REQUIRED = process.env.CLAMAV_REQUIRED === "true";
const CLAMAV_COMMAND = process.env.CLAMAV_COMMAND || "clamdscan";
const CLAMAV_TIMEOUT_MS = parseInt(process.env.CLAMAV_TIMEOUT_MS, 10) || 15000;
const CLAMAV_ARGS = process.env.CLAMAV_ARGS
  ? process.env.CLAMAV_ARGS.split(",").map((arg) => arg.trim()).filter(Boolean)
  : [];

/**
 * Sanitize filename
 */
const sanitizeFilename = (filename) => {
  // Remove path traversal attempts
  let safe = path.basename(filename);
  
  // Replace special characters
  safe = safe.replace(/[^a-zA-Z0-9._-]/g, "_");
  
  // Limit length
  if (safe.length > 255) {
    const ext = path.extname(safe);
    const name = path.basename(safe, ext);
    safe = name.substring(0, 255 - ext.length) + ext;
  }
  
  return safe;
};

/**
 * Generate unique filename
 */
const generateUniqueFilename = (originalFilename) => {
  const sanitized = sanitizeFilename(originalFilename);
  const ext = path.extname(sanitized);
  const nameWithoutExt = path.basename(sanitized, ext);
  const uniqueId = crypto.randomBytes(8).toString("hex");
  
  return `${uniqueId}_${nameWithoutExt}${ext}`;
};

/**
 * Validate file type and extension
 */
const validateFile = (file) => {
  // Check MIME type
  if (!FILE_ALLOWED_TYPES.includes(file.mimetype)) {
    throw new Error(
      `File type ${file.mimetype} not allowed. Allowed types: ${FILE_ALLOWED_TYPES.join(", ")}`
    );
  }
  
  // Check for dangerous extensions
  const ext = path.extname(file.originalname).toLowerCase();
  if (BLOCKED_EXTENSIONS.includes(ext)) {
    throw new Error(`File extension ${ext} is blocked for security reasons`);
  }
  
  // Check file size
  if (file.size > FILE_MAX_BYTES) {
    throw new Error(
      `File size ${file.size} bytes exceeds maximum ${FILE_MAX_BYTES} bytes`
    );
  }
  
  return true;
};

/**
 * Placeholder antivirus scanner
 * In production, integrate with ClamAV or similar service
 */
const scanForVirus = async (buffer) => {
  if (!CLAMAV_ENABLED) {
    return true;
  }

  const tempName = `upload_${Date.now()}_${crypto.randomBytes(6).toString("hex")}`;
  const tempPath = path.join(os.tmpdir(), tempName);

  try {
    await fs.writeFile(tempPath, buffer);

    const args = ["--stdout", "--no-summary", ...CLAMAV_ARGS, tempPath];
    const { stdout } = await execFileAsync(CLAMAV_COMMAND, args, {
      timeout: CLAMAV_TIMEOUT_MS,
    });

    if (stdout && /FOUND/i.test(stdout)) {
      throw new Error("Virus detected in uploaded file");
    }

    return true;
  } catch (error) {
    if (error && error.code === 1) {
      throw new Error("Virus detected in uploaded file");
    }

    if (error && error.code === "ENOENT") {
      const msg = `ClamAV command not found: ${CLAMAV_COMMAND}`;
      if (CLAMAV_REQUIRED) {
        throw new Error(msg);
      }
      logger.warn({ message: msg });
      return true;
    }

    if (error && error.code === 2) {
      const msg = `ClamAV scan error: ${error.message || "unknown error"}`;
      if (CLAMAV_REQUIRED) {
        throw new Error(msg);
      }
      logger.warn({ message: msg });
      return true;
    }

    if (CLAMAV_REQUIRED) {
      throw new Error("Virus scan failed");
    }

    logger.warn({ message: "Virus scan failed, allowing file", error: error?.message });
    return true;
  } finally {
    await fs.unlink(tempPath).catch(() => undefined);
  }
};

// Configure multer with memory storage
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: FILE_MAX_BYTES,
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    try {
      // Preliminary validation
      const ext = path.extname(file.originalname).toLowerCase();
      if (BLOCKED_EXTENSIONS.includes(ext)) {
        return cb(new Error(`Extension ${ext} is blocked`));
      }
      cb(null, true);
    } catch (error) {
      cb(error);
    }
  },
});

/**
 * Middleware to handle file upload and validation
 */
const handleFileUpload = (fieldName = "file") => {
  return async (req, res, next) => {
    upload.single(fieldName)(req, res, async (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({
            message: `File too large. Maximum size: ${FILE_MAX_BYTES} bytes`,
          });
        }
        return res.status(400).json({ message: err.message });
      } else if (err) {
        return res.status(400).json({ message: err.message });
      }
      
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      
      try {
        // Validate file
        validateFile(req.file);
        
        // Scan for viruses
        await scanForVirus(req.file.buffer);
        
        // Generate safe filename
        const safeFilename = generateUniqueFilename(req.file.originalname);
        
        // Attach metadata to request
        req.fileBuffer = req.file.buffer;
        req.fileMeta = {
          originalName: req.file.originalname,
          safeName: safeFilename,
          mimeType: req.file.mimetype,
          size: req.file.size,
        };
        
        next();
      } catch (error) {
        return res.status(400).json({ message: error.message });
      }
    });
  };
};

module.exports = {
  handleFileUpload,
  sanitizeFilename,
  generateUniqueFilename,
  validateFile,
  FILE_MAX_BYTES,
  FILE_ALLOWED_TYPES,
};
