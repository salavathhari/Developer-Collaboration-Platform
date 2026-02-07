const path = require("path");

const FileAsset = require("../models/FileAsset");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { logActivity } = require("../utils/activity");

const uploadFile = asyncHandler(async (req, res) => {
  const { projectId } = req.params;

  if (!req.file) {
    throw new ApiError(400, "File is required");
  }

  const uploadDir = process.env.UPLOAD_DIR || "uploads";
  const url = `/${uploadDir}/files/${req.file.filename}`;

  const file = await FileAsset.create({
    projectId,
    uploaderId: req.user.id,
    filename: req.file.originalname,
    url,
    size: req.file.size,
    mimeType: req.file.mimetype,
  });

  await logActivity({
    projectId,
    actorId: req.user.id,
    type: "fileUploaded",
    payload: { fileId: file.id, filename: file.filename },
  });

  const io = req.app.get("io");
  if (io) {
    io.to(projectId).emit("file_uploaded", { file });
  }

  return res.status(201).json({ file });
});

const getSignedUrl = asyncHandler(async (req, res) => {
  if (!process.env.S3_BUCKET || !process.env.S3_REGION) {
    throw new ApiError(400, "S3 is not configured");
  }

  let s3Client;
  let getSignedUrl;
  let PutObjectCommand;

  try {
    ({ S3Client: s3Client, PutObjectCommand } = require("@aws-sdk/client-s3"));
    ({ getSignedUrl } = require("@aws-sdk/s3-request-presigner"));
  } catch {
    throw new ApiError(500, "AWS SDK not installed");
  }

  const { filename, contentType } = req.body;
  if (!filename || !contentType) {
    throw new ApiError(400, "filename and contentType required");
  }

  const client = new s3Client({ region: process.env.S3_REGION });
  const key = `${req.params.projectId}/${Date.now()}-${filename}`;
  const command = new PutObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: key,
    ContentType: contentType,
  });

  const url = await getSignedUrl(client, command, { expiresIn: 60 });

  return res.status(200).json({ url, key });
});

const getFiles = asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const files = await FileAsset.find({ projectId })
    .sort({ createdAt: -1 })
    .populate("uploaderId", "name email avatar");

  return res.status(200).json({ files });
});

module.exports = {
  uploadFile,
  getSignedUrl,
  getFiles,
};
