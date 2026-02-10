const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

class S3Service {
  constructor() {
    this.client = new S3Client({
      region: process.env.S3_REGION || "us-east-1",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });
    this.bucket = process.env.S3_BUCKET;
  }

  /**
   * Upload a buffer to S3
   * @param {Buffer} buffer - File buffer
   * @param {string} destinationPath - S3 key path
   * @param {string} mimeType - MIME type
   * @returns {Promise<{url: string, storageKey: string, size: number, mimeType: string}>}
   */
  async uploadBuffer(buffer, destinationPath, mimeType) {
    if (!this.bucket) {
      throw new Error("S3_BUCKET environment variable not set");
    }

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: destinationPath,
      Body: buffer,
      ContentType: mimeType,
      ServerSideEncryption: "AES256",
    });

    await this.client.send(command);

    // Generate public URL (works if bucket is public)
    // or use signed URL for private buckets
    const url = `https://${this.bucket}.s3.${process.env.S3_REGION || "us-east-1"}.amazonaws.com/${destinationPath}`;

    return {
      url,
      storageKey: destinationPath,
      size: buffer.length,
      mimeType,
    };
  }

  /**
   * Delete a file from S3
   * @param {string} storageKey - S3 key
   * @returns {Promise<void>}
   */
  async delete(storageKey) {
    if (!this.bucket) {
      throw new Error("S3_BUCKET environment variable not set");
    }

    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: storageKey,
    });

    await this.client.send(command);
  }

  /**
   * Get a signed URL for secure access
   * @param {string} storageKey - S3 key
   * @param {number} expiresIn - Expiration in seconds (default 300)
   * @returns {Promise<string>}
   */
  async getSignedUrl(storageKey, expiresIn = 300) {
    if (!this.bucket) {
      throw new Error("S3_BUCKET environment variable not set");
    }

    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: storageKey,
    });

    return getSignedUrl(this.client, command, { expiresIn });
  }

  /**
   * Check if service is properly configured
   * @returns {boolean}
   */
  isConfigured() {
    return !!(
      process.env.AWS_ACCESS_KEY_ID &&
      process.env.AWS_SECRET_ACCESS_KEY &&
      process.env.S3_BUCKET
    );
  }
}

module.exports = new S3Service();
