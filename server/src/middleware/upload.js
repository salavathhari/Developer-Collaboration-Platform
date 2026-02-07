const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");

const uploadDir = process.env.UPLOAD_DIR || "uploads";
const avatarDir = path.join(process.cwd(), uploadDir, "avatars");
const fileDir = path.join(process.cwd(), uploadDir, "files");

fs.mkdirSync(avatarDir, { recursive: true });
fs.mkdirSync(fileDir, { recursive: true });

const storage = multer.diskStorage({
  destination: avatarDir,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const name = `${crypto.randomBytes(16).toString("hex")}${ext}`;
    cb(null, name);
  },
});

const fileFilter = (req, file, cb) => {
  if (!file.mimetype.startsWith("image/")) {
    return cb(new Error("Only image uploads are allowed"));
  }
  return cb(null, true);
};

const uploadAvatar = multer({
  storage,
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 },
}).single("avatar");

const fileStorage = multer.diskStorage({
  destination: fileDir,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const name = `${crypto.randomBytes(16).toString("hex")}${ext}`;
    cb(null, name);
  },
});

const uploadProjectFile = multer({
  storage: fileStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
}).single("file");

module.exports = {
  uploadAvatar,
  uploadProjectFile,
  avatarDir,
  fileDir,
};
