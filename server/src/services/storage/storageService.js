const s3Service = require("./s3Service");
const firebaseService = require("./firebaseService");

/**
 * Storage service abstraction
 * Routes to S3 or Firebase based on STORAGE_PROVIDER env var
 */
class StorageService {
  constructor() {
    this.provider = process.env.STORAGE_PROVIDER || "s3";
    this.service = null;
    this.init();
  }

  init() {
    if (this.provider === "firebase") {
      if (!firebaseService.isConfigured()) {
        console.warn(
          "Firebase Storage not configured, falling back to S3"
        );
        this.provider = "s3";
        this.service = s3Service;
      } else {
        this.service = firebaseService;
      }
    } else {
      if (!s3Service.isConfigured()) {
        console.warn("S3 not configured - file uploads will be disabled");
        console.warn("Set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and S3_BUCKET to enable file uploads");
        this.service = null;
        return;
      }
      this.service = s3Service;
    }

    console.log(`Storage service initialized: ${this.provider}`);
  }

  /**
   * Upload a buffer to storage
   * @param {Buffer} buffer - File buffer
   * @param {string} destinationPath - Storage path
   * @param {string} mimeType - MIME type
   * @returns {Promise<{url: string, storageKey: string, size: number, mimeType: string}>}
   */
  async uploadBuffer(buffer, destinationPath, mimeType) {
    if (!this.service) {
      throw new Error("Storage service not configured. Please set up AWS S3 or Firebase Storage.");
    }
    return this.service.uploadBuffer(buffer, destinationPath, mimeType);
  }

  /**
   * Delete a file from storage
   * @param {string} storageKey - Storage key/path
   *if (!this.service) {
      throw new Error("Storage service not configured");
    }
     @returns {Promise<void>}
   */
  async delete(storageKey) {
    return this.service.delete(storageKey);
  }

  /**
   * Get a signed URL for secure access
   * @param {string} storageKey - Storage key/path
   * @param {number} expiresIn - Expiration in seconds
   *if (!this.service) {
      throw new Error("Storage service not configured");
    }
     @returns {Promise<string>}
   */
  async getSignedUrl(storageKey, expiresIn = 300) {
    return this.service.getSignedUrl(storageKey, expiresIn);
  }

  /**
   * Get current provider name
   * @returns {string}
   */
  getProvider() {
    return this.provider;
  }
}

module.exports = new StorageService();
